import { GoogleGenAI, Type, Schema } from "@google/genai";
import { DiagramData } from "../types";

const STORAGE_KEY = 'econgraph_api_key';

// Simple obfuscation to avoid plain-text keys in localStorage.
// This is NOT encryption — true encryption is impossible when the
// decryption key must also live client-side. The purpose is to
// prevent casual exposure (e.g. shoulder-surfing DevTools).
const OBFUSCATION_PREFIX = 'egk_';

function obfuscate(key: string): string {
  return OBFUSCATION_PREFIX + btoa(key);
}

function deobfuscate(stored: string): string {
  if (!stored.startsWith(OBFUSCATION_PREFIX)) return stored;
  return atob(stored.slice(OBFUSCATION_PREFIX.length));
}

export function saveApiKey(key: string): void {
  if (!key.trim()) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, obfuscate(key.trim()));
}

export function getApiKey(): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return '';
  try {
    return deobfuscate(stored);
  } catch {
    return '';
  }
}

export function hasApiKey(): boolean {
  return getApiKey().length > 0;
}

export function clearApiKey(): void {
  localStorage.removeItem(STORAGE_KEY);
}

const diagramSchema: Schema = {
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

export async function generateDiagramData(prompt: string, history: string[] = []): Promise<DiagramData> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API key not configured. Please add your Google AI Studio API key in Settings.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-2.5-flash";

  // Convert history to a text context block
  const historyContext = history.length > 0
    ? `Previous context:\n${history.join("\n")}\n\nCurrent Request:`
    : "Request:";

  const systemInstruction = `
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

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `${historyContext} ${prompt}`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: diagramSchema,
        temperature: 0.2, // Lower temperature for better math consistency
      }
    });

    const jsonText = response.text || "{}";
    const data = JSON.parse(jsonText) as DiagramData;
    return data;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to generate diagram data. Please try again.");
  }
}
