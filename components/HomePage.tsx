import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
    Plus, Search, FolderPlus, MoreHorizontal, Clock,
    BarChart2, Folder, Sparkles, ArrowRight, Trash2, Edit3,
    ChevronRight, Grid3X3, List, Pencil, ChevronDown, Settings
} from 'lucide-react';
import { Graph, Project, DiagramData, EMPTY_DIAGRAM } from '../types';
import { ConfirmModal } from './Modal';
import { usePortalTooltip } from './usePortalTooltip';

interface HomePageProps {
    graphs: Graph[];
    projects: Project[];
    onCreateGraph: (projectId?: string) => void;
    onOpenGraph: (graphId: string) => void;
    onDeleteGraph: (graphId: string) => void;
    onDeleteGraphsDirect?: (graphIds: string[]) => void;
    onRenameGraph: (graphId: string) => void;
    onCreateProject: () => void;
    onDeleteProject: (projectId: string) => void;
    onRenameProject: (projectId: string) => void;
    onOpenLanding: () => void;
    onMoveGraphsToProject?: (graphIds: string[], projectId: string | null) => void;
    onOpenSettings?: () => void;
}

const WELCOME_MESSAGES = [
    { emoji: "📊", text: "Ready to visualize some economics?" },
    { emoji: "📈", text: "Let's create something insightful!" },
    { emoji: "✨", text: "What economic concept are we exploring today?" },
    { emoji: "🎯", text: "Time to make data beautiful!" },
    { emoji: "💡", text: "Great ideas start with great diagrams!" },
    { emoji: "🚀", text: "Ready to launch your next visualization?" },
    { emoji: "🎨", text: "Let's paint the economy!" },
    { emoji: "📉", text: "Supply, demand, or something in between?" },
    { emoji: "🌟", text: "Where curves meet dreams!" },
    { emoji: "💰", text: "Time to make dollars and sense!" },
    { emoji: "🎓", text: "Ready to make Adam Smith proud?" },
    { emoji: "⚡", text: "Economics has never been this fun!" },
    { emoji: "📍", text: "Every chart tells a story..." },
    { emoji: "🎪", text: "Graph it like you mean it!" },
    { emoji: "🏆", text: "Let's maximize some utility!" },
    { emoji: "🌍", text: "Ready to chart the world?" },
    { emoji: "💎", text: "Your next masterpiece awaits!" },
    { emoji: "🔥", text: "Time to create something legendary!" },
    { emoji: "🎬", text: "Rolling camera on your next diagram!" },
    { emoji: "🎯", text: "Never too late to achieve allocative efficiency!" },
    { emoji: "🗣️", text: "Pareto optimality he said..." },
    { emoji: "🧠", text: "Let's think critically and visualize boldly!" },
    { emoji: "🤓", text: "Allocative efficiency, she whispered..." },
    { emoji: "😏", text: "Ceteris paribus? Too many variables for that" },
    { emoji: "🎯", text: "Dead weight loss just hits different" },
    { emoji: "💫", text: "Living that utility-maximizing lifestyle..." },
    { emoji: "🧠", text: "My brain is officially bigger from all this econ" },
    { emoji: "🎭", text: "This market's got more drama than a telenovela" },
    { emoji: "⚡", text: "Comparative advantage? That's literally me" },
    { emoji: "👑", text: "The marginal utility throne? Already sitting here" },
    { emoji: "🎪", text: "It's not a bubble, it's a feature!" },
    { emoji: "🧪", text: "Economics lab is open for business" },
    { emoji: "🎸", text: "Playing the supply-demand riff perfectly" },
    { emoji: "💎", text: "Scarcity who? I've got everything I need" },
    { emoji: "📊", text: "Inflation is just a demand curve that's gotten too bold..." },
    { emoji: "🎪", text: "Supply my skill, demand your attention!" },
    { emoji: "🤓", text: "Elasticity is not just for rubber bands..." },
    { emoji: "🎯", text: "Marginal cost? That's just my price" },
    { emoji: "🎭", text: "The invisible hand is just me, really" },
    { emoji: "🎪", text: "Sticky prices, sticky situations" },
    { emoji: "🏃", text: "Opportunity cost? I'm worth it" },
    { emoji: "🧠", text: "Big brain economics energy right here!" },
    { emoji: "💫", text: "Living my best utility-maximizing life" },
    { emoji: "🎪", text: "It's not a circus, it's the free market!" },
    { emoji: "🌊", text: "Just riding the waves of market fluctuations!" },

];

const HomePage: React.FC<HomePageProps> = ({
    graphs,
    projects,
    onCreateGraph,
    onOpenGraph,
    onDeleteGraph,
    onDeleteGraphsDirect,
    onRenameGraph,
    onCreateProject,
    onDeleteProject,
    onRenameProject,
    onOpenLanding,
    onMoveGraphsToProject,
    onOpenSettings,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedProject, setSelectedProject] = useState<string | null>(null);
    const [projectMenuOpen, setProjectMenuOpen] = useState<string | null>(null);
    const [selectedGraphIds, setSelectedGraphIds] = useState<Set<string>>(new Set());
    const [moveMenuOpen, setMoveMenuOpen] = useState(false);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
    const moveMenuRef = useRef<HTMLDivElement>(null);

    const { showTooltip, hideTooltip, TooltipPortal } = usePortalTooltip({ delay: 400, placement: 'bottom' });

    // Random welcome message (changes on page load)
    const welcomeMessage = useMemo(() => {
        return WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
    }, []);

    // Close menus when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            // Close project menu if click is outside any project menu
            if (projectMenuOpen && !target.closest('[data-project-menu]')) {
                setProjectMenuOpen(null);
            }
            if (moveMenuRef.current && !moveMenuRef.current.contains(event.target as Node)) {
                setMoveMenuOpen(false);
            }
        };

        if (projectMenuOpen || moveMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [projectMenuOpen, moveMenuOpen]);

    // Filter graphs by search query and selected project
    const filteredGraphs = useMemo(() => {
        let filtered = graphs;

        if (selectedProject === 'unassigned') {
            filtered = filtered.filter(g => !g.projectId);
        } else if (selectedProject) {
            filtered = filtered.filter(g => g.projectId === selectedProject);
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(g =>
                g.title.toLowerCase().includes(query) ||
                g.diagramData?.title?.toLowerCase().includes(query) ||
                g.diagramData?.summary?.toLowerCase().includes(query)
            );
        }

        return filtered.sort((a, b) => b.lastModified - a.lastModified);
    }, [graphs, searchQuery, selectedProject]);

    // Get unassigned graphs count
    const unassignedCount = graphs.filter(g => !g.projectId).length;

    // Clear selection anchor when filters change
    useEffect(() => {
        setLastSelectedIndex(null);
    }, [searchQuery, selectedProject]);

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            const hours = Math.floor(diff / (1000 * 60 * 60));
            if (hours === 0) {
                const minutes = Math.floor(diff / (1000 * 60));
                return minutes <= 1 ? 'Just now' : `${minutes}m ago`;
            }
            return `${hours}h ago`;
        } else if (days === 1) {
            return 'Yesterday';
        } else if (days < 7) {
            return `${days}d ago`;
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    };

    const handleRenameGraph = (graph: Graph) => {
        onRenameGraph(graph.id);
    };

    const handleGraphClick = useCallback((graphId: string, graphIndex: number, event: React.MouseEvent) => {
        if (event.shiftKey && lastSelectedIndex !== null) {
            // Shift+click: select range
            const start = Math.min(lastSelectedIndex, graphIndex);
            const end = Math.max(lastSelectedIndex, graphIndex);
            setSelectedGraphIds(prev => {
                const newSet = new Set(prev);
                for (let i = start; i <= end; i++) {
                    if (filteredGraphs[i]) {
                        newSet.add(filteredGraphs[i].id);
                    }
                }
                return newSet;
            });
        } else if (event.ctrlKey || event.metaKey) {
            // Ctrl/Cmd+click: toggle single
            setSelectedGraphIds(prev => {
                const newSet = new Set(prev);
                if (newSet.has(graphId)) {
                    newSet.delete(graphId);
                } else {
                    newSet.add(graphId);
                }
                return newSet;
            });
            setLastSelectedIndex(graphIndex);
        } else {
            // Normal click: if already in select mode (has selections), toggle. Otherwise open.
            if (selectedGraphIds.size > 0) {
                setSelectedGraphIds(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(graphId)) {
                        newSet.delete(graphId);
                    } else {
                        newSet.add(graphId);
                    }
                    return newSet;
                });
                setLastSelectedIndex(graphIndex);
            } else {
                onOpenGraph(graphId);
            }
        }
    }, [lastSelectedIndex, filteredGraphs, selectedGraphIds, onOpenGraph]);

    const toggleGraphSelection = (graphId: string, graphIndex: number) => {
        setSelectedGraphIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(graphId)) {
                newSet.delete(graphId);
            } else {
                newSet.add(graphId);
            }
            return newSet;
        });
        setLastSelectedIndex(graphIndex);
    };

    const handleBulkDelete = () => {
        if (selectedGraphIds.size === 0) return;
        setConfirmDeleteOpen(true);
    };

    const confirmBulkDelete = () => {
        if (onDeleteGraphsDirect) {
            onDeleteGraphsDirect(Array.from(selectedGraphIds));
        } else {
            // Fallback to individual deletes if direct delete not available
            selectedGraphIds.forEach(id => onDeleteGraph(id));
        }
        setSelectedGraphIds(new Set());
        setLastSelectedIndex(null);
    };

    const handleBulkMoveToProject = (projectId: string | null) => {
        if (selectedGraphIds.size === 0 || !onMoveGraphsToProject) return;
        onMoveGraphsToProject(Array.from(selectedGraphIds), projectId);
        setSelectedGraphIds(new Set());
        setLastSelectedIndex(null);
        setMoveMenuOpen(false);
    };

    const clearSelection = () => {
        setSelectedGraphIds(new Set());
        setLastSelectedIndex(null);
    };

    const GraphCard = ({ graph, index }: { graph: Graph; index: number }) => {
        const graphProject = graph.projectId ? projects.find(p => p.id === graph.projectId) : null;
        const showProjectBadge = selectedProject === null && graphProject;
        const isSelected = selectedGraphIds.has(graph.id);
        const isSelectMode = selectedGraphIds.size > 0;

        return (
            <div
                onClick={(e) => handleGraphClick(graph.id, index, e)}
                className={`group bg-white rounded-xl border overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer ${isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300'
                    }`}
            >
                {/* Preview */}
                <div
                    className="h-32 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center relative overflow-hidden"
                >
                    <div className="absolute inset-0 opacity-10">
                        <svg viewBox="0 0 100 100" className="w-full h-full">
                            <line x1="10" y1="90" x2="90" y2="10" stroke="#ef4444" strokeWidth="2" />
                            <line x1="10" y1="10" x2="90" y2="90" stroke="#3b82f6" strokeWidth="2" />
                        </svg>
                    </div>
                    <BarChart2 className="w-12 h-12 text-gray-300 group-hover:text-blue-400 transition-colors" />

                    {/* Selection Checkbox */}
                    <div
                        role="checkbox"
                        aria-checked={isSelected}
                        tabIndex={0}
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleGraphSelection(graph.id, index);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.stopPropagation();
                                e.preventDefault();
                                toggleGraphSelection(graph.id, index);
                            }
                        }}
                        className={`absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-all cursor-pointer ${isSelected
                            ? 'bg-blue-600 border-blue-600 opacity-100'
                            : isSelectMode
                                ? 'bg-white border-gray-300 opacity-100 hover:border-blue-400'
                                : 'bg-white border-gray-300 opacity-0 group-hover:opacity-100 hover:border-blue-400'
                            }`}
                    >
                        {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </div>

                    {/* Project Badge */}
                    {showProjectBadge && (
                        <div
                            className="absolute top-2 left-9 flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-white/90 backdrop-blur-sm shadow-sm"
                            style={{ color: graphProject.color || '#3b82f6' }}
                        >
                            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: graphProject.color || '#3b82f6' }} />
                            <span className="truncate max-w-[100px]">{graphProject.name}</span>
                        </div>
                    )}

                    {/* Delete button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDeleteGraph(graph.id);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-white/80 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-all"
                        aria-label="Delete graph"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Info */}
                <div className="p-3">
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            if (!isSelectMode) handleRenameGraph(graph);
                        }}
                        className="flex items-center gap-1 group/title cursor-pointer"
                        onMouseEnter={(e) => { if (!isSelectMode) showTooltip(e.currentTarget, 'Click to rename'); }}
                        onMouseLeave={hideTooltip}
                    >
                        <h3 className="font-medium text-gray-900 truncate group-hover/title:text-blue-600 transition-colors flex-1">
                            {graph.diagramData?.title || graph.title}
                        </h3>
                        {!isSelectMode && <Pencil className="w-3 h-3 text-gray-400 opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(graph.lastModified)}</span>
                    </div>
                </div>
            </div>
        );
    };

    const GraphListItem = ({ graph, index }: { graph: Graph; index: number }) => {
        const graphProject = graph.projectId ? projects.find(p => p.id === graph.projectId) : null;
        const showProjectBadge = selectedProject === null && graphProject;
        const isSelected = selectedGraphIds.has(graph.id);
        const isSelectMode = selectedGraphIds.size > 0;

        return (
            <div
                onClick={(e) => handleGraphClick(graph.id, index, e)}
                className={`group flex items-center gap-4 p-3 bg-white rounded-lg border hover:shadow-md transition-all cursor-pointer ${isSelected ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50/30' : 'border-gray-200 hover:border-blue-300'}`}
            >
                {/* Checkbox */}
                <div
                    role="checkbox"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleGraphSelection(graph.id, index);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation();
                            e.preventDefault();
                            toggleGraphSelection(graph.id, index);
                        }
                    }}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all cursor-pointer shrink-0 ${isSelected
                        ? 'bg-blue-600 border-blue-600'
                        : isSelectMode
                            ? 'bg-white border-gray-300 hover:border-blue-400'
                            : 'bg-white border-gray-300 opacity-0 group-hover:opacity-100 hover:border-blue-400'
                        }`}
                >
                    {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                    )}
                </div>
                <div
                    className="w-10 h-10 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex items-center justify-center shrink-0"
                >
                    <BarChart2 className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            if (!isSelectMode) handleRenameGraph(graph);
                        }}
                        className="flex items-center gap-2 group/title cursor-pointer"
                        onMouseEnter={(e) => { if (!isSelectMode) showTooltip(e.currentTarget, 'Click to rename'); }}
                        onMouseLeave={hideTooltip}
                    >
                        <h3 className="font-medium text-gray-900 truncate group-hover/title:text-blue-600 transition-colors">
                            {graph.diagramData?.title || graph.title}
                        </h3>
                        {!isSelectMode && <Pencil className="w-3 h-3 text-gray-400 opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0" />}
                        {showProjectBadge && (
                            <div
                                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-gray-50"
                                style={{ color: graphProject.color || '#3b82f6' }}
                            >
                                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: graphProject.color || '#3b82f6' }} />
                                <span>{graphProject.name}</span>
                            </div>
                        )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                        {graph.diagramData?.summary}
                    </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{formatDate(graph.lastModified)}</span>
                    {!isSelectMode && (
                        <>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteGraph(graph.id);
                                }}
                                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-all"
                                aria-label="Delete graph"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <ChevronRight
                                className="w-4 h-4 text-gray-400 cursor-pointer hover:text-blue-500"
                            />
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Bulk Actions Bar */}
            {selectedGraphIds.size > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-4">
                    <span className="font-medium">{selectedGraphIds.size} selected</span>
                    <div className="h-4 w-px bg-gray-700" />
                    <button
                        onClick={handleBulkDelete}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-red-600 rounded-lg transition-colors text-sm font-medium"
                    >
                        <Trash2 className="w-4 h-4" />
                        Delete
                    </button>
                    <div className="relative" ref={moveMenuRef}>
                        <button
                            onClick={() => setMoveMenuOpen(!moveMenuOpen)}
                            className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-700 rounded-lg transition-colors text-sm font-medium"
                        >
                            <FolderPlus className="w-4 h-4" />
                            Move to
                            <ChevronDown className={`w-3 h-3 transition-transform ${moveMenuOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {moveMenuOpen && (
                            <div className="absolute bottom-full mb-2 left-0 bg-white text-gray-900 rounded-lg shadow-xl py-1 min-w-[180px]">
                                <button
                                    onClick={() => handleBulkMoveToProject(null)}
                                    className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                                >
                                    Unassigned
                                </button>
                                {projects.map(project => (
                                    <button
                                        key={project.id}
                                        onClick={() => handleBulkMoveToProject(project.id)}
                                        className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm flex items-center gap-2"
                                    >
                                        <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: project.color }} />
                                        {project.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={clearSelection}
                        className="px-3 py-1.5 hover:bg-gray-700 rounded-lg transition-colors text-sm"
                    >
                        Cancel
                    </button>
                </div>
            )}

            {/* Confirm Delete Modal */}
            <ConfirmModal
                isOpen={confirmDeleteOpen}
                onClose={() => setConfirmDeleteOpen(false)}
                onConfirm={confirmBulkDelete}
                title="Delete Graphs"
                message={`Are you sure you want to delete ${selectedGraphIds.size} graph(s)? This action cannot be undone.`}
                confirmText="Delete"
                variant="danger"
            />

            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                        >
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200/50">
                                <BarChart2 className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="font-bold text-xl text-gray-900">IB EconGraph AI</h1>
                                <p className="text-xs text-gray-500" style={{ marginLeft: '-10px' }}>Economic Diagram Studio</p>
                            </div>
                        </button>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={onOpenLanding}
                                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                About
                            </button>
                            {onOpenSettings && (
                                <button
                                    onClick={onOpenSettings}
                                    className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <Settings className="w-5 h-5" />
                                </button>
                            )}
                            <button
                                onClick={() => onCreateGraph()}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 font-medium text-sm"
                            >
                                <Plus className="w-4 h-4" />
                                New Graph
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Welcome Section */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 text-3xl font-bold text-gray-900">
                        <span>{welcomeMessage.emoji}</span>
                        <span>{welcomeMessage.text}</span>
                    </div>
                    <p className="text-gray-500 mt-2">
                        Create, edit, and organize your economic diagrams
                    </p>
                </div>

                {/* Search and Actions */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search graphs..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            <Grid3X3 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>
                    <button
                        onClick={onCreateProject}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all text-sm font-medium text-gray-700"
                    >
                        <FolderPlus className="w-4 h-4" />
                        New Project
                    </button>
                </div>

                <div className="flex gap-6">
                    {/* Sidebar - Projects */}
                    <aside className="w-64 shrink-0">
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <div className="p-3 border-b border-gray-100">
                                <h2 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                                    <Folder className="w-4 h-4" />
                                    Projects
                                </h2>
                            </div>

                            <div className="p-2">
                                {/* All Graphs */}
                                <button
                                    onClick={() => setSelectedProject(null)}
                                    className={`w-full flex items-center justify-between p-2.5 rounded-lg text-sm transition-colors ${selectedProject === null
                                        ? 'bg-blue-50 text-blue-700 font-medium'
                                        : 'text-gray-700 hover:bg-gray-50'
                                        }`}
                                >
                                    <span className="flex items-center gap-2">
                                        <Sparkles className="w-4 h-4" />
                                        All Graphs
                                    </span>
                                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{graphs.length}</span>
                                </button>

                                {/* Unassigned */}
                                {unassignedCount > 0 && (
                                    <button
                                        onClick={() => setSelectedProject('unassigned')}
                                        className={`w-full flex items-center justify-between p-2.5 rounded-lg text-sm transition-colors ${selectedProject === 'unassigned'
                                            ? 'bg-blue-50 text-blue-700 font-medium'
                                            : 'text-gray-700 hover:bg-gray-50'
                                            }`}
                                    >
                                        <span className="flex items-center gap-2">
                                            <BarChart2 className="w-4 h-4" />
                                            Unassigned
                                        </span>
                                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{unassignedCount}</span>
                                    </button>
                                )}

                                {/* Project List */}
                                {projects.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                                        {projects.map(project => {
                                            const projectGraphCount = graphs.filter(g => g.projectId === project.id).length;
                                            return (
                                                <div key={project.id} className="relative group">
                                                    <div
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={() => setSelectedProject(project.id)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                e.preventDefault();
                                                                setSelectedProject(project.id);
                                                            }
                                                        }}
                                                        className={`w-full flex items-center justify-between p-2.5 rounded-lg text-sm transition-colors cursor-pointer ${selectedProject === project.id
                                                            ? 'bg-blue-50 text-blue-700 font-medium'
                                                            : 'text-gray-700 hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <div
                                                                className="w-3 h-3 rounded-sm"
                                                                style={{ backgroundColor: project.color || '#3b82f6' }}
                                                            />
                                                            <span className="truncate">{project.name}</span>
                                                        </span>
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{projectGraphCount}</span>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setProjectMenuOpen(projectMenuOpen === project.id ? null : project.id);
                                                                }}
                                                                className="p-1 hover:bg-gray-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                                            >
                                                                <MoreHorizontal className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Project Menu */}
                                                    {projectMenuOpen === project.id && (
                                                        <div
                                                            data-project-menu
                                                            data-project-id={project.id}
                                                            className="absolute right-0 bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[120px]"
                                                        >
                                                            <button
                                                                onClick={() => {
                                                                    onRenameProject(project.id);
                                                                    setProjectMenuOpen(null);
                                                                }}
                                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                                                            >
                                                                <Edit3 className="w-3 h-3" />
                                                                Rename
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    onDeleteProject(project.id);
                                                                    setProjectMenuOpen(null);
                                                                }}
                                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                                Delete
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Create New Project CTA */}
                            <div className="p-3 border-t border-gray-100">
                                <button
                                    onClick={onCreateProject}
                                    className="w-full flex items-center justify-center gap-2 p-2 text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add Project
                                </button>
                            </div>
                        </div>
                    </aside>

                    {/* Main Content - Graphs */}
                    <div className="flex-1 min-w-0">
                        {/* Quick Actions */}
                        {filteredGraphs.length === 0 && !searchQuery && (
                            <div className="text-center py-16">
                                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <BarChart2 className="w-8 h-8 text-blue-500" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                    {selectedProject ? 'No graphs in this project' : 'No graphs yet'}
                                </h3>
                                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                                    Create your first economic diagram and bring your data to life
                                </p>
                                <button
                                    onClick={() => onCreateGraph(selectedProject && selectedProject !== 'unassigned' ? selectedProject : undefined)}
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 font-medium"
                                >
                                    <Plus className="w-5 h-5" />
                                    Create Your First Graph
                                </button>
                            </div>
                        )}

                        {filteredGraphs.length === 0 && searchQuery && (
                            <div className="text-center py-16">
                                <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">No results found</h3>
                                <p className="text-gray-500">Try a different search term</p>
                            </div>
                        )}

                        {filteredGraphs.length > 0 && (
                            <>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="font-semibold text-gray-900">
                                        {selectedProject === null
                                            ? 'All Graphs'
                                            : selectedProject === 'unassigned'
                                                ? 'Unassigned Graphs'
                                                : projects.find(p => p.id === selectedProject)?.name || 'Graphs'
                                        }
                                        <span className="text-gray-400 font-normal ml-2">({filteredGraphs.length})</span>
                                    </h2>
                                    {selectedProject && selectedProject !== 'unassigned' && (
                                        <button
                                            onClick={() => onCreateGraph(selectedProject)}
                                            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Add to project
                                        </button>
                                    )}
                                </div>

                                {viewMode === 'grid' ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                        {/* New Graph Card */}
                                        <button
                                            onClick={() => onCreateGraph(selectedProject && selectedProject !== 'unassigned' ? selectedProject : undefined)}
                                            className="h-52 bg-white rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all flex flex-col items-center justify-center gap-3 group"
                                        >
                                            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                                                <Plus className="w-6 h-6 text-gray-400 group-hover:text-blue-500 transition-colors" />
                                            </div>
                                            <span className="text-sm font-medium text-gray-500 group-hover:text-blue-600 transition-colors">
                                                New Graph
                                            </span>
                                        </button>

                                        {filteredGraphs.map((graph, idx) => (
                                            <GraphCard key={graph.id} graph={graph} index={idx} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {filteredGraphs.map((graph, idx) => (
                                            <GraphListItem key={graph.id} graph={graph} index={idx} />
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </main>
            <TooltipPortal />
        </div>
    );
};

export default HomePage;
