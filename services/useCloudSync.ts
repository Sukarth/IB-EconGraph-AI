import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { syncCloud } from './sync';
import { Graph, Project } from '../types';

export type SyncStatus = 'disabled' | 'idle' | 'syncing' | 'error' | 'offline';

export interface SyncState {
    status: SyncStatus;
    lastSyncedAt: number | null;
    error: string | null;
}

const DEBOUNCE_MS = 4000;
const FOCUS_SYNC_MIN_INTERVAL_MS = 60_000;

interface UseCloudSyncOptions {
    /** userId when signed in AND entitled to sync; null otherwise. */
    userId: string | null;
    hasInitialized: boolean;
    graphs: Graph[];
    projects: Project[];
    /**
     * Hand merged cloud state back to the app. `userId` identifies the account
     * the sync ran for, so a result that arrives after an account switch can be
     * discarded rather than imported into whoever is signed in now.
     */
    applyRemote: (graphs: Graph[], projects: Project[], userId: string) => void;
}

/**
 * Debounced, self-healing cloud sync loop. Local-first: never blocks the UI,
 * never runs concurrently, re-queues itself when local state changes during
 * a run (so remote merges never clobber in-flight edits).
 */
export function useCloudSync({ userId, hasInitialized, graphs, projects, applyRemote }: UseCloudSyncOptions): {
    syncState: SyncState;
    syncNow: () => void;
} {
    const [syncState, setSyncState] = useState<SyncState>({ status: 'disabled', lastSyncedAt: null, error: null });

    const graphsRef = useRef(graphs);
    const projectsRef = useRef(projects);
    graphsRef.current = graphs;
    projectsRef.current = projects;

    const userIdRef = useRef(userId);
    userIdRef.current = userId;

    const runningRef = useRef(false);
    const rerunRef = useRef(false);
    const timerRef = useRef<number | null>(null);
    const lastRunRef = useRef(0);
    const applyRemoteRef = useRef(applyRemote);
    applyRemoteRef.current = applyRemote;

    const runSync = useCallback(async () => {
        const uid = userIdRef.current;
        if (!uid) return;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            setSyncState((s) => ({ ...s, status: 'offline' }));
            return;
        }
        if (runningRef.current) {
            rerunRef.current = true;
            return;
        }
        runningRef.current = true;
        setSyncState((s) => ({ ...s, status: 'syncing', error: null }));

        const startGraphs = graphsRef.current;
        const startProjects = projectsRef.current;

        try {
            const outcome = await syncCloud(uid, startGraphs, startProjects);
            lastRunRef.current = Date.now();

            const localMoved = graphsRef.current !== startGraphs || projectsRef.current !== startProjects;
            if (outcome.changedLocal && !localMoved) {
                applyRemoteRef.current(outcome.graphs, outcome.projects, uid);
            } else if (outcome.changedLocal && localMoved) {
                // Local state advanced while we were syncing — run again rather
                // than applying a stale merge.
                rerunRef.current = true;
            }
            setSyncState({ status: 'idle', lastSyncedAt: Date.now(), error: null });
        } catch (err) {
            setSyncState((s) => ({
                status: 'error',
                lastSyncedAt: s.lastSyncedAt,
                error: err instanceof Error ? err.message : 'Sync failed.',
            }));
        } finally {
            runningRef.current = false;
            if (rerunRef.current) {
                rerunRef.current = false;
                // Held in timerRef so unmount and sign-out can cancel it; left
                // loose, a sync could still fire against a signed-out session.
                // A later scheduleSync supersedes it, which is correct: that one
                // runs sooner and reads the same state.
                if (timerRef.current) window.clearTimeout(timerRef.current);
                timerRef.current = window.setTimeout(() => {
                    timerRef.current = null;
                    void runSync();
                }, 500);
            }
        }
    }, []);

    const scheduleSync = useCallback((delay: number = DEBOUNCE_MS) => {
        if (!userIdRef.current) return;
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
            timerRef.current = null;
            void runSync();
        }, delay);
    }, [runSync]);

    // Sync on becoming enabled (sign-in / entitlement load)
    useEffect(() => {
        if (!userId) {
            setSyncState({ status: 'disabled', lastSyncedAt: null, error: null });
            if (timerRef.current) window.clearTimeout(timerRef.current);
            timerRef.current = null;
            return;
        }
        setSyncState((s) => (s.status === 'disabled' ? { ...s, status: 'idle' } : s));
        scheduleSync(200);
    }, [userId, scheduleSync]);

    // Debounced sync on data changes
    useEffect(() => {
        if (!hasInitialized || !userId) return;
        scheduleSync();
    }, [graphs, projects, hasInitialized, userId, scheduleSync]);

    // Refresh when the tab regains focus (cross-device edits) or comes online
    useEffect(() => {
        if (!userId) return;
        const onVisible = () => {
            if (document.visibilityState === 'visible' && Date.now() - lastRunRef.current > FOCUS_SYNC_MIN_INTERVAL_MS) {
                scheduleSync(300);
            }
        };
        const onOnline = () => scheduleSync(300);
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('online', onOnline);
        return () => {
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('online', onOnline);
        };
    }, [userId, scheduleSync]);

    // Cleanup
    useEffect(() => () => {
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = null;
    }, []);

    const syncNow = useCallback(() => {
        scheduleSync(0);
    }, [scheduleSync]);

    return useMemo(() => ({ syncState, syncNow }), [syncState, syncNow]);
}
