import { GoogleGenAI } from "@google/genai";
import { DiagramData } from "../types";
import { DIAGRAM_SYSTEM_INSTRUCTION, GEMINI_DIAGRAM_SCHEMA, buildHistoryContext } from "./diagramPrompt";
import { obfuscateKey, deobfuscateKey } from "./keyObfuscation";

const STORAGE_KEY = 'econgraph_api_key';
const MODEL_STORAGE_KEY = 'econgraph_selected_model';

export function saveApiKey(key: string): void {
  if (!key.trim()) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, obfuscateKey(key.trim()));
}

export function getApiKey(): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return '';
  try {
    return deobfuscateKey(stored);
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

// Model management
export function saveSelectedModel(modelName: string): void {
  localStorage.setItem(MODEL_STORAGE_KEY, modelName);
}

export function getSelectedModel(): string {
  return localStorage.getItem(MODEL_STORAGE_KEY) || 'gemini-2.5-flash';
}

export function clearSelectedModel(): void {
  localStorage.removeItem(MODEL_STORAGE_KEY);
}

export interface ModelInfo {
  name: string;
  displayName: string;
  description?: string;
  supportedGenerationMethods?: string[];
}

export async function fetchAvailableModels(): Promise<ModelInfo[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API key not configured");
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const data = await response.json();

    // Filter for models that support generateContent
    const models: ModelInfo[] = (data.models || [])
      .filter((model: any) =>
        model.supportedGenerationMethods?.includes('generateContent')
      )
      .map((model: any) => ({
        name: model.name.replace('models/', ''),
        displayName: model.displayName || model.name,
        description: model.description,
        supportedGenerationMethods: model.supportedGenerationMethods
      }))
      .sort((a: ModelInfo, b: ModelInfo) => a.displayName.localeCompare(b.displayName));

    return models;
  } catch (error) {
    console.error("Error fetching models:", error);
    throw error;
  }
}

export async function generateDiagramData(prompt: string, history: string[] = []): Promise<DiagramData> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API key not configured. Please add your Google AI Studio API key in Settings.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = getSelectedModel();

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `${buildHistoryContext(history)} ${prompt}`,
      config: {
        systemInstruction: DIAGRAM_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: GEMINI_DIAGRAM_SCHEMA,
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
