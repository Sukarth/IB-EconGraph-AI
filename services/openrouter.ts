import { DiagramData } from '../types';
import { obfuscateKey, deobfuscateKey } from './keyObfuscation';

const STORAGE_KEY = 'econgraph_openrouter_api_key';
const MODEL_STORAGE_KEY = 'econgraph_openrouter_selected_model';

export function saveOpenRouterApiKey(key: string): void {
    if (!key.trim()) {
        localStorage.removeItem(STORAGE_KEY);
        return;
    }
    localStorage.setItem(STORAGE_KEY, obfuscateKey(key.trim()));
}

export function getOpenRouterApiKey(): string {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return '';
    try {
        return deobfuscateKey(stored);
    } catch {
        return '';
    }
}

export function hasOpenRouterApiKey(): boolean {
    return getOpenRouterApiKey().length > 0;
}

export function clearOpenRouterApiKey(): void {
    localStorage.removeItem(STORAGE_KEY);
}

export interface OpenRouterModelInfo {
    id: string;
    name: string;
    pricing?: { prompt?: string; completion?: string };
    context_length?: number;
    max_output_length?: number;
    supported_features?: string[];
    supported_parameters?: string[];
    // Some OpenRouter responses include an explicit boolean.
    supports_structured_outputs?: boolean;
}

function supportsStructuredOutputs(model: OpenRouterModelInfo): boolean {
    const supportedFeatures = (model.supported_features ?? []).map((s) => s.toLowerCase());
    const supportedParameters = (model.supported_parameters ?? []).map((s) => s.toLowerCase());

    // Only include models that explicitly advertise structured outputs support.
    return (
        model.supports_structured_outputs === true ||
        supportedFeatures.includes('structured_outputs') ||
        supportedParameters.includes('structured_outputs') ||
        supportedParameters.includes('json_schema')
    );
}

export async function fetchOpenRouterModels(): Promise<OpenRouterModelInfo[]> {
    const apiKey = getOpenRouterApiKey();
    if (!apiKey) {
        throw new Error('API key not configured');
    }

    try {
        const response = await fetch('https://openrouter.ai/api/v1/models', {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch models: ${response.statusText}`);
        }

        const data = (await response.json()) as { data: OpenRouterModelInfo[] };
        const models = data.data || [];

        // Filter for models that support structured outputs.
        const filtered = models.filter(supportsStructuredOutputs);

        return filtered.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
        console.error('Error fetching OpenRouter models:', error);
        throw error;
    }
}

const diagramDataJsonSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        title: { type: 'string' },
        summary: { type: 'string' },
        caption: { type: 'string' },
        xAxis: {
            type: 'object',
            additionalProperties: false,
            properties: {
                label: { type: 'string' },
                min: { type: 'number' },
                max: { type: 'number' },
            },
            required: ['label', 'min', 'max'],
        },
        yAxis: {
            type: 'object',
            additionalProperties: false,
            properties: {
                label: { type: 'string' },
                min: { type: 'number' },
                max: { type: 'number' },
            },
            required: ['label', 'min', 'max'],
        },
        curves: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    id: { type: 'string' },
                    label: { type: 'string' },
                    color: { type: 'string' },
                    type: { type: 'string', enum: ['linear', 'bezier', 'vertical', 'horizontal'] },
                    width: { type: 'number' },
                    strokeDasharray: { type: 'string' },
                    locked: { type: 'boolean' },
                    fontSize: { type: 'number' },
                    points: {
                        type: 'array',
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                x: { type: 'number' },
                                y: { type: 'number' },
                            },
                            required: ['x', 'y'],
                        },
                    },
                },
                required: ['id', 'label', 'color', 'type', 'width', 'points'],
            },
        },
        annotatedPoints: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    x: { type: 'number' },
                    y: { type: 'number' },
                    label: { type: 'string' },
                    labelPosition: {
                        type: 'string',
                        enum: ['top', 'bottom', 'left', 'right', 'top-right', 'top-left', 'bottom-right', 'bottom-left'],
                    },
                    showDottedLines: { type: 'boolean' },
                    color: { type: 'string' },
                    linkedCurveIds: { type: 'array', items: { type: 'string' } },
                    fontSize: { type: 'number' },
                },
                required: ['x', 'y', 'label', 'showDottedLines'],
            },
        },
        shadedRegions: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    id: { type: 'string' },
                    label: { type: 'string' },
                    color: { type: 'string' },
                    linkedPointIds: { type: 'array', items: { type: 'string' } },
                    points: {
                        type: 'array',
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                x: { type: 'number' },
                                y: { type: 'number' },
                            },
                            required: ['x', 'y'],
                        },
                    },
                },
                required: ['id', 'label', 'color', 'points'],
            },
        },
        textLabels: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    id: { type: 'string' },
                    x: { type: 'number' },
                    y: { type: 'number' },
                    text: { type: 'string' },
                    fontSize: { type: 'number' },
                    color: { type: 'string' },
                    fontWeight: { type: 'string', enum: ['normal', 'bold'] },
                },
                required: ['id', 'x', 'y', 'text'],
            },
        },
    },
    required: ['title', 'summary', 'xAxis', 'yAxis', 'curves', 'annotatedPoints', 'shadedRegions'],
} as const;

export function saveOpenRouterSelectedModel(modelName: string): void {
    const value = modelName.trim();
    if (!value) {
        localStorage.removeItem(MODEL_STORAGE_KEY);
        return;
    }
    localStorage.setItem(MODEL_STORAGE_KEY, value);
}

export function getOpenRouterSelectedModel(): string {
    return localStorage.getItem(MODEL_STORAGE_KEY) || '';
}

export function clearOpenRouterSelectedModel(): void {
    localStorage.removeItem(MODEL_STORAGE_KEY);
}

function extractJsonCandidate(text: string): string {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) return fenced[1].trim();

    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        return text.slice(firstBrace, lastBrace + 1).trim();
    }

    return text.trim();
}

export async function generateDiagramDataOpenRouter(prompt: string, history: string[] = []): Promise<DiagramData> {
    const apiKey = getOpenRouterApiKey();
    if (!apiKey) {
        throw new Error('API key not configured. Please add your OpenRouter API key in Settings.');
    }

    const model = getOpenRouterSelectedModel();
    if (!model.trim()) {
        throw new Error('No OpenRouter model selected. Please choose a model in Settings before using OpenRouter.');
    }

    const historyContext = history.length > 0
        ? `Previous context:\n${history.join('\n')}\n\nCurrent Request:`
        : 'Request:';

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

Output requirements (STRICT):
- Output ONLY a JSON object (no prose).
- Do NOT wrap in markdown.
- The JSON must match the DiagramData shape used by this app: { title, summary, xAxis, yAxis, curves, annotatedPoints, shadedRegions }.
`;

    const baseBody: any = {
        model,
        temperature: 0.2,
        messages: [
            { role: 'system', content: systemInstruction.trim() },
            { role: 'user', content: `${historyContext} ${prompt}` },
        ],
    };

    const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
    };

    // Optional headers recommended by OpenRouter for rankings.
    try {
        headers['HTTP-Referer'] = window.location.origin;
        headers['X-Title'] = 'IB EconGraph AI';
    } catch {
        // ignore
    }

    const tryRequest = async (body: any) => {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            const error = new Error(`OpenRouter request failed (${response.status}): ${text || response.statusText}`);
            (error as any).status = response.status;
            (error as any).raw = text;
            throw error;
        }

        return response.json() as Promise<any>;
    };

    const parseDiagram = (data: any): DiagramData => {
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content === 'object' && content !== null) {
            return content as DiagramData;
        }

        if (typeof content !== 'string' || !content.trim()) {
            throw new Error('OpenRouter returned an unexpected response.');
        }

        const candidate = extractJsonCandidate(content);
        try {
            return JSON.parse(candidate) as DiagramData;
        } catch (error) {
            console.error('OpenRouter JSON parse error:', error, { content });
            throw new Error('Failed to parse model output as JSON. Try again or use a different model.');
        }
    };

    // Prefer Structured Outputs (JSON Schema). If the model/router rejects it, fall back to JSON mode.
    try {
        const data = await tryRequest({
            ...baseBody,
            response_format: {
                type: 'json_schema',
                json_schema: {
                    name: 'diagram_data',
                    strict: true,
                    schema: diagramDataJsonSchema,
                },
            },
        });
        return parseDiagram(data);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const looksLikeStructuredOutputUnsupported = /structured|json_schema|response_format/i.test(message);
        if (!looksLikeStructuredOutputUnsupported) throw error;

        const data = await tryRequest({
            ...baseBody,
            response_format: {
                type: 'json_object',
            },
        });
        return parseDiagram(data);
    }
}
