import { supabase } from './supabaseClient';
import { graphSharePayload, projectSharePayload } from './shares';
import { Graph, Project } from '../types';
import { isRlsDenied } from './cloudErrors';

// ─────────────────────────────────────────────────────────────────────────────
// Local-first cloud sync (Supporter feature).
//
// localStorage remains the working store; this module reconciles it with
// Supabase using last-write-wins on the client's `lastModified` timestamps.
// Deletions are tracked with tombstones on both sides so a delete on one
// device doesn't get resurrected by a stale copy on another.
// ─────────────────────────────────────────────────────────────────────────────

const TOMBSTONE_KEY = 'econgraph_tombstones_v1';
const TOMBSTONE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const VERSIONS_TO_KEEP = 30;

// Content hash of each graph's last version snapshot, so we don't write a fresh
// full snapshot when only last_modified changed (rename, re-parenting, re-import,
// idempotent autosave). graph_versions is the fastest-growing table on the free
// tier, and these duplicates are pure waste. Per-device/best-effort: a cleared
// store just means one extra snapshot.
const VERSION_HASH_KEY = 'econgraph_version_hashes_v1';

function loadVersionHashes(): Record<string, string> {
    try {
        const raw = localStorage.getItem(VERSION_HASH_KEY);
        if (raw) return JSON.parse(raw) as Record<string, string>;
    } catch { /* corrupted — start fresh */ }
    return {};
}

function saveVersionHashes(map: Record<string, string>): void {
    try {
        localStorage.setItem(VERSION_HASH_KEY, JSON.stringify(map));
    } catch { /* quota — best-effort */ }
}

// Graphs whose snapshot insert failed, and shares whose refresh failed. Both
// are best-effort steps that run only for rows touched by the current sync, so
// without a record of the failure a later sync that happens to touch nothing
// would never retry them and the work would be lost for good.
const PENDING_VERSIONS_KEY = 'econgraph_pending_versions_v1';
const PENDING_SHARES_KEY = 'econgraph_pending_share_refresh_v1';

function loadPendingVersionIds(): Set<string> {
    try {
        const raw = localStorage.getItem(PENDING_VERSIONS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return new Set(parsed.filter((v) => typeof v === 'string'));
        }
    } catch { /* corrupted — start fresh */ }
    return new Set();
}

function savePendingVersionIds(ids: Set<string>): void {
    try {
        if (ids.size === 0) localStorage.removeItem(PENDING_VERSIONS_KEY);
        else localStorage.setItem(PENDING_VERSIONS_KEY, JSON.stringify([...ids]));
    } catch { /* quota — best-effort */ }
}

function sharesRefreshPending(): boolean {
    try {
        return localStorage.getItem(PENDING_SHARES_KEY) === '1';
    } catch {
        return false;
    }
}

function setSharesRefreshPending(pending: boolean): void {
    try {
        if (pending) localStorage.setItem(PENDING_SHARES_KEY, '1');
        else localStorage.removeItem(PENDING_SHARES_KEY);
    } catch { /* quota — best-effort */ }
}

/** Small, fast, non-cryptographic content hash (djb2). Collisions only cost a
 *  skipped snapshot, so a cheap hash is fine here. */
function contentHash(s: string): string {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return h.toString(36);
}

/**
 * Fingerprint of the parts a version snapshot exists to preserve. Hashing the
 * whole `Graph` defeated the dedup entirely: it includes `lastModified`, which
 * every autosave rewrites, so no push ever compared equal and a duplicate
 * snapshot was written on each sync.
 */
function versionFingerprint(g: Graph): string {
    return contentHash(JSON.stringify({
        diagramData: g.diagramData,
        title: g.title,
        caption: g.caption,
    }));
}

interface TombstoneStore {
    graphs: Record<string, number>;
    projects: Record<string, number>;
}

function loadTombstones(): TombstoneStore {
    try {
        const raw = localStorage.getItem(TOMBSTONE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            return {
                graphs: parsed.graphs ?? {},
                projects: parsed.projects ?? {},
            };
        }
    } catch { /* corrupted store — start fresh */ }
    return { graphs: {}, projects: {} };
}

function saveTombstones(store: TombstoneStore): void {
    const cutoff = Date.now() - TOMBSTONE_MAX_AGE_MS;
    for (const kind of ['graphs', 'projects'] as const) {
        for (const [id, ts] of Object.entries(store[kind])) {
            if (ts < cutoff) delete store[kind][id];
        }
    }
    try {
        localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(store));
    } catch { /* quota — tombstones are best-effort */ }
}

/** Call whenever graphs/projects are deleted locally so sync can propagate it. */
export function recordTombstones(kind: 'graphs' | 'projects', ids: string[]): void {
    if (ids.length === 0) return;
    const store = loadTombstones();
    const now = Date.now();
    for (const id of ids) store[kind][id] = now;
    saveTombstones(store);
}

/**
 * Remove tombstones for the given ids (e.g. when a backup import restores them),
 * so a live row and a tombstone for the same id are never queued together.
 */
export function clearTombstones(kind: 'graphs' | 'projects', ids: string[]): void {
    if (ids.length === 0) return;
    const store = loadTombstones();
    let changed = false;
    for (const id of ids) {
        if (store[kind][id] !== undefined) {
            delete store[kind][id];
            changed = true;
        }
    }
    if (changed) saveTombstones(store);
}

/**
 * Fetch the ids of the signed-in user's live (non-deleted) cloud graphs and
 * projects. Backup restore uses this so "replace everything" can also tombstone
 * cloud rows that exist only on another device and were never pulled here —
 * otherwise the next sync would resurrect them. RLS scopes the result to the
 * caller's own rows. Returns null when cloud is unavailable (offline / not
 * configured / not signed in), in which case the local-only behaviour applies.
 */
export async function fetchCloudIds(): Promise<{ graphIds: string[]; projectIds: string[] } | null> {
    if (!supabase) return null;
    try {
        const [graphsRes, projectsRes] = await Promise.all([
            supabase.from('graphs').select('id').eq('deleted', false),
            supabase.from('projects').select('id').eq('deleted', false),
        ]);
        if (graphsRes.error || projectsRes.error) return null;
        return {
            graphIds: (graphsRes.data ?? []).map((r) => (r as { id: string }).id),
            projectIds: (projectsRes.data ?? []).map((r) => (r as { id: string }).id),
        };
    } catch {
        return null;
    }
}

// ── Remote row shapes ────────────────────────────────────────────────────────

interface RemoteGraphRow {
    id: string;
    user_id?: string;
    project_id: string | null;
    title: string;
    data: Graph | Record<string, never>;
    created_at_ms: number;
    last_modified: number;
    deleted: boolean;
}

interface RemoteProjectRow {
    id: string;
    user_id?: string;
    name: string;
    description: string;
    color: string;
    created_at_ms: number;
    last_modified: number;
    deleted: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(id: string): boolean {
    return UUID_RE.test(id);
}

/**
 * Remote ids are uuid columns; data imported from very old backups may have
 * non-uuid ids. Remap them (and graph→project references) before syncing.
 */
export function remapNonUuidIds(graphs: Graph[], projects: Project[]): {
    graphs: Graph[]; projects: Project[]; changed: boolean;
} {
    let changed = false;
    const projectIdMap = new Map<string, string>();

    const newProjects = projects.map((p) => {
        if (isUuid(p.id)) return p;
        changed = true;
        const newId = crypto.randomUUID();
        projectIdMap.set(p.id, newId);
        return { ...p, id: newId };
    });

    const newGraphs = graphs.map((g) => {
        let next = g;
        if (g.projectId && projectIdMap.has(g.projectId)) {
            next = { ...next, projectId: projectIdMap.get(g.projectId) };
            changed = true;
        }
        if (!isUuid(next.id)) {
            next = { ...next, id: crypto.randomUUID() };
            changed = true;
        }
        return next;
    });

    return { graphs: newGraphs, projects: newProjects, changed };
}

export interface SyncOutcome {
    graphs: Graph[];
    projects: Project[];
    /** True when local state differs from what was passed in (apply it). */
    changedLocal: boolean;
    pushed: number;
    pulled: number;
}

function graphToRow(g: Graph, userId: string): RemoteGraphRow {
    return {
        id: g.id,
        user_id: userId,
        project_id: g.projectId && isUuid(g.projectId) ? g.projectId : null,
        title: g.diagramData?.title || g.title || '',
        data: g,
        created_at_ms: g.createdAt ?? 0,
        last_modified: g.lastModified ?? 0,
        deleted: false,
    };
}

function projectToRow(p: Project, userId: string): RemoteProjectRow {
    return {
        id: p.id,
        user_id: userId,
        name: p.name,
        description: p.description ?? '',
        color: p.color ?? '#3b82f6',
        created_at_ms: p.createdAt ?? 0,
        last_modified: p.lastModified ?? 0,
        deleted: false,
    };
}

// Tombstone rows must carry the FULL column set for their table. postgrest-js
// upserts batch rows together and sends any key missing from a row as NULL, so
// a partial tombstone batched with a full alive row would write NULL into a
// NOT NULL column (e.g. created_at_ms) and the whole upsert fails.
function graphTombstoneRow(id: string, userId: string, deletedAt: number): RemoteGraphRow {
    // Content is wiped on deletion. The graph's version history is removed by
    // the graphs_purge_versions_on_delete trigger (see supabase/schema.sql),
    // so it happens server-side no matter which client performed the delete.
    return {
        id, user_id: userId, project_id: null, title: '', data: {},
        created_at_ms: 0, last_modified: deletedAt, deleted: true,
    };
}

function projectTombstoneRow(id: string, userId: string, deletedAt: number): RemoteProjectRow {
    return {
        id, user_id: userId, name: '', description: '', color: '#3b82f6',
        created_at_ms: 0, last_modified: deletedAt, deleted: true,
    };
}

/**
 * Reconcile local graphs/projects with the cloud. Throws on hard failures
 * (network, RLS) with a user-presentable message.
 */
export async function syncCloud(userId: string, localGraphsIn: Graph[], localProjectsIn: Project[]): Promise<SyncOutcome> {
    if (!supabase) throw new Error('Cloud sync is not available on this deployment.');

    const remap = remapNonUuidIds(localGraphsIn, localProjectsIn);
    const localGraphs = remap.graphs;
    const localProjects = remap.projects;
    let changedLocal = remap.changed;

    const tombs = loadTombstones();

    const [graphRes, projectRes] = await Promise.all([
        supabase.from('graphs').select('id, project_id, title, data, created_at_ms, last_modified, deleted'),
        supabase.from('projects').select('id, name, description, color, created_at_ms, last_modified, deleted'),
    ]);
    if (graphRes.error) throw new Error(friendlySyncError(graphRes.error.message));
    if (projectRes.error) throw new Error(friendlySyncError(projectRes.error.message));

    const remoteGraphs = (graphRes.data ?? []) as RemoteGraphRow[];
    const remoteProjects = (projectRes.data ?? []) as RemoteProjectRow[];

    let pushed = 0;
    let pulled = 0;

    // ── Projects ──
    const projectRows: RemoteProjectRow[] = [];
    const projectTombRows: RemoteProjectRow[] = [];
    const projectTombIds = new Set<string>(); // guard against pushing an id twice (ON CONFLICT 21000)
    const finalProjects = new Map<string, Project>(localProjects.map((p) => [p.id, p]));
    const remoteProjectMap = new Map(remoteProjects.map((r) => [r.id, r]));

    for (const remote of remoteProjects) {
        const local = finalProjects.get(remote.id);
        if (remote.deleted) {
            if (local) {
                if ((local.lastModified ?? 0) > remote.last_modified) {
                    projectRows.push(projectToRow(local, userId)); // resurrect
                } else {
                    finalProjects.delete(remote.id);
                    changedLocal = true;
                }
            }
            delete tombs.projects[remote.id]; // server already knows
            continue;
        }
        if (local) {
            if (remote.last_modified > (local.lastModified ?? 0)) {
                finalProjects.set(remote.id, {
                    id: remote.id,
                    name: remote.name,
                    description: remote.description,
                    color: remote.color,
                    createdAt: remote.created_at_ms,
                    lastModified: remote.last_modified,
                });
                changedLocal = true;
                pulled++;
            } else if (remote.last_modified < (local.lastModified ?? 0)) {
                projectRows.push(projectToRow(local, userId));
            }
        } else {
            const tombTs = tombs.projects[remote.id];
            if (tombTs && tombTs >= remote.last_modified) {
                projectTombRows.push(projectTombstoneRow(remote.id, userId, tombTs));
                projectTombIds.add(remote.id);
            } else {
                finalProjects.set(remote.id, {
                    id: remote.id,
                    name: remote.name,
                    description: remote.description,
                    color: remote.color,
                    createdAt: remote.created_at_ms,
                    lastModified: remote.last_modified,
                });
                changedLocal = true;
                pulled++;
            }
        }
    }
    for (const local of finalProjects.values()) {
        if (!remoteProjectMap.has(local.id)) {
            projectRows.push(projectToRow(local, userId));
        }
    }
    // A tombstone for an id that is alive locally is stale: the row came back
    // after the delete was recorded (pulled from another device, restored from
    // a backup, resurrected above). Left in place it never expires, and if the
    // timestamps line up the catch-all below queues a tombstone for an id this
    // same batch is upserting as alive — which Postgres rejects with "ON
    // CONFLICT DO UPDATE command cannot affect row a second time", failing the
    // whole sync.
    for (const id of finalProjects.keys()) delete tombs.projects[id];

    // Tombstones for local deletions the server hasn't heard about yet.
    for (const [id, ts] of Object.entries(tombs.projects)) {
        if (projectTombIds.has(id)) continue; // already queued above
        const remote = remoteProjectMap.get(id);
        if (remote && !remote.deleted && remote.last_modified <= ts) {
            projectTombRows.push(projectTombstoneRow(id, userId, ts));
            projectTombIds.add(id);
        }
    }

    // ── Graphs ──
    const graphRows: RemoteGraphRow[] = [];
    const graphTombRows: RemoteGraphRow[] = [];
    const graphTombIds = new Set<string>();
    const finalGraphs = new Map<string, Graph>(localGraphs.map((g) => [g.id, g]));
    const remoteGraphMap = new Map(remoteGraphs.map((r) => [r.id, r]));

    const remoteRowToGraph = (row: RemoteGraphRow): Graph | null => {
        const data = row.data as Graph;
        if (!data || typeof data !== 'object' || !data.diagramData) return null;
        return { ...data, id: row.id, lastModified: row.last_modified };
    };

    for (const remote of remoteGraphs) {
        const local = finalGraphs.get(remote.id);
        if (remote.deleted) {
            if (local) {
                if ((local.lastModified ?? 0) > remote.last_modified) {
                    graphRows.push(graphToRow(local, userId)); // resurrect
                } else {
                    finalGraphs.delete(remote.id);
                    changedLocal = true;
                }
            }
            delete tombs.graphs[remote.id];
            continue;
        }
        if (local) {
            if (remote.last_modified > (local.lastModified ?? 0)) {
                const pulledGraph = remoteRowToGraph(remote);
                if (pulledGraph) {
                    finalGraphs.set(remote.id, pulledGraph);
                    changedLocal = true;
                    pulled++;
                }
            } else if (remote.last_modified < (local.lastModified ?? 0)) {
                graphRows.push(graphToRow(local, userId));
            }
        } else {
            const tombTs = tombs.graphs[remote.id];
            if (tombTs && tombTs >= remote.last_modified) {
                graphTombRows.push(graphTombstoneRow(remote.id, userId, tombTs));
                graphTombIds.add(remote.id);
            } else {
                const pulledGraph = remoteRowToGraph(remote);
                if (pulledGraph) {
                    finalGraphs.set(remote.id, pulledGraph);
                    changedLocal = true;
                    pulled++;
                }
            }
        }
    }
    for (const local of finalGraphs.values()) {
        if (!remoteGraphMap.has(local.id)) {
            graphRows.push(graphToRow(local, userId));
        }
    }
    // Same stale-tombstone sweep as for projects above.
    for (const id of finalGraphs.keys()) delete tombs.graphs[id];

    for (const [id, ts] of Object.entries(tombs.graphs)) {
        if (graphTombIds.has(id)) continue; // already queued above
        const remote = remoteGraphMap.get(id);
        if (remote && !remote.deleted && remote.last_modified <= ts) {
            graphTombRows.push(graphTombstoneRow(id, userId, ts));
            graphTombIds.add(id);
        }
    }

    // ── Push ──
    const projectUpserts = [...projectRows, ...projectTombRows];
    if (projectUpserts.length > 0) {
        const { error } = await supabase.from('projects').upsert(projectUpserts as never[]);
        if (error) throw new Error(friendlySyncError(error.message));
        pushed += projectUpserts.length;
    }
    const graphUpserts = [...graphRows, ...graphTombRows];
    if (graphUpserts.length > 0) {
        const { error } = await supabase.from('graphs').upsert(graphUpserts as never[]);
        if (error) throw new Error(friendlySyncError(error.message));
        pushed += graphUpserts.length;
    }

    saveTombstones(tombs);

    // ── Version snapshots for pushed (alive) graphs ──
    // Retries first: a graph whose snapshot insert failed on an earlier sync is
    // not necessarily pushed again (it needs no further edits), so without this
    // its revision would be lost permanently.
    const pendingVersionIds = loadPendingVersionIds();
    const versionCandidates = [...graphRows];
    const queuedIds = new Set(graphRows.map((r) => r.id));
    for (const id of pendingVersionIds) {
        if (queuedIds.has(id)) continue;
        const graph = finalGraphs.get(id);
        if (graph) versionCandidates.push(graphToRow(graph, userId));
        else pendingVersionIds.delete(id); // graph is gone; nothing to snapshot
    }

    if (versionCandidates.length > 0) {
        // Only snapshot graphs whose content actually changed since their last
        // version — skip pushes that merely bumped last_modified, so identical
        // snapshots don't pile up in the free-tier DB.
        const hashes = loadVersionHashes();
        const changedRows = versionCandidates.filter((row) => {
            const h = versionFingerprint(row.data as Graph);
            if (hashes[row.id] === h && !pendingVersionIds.has(row.id)) return false;
            hashes[row.id] = h;
            return true;
        });
        if (changedRows.length > 0) {
            const versionRows = changedRows.map((row) => ({
                graph_id: row.id,
                user_id: userId,
                title: row.title,
                data: row.data,
                last_modified: row.last_modified,
            }));
            const { error } = await supabase.from('graph_versions').insert(versionRows as never[]);
            if (error) {
                // Queue for the next sync rather than dropping the revision.
                for (const row of changedRows) pendingVersionIds.add(row.id);
            } else {
                for (const row of changedRows) pendingVersionIds.delete(row.id);
                saveVersionHashes(hashes);
                // Independent per-graph prunes — run them concurrently instead of a
                // serial round-trip each, which stalls the debounced sync path.
                await Promise.all(
                    changedRows.map((row) =>
                        supabase!.rpc('prune_graph_versions', { p_graph: row.id, p_keep: VERSIONS_TO_KEEP }),
                    ),
                );
            }
        }
    }
    savePendingVersionIds(pendingVersionIds);

    // ── Keep share links fresh, drop shares of deleted content ──
    await refreshShares(
        userId,
        finalGraphs,
        finalProjects,
        graphRows,
        projectRows,
        graphTombRows.map((r) => r.id),
        projectTombRows.map((r) => r.id),
    );

    return {
        graphs: Array.from(finalGraphs.values()),
        projects: Array.from(finalProjects.values()),
        changedLocal,
        pushed,
        pulled,
    };
}

async function refreshShares(
    userId: string,
    finalGraphs: Map<string, Graph>,
    finalProjects: Map<string, Project>,
    pushedGraphRows: RemoteGraphRow[],
    pushedProjectRows: RemoteProjectRow[],
    deletedGraphIds: string[],
    deletedProjectIds: string[],
): Promise<void> {
    if (!supabase) return;
    // A previous run failed partway. Its shares were never refreshed and the
    // rows behind them may not change again, so this run refreshes everything
    // rather than only what it happened to touch.
    const retryAll = sharesRefreshPending();
    let failed = false;
    try {
        const { data: shares, error } = await supabase
            .from('shares')
            .select('id, kind, graph_id, project_id')
            .eq('user_id', userId);
        if (error) throw new Error(error.message);
        if (!shares || shares.length === 0) {
            setSharesRefreshPending(false);
            return;
        }

        const pushedIds = new Set(pushedGraphRows.map((r) => r.id));
        const pushedProjectIds = new Set(pushedProjectRows.map((r) => r.id));
        const allGraphs = Array.from(finalGraphs.values());

        // Each share touches a different row, so refresh them concurrently
        // rather than one blocking round-trip after another.
        await Promise.all(shares.map(async (share) => {
            if (share.kind === 'graph' && share.graph_id) {
                if (deletedGraphIds.includes(share.graph_id) || !finalGraphs.has(share.graph_id)) {
                    const { error: delErr } = await supabase!.from('shares').delete().eq('id', share.id);
                    if (delErr) failed = true;
                } else if (retryAll || pushedIds.has(share.graph_id)) {
                    const graph = finalGraphs.get(share.graph_id)!;
                    const { error: upErr } = await supabase!.from('shares')
                        .update({ payload: graphSharePayload(graph), updated_at: new Date().toISOString() })
                        .eq('id', share.id);
                    if (upErr) failed = true;
                }
            } else if (share.kind === 'project' && share.project_id) {
                if (deletedProjectIds.includes(share.project_id) || !finalProjects.has(share.project_id)) {
                    const { error: delErr } = await supabase!.from('shares').delete().eq('id', share.id);
                    if (delErr) failed = true;
                } else {
                    const project = finalProjects.get(share.project_id)!;
                    const memberPushed = allGraphs.some((g) => g.projectId === project.id && pushedIds.has(g.id));
                    // A deleted member is no longer in `allGraphs`, so its id isn't in
                    // `pushedIds` — without this, deleting a diagram from a shared project
                    // would leave it in the publicly served payload. Any deletion this
                    // sync re-renders the payload (which now omits the deleted graphs).
                    const memberDeleted = deletedGraphIds.length > 0;
                    // The project row itself can change without any member changing
                    // (a rename, a new colour); the payload embeds the project name,
                    // so that has to re-render too.
                    const projectPushed = pushedProjectIds.has(project.id);
                    if (retryAll || memberPushed || memberDeleted || projectPushed) {
                        const { error: upErr } = await supabase!.from('shares')
                            .update({ payload: projectSharePayload(project, allGraphs), updated_at: new Date().toISOString() })
                            .eq('id', share.id);
                        if (upErr) failed = true;
                    }
                }
            }
        }));
    } catch {
        failed = true;
    }
    // Sticky until a run completes cleanly, so a transient failure cannot leave
    // a public link showing stale content forever.
    setSharesRefreshPending(failed);
}

function friendlySyncError(message: string): string {
    if (isRlsDenied(message)) {
        return 'Cloud sync is part of the Supporter plan. Your data is still saved locally in this browser.';
    }
    if (/Failed to fetch|network/i.test(message)) {
        return 'Could not reach the sync server. Your data is safe locally; sync will retry.';
    }
    return `Sync failed: ${message}`;
}
