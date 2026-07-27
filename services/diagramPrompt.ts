import { Type, Schema } from "@google/genai";

// Shared between the browser (BYOK Gemini provider) and the serverless hosted
// AI endpoint (api/generate.ts). Keep this module free of browser-only APIs.

export const DIAGRAM_SYSTEM_INSTRUCTION = `
  You are an expert Economics Professor and SVG Graph Generator.
  Your goal is to generate precise coordinate data for economic diagrams based on user prompts.

  Rules for generation:
  1. Coordinate System: Use a logical scale (e.g., 0-10 or 0-100). Keep it consistent.
  2. Accuracy: Calculate intersection points mathematically. If Supply is P = 10 + Q and Demand is P = 100 - Q, Equilibrium is Q=45, P=55.
  3. Shared Coordinates (CRITICAL):
     - If an equilibrium point E is at (50, 50), ensuring the Supply Curve, Demand Curve, and any Shaded Regions ALL use the exact coordinate (50, 50).
     - Do not approximate. If a shaded region (e.g., Consumer Surplus) is bounded by the Price axis, Demand curve, and Equilibrium price, the vertices must strictly match the curve points.
  4. Shading:
     - Provide a closed polygon for shaded areas.
  5. Labels:
     - Use LaTeX-style formatting for subscripts and superscripts.
     - Example: "P_1", "Q^*", "Q_{tax}", "D_{private}".
  6. Context:
     - If the user asks for "Monopoly", ensure MR is below D.
     - If the user asks for "Tax", shift the appropriate curve.

  Output purely the JSON object matching the schema.
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
