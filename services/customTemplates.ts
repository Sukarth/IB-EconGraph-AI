import { supabase } from './supabaseClient';
import { DiagramData } from '../types';
import { isRlsDenied } from './cloudErrors';

export interface CustomTemplate {
    id: string;
    name: string;
    description: string;
    data: Partial<DiagramData>;
    createdAt: number;
}

const CACHE_KEY = 'econgraph_custom_templates_v1';

// The cache is tagged with its owning user so it can never be shown to a
// different (or signed-out) account on a shared browser.
interface TemplateCache {
    userId: string;
    templates: CustomTemplate[];
}

function readCache(userId: string): CustomTemplate[] {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as TemplateCache;
        if (parsed?.userId !== userId || !Array.isArray(parsed.templates)) return [];
        return parsed.templates;
    } catch {
        return [];
    }
}

function writeCache(userId: string, templates: CustomTemplate[]): void {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ userId, templates } satisfies TemplateCache));
    } catch { /* quota — cache is best-effort */ }
}

/** Clear the local template cache (call on sign-out). */
export function clearTemplateCache(): void {
    try {
        localStorage.removeItem(CACHE_KEY);
    } catch { /* ignore */ }
}

/** Instant, offline-friendly read of the local cache for a specific user. */
export function listCachedTemplates(userId: string): CustomTemplate[] {
    return readCache(userId);
}

/** Pull the authoritative list from the cloud and refresh the cache. */
export async function fetchCustomTemplates(userId: string): Promise<CustomTemplate[]> {
    if (!supabase) return readCache(userId);
    const { data, error } = await supabase
        .from('templates')
        .select('id, name, description, data, last_modified')
        .order('last_modified', { ascending: false });
    if (error) return readCache(userId);
    const templates: CustomTemplate[] = (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        data: row.data as Partial<DiagramData>,
        createdAt: row.last_modified,
    }));
    writeCache(userId, templates);
    return templates;
}

/** Extract reusable content from the current diagram. */
export function templateDataFromDiagram(diagram: DiagramData): Partial<DiagramData> {
    return {
        curves: diagram.curves,
        shadedRegions: diagram.shadedRegions,
        annotatedPoints: diagram.annotatedPoints,
        textLabels: diagram.textLabels ?? [],
    };
}

export async function saveCustomTemplate(
    userId: string,
    input: { name: string; description?: string; data: Partial<DiagramData> },
): Promise<{ template?: CustomTemplate; error?: string }> {
    if (!supabase) return { error: 'Custom templates are not available on this deployment.' };
    const template: CustomTemplate = {
        id: crypto.randomUUID(),
        name: input.name.trim(),
        description: input.description?.trim() ?? '',
        data: input.data,
        createdAt: Date.now(),
    };
    if (!template.name) return { error: 'Please give the template a name.' };

    const { error } = await supabase.from('templates').insert({
        id: template.id,
        user_id: userId,
        name: template.name,
        description: template.description,
        category: 'custom',
        data: template.data,
        last_modified: template.createdAt,
    });
    if (error) {
        if (isRlsDenied(error.message)) {
            return { error: 'Custom templates are part of the Supporter plan.' };
        }
        return { error: error.message };
    }
    writeCache(userId, [template, ...readCache(userId)]);
    return { template };
}

export async function deleteCustomTemplate(userId: string, id: string): Promise<{ error?: string }> {
    if (!supabase) return { error: 'Custom templates are not available on this deployment.' };
    const { error } = await supabase.from('templates').delete().eq('id', id);
    if (error) return { error: error.message };
    writeCache(userId, readCache(userId).filter((t) => t.id !== id));
    return {};
}

export interface CloudVersion {
    id: string;
    graphId: string;
    title: string;
    data: unknown;
    lastModified: number;
    createdAt: string;
}

/** Version history for a graph (Supporter feature; newest first). */
export async function fetchGraphVersions(graphId: string): Promise<CloudVersion[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('graph_versions')
        .select('id, graph_id, title, data, last_modified, created_at')
        .eq('graph_id', graphId)
        .order('created_at', { ascending: false })
        .limit(30);
    if (error) return [];
    return (data ?? []).map((row) => ({
        id: row.id,
        graphId: row.graph_id,
        title: row.title,
        data: row.data,
        lastModified: row.last_modified,
        createdAt: row.created_at,
    }));
}
