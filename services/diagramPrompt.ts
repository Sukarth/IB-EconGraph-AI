import { Type, Schema } from "@google/genai";

// Shared between the browser (BYOK Gemini provider) and the serverless hosted
// AI endpoint (api/generate.ts). Keep this module free of browser-only APIs.

/**
 * The economics rules every provider shares. Only the closing output
 * instruction differs between them, so that part is appended per provider
 * below rather than the whole prompt being copied.
 */
const DIAGRAM_RULES = `
  You are an expert Economics Professor and SVG Graph Generator.
  Your goal is to generate precise coordinate data for economic diagrams based on user prompts.

  Rules for generation:
  1. Coordinate System: Use a logical scale (e.g., 0-10 or 0-100). Keep it consistent.
  2. Accuracy: Calculate intersection points mathematically. If Supply is P = 10 + Q and Demand is P = 100 - Q, Equilibrium is Q=45, P=55.
  3. Shared Coordinates (CRITICAL):
     - If an equilibrium point E is at (50, 50), ensure the Supply Curve, Demand Curve, and any Shaded Regions ALL use the exact coordinate (50, 50).
     - Do not approximate. If a shaded region (e.g., Consumer Surplus) is bounded by the Price axis, Demand curve, and Equilibrium price, the vertices must strictly match the curve points.
  4. Shading:
     - Provide a closed polygon for shaded areas.
  5. Labels:
     - Use LaTeX-style formatting for subscripts and superscripts.
     - Example: "P_1", "Q^*", "Q_{tax}", "D_{private}".
  6. Context:
     - If the user asks for "Monopoly", ensure MR is below D.
     - If the user asks for "Tax", shift the appropriate curve.
`;

/** Gemini (BYOK and hosted): the response schema below enforces the shape. */
export const DIAGRAM_SYSTEM_INSTRUCTION = `${DIAGRAM_RULES}
  Output purely the JSON object matching the schema.
  `;

/**
 * OpenRouter: an arbitrary model behind a plain chat completion, with no
 * server-side schema enforcement, so the shape has to be spelled out and prose
 * and markdown fences explicitly ruled out.
 */
export const OPENROUTER_SYSTEM_INSTRUCTION = `${DIAGRAM_RULES}
  Output requirements (STRICT):
  - Output ONLY a JSON object (no prose).
  - Do NOT wrap in markdown.
  - The JSON must match the DiagramData shape used by this app: { title, summary, xAxis, yAxis, curves, annotatedPoints, shadedRegions }.
  `;

export const GEMINI_DIAGRAM_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title of the economic diagram" },
    summary: { type: Type.STRING, description: "Brief explanation of what the diagram shows" },
    xAxis: {
      type: Type.OBJECT,
      properties: {
        label: { type: Type.STRING, description: "Label for X axis (e.g. Quantity)" },
        min: { type: Type.NUMBER, description: "Always 0 usually" },
        max: { type: Type.NUMBER, description: "Scale maximum, usually 10 or 100" }
      },
      required: ["label", "min", "max"]
    },
    yAxis: {
      type: Type.OBJECT,
      properties: {
        label: { type: Type.STRING, description: "Label for Y axis (e.g. Price)" },
        min: { type: Type.NUMBER },
        max: { type: Type.NUMBER }
      },
      required: ["label", "min", "max"]
    },
    curves: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          label: { type: Type.STRING, description: "Label like D, S, MC, ATC. Use _ for subscript (D_1) and ^ for superscript." },
          color: { type: Type.STRING, description: "Hex code. Use standard colors: Red #ef4444 for Demand/Marginal Benefit, Blue #3b82f6 for Supply/MC, etc." },
          type: { type: Type.STRING, enum: ["linear", "bezier", "vertical", "horizontal"] },
          width: { type: Type.NUMBER, description: "Stroke width, default 2" },
          strokeDasharray: { type: Type.STRING, description: "Optional, e.g. '5,5' for dashed" },
          points: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER }
              },
              required: ["x", "y"]
            },
            description: "2 points for linear, 3 points for bezier (start, control, end)"
          }
        },
        required: ["id", "label", "color", "type", "points", "width"]
      }
    },
    annotatedPoints: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          x: { type: Type.NUMBER },
          y: { type: Type.NUMBER },
          label: { type: Type.STRING, description: "e.g. E_1, P^*, Q_0. Use _ for subscript and ^ for superscript." },
          labelPosition: { type: Type.STRING, enum: ["top", "bottom", "left", "right", "top-right", "top-left", "bottom-right", "bottom-left"] },
          showDottedLines: { type: Type.BOOLEAN, description: "If true, draws dotted lines to both axes" },
          color: { type: Type.STRING }
        },
        required: ["x", "y", "label", "showDottedLines"]
      }
    },
    shadedRegions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          label: { type: Type.STRING, description: "Label for the area (e.g. DWL, CS, PS)" },
          color: { type: Type.STRING, description: "RGBA color string, e.g., 'rgba(239, 68, 68, 0.2)'" },
          points: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER }
              },
              required: ["x", "y"]
            },
            description: "Ordered vertices of the polygon to fill."
          }
        },
        required: ["id", "label", "color", "points"]
      }
    }
  },
  required: ["title", "xAxis", "yAxis", "curves", "annotatedPoints", "shadedRegions", "summary"]
};

export function buildHistoryContext(history: string[]): string {
  return history.length > 0
    ? `Previous context:\n${history.join("\n")}\n\nCurrent Request:`
    : "Request:";
}

/**
 * Runtime shape check for a model-produced diagram, shared by every provider
 * (hosted `api/generate`, the hosted client, BYOK Gemini, OpenRouter).
 *
 * A response-schema request is a strong hint, not a guarantee: OpenRouter has no
 * schema at all, and even Gemini can return a truncated or partial object. The
 * renderer reads `curves[].points[].x` and scales by `xAxis.max - xAxis.min`
 * without guarding, so a missing array or a non-finite bound throws or produces
 * NaN geometry rather than a usable error. Checking the axis objects alone (the
 * previous test) let all of that through.
 *
 * Returns null when valid, or a short reason for logging.
 */
export function diagramShapeError(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "not an object";
  const d = value as Record<string, unknown>;

  for (const key of ["title", "summary"] as const) {
    if (typeof d[key] !== "string") return `${key} is not a string`;
  }

  for (const key of ["xAxis", "yAxis"] as const) {
    const axis = d[key];
    if (!axis || typeof axis !== "object" || Array.isArray(axis)) return `${key} is missing`;
    const a = axis as Record<string, unknown>;
    if (typeof a.label !== "string") return `${key}.label is not a string`;
    if (typeof a.min !== "number" || !Number.isFinite(a.min)) return `${key}.min is not finite`;
    if (typeof a.max !== "number" || !Number.isFinite(a.max)) return `${key}.max is not finite`;
    // Equal bounds would make the renderer divide by a zero-width range.
    if (a.max <= a.min) return `${key}.max is not greater than ${key}.min`;
  }

  for (const key of ["curves", "annotatedPoints", "shadedRegions"] as const) {
    if (!Array.isArray(d[key])) return `${key} is not an array`;
  }

  const hasFinitePoints = (points: unknown): boolean =>
    Array.isArray(points) &&
    points.every(
      (p) =>
        !!p &&
        typeof p === "object" &&
        Number.isFinite((p as { x?: unknown }).x as number) &&
        Number.isFinite((p as { y?: unknown }).y as number),
    );

  for (const curve of d.curves as unknown[]) {
    if (!curve || typeof curve !== "object") return "a curve is not an object";
    const c = curve as Record<string, unknown>;
    // A curve with no usable geometry renders as nothing at best and throws at
    // worst, so treat it as a failed generation rather than a blank diagram.
    if (!hasFinitePoints(c.points) || (c.points as unknown[]).length < 2) {
      return "a curve has fewer than two finite points";
    }
  }

  for (const region of d.shadedRegions as unknown[]) {
    if (!region || typeof region !== "object") return "a shaded region is not an object";
    if (!hasFinitePoints((region as Record<string, unknown>).points)) {
      return "a shaded region has non-finite points";
    }
  }

  for (const point of d.annotatedPoints as unknown[]) {
    if (!point || typeof point !== "object") return "an annotated point is not an object";
    const p = point as Record<string, unknown>;
    if (!Number.isFinite(p.x as number) || !Number.isFinite(p.y as number)) {
      return "an annotated point has non-finite coordinates";
    }
  }

  return null;
}
