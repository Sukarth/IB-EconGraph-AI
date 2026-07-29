import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { generateDiagramData, hasApiKey } from './services/ai';
import { getAIProvider } from './services/aiProvider';
import { useAuth } from './services/auth';
import { useCloudSync } from './services/useCloudSync';
import { recordTombstones, clearTombstones, fetchCloudIds } from './services/sync';
import { CLIENT_ROUTES, SHARE_PATH } from './routes.mjs';
import {
  GUEST_SCOPE,
  initLocalStore,
  requestPersistentStorage,
  readScope,
  writeGraphs,
  writeProjects,
  scopeHasContent,
  adoptScope,
  decideGuestAdoption,
} from './services/localStore';
import DiagramRenderer from './components/DiagramRenderer';
import LandingPage from './components/LandingPage';
import HomePage from './components/HomePage';
import SettingsPage from './components/SettingsPage';
import PricingPage from './components/PricingPage';
import ComparePage from './components/ComparePage';
import { PrivacyPage, TermsPage } from './components/LegalPages';
import SharedViewPage from './components/SharedViewPage';
import ShareModal from './components/ShareModal';
import CloudHistoryModal from './components/CloudHistoryModal';
import ToolbarLeft from './components/ToolbarLeft';
import ToolbarRight from './components/ToolbarRight';
import ComponentLibrary from './components/ComponentLibrary';
import { PromptModal, ConfirmModal, ColorPickerModal, ExportModal } from './components/Modal';
import { usePortalTooltip } from './components/usePortalTooltip';
import { DiagramData, INITIAL_DIAGRAM, EMPTY_DIAGRAM, Graph, Project, Message, EditorTool, EditorSettings, ComponentTemplate } from './types';
import {
  Loader2, Send, Plus, MessageSquare, BarChart2,
  Trash2, Menu, History, RotateCcw, RotateCw, FolderOpen, ChevronLeft, Grid3X3, AlertTriangle, Settings,
  Share2, CloudDownload
} from 'lucide-react';

const generateId = () => uuidv4();

// Diagrams and projects are stored per account (see services/localStore.ts).
// These keys are editor preferences, which are deliberately shared across
// accounts on the same browser: they describe the tool, not anyone's work.
const STORAGE_KEYS = {
  settings: 'econgraph_settings',
  specialColors: 'econgraph_special_colors',
  standardColors: 'econgraph_standard_colors',
};

const DEFAULT_STANDARD_COLORS = [
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#22c55e', // Green
  '#f59e0b', // Orange/Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#64748b', // Slate
  '#06b6d4', // Cyan
  '#6366f1', // Indigo
  '#84cc16', // Lime
  '#f97316', // Deep Orange
  '#111827', // Gray 900
  '#71717a', // Zinc 500
  '#000000', // Black
];

const DEFAULT_SPECIAL_COLORS = ['#648d49', '#ae0f0f'];

const PROJECT_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
];

type ViewType = 'landing' | 'home' | 'editor' | 'settings' | 'pricing' | 'compare' | 'shared' | 'privacy' | 'terms';

// The route table lives in routes.mjs so the build can read it too, and refuse
// to ship a route the deployment has nothing to serve it with.
const ROUTE_VIEWS = CLIENT_ROUTES as Record<string, ViewType | undefined>;

// The same table read backwards: which URL to show for a given view. Looking the
// path up rather than building `/${view}` keeps the two from drifting if a view
// is ever named differently from its route.
const PATH_FOR_VIEW: Partial<Record<ViewType, string>> = Object.fromEntries(
  Object.entries(ROUTE_VIEWS).map(([path, view]) => [view, path]),
);

// Views reachable by navigating. 'shared' is left out because you get there by
// opening a share link, and there is no /shared route for the edge to serve, so
// pushing one would work until the first reload. That exclusion is a compile
// error, but only for 'shared': a view added to ViewType later joins this type
// automatically and may still have no route. The build guard catches that case,
// and navigateToView refuses to move rather than papering over it.
type RoutableView = Exclude<ViewType, 'shared'>;

function parsePath(pathname: string): { view: ViewType; sharedSlug: string | null } {
  const view = ROUTE_VIEWS[pathname];
  if (view) return { view, sharedSlug: null };
  const shareMatch = pathname.match(SHARE_PATH);
  if (shareMatch) return { view: 'shared', sharedSlug: shareMatch[1] };
  return { view: 'landing', sharedSlug: null }; // default for '/' and unknown paths
}

/** Why AI generation is unavailable, or null when it's usable. */
type AiGate = null | 'hosted-signin' | 'hosted-upgrade' | 'byok-nokey';

export default function App() {
  // --- View State ---
  const [view, setView] = useState<ViewType>(() => parsePath(window.location.pathname).view);
  const [sharedSlug, setSharedSlug] = useState<string | null>(() => parsePath(window.location.pathname).sharedSlug);

  // --- Data State ---
  const [graphs, setGraphs] = useState<Graph[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeGraphId, setActiveGraphId] = useState<string | null>(null);
  const [currentDiagram, setCurrentDiagram] = useState<DiagramData>(INITIAL_DIAGRAM);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const downloadUrlRef = useRef<string | null>(null);

  // UI State
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isComponentLibraryOpen, setComponentLibraryOpen] = useState(false);
  const [isAIPanelOpen, setAIPanelOpen] = useState(true);

  // Editor State
  const [activeTool, setActiveTool] = useState<EditorTool>('select');
  const [activeColor, setActiveColor] = useState('#3b82f6');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 }); // Lifted pan state
  const [settings, setSettings] = useState<EditorSettings>({
    showGrid: true,
    gridSize: 10,
    snapToGrid: true,
    snapToPoints: true,
    moveTogether: true,
    snapThreshold: 8
  });

  // Color State
  const [specialColors, setSpecialColors] = useState<string[]>(DEFAULT_SPECIAL_COLORS);
  const [standardColors, setStandardColors] = useState<string[]>(DEFAULT_STANDARD_COLORS);

  // Modal State
  const [promptModal, setPromptModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    defaultValue: string;
    onConfirm: (value: string) => void;
  }>({ visible: false, title: '', message: '', defaultValue: '', onConfirm: () => { } });

  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    danger?: boolean;
  }>({ visible: false, title: '', message: '', onConfirm: () => { } });

  const [colorModal, setColorModal] = useState<{
    visible: boolean;
    currentColor: string;
    onSelect: (color: string) => void;
  }>({ visible: false, currentColor: '#3b82f6', onSelect: () => { } });

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [cloudHistoryOpen, setCloudHistoryOpen] = useState(false);

  // History for undo/redo
  const [history, setHistory] = useState<DiagramData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyDebounceRef = useRef<number | null>(null);
  const autosaveDebounceRef = useRef<number | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { showTooltip: showSendTooltip, hideTooltip: hideSendTooltip, TooltipPortal: SendTooltipPortal } = usePortalTooltip({ delay: 400, placement: 'top' });

  // --- Cloud (accounts + sync are Supporter features; app is fully usable without) ---
  const { configured: cloudConfigured, loading: authLoading, user, isPro } = useAuth();

  // Live refs so applyRemote (a stable, dep-free callback) can see the graph
  // currently open in the editor without being re-created on every edit.
  const activeGraphIdRef = useRef<string | null>(null);
  const currentDiagramRef = useRef<DiagramData>(INITIAL_DIAGRAM);

  // Which account's local data is live. `null` while the session is still being
  // restored, so we don't briefly load guest data for someone who is signed in.
  const storeScope = authLoading ? null : (user?.id ?? GUEST_SCOPE);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  // Browser storage refused to give up this namespace. Saving is off for the
  // session so the stored copy survives, and the banner says so.
  const [storageUnreadable, setStorageUnreadable] = useState(false);
  const loadedScopeRef = useRef<string | null>(null);
  // True between signing in and deciding whether signed-out work joins this
  // account. The editor holds off creating a blank diagram until it resolves.
  const [pendingGuestAdoption, setPendingGuestAdoption] = useState(false);
  // The handover is decided (so `pendingGuestAdoption` is already false) but the
  // copy is still running. See the auto-open effect.
  const [adoptingGuestWork, setAdoptingGuestWork] = useState(false);
  // A finished handover waiting for its namespace to be the live one. By the
  // time adoptScope resolves it has already emptied the guest namespace, so
  // this data exists in exactly one place and dropping it loses the user's
  // work. Holding it here lets the effect below wait for the right moment
  // instead of deciding, from inside an async callback, whether that moment has
  // passed.
  const [pendingAdopted, setPendingAdopted] = useState<{ scope: string; graphs: Graph[]; projects: Project[] } | null>(null);

  const applyRemote = useCallback((remoteGraphs: Graph[], remoteProjects: Project[], forUserId: string) => {
    // A sync that lands after the account changed is carrying the previous
    // account's cloud data. Dropping it keeps that data out of this account
    // (and off this account's next upload).
    if (loadedScopeRef.current !== forUserId) return;
    setGraphs(remoteGraphs);
    setProjects(remoteProjects);
    // If the graph open in the editor was changed by this pull (e.g. edited on
    // another device), refresh the editor's live copy, otherwise the next
    // autosave writes our stale currentDiagram back over the newer cloud version.
    // BUT only when there are no unsaved local edits in flight: a pending
    // autosave means currentDiagram holds edits not yet written to `graphs`, and
    // overwriting it here would silently discard them and reset the undo stack.
    const openId = activeGraphIdRef.current;
    if (openId && autosaveDebounceRef.current === null) {
      const incoming = remoteGraphs.find((g) => g.id === openId);
      if (!incoming) {
        // Deleted on another device. The merge already dropped it, so leaving
        // it open would keep editing (and re-uploading) a graph that no longer
        // exists. Close it and let the auto-open effect pick the next one.
        setActiveGraphId(null);
        const blank = { ...EMPTY_DIAGRAM };
        setCurrentDiagram(blank);
        setHistory([blank]);
        historyRef.current = [blank];
        historyIndexRef.current = 0;
        setHistoryIndex(0);
      } else if (JSON.stringify(incoming.diagramData) !== JSON.stringify(currentDiagramRef.current)) {
        setCurrentDiagram(incoming.diagramData);
        setHistory([incoming.diagramData]);
        historyRef.current = [incoming.diagramData];
        historyIndexRef.current = 0;
        setHistoryIndex(0);
      }
    }
  }, []);

  const { syncState, syncNow } = useCloudSync({
    // Withhold the account until its own local data is the data in memory.
    // Syncing during a switch, while the previous account's diagrams are still
    // loaded, would upload them into this account.
    userId: user && isPro && loadedScope === user.id ? user.id : null,
    hasInitialized,
    graphs,
    projects,
    applyRemote,
  });

  // A signed-in Supporter's local store can be empty simply because the first
  // cloud pull hasn't landed yet, used below to avoid creating (and syncing
  // up) a throwaway blank graph before we've heard whether the cloud has data.
  // 'disabled' counts too: for a Supporter it means the sync loop hasn't picked
  // this account up yet, which is still "before the first pull". Without it
  // there's a render where the store looks empty and the editor would create a
  // blank diagram (and upload it) moments before the real data arrives.
  const awaitingFirstPull =
    cloudConfigured && !!user && isPro &&
    syncState.lastSyncedAt === null &&
    (syncState.status === 'idle' || syncState.status === 'syncing' || syncState.status === 'disabled');

  // The first pull did not just fail to arrive, it failed outright. We cannot
  // tell whether this account's cloud is empty, so any decision that depends on
  // "the account has nothing" has to stay unresolved.
  const firstPullFailed =
    cloudConfigured && !!user && isPro &&
    syncState.lastSyncedAt === null &&
    (syncState.status === 'error' || syncState.status === 'offline');

  // --- Load shared editor preferences on mount ---
  // Diagrams and projects are NOT loaded here: they belong to whichever account
  // is signed in, which isn't known until the session has been restored. See
  // the scope effect below.
  useEffect(() => {
    // Open the diagram store (and migrate into it) early. Reads wait on this
    // internally, so this is just a head start, not a prerequisite.
    void initLocalStore();
    // Ask the browser not to evict saved diagrams when disk runs low.
    void requestPersistentStorage();
    try {
      const savedSettings = localStorage.getItem(STORAGE_KEYS.settings);
      const savedSpecial = localStorage.getItem(STORAGE_KEYS.specialColors);
      const savedStandard = localStorage.getItem(STORAGE_KEYS.standardColors);

      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings(s => ({ ...s, ...parsed }));
      }
      if (savedSpecial) {
        const parsed = JSON.parse(savedSpecial);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          setSpecialColors(parsed);
        }
      }
      if (savedStandard) {
        const parsed = JSON.parse(savedStandard);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setStandardColors(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to load preferences from localStorage:', e);
    }
  }, []);

  // --- Per-account local data ---
  // Everyone who uses this browser gets their own namespace: one per signed-in
  // account, plus a shared "guest" one for work done signed out. Switching
  // accounts swaps which namespace is live, and never deletes the other one.
  useEffect(() => {
    if (storeScope === null || storeScope === loadedScope) return;
    // This effect is about to read the incoming namespace off disk, and a
    // finished handover was written to disk before it ever got here, so that
    // read already includes it. Dropping the held copy avoids replaying it over
    // whatever the read (or a sync that ran meanwhile) turned up. Note this sits
    // after the early return above: coming back to a namespace that never
    // stopped being the loaded one does no read, and must not discard anything.
    setPendingAdopted(null);
    let cancelled = false;
    void (async () => {
      const stored = await readScope(storeScope);
      // Signing in with nothing of your own, over work done signed out, is the
      // one case where the two might be joined. Resolve it here so the editor
      // waits for that decision instead of creating a blank diagram meanwhile.
      const guestPending =
        stored.ok
        && storeScope !== GUEST_SCOPE
        && stored.graphs.length === 0
        && stored.projects.length === 0
        && await scopeHasContent(GUEST_SCOPE);
      // The account may have changed again while this was loading; whichever
      // effect run matches the live namespace is the one allowed to apply.
      if (cancelled) return;

      setGraphs(stored.graphs);
      setProjects(stored.projects);
      setPendingGuestAdoption(guestPending);
      // Drop timers armed by the outgoing account. A pending autosave would
      // write its diagram into this namespace, and a pending history push would
      // put it in the new account's undo stack.
      if (historyDebounceRef.current !== null) {
        window.clearTimeout(historyDebounceRef.current);
        historyDebounceRef.current = null;
      }
      if (autosaveDebounceRef.current !== null) {
        window.clearTimeout(autosaveDebounceRef.current);
        autosaveDebounceRef.current = null;
      }
      // Close whatever was open and blank the canvas: it belongs to the
      // namespace we're leaving. The auto-open effect below picks this
      // account's most recent diagram once its data is in place.
      setActiveGraphId(null);
      const blank = { ...EMPTY_DIAGRAM };
      setCurrentDiagram(blank);
      setHistory([blank]);
      historyRef.current = [blank];
      // undo/redo read the ref, not the state. Leaving it stale lets Ctrl+Z
      // index past the end of the new one-item history and feed undefined into
      // the canvas.
      historyIndexRef.current = 0;
      setHistoryIndex(0);
      // `loadedScope` records which namespace this effect has settled, so it is
      // set either way: leaving it behind on a failure would re-run the effect
      // forever, and leaving it pointing at the *previous* account would let
      // that account's library be overwritten with this one's empty arrays the
      // moment the user switched back. Whether saving is allowed is a separate
      // question, and `storageUnreadable` is what answers it.
      setLoadedScope(storeScope);
      setStorageUnreadable(!stored.ok);
      if (!stored.ok) {
        console.error(`Could not read local storage for ${storeScope}; saving is off so it is not overwritten.`);
      }
      setHasInitialized(true);
    })();
    return () => { cancelled = true; };
  }, [storeScope, loadedScope]);

  // --- Hand guest work to the account that signs in ---
  // Work done signed out should follow you into your account, but only when
  // doing so can't mix it into diagrams that are already there. So we adopt it
  // only if this account has nothing of its own, and for Supporters only once
  // the first cloud pull has told us whether the account is really empty.
  // Otherwise the guest namespace is left untouched, and signing out returns to
  // it intact.
  useEffect(() => {
    if (storeScope === null) return;
    const decision = decideGuestAdoption({
      pending: pendingGuestAdoption,
      scopeReady: loadedScope === storeScope,
      awaitingFirstPull,
      firstPullFailed,
      accountHasContent: graphs.length > 0 || projects.length > 0,
    });
    if (decision === 'wait') return;

    // Settle the decision before awaiting anything, so this can't run twice and
    // hand the same work over twice.
    setPendingGuestAdoption(false);
    // 'keep-separate': the account brought its own diagrams (pulled from the
    // cloud), so the signed-out work stays where it is, ready for next time.
    if (decision !== 'adopt') return;

    // `pendingGuestAdoption` is already false by now, so on its own it no longer
    // holds the auto-open effect back. Without this second flag that effect sees
    // an empty library, creates a blank diagram and syncs it up, and the adopted
    // graphs then replace it locally while the stray row stays in the cloud.
    setAdoptingGuestWork(true);
    // Deliberately no effect-scoped `cancelled` flag. Setting
    // `pendingGuestAdoption` above re-runs this effect, which would trip such a
    // flag immediately, and the copy is not conditional on this effect still
    // being current: it moves the diagrams on disk either way.
    const adoptingInto = storeScope;
    void (async () => {
      try {
        const adopted = await adoptScope(GUEST_SCOPE, adoptingInto);
        // null means the copy failed and the work is still in the guest
        // namespace. Leave this account empty rather than showing diagrams that
        // were not actually saved to it.
        if (!adopted) return;
        // Recorded, not published. Deciding here whether the namespace is still
        // live means reading state this closure captured before the await, and
        // every version of that check has been wrong in a way that ends with
        // the adopted diagrams being overwritten by a blank one.
        setPendingAdopted({ scope: adoptingInto, graphs: adopted.graphs, projects: adopted.projects });
      } finally {
        setAdoptingGuestWork(false);
      }
    })();
  }, [pendingGuestAdoption, storeScope, loadedScope, awaitingFirstPull, firstPullFailed, graphs.length, projects.length]);

  // Publish an adopted library once its namespace is the live one. Running as
  // an effect is the point: it reads `storeScope` and `loadedScope` as they are
  // now, not as they were when the copy started, and it waits rather than
  // discarding. An account switch mid-copy therefore parks the diagrams here
  // until that account is back, and if the switch away completed, the load
  // effect clears this because its own read of the disk already has them.
  useEffect(() => {
    if (!pendingAdopted) return;
    if (storeScope !== pendingAdopted.scope || loadedScope !== pendingAdopted.scope) return;
    setGraphs(pendingAdopted.graphs);
    setProjects(pendingAdopted.projects);
    setPendingAdopted(null);
  }, [pendingAdopted, storeScope, loadedScope]);

  // Keep live refs in sync for dep-free callbacks (see applyRemote).
  // Synced in effects rather than assigned during render: React may discard a
  // render pass, and a ref written in the body would keep the value from that
  // abandoned pass. Every reader below runs in an async callback after commit,
  // so a one-commit lag is not observable.
  useEffect(() => { activeGraphIdRef.current = activeGraphId; }, [activeGraphId]);
  useEffect(() => { currentDiagramRef.current = currentDiagram; }, [currentDiagram]);
  useEffect(() => { loadedScopeRef.current = loadedScope; }, [loadedScope]);

  // --- Auto-open most recent graph logic ---
  useEffect(() => {
    // Only run when navigating to editor without an active graph, after initialization
    if (view !== 'editor' || activeGraphId || !hasInitialized) {
      return;
    }

    if (graphs.length > 0) {
      // Open most recently modified graph
      const sorted = [...graphs].sort((a, b) => b.lastModified - a.lastModified);
      const mostRecent = sorted[0];
      setActiveGraphId(mostRecent.id);
      setCurrentDiagram(mostRecent.diagramData);
      setHistory([mostRecent.diagramData]);
      historyRef.current = [mostRecent.diagramData];
      setHistoryIndex(0);
    } else if (graphs.length === 0) {
      // Wait for the first cloud pull before assuming a Supporter has no graphs
      //, otherwise we'd create a blank one and sync it up as clutter.
      if (awaitingFirstPull) return;
      // Likewise, don't create one while work done signed out is about to be
      // handed to this account: that would leave a stray blank diagram beside it
      // (and select it, since the graph below is chosen unconditionally).
      // A failed pull leaves that decision unresolved indefinitely, so don't
      // hold the editor hostage to it.
      if (pendingGuestAdoption && !firstPullFailed) return;
      // The copy itself is a bounded local operation, so once it is actually
      // running, always wait for it: `firstPullFailed` says nothing about
      // whether the diagrams are about to arrive.
      if (adoptingGuestWork) return;
      // Copy finished, waiting to be published into this namespace. Creating a
      // blank graph in the gap would be saved over it. Scoped to this namespace
      // on purpose: a handover parked for another account must not stop this
      // one getting its starting diagram.
      if (pendingAdopted && pendingAdopted.scope === storeScope) return;
      // Create new graph if none exist
      const newGraph: Graph = {
        id: generateId(),
        title: EMPTY_DIAGRAM.title,
        titleSetByUser: false,
        caption: EMPTY_DIAGRAM.caption || 'Figure 1: Economic Diagram',
        messages: [],
        diagramData: { ...EMPTY_DIAGRAM },
        createdAt: Date.now(),
        lastModified: Date.now(),
      };
      // Use functional update to ensure we're working with latest state
      setGraphs(prev => {
        // Guard: if graphs were just added by another effect/action, don't create duplicate
        if (prev.length > 0) return prev;
        return [newGraph];
      });
      setActiveGraphId(newGraph.id);
      setCurrentDiagram(newGraph.diagramData);
      setHistory([newGraph.diagramData]);
      historyRef.current = [newGraph.diagramData];
      setHistoryIndex(0);
    }
  }, [view, hasInitialized, activeGraphId, graphs.length, awaitingFirstPull, pendingGuestAdoption, adoptingGuestWork, pendingAdopted, storeScope, firstPullFailed]); // Use graphs.length instead of graphs to avoid re-trigger on content changes

  // --- Save to localStorage when data changes (only after initial load) ---
  // Only write once the namespace in memory is the one we last loaded. During an
  // account switch those differ for a render, and writing then would save the
  // outgoing account's diagrams over the incoming account's.
  useEffect(() => {
    if (!hasInitialized || storageUnreadable || loadedScope === null || loadedScope !== storeScope) return;
    void writeGraphs(loadedScope, graphs);
  }, [graphs, hasInitialized, storageUnreadable, loadedScope, storeScope]);

  useEffect(() => {
    if (!hasInitialized || storageUnreadable || loadedScope === null || loadedScope !== storeScope) return;
    void writeProjects(loadedScope, projects);
  }, [projects, hasInitialized, storageUnreadable, loadedScope, storeScope]);

  useEffect(() => {
    if (!hasInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({
        showGrid: settings.showGrid,
        gridSize: settings.gridSize,
        snapToGrid: settings.snapToGrid,
        snapToPoints: settings.snapToPoints,
        moveTogether: settings.moveTogether,
        snapThreshold: settings.snapThreshold
      }));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }, [settings, hasInitialized]);

  useEffect(() => {
    if (!hasInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEYS.specialColors, JSON.stringify(specialColors));
    } catch (e) {
      console.error('Failed to save special colors:', e);
    }
  }, [specialColors, hasInitialized]);

  useEffect(() => {
    if (!hasInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEYS.standardColors, JSON.stringify(standardColors));
    } catch (e) {
      console.error('Failed to save standard colors:', e);
    }
  }, [standardColors, hasInitialized]);

  // --- Navigation Functions ---
  const navigateToView = useCallback((newView: RoutableView) => {
    const path = newView === 'landing' ? '/' : PATH_FOR_VIEW[newView];
    if (!path) {
      // Only reachable if a view was added without a route in routes.mjs, which
      // the build guard rejects. Staying put is worse than navigating but better
      // than showing the view at a URL that 404s the moment anyone reloads.
      console.error(`navigateToView: no route for view "${newView}".`);
      return;
    }
    setView(newView);
    window.history.pushState({}, '', path);
  }, []);

  // Listen for browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parsePath(window.location.pathname);
      setView(parsed.view);
      setSharedSlug(parsed.sharedSlug);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Keep the document title and canonical URL in sync with the SPA route so
  // content routes (/pricing, /compare) self-canonicalize instead of being
  // seen as duplicates of the homepage's hardcoded canonical.
  const countedFirstViewRef = useRef(false);
  useEffect(() => {
    const SITE = 'https://ib-econgraph-ai.vercel.app';
    const meta: Record<string, { title: string; path: string }> = {
      landing: { title: 'IB EconGraph AI: Free AI-Powered Economics Diagram Editor', path: '/' },
      pricing: { title: 'Pricing · Free Forever · IB EconGraph AI', path: '/pricing' },
      compare: { title: 'How IB EconGraph AI Compares: IB Economics Diagram Tools', path: '/compare' },
      privacy: { title: 'Privacy Policy · IB EconGraph AI', path: '/privacy' },
      terms: { title: 'Terms of Service · IB EconGraph AI', path: '/terms' },
    };
    // App-only views (home/editor/settings/shared) canonicalize to the homepage.
    const entry = meta[view] ?? { title: 'IB EconGraph AI: Free Economics Diagram Editor', path: '/' };
    document.title = entry.title;
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = SITE + entry.path;

    // GoatCounter counts the first load itself (the tag in index.html), so only
    // report navigations after that, otherwise every visit double-counts its
    // entry page. Views with no metadata entry are app UI rather than content;
    // report the real path for those, minus any share slug, which is a
    // capability token and must not reach an analytics endpoint.
    if (!countedFirstViewRef.current) {
      countedFirstViewRef.current = true;
      return;
    }
    const countedPath = meta[view]
      ? entry.path
      : window.location.pathname.replace(/^\/s\/[^/]+\/?$/, '/s/');
    // Optional chaining throughout: the tag is `async`, so on a fast navigation
    // it may not have loaded yet. A missed count is fine; a crash is not.
    const gc = (window as unknown as {
      goatcounter?: { count?: (opts: { path: string; title: string }) => void };
    }).goatcounter;
    gc?.count?.({ path: countedPath, title: entry.title });
  }, [view]);

  // Scroll the chat to the bottom when a message is added to the open graph (or
  // when switching graphs), not on every diagram edit, which also mutates
  // `graphs` but leaves the message list unchanged.
  const activeMessageCount = graphs.find(g => g.id === activeGraphId)?.messages.length ?? 0;
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessageCount, activeGraphId]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (historyDebounceRef.current) window.clearTimeout(historyDebounceRef.current);
    if (autosaveDebounceRef.current) window.clearTimeout(autosaveDebounceRef.current);
    if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
  }, []);

  // --- History Management ---
  const historyIndexRef = useRef(-1);
  const historyRef = useRef<DiagramData[]>([]);

  const pushToHistory = useCallback((data: DiagramData) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndexRef.current + 1);
      newHistory.push(JSON.parse(JSON.stringify(data)));
      const result = newHistory.slice(-50);
      historyRef.current = result;
      historyIndexRef.current = result.length - 1;
      return result;
    });
    setHistoryIndex(historyIndexRef.current);
  }, []);

  const scheduleHistoryPush = useCallback((data: DiagramData) => {
    if (historyDebounceRef.current) window.clearTimeout(historyDebounceRef.current);
    historyDebounceRef.current = window.setTimeout(() => pushToHistory(data), 250);
  }, [pushToHistory]);

  /**
   * `fromCanvasEdit` distinguishes a direct edit on the canvas from the other
   * callers (undo/redo, clear, restoring an older version or a chat message).
   * Only a direct edit can mean the user retitled the graph; the rest replay a
   * title that was already chosen for them, and treating those as a rename
   * would freeze the title against future AI generations.
   */
  const scheduleAutosave = useCallback((data: DiagramData, fromCanvasEdit = false) => {
    if (!activeGraphId) return;
    if (autosaveDebounceRef.current) window.clearTimeout(autosaveDebounceRef.current);
    autosaveDebounceRef.current = window.setTimeout(() => {
      // Clear the handle first: applyRemote reads this ref to mean "unsaved
      // edits are in flight, don't overwrite the canvas". Left set, it stays
      // true forever after the first autosave and cross-device pulls silently
      // stop refreshing the open diagram.
      autosaveDebounceRef.current = null;
      setGraphs(prev => prev.map(g =>
        g.id === activeGraphId
          ? {
            ...g,
            diagramData: data,
            title: data.title,
            // Editing the title directly on the canvas counts as naming it.
            // Only a real change flips this; ordinary canvas edits carry the
            // existing title through unchanged.
            titleSetByUser: g.titleSetByUser || (fromCanvasEdit && data.title !== g.title),
            lastModified: Date.now(),
          }
          : g
      ));
    }, 200);
  }, [activeGraphId]);

  const handleDataChange = useCallback((newData: DiagramData) => {
    setCurrentDiagram(newData);
    scheduleHistoryPush(newData);
    scheduleAutosave(newData, true);
  }, [scheduleHistoryPush, scheduleAutosave]);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      const nextIndex = historyIndexRef.current - 1;
      historyIndexRef.current = nextIndex;
      setHistoryIndex(nextIndex);
      const diagram = historyRef.current[nextIndex];
      setCurrentDiagram(diagram);
      scheduleAutosave(diagram);
    }
  }, [scheduleAutosave]);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      const nextIndex = historyIndexRef.current + 1;
      historyIndexRef.current = nextIndex;
      setHistoryIndex(nextIndex);
      const diagram = historyRef.current[nextIndex];
      setCurrentDiagram(diagram);
      scheduleAutosave(diagram);
    }
  }, [scheduleAutosave]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        redo();
      }

      // Tool shortcuts
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 's') setActiveTool('select');
        else if (key === 'b') setActiveTool('boxSelect');
        else if (key === 'l') setActiveTool('line');
        else if (key === 'c') setActiveTool('curve');
        else if (key === 'p') setActiveTool('point');
        else if (key === 't') setActiveTool('label');
        else if (key === 'f') setActiveTool('fill');
        else if (key === 'e') setActiveTool('eraser');
        else if (key === 'h') setActiveTool('pan');
        else if (key === 'escape') setActiveTool('select');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // --- Graph Management ---
  const createGraph = useCallback((projectId?: string): string => {
    const newGraph: Graph = {
      id: generateId(),
      title: EMPTY_DIAGRAM.title,
      titleSetByUser: false,
      caption: EMPTY_DIAGRAM.caption || 'Figure 1: Economic Diagram',
      projectId,
      messages: [],
      diagramData: { ...EMPTY_DIAGRAM },
      createdAt: Date.now(),
      lastModified: Date.now(),
    };
    setGraphs(prev => [newGraph, ...prev]);
    return newGraph.id;
  }, []);

  const openGraph = useCallback((graphId: string) => {
    const graph = graphs.find(g => g.id === graphId);
    if (graph) {
      setActiveGraphId(graphId);
      setCurrentDiagram(graph.diagramData);
      setHistory([graph.diagramData]);
      historyRef.current = [graph.diagramData];
      setHistoryIndex(0);
      navigateToView('editor');
    }
  }, [graphs, navigateToView]);

  const deleteGraph = useCallback((graphId: string) => {
    setConfirmModal({
      visible: true,
      title: 'Delete Graph',
      message: 'Are you sure you want to delete this graph? This cannot be undone.',
      confirmText: 'Delete',
      danger: true,
      onConfirm: () => {
        setGraphs(prev => prev.filter(g => g.id !== graphId));
        recordTombstones('graphs', [graphId]);
        if (activeGraphId === graphId) {
          setActiveGraphId(null);
          navigateToView('home');
        }
        setConfirmModal(c => ({ ...c, visible: false }));
      }
    });
  }, [activeGraphId, navigateToView]);

  // Delete multiple graphs directly without showing confirmation modal
  // (Used for bulk delete where HomePage shows the confirmation)
  const deleteGraphsDirect = useCallback((graphIds: string[]) => {
    setGraphs(prev => prev.filter(g => !graphIds.includes(g.id)));
    recordTombstones('graphs', graphIds);
    // If active graph is being deleted, go to home
    if (activeGraphId && graphIds.includes(activeGraphId)) {
      setActiveGraphId(null);
      navigateToView('home');
    }
  }, [activeGraphId, navigateToView]);

  // --- Project Management ---
  const createProject = useCallback(() => {
    setPromptModal({
      visible: true,
      title: 'New Project',
      message: 'Enter a name for your project:',
      defaultValue: '',
      onConfirm: (name) => {
        if (name.trim()) {
          const newProject: Project = {
            id: generateId(),
            name: name.trim(),
            description: '',
            color: PROJECT_COLORS[projects.length % PROJECT_COLORS.length],
            createdAt: Date.now(),
            lastModified: Date.now(),
          };
          setProjects(prev => [...prev, newProject]);
        }
        setPromptModal(p => ({ ...p, visible: false }));
      }
    });
  }, [projects.length]);

  const deleteProject = useCallback((projectId: string) => {
    setConfirmModal({
      visible: true,
      title: 'Delete Project',
      message: 'Are you sure you want to delete this project? Graphs in this project will become unassigned.',
      confirmText: 'Delete',
      danger: true,
      onConfirm: () => {
        setProjects(prev => prev.filter(p => p.id !== projectId));
        recordTombstones('projects', [projectId]);
        // Unassign graphs from this project
        setGraphs(prev => prev.map(g =>
          g.projectId === projectId ? { ...g, projectId: undefined, lastModified: Date.now() } : g
        ));
        setConfirmModal(c => ({ ...c, visible: false }));
      }
    });
  }, []);

  const renameProject = useCallback((projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    setPromptModal({
      visible: true,
      title: 'Rename Project',
      message: 'Enter a new name for this project:',
      defaultValue: project.name,
      onConfirm: (newName: string) => {
        if (newName.trim()) {
          setProjects(prev => prev.map(p =>
            p.id === projectId ? { ...p, name: newName.trim(), lastModified: Date.now() } : p
          ));
        }
        setPromptModal(p => ({ ...p, visible: false }));
      }
    });
  }, [projects]);

  const renameGraph = useCallback((graphId: string) => {
    const graph = graphs.find(g => g.id === graphId);
    if (!graph) return;

    setPromptModal({
      visible: true,
      title: 'Rename Graph',
      message: 'Enter a new name for this graph:',
      defaultValue: graph.diagramData.title || graph.title,
      onConfirm: (newName: string) => {
        if (newName.trim()) {
          setGraphs(prev => prev.map(g =>
            g.id === graphId ? {
              ...g,
              title: newName.trim(),
              titleSetByUser: true,
              diagramData: { ...g.diagramData, title: newName.trim() },
              lastModified: Date.now()
            } : g
          ));
        }
        setPromptModal(p => ({ ...p, visible: false }));
      }
    });
  }, [graphs]);

  // --- Actions ---
  const moveGraphsToProject = useCallback((graphIds: string[], projectId: string | null) => {
    setGraphs(prev => prev.map(g =>
      graphIds.includes(g.id) ? { ...g, projectId: projectId || undefined, lastModified: Date.now() } : g
    ));
  }, []);

  const handleImportData = useCallback(async (data: { graphs: Graph[]; projects: Project[]; specialColors?: string[]; standardColors?: string[] }) => {
    // Import replaces everything, tombstone current items missing from the
    // backup so cloud sync propagates the replacement instead of undoing it.
    // Bind the restore to the namespace it started in. Signing in or out during
    // the cloud read below would otherwise drop this backup, and the deletions
    // that come with it, into whichever account happens to be live by then.
    const startedIn = loadedScopeRef.current;

    const importedGraphIds = new Set(data.graphs.map(g => g.id));
    const importedProjectIds = new Set(data.projects.map(p => p.id));
    const graphTombstones = graphs.filter(g => !importedGraphIds.has(g.id)).map(g => g.id);
    const projectTombstones = projects.filter(p => !importedProjectIds.has(p.id)).map(p => p.id);

    // Cloud rows that live only on another device were never in local `graphs`,
    // so the filter above can't tombstone them, without this, the next sync
    // pulls them back and the "replace everything" restore silently resurrects
    // diagrams the backup was meant to drop. Best-effort: null when offline.
    //
    // This has to finish BEFORE the imported state is published: publishing
    // schedules a sync, and a sync that runs while these tombstones are still
    // missing merges the remote-only rows straight back in.
    const cloud = await fetchCloudIds();

    // Nothing above this point has written anything, so abandoning here leaves
    // no trace in either account.
    if (loadedScopeRef.current !== startedIn) {
      setConfirmModal({
        visible: true,
        title: 'Restore cancelled',
        message: 'The account changed while the backup was being restored, so nothing was imported. Please try again.',
        confirmText: 'OK',
        danger: false,
        onConfirm: () => setConfirmModal(c => ({ ...c, visible: false })),
      });
      return;
    }

    if (cloud) {
      graphTombstones.push(...cloud.graphIds.filter(id => !importedGraphIds.has(id)));
      projectTombstones.push(...cloud.projectIds.filter(id => !importedProjectIds.has(id)));
    }
    recordTombstones('graphs', graphTombstones);
    recordTombstones('projects', projectTombstones);

    // Restored items must win last-write-wins against any wiped/tombstoned
    // remote rows, and must not collide with a stale tombstone of the same id.
    // Stamped after the await so they are newer than every tombstone above.
    const now = Date.now();
    clearTombstones('graphs', data.graphs.map(g => g.id));
    clearTombstones('projects', data.projects.map(p => p.id));
    setGraphs(data.graphs.map(g => ({ ...g, lastModified: now })));
    setProjects(data.projects.map(p => ({ ...p, lastModified: now })));
    if (data.specialColors && Array.isArray(data.specialColors) && data.specialColors.length >= 2) {
      setSpecialColors(data.specialColors);
    }
    if (data.standardColors && Array.isArray(data.standardColors) && data.standardColors.length > 0) {
      setStandardColors(data.standardColors);
    }
    // Reset active graph since the data has changed
    setActiveGraphId(null);
  }, [graphs, projects]);

  const startFromHome = useCallback((projectId?: string) => {
    const graphId = createGraph(projectId);
    openGraph(graphId);
  }, [createGraph, openGraph]);

  const startFreshDiagram = () => {
    const graphId = createGraph();
    openGraph(graphId);
  };

  const activeGraph = useMemo(
    () => graphs.find(g => g.id === activeGraphId) || null,
    [graphs, activeGraphId]
  );

  /**
   * A share stores a snapshot of `graph.diagramData`, but that field trails the
   * canvas by the autosave debounce. Creating a link straight after an edit
   * would publish the pre-edit diagram, so hand the share the live canvas.
   */
  const shareGraph = useMemo(
    () => (activeGraph ? { ...activeGraph, diagramData: currentDiagram, title: currentDiagram.title } : null),
    [activeGraph, currentDiagram]
  );

  // Latest graphs, readable from async callbacks that would otherwise close
  // over the snapshot taken before an `await` (e.g. a rename the user makes
  // while a generation is still in flight).
  const graphsRef = useRef(graphs);
  useEffect(() => { graphsRef.current = graphs; }, [graphs]);

  const projectGraphs = useMemo(() => {
    if (!activeGraph) return [];
    if (activeGraph.projectId) {
      // Return graphs in the same project
      return graphs.filter(g => g.projectId === activeGraph.projectId);
    } else {
      // Return other unassigned graphs
      return graphs.filter(g => !g.projectId && g.id !== activeGraph.id);
    }
  }, [graphs, activeGraph]);

  const currentProject = useMemo(
    () => activeGraph?.projectId ? projects.find(p => p.id === activeGraph.projectId) : null,
    [activeGraph, projects]
  );

  // Single source of truth for AI-availability gating, shared by the chat
  // submit guard and the editor warning banner so the two can't drift. Reads
  // getAIProvider()/hasApiKey() fresh each call to reflect the latest settings.
  const computeAiGate = useCallback((): AiGate => {
    if (getAIProvider() === 'hosted') {
      if (!user) return 'hosted-signin';
      if (!isPro) return 'hosted-upgrade';
      return null;
    }
    return hasApiKey() ? null : 'byok-nokey';
  }, [user, isPro]);

  const handleSubmit = useCallback(async (e?: React.FormEvent, customPrompt?: string) => {
    if (e) e.preventDefault();
    const promptText = customPrompt || prompt;
    if (!promptText.trim() || !activeGraphId) return;

    // Check the AI provider is usable before sending
    const gate = computeAiGate();
    const aiBlockedMessage =
      gate === 'hosted-signin'
        ? 'Sign in (Settings > Account) to use hosted AI, or switch to a free provider with your own API key.'
        : gate === 'hosted-upgrade'
          ? 'Hosted AI is part of the Supporter plan. Upgrade on the Pricing page, or use your own free API key in Settings.'
          : gate === 'byok-nokey'
            ? 'API key not configured. Please add your API key in Settings before using AI features.'
            : null;
    if (aiBlockedMessage) {
      const errorMsg: Message = {
        id: generateId(),
        role: 'model',
        content: aiBlockedMessage,
        timestamp: Date.now()
      };
      setGraphs(prev => prev.map(g => {
        if (g.id === activeGraphId) {
          return { ...g, messages: [...g.messages, errorMsg] };
        }
        return g;
      }));
      return;
    }

    setIsLoading(true);
    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: promptText,
      timestamp: Date.now()
    };

    // Update graph with user message
    setGraphs(prev => prev.map(g => {
      if (g.id === activeGraphId) {
        return {
          ...g,
          messages: [...g.messages, userMsg],
          lastModified: Date.now()
        };
      }
      return g;
    }));
    setPrompt('');

    try {
      const history = activeGraph?.messages.map(m => `${m.role}: ${m.content}`) || [];
      const result = await generateDiagramData(promptText, history);

      // Once the user has named the graph, that name is theirs and a later
      // generation must not silently overwrite it. This keys off an explicit
      // flag rather than the title itself: inferring it from "title differs
      // from the default" locked the graph to whatever the *first* generation
      // called it, because that generation writes its title back below.
      // Read the graph as it is *now*, not as it was when the request was sent,
      // so a rename made while this was generating still wins.
      const liveGraph = graphsRef.current.find(g => g.id === activeGraphId) || null;
      const userNamed = !!liveGraph && (
        liveGraph.titleSetByUser
        // Graphs saved before the flag existed: fall back to the old heuristic
        // so an existing hand-picked title is never overwritten.
        ?? (liveGraph.title.trim() !== '' && liveGraph.title !== EMPTY_DIAGRAM.title)
      );
      const nextDiagram = userNamed ? { ...result, title: liveGraph!.title } : result;

      const aiMsg: Message = {
        id: generateId(),
        role: 'model',
        content: `Here is the diagram for "${promptText}". You can drag points to adjust curves or double click labels to edit them.`,
        diagramData: nextDiagram,
        timestamp: Date.now()
      };

      setGraphs(prev => prev.map(g => {
        if (g.id === activeGraphId) {
          return {
            ...g,
            messages: [...g.messages, aiMsg],
            diagramData: nextDiagram,
            title: nextDiagram.title,
            lastModified: Date.now()
          };
        }
        return g;
      }));
      setCurrentDiagram(nextDiagram);
      pushToHistory(nextDiagram);

    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : 'Sorry, I encountered an error generating the diagram. Please try again.';
      const errorMsg: Message = {
        id: generateId(),
        role: 'model',
        content: message,
        timestamp: Date.now()
      };
      setGraphs(prev => prev.map(g => {
        if (g.id === activeGraphId) {
          return { ...g, messages: [...g.messages, errorMsg] };
        }
        return g;
      }));
    } finally {
      setIsLoading(false);
    }
  }, [activeGraphId, activeGraph, prompt, pushToHistory, setGraphs, computeAiGate]);

  const handleNewChat = useCallback(() => {
    if (!activeGraphId) return;

    setConfirmModal({
      visible: true,
      title: 'Start a new chat?'
      ,
      message: "This will clear the chat history (not the diagram). This cannot be undone.",
      confirmText: 'Clear chat history',
      danger: true,
      onConfirm: () => {
        setGraphs(prev => prev.map(g => {
          if (g.id === activeGraphId) {
            return { ...g, messages: [], lastModified: Date.now() };
          }
          return g;
        }));
        setPrompt('');
        setConfirmModal(c => ({ ...c, visible: false }));
      }
    });
  }, [activeGraphId, setGraphs]);

  const pendingPromptRef = useRef<string | null>(null);

  useEffect(() => {
    if (pendingPromptRef.current && activeGraphId) {
      const prompt = pendingPromptRef.current;
      pendingPromptRef.current = null;
      handleSubmit(undefined, prompt);
    }
  }, [activeGraphId, handleSubmit]);

  const startWithPreset = (presetName: string) => {
    const graphId = createGraph();
    openGraph(graphId);
    setCurrentDiagram({ ...EMPTY_DIAGRAM });
    setHistory([{ ...EMPTY_DIAGRAM }]);
    historyRef.current = [{ ...EMPTY_DIAGRAM }];
    setHistoryIndex(0);
    historyIndexRef.current = 0;
    setPrompt(presetName);
    pendingPromptRef.current = presetName;
  };

  // Handle label editing
  const handleLabelEdit = (type: string, index: number, currentValue: string) => {
    let title = 'Edit Label';
    if (type === 'title') title = 'Edit Title';
    else if (type === 'axisX') title = 'Edit X-Axis Label';
    else if (type === 'axisY') title = 'Edit Y-Axis Label';
    else if (type === 'curve') title = 'Edit Curve Label';
    else if (type === 'region') title = 'Edit Region Label';
    else if (type === 'annotation') title = 'Edit Point Label';
    else if (type === 'textLabel') title = 'Edit Text Label';
    else if (type === 'caption') title = 'Edit Figure Caption';

    setPromptModal({
      visible: true,
      title,
      message: `Enter new ${type === 'title' ? 'title' : type === 'caption' ? 'caption' : 'label'}:`,
      defaultValue: currentValue,
      onConfirm: (value: string) => {
        const newData = { ...currentDiagram };
        if (type === 'title') newData.title = value;
        else if (type === 'caption') newData.caption = value;
        else if (type === 'axisX') newData.xAxis = { ...newData.xAxis, label: value };
        else if (type === 'axisY') newData.yAxis = { ...newData.yAxis, label: value };
        else if (type === 'curve') newData.curves = newData.curves.map((c, i) => i === index ? { ...c, label: value } : c);
        else if (type === 'region') newData.shadedRegions = newData.shadedRegions.map((r, i) => i === index ? { ...r, label: value } : r);
        else if (type === 'annotation') newData.annotatedPoints = newData.annotatedPoints.map((p, i) => i === index ? { ...p, label: value } : p);
        else if (type === 'textLabel' && newData.textLabels) newData.textLabels = newData.textLabels.map((l, i) => i === index ? { ...l, text: value } : l);

        handleDataChange(newData);
        setPromptModal(p => ({ ...p, visible: false }));
      }
    });
  };

  // Clear canvas
  const handleClearCanvas = () => {
    setConfirmModal({
      visible: true,
      title: 'Clear Canvas',
      message: 'Are you sure you want to clear all elements from the canvas? This cannot be undone.',
      confirmText: 'Clear All',
      danger: true,
      onConfirm: () => {
        setCurrentDiagram(EMPTY_DIAGRAM);
        pushToHistory(EMPTY_DIAGRAM);
        scheduleAutosave(EMPTY_DIAGRAM);
        setConfirmModal(c => ({ ...c, visible: false }));
      }
    });
  };

  // Add component from library
  const handleAddComponent = (template: ComponentTemplate) => {
    const newData = { ...currentDiagram };

    if (template.data.curves) {
      template.data.curves.forEach(curve => {
        const newCurve = { ...curve, id: `curve-${generateId()}` };
        newData.curves = [...newData.curves, newCurve];
      });
    }

    if (template.data.shadedRegions) {
      template.data.shadedRegions.forEach(region => {
        const newRegion = { ...region, id: `region-${generateId()}` };
        newData.shadedRegions = [...newData.shadedRegions, newRegion];
      });
    }

    if (template.data.annotatedPoints) {
      const newPoints = template.data.annotatedPoints.map(p => ({
        ...p,
        id: `point-${generateId()}`
      }));
      newData.annotatedPoints = [...newData.annotatedPoints, ...newPoints];
    }

    if (template.data.textLabels && template.data.textLabels.length > 0) {
      const newLabels = template.data.textLabels.map(l => ({
        ...l,
        id: `label-${generateId()}`
      }));
      newData.textLabels = [...(newData.textLabels ?? []), ...newLabels];
    }

    handleDataChange(newData);
  };

  const handleColorChange = () => {
    setColorModal({
      visible: true,
      currentColor: activeColor,
      onSelect: (color: string) => {
        // Just update the active color, don't close the modal
        // This allows users to edit color slots without the modal closing
        setActiveColor(color);
      }
    });
  };

  const handleUpdateSpecialColor = (index: number, color: string) => {
    setSpecialColors(prev => {
      const next = [...prev];
      if (index >= 0 && index < next.length) {
        next[index] = color;
      }
      return next;
    });
  };

  const handleUpdateStandardColor = (index: number, color: string) => {
    setStandardColors(prev => {
      const next = [...prev];
      if (index >= 0 && index < next.length) {
        next[index] = color;
      }
      return next;
    });
  };

  const handleResetSpecialColors = () => {
    setSpecialColors(DEFAULT_SPECIAL_COLORS);
  };

  const handleResetStandardColors = () => {
    setStandardColors(DEFAULT_STANDARD_COLORS);
  };

  const restoreCheckpoint = (msg: Message) => {
    if (msg.diagramData) {
      setCurrentDiagram(msg.diagramData);
      pushToHistory(msg.diagramData);
      scheduleAutosave(msg.diagramData);
    }
  };

  const handleDownload = () => {
    setExportModalOpen(true);
  };

  const handleDownloadReady = useCallback((url: string) => {
    if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
    downloadUrlRef.current = url;
    setDownloadUrl(url);
  }, []);

  const suggestions = [
    "Monopoly with Deadweight Loss",
    "Negative Externality & Tax",
    "Price Ceiling Shortage",
    "Perfect Competition Long Run"
  ];

  // Provider-aware AI availability (drives the editor warning banner). Uses the
  // same computeAiGate() discriminant as the chat submit guard above.
  const aiGate = computeAiGate();
  const aiWarning: { title: string; body: React.ReactNode } | null =
    aiGate === 'hosted-signin'
      ? {
        title: 'Sign in to use hosted AI',
        body: <>Hosted AI needs an account. Sign in from{' '}
          <button onClick={() => navigateToView('settings')} className="underline font-medium hover:text-amber-800">Settings</button>
          {' '}or switch to a free provider with your own key.</>
      }
      : aiGate === 'hosted-upgrade'
        ? {
          title: 'Hosted AI is a Supporter feature',
          body: <>See the{' '}
            <button onClick={() => navigateToView('pricing')} className="underline font-medium hover:text-amber-800">Supporter plan</button>
            , or keep generating free with your own key in{' '}
            <button onClick={() => navigateToView('settings')} className="underline font-medium hover:text-amber-800">Settings</button>.</>
        }
        : aiGate === 'byok-nokey'
          ? {
            title: 'API key not configured',
            body: <>Add your API key in{' '}
              <button onClick={() => navigateToView('settings')} className="underline font-medium hover:text-amber-800">Settings</button>
              {' '}to use AI features.</>
          }
          : null;

  // --- Render Views ---
  if (view === 'shared' && sharedSlug) {
    return (
      <SharedViewPage
        slug={sharedSlug}
        onGoHome={() => navigateToView('landing')}
      />
    );
  }

  if (view === 'pricing') {
    return (
      <PricingPage
        onOpenEditor={() => navigateToView('home')}
        onOpenLanding={() => navigateToView('landing')}
        onOpenCompare={() => navigateToView('compare')}
        onOpenSettings={() => navigateToView('settings')}
      />
    );
  }

  if (view === 'compare') {
    return (
      <ComparePage
        onOpenEditor={() => navigateToView('home')}
        onOpenLanding={() => navigateToView('landing')}
        onOpenPricing={() => navigateToView('pricing')}
      />
    );
  }

  if (view === 'privacy') return <PrivacyPage />;
  if (view === 'terms') return <TermsPage />;

  if (view === 'landing') {
    return (
      <LandingPage
        onGoHome={() => navigateToView('home')}
        onOpenPricing={() => navigateToView('pricing')}
        onOpenCompare={() => navigateToView('compare')}
        onOpenPrivacy={() => navigateToView('privacy')}
        onOpenTerms={() => navigateToView('terms')}
      />
    );
  }

  if (view === 'home') {
    return (
      <>
        <PromptModal
          isOpen={promptModal.visible}
          title={promptModal.title}
          message={promptModal.message}
          defaultValue={promptModal.defaultValue}
          onConfirm={promptModal.onConfirm}
          onClose={() => setPromptModal(p => ({ ...p, visible: false }))}
        />
        <ConfirmModal
          isOpen={confirmModal.visible}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onClose={() => setConfirmModal(c => ({ ...c, visible: false }))}
          confirmText={confirmModal.confirmText}
          variant={confirmModal.danger ? 'danger' : 'primary'}
        />
        <HomePage
          graphs={graphs}
          projects={projects}
          onCreateGraph={startFromHome}
          onOpenGraph={openGraph}
          onDeleteGraph={deleteGraph}
          onDeleteGraphsDirect={deleteGraphsDirect}
          onRenameGraph={renameGraph}
          onCreateProject={createProject}
          onDeleteProject={deleteProject}
          onRenameProject={renameProject}
          onOpenLanding={() => navigateToView('landing')}
          onMoveGraphsToProject={moveGraphsToProject}
          onOpenSettings={() => navigateToView('settings')}
        />
      </>
    );
  }

  if (view === 'settings') {
    return (
      <SettingsPage
        onBack={() => navigateToView('home')}
        graphs={graphs}
        projects={projects}
        onImportData={handleImportData}
        syncState={syncState}
        onSyncNow={syncNow}
        onOpenPricing={() => navigateToView('pricing')}
      />
    );
  }

  // Editor View
  return (
    <>
      {storageUnreadable && (
        <div
          role="alert"
          className="fixed inset-x-0 top-0 z-[100] bg-red-600 px-4 py-2 text-center text-sm font-medium text-white"
        >
          Your saved diagrams could not be read from this browser. Saving is turned off so nothing is overwritten. Reload the page to try again.
        </div>
      )}

      {/* Modals */}
      <PromptModal
        isOpen={promptModal.visible}
        title={promptModal.title}
        message={promptModal.message}
        defaultValue={promptModal.defaultValue}
        onConfirm={promptModal.onConfirm}
        onClose={() => setPromptModal(p => ({ ...p, visible: false }))}
      />
      <ConfirmModal
        isOpen={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal(c => ({ ...c, visible: false }))}
        confirmText={confirmModal.confirmText}
        variant={confirmModal.danger ? 'danger' : 'primary'}
      />
      <ColorPickerModal
        isOpen={colorModal.visible}
        currentColor={colorModal.currentColor}
        onSelect={colorModal.onSelect}
        onClose={() => setColorModal(c => ({ ...c, visible: false }))}
        specialColors={specialColors}
        standardColors={standardColors}
        onUpdateSpecialColor={handleUpdateSpecialColor}
        onUpdateStandardColor={handleUpdateStandardColor}
        onResetSpecialColors={handleResetSpecialColors}
        onResetStandardColors={handleResetStandardColors}
      />
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        svgUrl={downloadUrl}
        title={currentDiagram.title}
        description={currentDiagram.summary}
      />
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        graph={shareGraph}
        onOpenSettings={() => navigateToView('settings')}
        onOpenPricing={() => navigateToView('pricing')}
      />
      <CloudHistoryModal
        isOpen={cloudHistoryOpen}
        onClose={() => setCloudHistoryOpen(false)}
        graph={activeGraph}
        onRestore={(diagramData) => {
          setCurrentDiagram(diagramData);
          pushToHistory(diagramData);
          scheduleAutosave(diagramData);
        }}
      />

      <div className="flex h-screen w-full bg-gray-50 text-gray-900 overflow-hidden font-sans">

        {/* Left Sidebar - Project Graphs */}
        <aside
          className={`${isSidebarOpen ? 'w-64' : 'w-0'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col shrink-0 overflow-hidden`}
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              {currentProject ? (
                <>
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: currentProject.color }}
                  />
                  <span className="font-semibold text-sm truncate">{currentProject.name}</span>
                </>
              ) : (
                <>
                  <BarChart2 className="w-4 h-4 text-gray-500" />
                  <span className="font-semibold text-sm">Unassigned</span>
                </>
              )}
            </div>
          </div>

          {/* New Graph Button */}
          <div className="p-3 border-b border-gray-100 shrink-0">
            <button
              onClick={() => {
                const newId = createGraph(currentProject?.id);
                openGraph(newId);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
            >
              <Plus className="w-4 h-4" />
              New Graph
            </button>
          </div>

          {/* Project Graphs List */}
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {projectGraphs.length > 0 ? (
              <div>
                <div className="text-xs text-gray-500 font-medium mb-2 px-1">
                  {currentProject ? 'Graphs in project' : 'Other unassigned graphs'}
                </div>
                <div className="space-y-1">
                  {projectGraphs.map(graph => (
                    <button
                      key={graph.id}
                      onClick={() => openGraph(graph.id)}
                      className={`w-full flex items-center gap-2 p-2 rounded-lg text-left text-sm transition-colors group ${graph.id === activeGraphId
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'hover:bg-gray-100 text-gray-700'
                        }`}
                    >
                      <BarChart2 className={`w-4 h-4 shrink-0 ${graph.id === activeGraphId ? 'text-blue-600' : 'text-gray-400'}`} />
                      <span className="truncate">{graph.diagramData.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 px-4">
                <BarChart2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  {currentProject ? 'No other graphs in this project' : 'No other unassigned graphs'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {currentProject ? 'Create a new graph or add one from home' : 'Organize graphs into projects from the home page'}
                </p>
              </div>
            )}
          </div>

          {/* Back to Home */}
          <div className="p-3 border-t border-gray-100 shrink-0">
            <button
              onClick={() => navigateToView('home')}
              className="w-full flex items-center gap-2 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg transition-colors font-medium text-sm hover:bg-gray-100"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Home
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">

          {/* Header */}
          <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-4">
              <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">
                <Menu className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigateToView('home')}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-200/50">
                  <BarChart2 className="w-4 h-4 text-white" />
                </div>
                <span className="font-semibold text-gray-800">IB EconGraph AI</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              {cloudConfigured && (
                <>
                  <button
                    onClick={() => setCloudHistoryOpen(true)}
                    title="Cloud version history"
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <CloudDownload className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShareModalOpen(true)}
                    title="Share a view-only link"
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md border border-gray-300"
                  >
                    <Share2 className="w-4 h-4" />
                    <span className="hidden md:inline">Share</span>
                  </button>
                </>
              )}
              <button
                onClick={() => navigateToView('settings')}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={() => setAIPanelOpen(prev => !prev)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md border border-gray-300"
              >
                <MessageSquare className="w-4 h-4" />
                {isAIPanelOpen ? 'Hide AI' : 'Show AI'}
              </button>
            </div>
          </header>

          {/* Split View */}
          <div className="flex-1 flex overflow-hidden">

            {/* Left Toolbar */}
            <ToolbarLeft
              activeTool={activeTool}
              onToolChange={setActiveTool}
              activeColor={activeColor}
              onOpenColorPicker={handleColorChange}
              onColorSelect={setActiveColor}
              strokeWidth={strokeWidth}
              onStrokeWidthChange={setStrokeWidth}
              onToggleComponentLibrary={() => setComponentLibraryOpen(!isComponentLibraryOpen)}
              specialColors={specialColors}
              standardColors={standardColors}
            />

            {/* Component Library Panel */}
            <ComponentLibrary
              isOpen={isComponentLibraryOpen}
              onClose={() => setComponentLibraryOpen(false)}
              onAddComponent={handleAddComponent}
              currentDiagram={currentDiagram}
            />

            {/* Center: Graph Canvas */}
            <div className="flex-1 bg-gray-100 flex flex-col overflow-hidden">
              <div className="flex-1 p-4 flex flex-col items-center justify-center overflow-auto">
                <div className="w-full h-full max-w-4xl flex flex-col">
                  <DiagramRenderer
                    data={currentDiagram}
                    onDataChange={handleDataChange}
                    onDownloadReady={handleDownloadReady}
                    className="w-full flex-1 shadow-xl"
                    width={800}
                    height={550}
                    activeTool={activeTool}
                    settings={settings}
                    activeColor={activeColor}
                    strokeWidth={strokeWidth}
                    zoom={zoom}
                    onZoomChange={setZoom}
                    pan={pan}
                    onPanChange={setPan}
                    onLabelEdit={handleLabelEdit}
                  />
                </div>
              </div>

              {/* Bottom Bar */}
              <div className="h-12 bg-white border-t border-gray-200 px-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  {/* Grid Size Selector */}
                  <div className="flex items-center gap-2">
                    <Grid3X3 className="w-4 h-4 text-gray-400" />
                    <select
                      value={settings.gridSize}
                      onChange={(e) => setSettings(s => ({ ...s, gridSize: Number(e.target.value) }))}
                      className="text-sm border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none"
                    >
                      <option value={1}>1px Grid</option>
                      <option value={2}>2px Grid</option>
                      <option value={5}>5px Grid</option>
                      <option value={10}>10px Grid</option>
                      <option value={15}>15px Grid</option>
                      <option value={20}>20px Grid</option>
                      <option value={25}>25px Grid</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" /> Ctrl+Z
                  </span>
                  <span className="flex items-center gap-1">
                    <RotateCw className="w-3 h-3" /> Ctrl+Y
                  </span>
                  <span>Tool: <span className="font-medium text-gray-700 capitalize">{activeTool}</span></span>
                </div>
              </div>
            </div>

            {/* Right Toolbar - Moved to be left of AI Panel */}
            <ToolbarRight
              onUndo={undo}
              onRedo={redo}
              canUndo={historyIndex > 0}
              canRedo={historyIndex < history.length - 1}
              showGrid={settings.showGrid}
              onToggleGrid={() => setSettings(s => ({ ...s, showGrid: !s.showGrid }))}
              snapEnabled={settings.snapToGrid || settings.snapToPoints}
              onToggleSnap={() => setSettings(s => ({ ...s, snapToGrid: !s.snapToGrid, snapToPoints: !s.snapToPoints }))}
              moveTogetherEnabled={settings.moveTogether}
              onToggleMoveTogether={() => setSettings(s => ({ ...s, moveTogether: !s.moveTogether }))}
              zoom={zoom}
              onZoomChange={setZoom}
              onExport={handleDownload}
              onClear={handleClearCanvas}
              onRecenter={() => { setPan({ x: 0, y: 0 }); setZoom(1); }}
            />

            {/* Right: AI Chat Panel */}
            <div
              className={`${isAIPanelOpen ? 'w-96 border-l' : 'w-0'} bg-white border-gray-200 flex flex-col shrink-0 z-10 shadow-xl transition-all duration-300 overflow-hidden`}
            >
              {isAIPanelOpen && (
                <>
                  {/* AI availability warning */}
                  {aiWarning && (
                    <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm text-amber-800 font-medium">{aiWarning.title}</p>
                        <p className="text-xs text-amber-600 mt-0.5">{aiWarning.body}</p>
                      </div>
                    </div>
                  )}

                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50">
                    {(!activeGraph || activeGraph.messages.length === 0) && (
                      <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-70">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                          <Plus className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">Start a new graph</h3>
                          <p className="text-sm text-gray-500 max-w-xs mx-auto mt-1">Describe an economic scenario to generate a diagram.</p>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center mt-4">
                          {suggestions.map((s, i) => (
                            <button
                              key={i}
                              onClick={() => handleSubmit(undefined, s)}
                              className="text-xs bg-white border border-gray-200 px-3 py-1.5 rounded-full hover:border-blue-400 hover:text-blue-600 transition-all shadow-sm"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeGraph?.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                      >
                        <div className={`
                          max-w-[90%] rounded-2xl p-3 text-sm shadow-sm
                          ${msg.role === 'user'
                            ? 'bg-blue-600 text-white rounded-br-none'
                            : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'}
                        `}>
                          <p>{msg.content}</p>
                        </div>

                        {msg.role === 'model' && msg.diagramData && (
                          <button
                            onClick={() => restoreCheckpoint(msg)}
                            className="mt-2 flex items-center gap-1 text-xs text-blue-600 font-medium hover:underline bg-blue-50 px-2 py-1 rounded"
                          >
                            <History className="w-3 h-3" />
                            Restore this version
                          </button>
                        )}

                        <span className="text-[10px] text-gray-400 mt-1 px-1">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input Area */}
                  <div className="p-4 bg-white border-t border-gray-200">
                    <form onSubmit={(e) => handleSubmit(e)} className="relative">
                      <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit();
                          }
                        }}
                        placeholder="Describe changes or a new graph..."
                        className="w-full pr-24 pl-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none resize-none text-sm bg-gray-50 h-[52px] max-h-32 min-h-[52px]"
                        style={{ height: '52px' }}
                      />

                      <button
                        type="button"
                        onClick={handleNewChat}
                        disabled={isLoading || !activeGraph || activeGraph.messages.length === 0}
                        className="absolute right-12 top-2 p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="New chat"
                      >
                        <Plus className="w-4 h-4" />
                      </button>

                      <button
                        type="submit"
                        disabled={isLoading || !prompt.trim()}
                        onMouseEnter={(e) => showSendTooltip(e.currentTarget, 'Send Message')}
                        onMouseLeave={hideSendTooltip}
                        className="absolute right-2 top-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <SendTooltipPortal />
    </>
  );
}
