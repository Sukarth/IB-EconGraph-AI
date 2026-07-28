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
 *
 * Diagrams live in IndexedDB rather than localStorage. localStorage caps an
 * origin at roughly 5MB, which several accounts' diagrams share (and a diagram
 * carries a full snapshot per AI chat turn, so they are not small). Worse, that
 * same 5MB holds the auth token, so filling it could break signing in.
 * IndexedDB is measured in gigabytes. localStorage remains the fallback for
 * browsers where IndexedDB can't be opened.
 */

/** Namespace for work done while signed out. */
export const GUEST_SCOPE = 'guest';

/** A storage namespace: a user id, or GUEST_SCOPE. */
export type StoreScope = string;

/**
 * Guest keeps the original unprefixed names so that local work predating any of
 * this is still found and carried forward.
 */
const BASE_KEYS = {
    graphs: 'econgraph_graphs',
    projects: 'econgraph_projects',
} as const;

type Collection = keyof typeof BASE_KEYS;
const COLLECTIONS = Object.keys(BASE_KEYS) as Collection[];

/** Pre-namespacing key recording which account the shared store belonged to. */
const LEGACY_OWNER_KEY = 'econgraph_owner';
const VERSION_KEY = 'econgraph_store_version';
const VERSION_NAMESPACED = '2';   // per-account, still in localStorage
const VERSION_INDEXEDDB = '3';    // per-account, moved to IndexedDB

const DB_NAME = 'econgraph';
const DB_VERSION = 1;
const DB_STORE = 'scopes';
/** Give up and fall back rather than hanging the app behind a stuck open(). */
const DB_OPEN_TIMEOUT_MS = 4000;

function localKey(collection: Collection, scope: StoreScope): string {
    const base = BASE_KEYS[collection];
    return scope === GUEST_SCOPE ? base : `${base}__u_${scope}`;
}

function dbKey(collection: Collection, scope: StoreScope): string {
    return `${scope}::${collection}`;
}

// ---------------------------------------------------------------------------
// localStorage backend (also the source for the one-time move into IndexedDB)
// ---------------------------------------------------------------------------

function lsGet(collection: Collection, scope: StoreScope): string | null {
    try {
        return localStorage.getItem(localKey(collection, scope));
    } catch {
        return null;
    }
}

/** Returns whether the write actually landed. Callers that then clear a source
 *  namespace MUST check this, or a failed write silently destroys the data. */
function lsSet(collection: Collection, scope: StoreScope, raw: string | null): boolean {
    try {
        const key = localKey(collection, scope);
        if (raw === null) localStorage.removeItem(key);
        else localStorage.setItem(key, raw);
        return true;
    } catch (e) {
        console.error(`Failed to write ${collection} for scope ${scope}:`, e);
        return false;
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

// ---------------------------------------------------------------------------
// IndexedDB backend
// ---------------------------------------------------------------------------

function openDb(): Promise<IDBDatabase | null> {
    return new Promise((resolve) => {
        let settled = false;
        const done = (db: IDBDatabase | null) => {
            if (settled) return;
            settled = true;
            resolve(db);
        };
        try {
            if (typeof indexedDB === 'undefined') return done(null);
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
            };
            req.onsuccess = () => done(req.result);
            req.onerror = () => done(null);
            // Another tab is mid-upgrade and holding the database.
            req.onblocked = () => done(null);
            setTimeout(() => done(null), DB_OPEN_TIMEOUT_MS);
        } catch {
            done(null);
        }
    });
}

/**
 * `ok` distinguishes a genuine failure from a successful read that happens to
 * return nothing. Writes are only safe to act on when `ok` is true: treating a
 * failed write as success is how a move loses data.
 */
interface IdbResult<T> { ok: boolean; value: T | null }

function idbRequest<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<IdbResult<T>> {
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(DB_STORE, mode);
            const req = run(tx.objectStore(DB_STORE));
            // Resolve on transaction completion for writes: a request can
            // succeed and the transaction still abort (quota, for one).
            req.onsuccess = () => {
                if (mode === 'readonly') resolve({ ok: true, value: req.result as T });
            };
            tx.oncomplete = () => resolve({ ok: true, value: (req.result ?? null) as T | null });
            req.onerror = () => resolve({ ok: false, value: null });
            tx.onabort = () => resolve({ ok: false, value: null });
            tx.onerror = () => resolve({ ok: false, value: null });
        } catch (e) {
            console.error('IndexedDB operation failed:', e);
            resolve({ ok: false, value: null });
        }
    });
}

const idbGet = <T>(db: IDBDatabase, key: string) => idbRequest<T>(db, 'readonly', (s) => s.get(key));
const idbPut = (db: IDBDatabase, key: string, value: unknown) => idbRequest(db, 'readwrite', (s) => s.put(value, key));
const idbDelete = (db: IDBDatabase, key: string) => idbRequest(db, 'readwrite', (s) => s.delete(key));

// ---------------------------------------------------------------------------
// Initialisation and migration
// ---------------------------------------------------------------------------

let db: IDBDatabase | null = null;
let readyPromise: Promise<void> | null = null;

function readVersion(): string | null {
    try {
        return localStorage.getItem(VERSION_KEY);
    } catch {
        return null;
    }
}

function writeVersion(version: string): void {
    try {
        localStorage.setItem(VERSION_KEY, version);
    } catch { /* ignore */ }
}

/**
 * Split the old shared store into per-account namespaces (still localStorage).
 *
 * Before this, everyone's diagrams shared one set of keys and `econgraph_owner`
 * recorded who they belonged to. If an account owned them, they move into that
 * account's namespace so signing in still finds them. If nothing owned them,
 * they were anonymous and already live where guest work belongs.
 */
function migrateToNamespaces(): void {
    let owner: string | null = null;
    try {
        owner = localStorage.getItem(LEGACY_OWNER_KEY);
    } catch { /* ignore */ }

    if (owner && owner !== GUEST_SCOPE) {
        for (const collection of COLLECTIONS) {
            const raw = lsGet(collection, GUEST_SCOPE);
            // Don't clobber an existing namespace if this somehow runs twice.
            if (raw !== null && lsGet(collection, owner) === null) {
                // Only drop the source once the copy is definitely on disk.
                if (lsSet(collection, owner, raw)) lsSet(collection, GUEST_SCOPE, null);
            }
        }
        try { localStorage.removeItem(LEGACY_OWNER_KEY); } catch { /* ignore */ }
    }
    writeVersion(VERSION_NAMESPACED);
}

/**
 * Move every namespace out of localStorage and into IndexedDB, freeing the
 * origin's 5MB budget. Scans for any `econgraph_graphs*` / `econgraph_projects*`
 * key so it catches guest and every account in one pass.
 */
async function migrateToIndexedDb(database: IDBDatabase): Promise<void> {
    let keys: string[] = [];
    try {
        keys = Object.keys(localStorage);
    } catch {
        return;
    }

    // Every namespace left behind has to be retried on the next load. Stamping
    // the version after a partial run would end the retries while reads have
    // already switched to IndexedDB, so the skipped namespace would sit in
    // localStorage that nothing ever looks at again.
    let complete = true;
    for (const collection of COLLECTIONS) {
        const base = BASE_KEYS[collection];
        for (const key of keys) {
            if (key !== base && !key.startsWith(`${base}__u_`)) continue;
            const scope = key === base ? GUEST_SCOPE : key.slice(`${base}__u_`.length);
            let raw: string | null = null;
            try { raw = localStorage.getItem(key); } catch { complete = false; continue; }
            if (raw === null) continue;

            const existing = await idbGet<unknown[]>(database, dbKey(collection, scope));
            if (!existing.ok) { complete = false; continue; } // can't tell what's there; leave the source alone
            // Only seed a namespace IndexedDB doesn't already know about, so a
            // partially completed run can be repeated safely.
            if (!Array.isArray(existing.value)) {
                const written = await idbPut(database, dbKey(collection, scope), parseArray(raw));
                // Keep localStorage as the copy of record until the move lands.
                if (!written.ok) { complete = false; continue; }
            }
            try { localStorage.removeItem(key); } catch { /* ignore */ }
        }
    }
    if (complete) writeVersion(VERSION_INDEXEDDB);
}

async function init(): Promise<void> {
    if (readVersion() !== VERSION_NAMESPACED && readVersion() !== VERSION_INDEXEDDB) {
        migrateToNamespaces();
    }
    db = await openDb();
    if (db && readVersion() !== VERSION_INDEXEDDB) {
        await migrateToIndexedDb(db);
    }
}

/**
 * Every public call funnels through this, so callers never have to think about
 * ordering: a read issued before initialisation finishes simply waits for it.
 */
function ready(): Promise<void> {
    if (!readyPromise) {
        readyPromise = init().catch((e) => {
            // Fall back to localStorage rather than leaving the app unable to
            // load anything at all.
            console.error('Local store initialisation failed, using localStorage:', e);
            db = null;
        });
    }
    return readyPromise;
}

/** Start opening the database. Optional: any read awaits this anyway. */
export function initLocalStore(): Promise<void> {
    return ready();
}

/**
 * Ask the browser not to evict this origin's data when disk runs low. Purely
 * advisory, and unrelated to the quota itself.
 */
export async function requestPersistentStorage(): Promise<boolean> {
    try {
        if (!navigator.storage?.persist) return false;
        if (await navigator.storage.persisted()) return true;
        return await navigator.storage.persist();
    } catch {
        return false;
    }
}

// ---------------------------------------------------------------------------
// Reads and writes
// ---------------------------------------------------------------------------

/**
 * `ok` has to reach the caller. A read that failed and a namespace that is
 * genuinely empty both produce no items, but only one of them means it is safe
 * to write over what is stored, and the caller is the only one who can tell the
 * difference in a useful way.
 */
async function readCollection<T>(collection: Collection, scope: StoreScope): Promise<{ ok: boolean; items: T[] }> {
    await ready();
    if (db) {
        const result = await idbGet<T[]>(db, dbKey(collection, scope));
        return { ok: result.ok, items: Array.isArray(result.value) ? result.value : [] };
    }
    return { ok: true, items: parseArray<T>(lsGet(collection, scope)) };
}

// Serialise writes per key: two rapid saves resolving out of order would
// otherwise leave the older array on disk.
const writeQueues = new Map<string, Promise<boolean>>();

function enqueueWrite(key: string, op: () => Promise<boolean>): Promise<boolean> {
    const previous = writeQueues.get(key) ?? Promise.resolve(true);
    const next = previous.then(op, op).catch((e) => {
        console.error(`Failed to save ${key}:`, e);
        return false;
    });
    writeQueues.set(key, next);
    return next;
}

/** Resolves to whether the data is actually stored. */
async function writeCollection<T>(collection: Collection, scope: StoreScope, items: T[]): Promise<boolean> {
    await ready();
    const key = dbKey(collection, scope);
    return enqueueWrite(key, async () => {
        if (db) return (await idbPut(db, key, items)).ok;
        return lsSet(collection, scope, JSON.stringify(items));
    });
}

/**
 * Read one account's (or the guest's) stored diagrams and projects.
 *
 * `ok` is false when the store could not be read. The arrays are empty then
 * too, but the caller must not act on that: treating an unreadable namespace as
 * an empty one is how a library gets overwritten with nothing.
 */
export async function readScope(scope: StoreScope): Promise<{ ok: boolean; graphs: Graph[]; projects: Project[] }> {
    const [graphs, projects] = await Promise.all([
        readCollection<Graph>('graphs', scope),
        readCollection<Project>('projects', scope),
    ]);
    return { ok: graphs.ok && projects.ok, graphs: graphs.items, projects: projects.items };
}

export function writeGraphs(scope: StoreScope, graphs: Graph[]): Promise<boolean> {
    return writeCollection('graphs', scope, graphs);
}

export function writeProjects(scope: StoreScope, projects: Project[]): Promise<boolean> {
    return writeCollection('projects', scope, projects);
}

/**
 * Whether a namespace holds anything worth keeping. False if it could not be
 * read: the caller uses this to decide whether guest work is waiting to be
 * adopted, and "we don't know" must not start a move.
 */
export async function scopeHasContent(scope: StoreScope): Promise<boolean> {
    const { ok, graphs, projects } = await readScope(scope);
    return ok && (graphs.length > 0 || projects.length > 0);
}

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
    /**
     * A Supporter whose first pull failed (error/offline). An empty account is
     * then unproven: the cloud may well hold diagrams we simply couldn't read.
     */
    firstPullFailed: boolean;
    /** Whether the account has any diagrams or projects right now. */
    accountHasContent: boolean;
}): AdoptionDecision {
    if (!input.pending || !input.scopeReady) return 'wait';
    if (input.awaitingFirstPull) return 'wait';
    // Never treat "we couldn't reach the cloud" as "the account is empty":
    // adopting on that basis mixes signed-out work into someone's real library.
    if (input.firstPullFailed) return 'wait';
    return input.accountHasContent ? 'keep-separate' : 'adopt';
}

/**
 * Hand a namespace's contents over to another one, emptying the source.
 *
 * Used when a signed-in account takes ownership of work done while signed out.
 * The caller must have established that the destination is empty: this
 * overwrites rather than merges, precisely so two people's diagrams are never
 * silently mixed together.
 *
 * Returns null if the copy did not land, leaving the source untouched. Clearing
 * the source on a failed write would destroy the only copy, which is the whole
 * thing this namespacing exists to prevent.
 */
export async function adoptScope(from: StoreScope, to: StoreScope): Promise<{ graphs: Graph[]; projects: Project[] } | null> {
    const moved = await readScope(from);
    // Copying nothing and then clearing the source would empty the namespace we
    // were asked to preserve, which is the one outcome this must never produce.
    if (!moved.ok) {
        console.error(`Could not read ${from}; leaving it in place rather than moving an unknown amount of data.`);
        return null;
    }
    const [graphsSaved, projectsSaved] = await Promise.all([
        writeGraphs(to, moved.graphs),
        writeProjects(to, moved.projects),
    ]);
    if (!graphsSaved || !projectsSaved) {
        console.error(`Could not move ${from} into ${to}; leaving the source in place.`);
        return null;
    }

    await Promise.all([writeGraphs(from, []), writeProjects(from, [])]);
    if (db) {
        // Leave no empty records behind for a namespace nobody is using.
        await Promise.all([
            idbDelete(db, dbKey('graphs', from)),
            idbDelete(db, dbKey('projects', from)),
        ]);
    }
    return moved;
}
