import { supabase } from './supabaseClient';
import { DiagramData, Graph, Project } from '../types';
import { isRlsDenied } from './cloudErrors';

export interface SharedGraphEntry {
    id: string;
    title: string;
    caption?: string;
    diagramData: DiagramData;
}

export interface GraphSharePayload {
    kind: 'graph';
    title: string;
    caption?: string;
    diagramData: DiagramData;
}

export interface ProjectSharePayload {
    kind: 'project';
    name: string;
    graphs: SharedGraphEntry[];
}

export type SharePayload = GraphSharePayload | ProjectSharePayload;

export function shareUrl(shareId: string): string {
    return `${window.location.origin}/s/${shareId}`;
}

/** 24 hex chars (96 bits) — unguessable slug. */
export function newShareSlug(): string {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Shares never include chat history — diagram content only. */
export function graphSharePayload(graph: Graph): GraphSharePayload {
    return {
        kind: 'graph',
        title: graph.diagramData.title || graph.title,
        caption: graph.caption || graph.diagramData.caption,
        diagramData: graph.diagramData,
    };
}

export function projectSharePayload(project: Project, graphs: Graph[]): ProjectSharePayload {
    return {
        kind: 'project',
        name: project.name,
        graphs: graphs
            .filter((g) => g.projectId === project.id)
            .map((g) => ({
                id: g.id,
                title: g.diagramData.title || g.title,
                caption: g.caption || g.diagramData.caption,
                diagramData: g.diagramData,
            })),
    };
}

/** Postgres unique_violation — the one-share-per-content indexes fired. */
function isDuplicateShare(error: { code?: string; message?: string }): boolean {
    return error.code === '23505' || /duplicate key value/i.test(error.message ?? '');
}

/**
 * Look up the existing share for a piece of content, keeping "none exists"
 * distinct from "the lookup failed". Callers that mint a new slug MUST NOT
 * treat a failure as "none": that would create a second share row for the same
 * content, and revoking the one the UI shows would leave the other link live.
 */
async function findShareId(
    kind: 'graph' | 'project',
    column: 'graph_id' | 'project_id',
    contentId: string,
): Promise<{ id: string | null; failed: boolean }> {
    if (!supabase) return { id: null, failed: true };
    const { data, error } = await supabase
        .from('shares')
        .select('id')
        .eq('kind', kind)
        .eq(column, contentId)
        .limit(1)
        .maybeSingle();
    if (error) return { id: null, failed: true };
    return { id: data?.id ?? null, failed: false };
}

export async function getShareIdForGraph(graphId: string): Promise<string | null> {
    if (!supabase) return null;
    const { data } = await supabase
        .from('shares')
        .select('id')
        .eq('kind', 'graph')
        .eq('graph_id', graphId)
        .limit(1)
        .maybeSingle();
    return data?.id ?? null;
}

export async function getShareIdForProject(projectId: string): Promise<string | null> {
    if (!supabase) return null;
    const { data } = await supabase
        .from('shares')
        .select('id')
        .eq('kind', 'project')
        .eq('project_id', projectId)
        .limit(1)
        .maybeSingle();
    return data?.id ?? null;
}

export async function createOrUpdateGraphShare(userId: string, graph: Graph): Promise<{ id?: string; error?: string }> {
    if (!supabase) return { error: 'Sharing is not available on this deployment.' };
    const existing = await findShareId('graph', 'graph_id', graph.id);
    if (existing.failed) {
        return { error: 'Could not check for an existing link right now. Please try again in a moment.' };
    }
    const id = existing.id ?? newShareSlug();
    const { error } = await supabase.from('shares').upsert({
        id,
        user_id: userId,
        kind: 'graph',
        graph_id: graph.id,
        project_id: null,
        payload: graphSharePayload(graph),
        updated_at: new Date().toISOString(),
    });
    if (error) {
        // Lost a race: another tab created the link between our lookup and this
        // insert, and the one-share-per-graph index rejected the second slug.
        // Hand back the link that won rather than surfacing a database error.
        if (isDuplicateShare(error)) {
            const winner = await findShareId('graph', 'graph_id', graph.id);
            if (winner.id) return { id: winner.id };
        }
        return { error: friendlyShareError(error.message) };
    }
    return { id };
}

export async function createOrUpdateProjectShare(
    userId: string,
    project: Project,
    graphs: Graph[],
): Promise<{ id?: string; error?: string }> {
    if (!supabase) return { error: 'Sharing is not available on this deployment.' };
    const existing = await findShareId('project', 'project_id', project.id);
    if (existing.failed) {
        return { error: 'Could not check for an existing link right now. Please try again in a moment.' };
    }
    const id = existing.id ?? newShareSlug();
    const { error } = await supabase.from('shares').upsert({
        id,
        user_id: userId,
        kind: 'project',
        graph_id: null,
        project_id: project.id,
        payload: projectSharePayload(project, graphs),
        updated_at: new Date().toISOString(),
    });
    if (error) {
        if (isDuplicateShare(error)) {
            const winner = await findShareId('project', 'project_id', project.id);
            if (winner.id) return { id: winner.id };
        }
        return { error: friendlyShareError(error.message) };
    }
    return { id };
}

export async function revokeShare(shareId: string): Promise<{ error?: string }> {
    if (!supabase) return { error: 'Sharing is not available on this deployment.' };
    const { error } = await supabase.from('shares').delete().eq('id', shareId);
    return error ? { error: error.message } : {};
}

/**
 * Public fetch — works without a session (anyone with the link). Reads through
 * the get_share() RPC so the shares table stays non-enumerable by anon.
 * Throws on transport/database errors so callers can distinguish "not found"
 * (null) from "couldn't load" (throw).
 */
export async function fetchSharedPayload(slug: string): Promise<SharePayload | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('get_share', { p_id: slug });
    if (error) throw new Error(error.message);
    if (!data) return null;
    return data as SharePayload;
}

function friendlyShareError(message: string): string {
    if (isRlsDenied(message)) {
        return 'Sharing links are part of the Supporter plan.';
    }
    return message;
}
