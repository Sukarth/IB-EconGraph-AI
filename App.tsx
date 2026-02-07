import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { generateDiagramData, hasApiKey } from './services/ai';
import DiagramRenderer from './components/DiagramRenderer';
import LandingPage from './components/LandingPage';
import HomePage from './components/HomePage';
import SettingsPage from './components/SettingsPage';
import ToolbarLeft from './components/ToolbarLeft';
import ToolbarRight from './components/ToolbarRight';
import ComponentLibrary from './components/ComponentLibrary';
import { PromptModal, ConfirmModal, ColorPickerModal, ExportModal } from './components/Modal';
import { usePortalTooltip } from './components/usePortalTooltip';
import { DiagramData, INITIAL_DIAGRAM, EMPTY_DIAGRAM, Graph, Project, Message, EditorTool, EditorSettings, ComponentTemplate } from './types';
import {
  Loader2, Send, Plus, MessageSquare, BarChart2,
  Trash2, Menu, History, RotateCcw, RotateCw, FolderOpen, ChevronLeft, Grid3X3, AlertTriangle, Settings
} from 'lucide-react';

const generateId = () => uuidv4();

const STORAGE_KEYS = {
  graphs: 'econgraph_graphs',
  projects: 'econgraph_projects',
  settings: 'econgraph_settings',
  specialColors: 'econgraph_special_colors',
  standardColors: 'econgraph_standard_colors'
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

type ViewType = 'landing' | 'home' | 'editor' | 'settings';

export default function App() {
  // --- View State ---
  const [view, setView] = useState<ViewType>(() => {
    // Initialize view based on URL path
    const path = window.location.pathname;
    if (path === '/home') return 'home';
    if (path === '/editor') return 'editor';
    if (path === '/settings') return 'settings';
    return 'landing'; // default to landing for '/' and any other path
  });

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

  // History for undo/redo
  const [history, setHistory] = useState<DiagramData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyDebounceRef = useRef<number | null>(null);
  const autosaveDebounceRef = useRef<number | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { showTooltip: showSendTooltip, hideTooltip: hideSendTooltip, TooltipPortal: SendTooltipPortal } = usePortalTooltip({ delay: 400, placement: 'top' });

  // --- Load from localStorage on mount ---
  useEffect(() => {
    try {
      const savedGraphs = localStorage.getItem(STORAGE_KEYS.graphs);
      const savedProjects = localStorage.getItem(STORAGE_KEYS.projects);
      const savedSettings = localStorage.getItem(STORAGE_KEYS.settings);
      const savedSpecial = localStorage.getItem(STORAGE_KEYS.specialColors);
      const savedStandard = localStorage.getItem(STORAGE_KEYS.standardColors);

      if (savedGraphs) {
        const parsed = JSON.parse(savedGraphs) as Graph[];
        setGraphs(parsed);
      }
      if (savedProjects) {
        const parsed = JSON.parse(savedProjects) as Project[];
        setProjects(parsed);
      }
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
      console.error('Failed to load data from localStorage:', e);
    }
    setHasInitialized(true);
  }, []);

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
      // Create new graph if none exist
      const newGraph: Graph = {
        id: generateId(),
        title: EMPTY_DIAGRAM.title,
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
  }, [view, hasInitialized, activeGraphId, graphs.length]); // Use graphs.length instead of graphs to avoid re-trigger on content changes

  // --- Save to localStorage when data changes (only after initial load) ---
  useEffect(() => {
    if (!hasInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEYS.graphs, JSON.stringify(graphs));
    } catch (e) {
      console.error('Failed to save graphs:', e);
    }
  }, [graphs, hasInitialized]);

  useEffect(() => {
    if (!hasInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(projects));
    } catch (e) {
      console.error('Failed to save projects:', e);
    }
  }, [projects, hasInitialized]);

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
  const navigateToView = useCallback((newView: ViewType) => {
    setView(newView);
    const path = newView === 'landing' ? '/' : `/${newView}`;
    window.history.pushState({}, '', path);
  }, []);

  // Listen for browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/home') setView('home');
      else if (path === '/editor') setView('editor');
      else if (path === '/settings') setView('settings');
      else setView('landing');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [graphs, activeGraphId]);

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

  const scheduleAutosave = useCallback((data: DiagramData) => {
    if (!activeGraphId) return;
    if (autosaveDebounceRef.current) window.clearTimeout(autosaveDebounceRef.current);
    autosaveDebounceRef.current = window.setTimeout(() => {
      setGraphs(prev => prev.map(g =>
        g.id === activeGraphId
          ? { ...g, diagramData: data, title: data.title, lastModified: Date.now() }
          : g
      ));
    }, 200);
  }, [activeGraphId]);

  const handleDataChange = useCallback((newData: DiagramData) => {
    setCurrentDiagram(newData);
    scheduleHistoryPush(newData);
    scheduleAutosave(newData);
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
        // Unassign graphs from this project
        setGraphs(prev => prev.map(g =>
          g.projectId === projectId ? { ...g, projectId: undefined } : g
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

  const handleImportData = useCallback((data: { graphs: Graph[]; projects: Project[]; specialColors?: string[]; standardColors?: string[] }) => {
    setGraphs(data.graphs);
    setProjects(data.projects);
    if (data.specialColors && Array.isArray(data.specialColors) && data.specialColors.length >= 2) {
      setSpecialColors(data.specialColors);
    }
    if (data.standardColors && Array.isArray(data.standardColors) && data.standardColors.length > 0) {
      setStandardColors(data.standardColors);
    }
    // Reset active graph since the data has changed
    setActiveGraphId(null);
  }, []);

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

  const handleSubmit = useCallback(async (e?: React.FormEvent, customPrompt?: string) => {
    if (e) e.preventDefault();
    const promptText = customPrompt || prompt;
    if (!promptText.trim() || !activeGraphId) return;

    // Check for API key before sending
    if (!hasApiKey()) {
      const errorMsg: Message = {
        id: generateId(),
        role: 'model',
        content: "API key not configured. Please add your API key in Settings before using AI features.",
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

      const aiMsg: Message = {
        id: generateId(),
        role: 'model',
        content: `Here is the diagram for "${promptText}". You can drag points to adjust curves or double click labels to edit them.`,
        diagramData: result,
        timestamp: Date.now()
      };

      setGraphs(prev => prev.map(g => {
        if (g.id === activeGraphId) {
          return {
            ...g,
            messages: [...g.messages, aiMsg],
            diagramData: result,
            title: result.title,
            lastModified: Date.now()
          };
        }
        return g;
      }));
      setCurrentDiagram(result);
      pushToHistory(result);

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
  }, [activeGraphId, activeGraph, prompt, pushToHistory, setGraphs]);

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

  // --- Render Views ---
  if (view === 'landing') {
    return (
      <LandingPage
        onGoHome={() => navigateToView('home')}
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
      />
    );
  }

  // Editor View
  return (
    <>
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
                  {/* API Key Warning */}
                  {!hasApiKey() && (
                    <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm text-amber-800 font-medium">API key not configured</p>
                        <p className="text-xs text-amber-600 mt-0.5">
                          Add your API key in{' '}
                          <button
                            onClick={() => navigateToView('settings')}
                            className="underline font-medium hover:text-amber-800"
                          >
                            Settings
                          </button>{' '}
                          to use AI features.
                        </p>
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
