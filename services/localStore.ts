import { Graph, Project } from '../types';

/**
 * Per-account local storage for diagrams and projects.
 *
 * The browser's local store is shared by everyone who uses the browser, but the
 * app's content is not: two people signing into the same browser must never see
 * (or overwrite) each other's diagrams. Every account therefore gets its own
 * namespace, keyed by user id, plus one shared "guest" namespace for work done
 * while signed out.
 *
 * Nothing is ever deleted on an account switch. Signing out and back in returns
 * you to exactly what you left.
 *
 * Note that guest work is genuinely shared: two people using the same browser
 * without signing in are indistinguishable, so they see the same diagrams.
 * That is unavoidable, and signing in is what separates them.
 */

/** Namespace for work done while signed out. */
export const GUEST_SCOPE = 'guest';

/** A storage namespace: a user id, or GUEST_SCOPE. */
export type StoreScope = string;

/**
 * Guest keeps the original unprefixed names so that existing local work is
 * still there after this change ships, with no migration needed.
 */
const BASE_KEYS = {
    graphs: 'econgraph_graphs',
    projects: 'econgraph_projects',
} as const;

type Collection = keyof typeof BASE_KEYS;

/** Pre-namespacing key recording which account the shared store belonged to. */
const LEGACY_OWNER_KEY = 'econgraph_owner';
const VERSION_KEY = 'econgraph_store_version';
const CURRENT_VERSION = '2';

function keyFor(collection: Collection, scope: StoreScope): string {
    const base = BASE_KEYS[collection];
    return scope === GUEST_SCOPE ? base : `${base}__u_${scope}`;
}

function readRaw(collection: Collection, scope: StoreScope): string | null {
    try {
        return localStorage.getItem(keyFor(collection, scope));
    } catch {
        return null;
    }
}

function writeRaw(collection: Collection, scope: StoreScope, raw: string | null): void {
    try {
        const key = keyFor(collection, scope);
        if (raw === null) localStorage.removeItem(key);
        else localStorage.setItem(key, raw);
    } catch (e) {
        // Quota is the realistic failure here: several accounts' diagrams now
        // coexist in one browser. Surface it rather than losing writes silently.
        console.error(`Failed to write ${collection} for scope ${scope}:`, e);
    }
}

function parseArray<T>(raw: string | null): T[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
        return [];
    }
}

/**
 * One-time move from the old shared store to per-account namespaces.
 *
 * Before this, everyone's diagrams shared one set of keys and `econgraph_owner`
 * recorded who they belonged to. If an account owned them, they move into that
 * account's namespace so signing in still finds them. If nothing owned them,
 * they were anonymous and already live where guest work belongs.
 *
 * Safe to call on every start: it does nothing once the version marker is set.
 */
export function migrateLegacyStore(): void {
    let version: string | null = null;
    try {
        version = localStorage.getItem(VERSION_KEY);
    } catch {
        return; // storage unavailable (private mode with storage disabled)
    }
    if (version === CURRENT_VERSION) return;

    let owner: string | null = null;
    try {
        owner = localStorage.getItem(LEGACY_OWNER_KEY);
    } catch { /* ignore */ }

    if (owner && owner !== GUEST_SCOPE) {
        for (const collection of Object.keys(BASE_KEYS) as Collection[]) {
            const raw = readRaw(collection, GUEST_SCOPE);
            // Don't clobber an existing namespace if this somehow runs twice.
            if (raw !== null && readRaw(collection, owner) === null) {
                writeRaw(collection, owner, raw);
                writeRaw(collection, GUEST_SCOPE, null);
            }
        }
        try { localStorage.removeItem(LEGACY_OWNER_KEY); } catch { /* ignore */ }
    }

    try { localStorage.setItem(VERSION_KEY, CURRENT_VERSION); } catch { /* ignore */ }
}

/** Read one account's (or the guest's) stored diagrams and projects. */
export function readScope(scope: StoreScope): { graphs: Graph[]; projects: Project[] } {
    return {
        graphs: parseArray<Graph>(readRaw('graphs', scope)),
        projects: parseArray<Project>(readRaw('projects', scope)),
    };
}

export function writeGraphs(scope: StoreScope, graphs: Graph[]): void {
    writeRaw('graphs', scope, JSON.stringify(graphs));
}

export function writeProjects(scope: StoreScope, projects: Project[]): void {
    writeRaw('projects', scope, JSON.stringify(projects));
}

/** Whether a namespace holds anything worth keeping. */
export function scopeHasContent(scope: StoreScope): boolean {
    const { graphs, projects } = readScope(scope);
    return graphs.length > 0 || projects.length > 0;
}

/**
 * Hand a namespace's contents over to another one, emptying the source.
 *
 * Used when a signed-in account takes ownership of work done while signed out.
 * The caller must have established that the destination is empty: this
 * overwrites rather than merges, precisely so two people's diagrams are never
 * silently mixed together.
 */
/**
 * What to do with work done signed out, once someone signs in.
 *
 *  - `wait`          nothing to decide yet, or we can't tell whether the
 *                    account is empty until its first cloud pull lands.
 *  - `adopt`         the account has nothing of its own, so the signed-out work
 *                    becomes theirs.
 *  - `keep-separate` the account already has diagrams. Never merge the two:
 *                    the signed-out work stays where it is and is still there
 *                    when they sign out again.
 */
export type AdoptionDecision = 'wait' | 'adopt' | 'keep-separate';

export function decideGuestAdoption(input: {
    /** Signed in over guest work, with no diagrams of their own at load time. */
    pending: boolean;
    /** The namespace in memory is the one we last loaded (no swap in flight). */
    scopeReady: boolean;
    /** A Supporter whose first cloud pull hasn't landed yet. */
    awaitingFirstPull: boolean;
    /** Whether the account has any diagrams or projects right now. */
    accountHasContent: boolean;
}): AdoptionDecision {
    if (!input.pending || !input.scopeReady) return 'wait';
    if (input.awaitingFirstPull) return 'wait';
    return input.accountHasContent ? 'keep-separate' : 'adopt';
}

export function adoptScope(from: StoreScope, to: StoreScope): { graphs: Graph[]; projects: Project[] } {
    const moved = readScope(from);
    writeGraphs(to, moved.graphs);
    writeProjects(to, moved.projects);
    writeRaw('graphs', from, null);
    writeRaw('projects', from, null);
    return moved;
}
