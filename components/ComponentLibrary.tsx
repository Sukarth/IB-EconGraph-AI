import React, { useState, useEffect } from 'react';
import {
    TrendingDown, TrendingUp, Activity, Minus, ArrowDownRight, ArrowUp,
    Triangle, AlertTriangle, Square, Target, Circle, BarChart2, Crown, Receipt,
    ChevronDown, ChevronRight, Search, Plus, X, Package, Star, Trash2, Loader2, BookmarkPlus
} from 'lucide-react';
import { ComponentTemplate, COMPONENT_TEMPLATES, DiagramData } from '../types';
import { ConfirmModal } from './Modal';
import { usePortalTooltip } from './usePortalTooltip';
import { useAuth } from '../services/auth';
import {
    CustomTemplate, listCachedTemplates, fetchCustomTemplates,
    saveCustomTemplate, deleteCustomTemplate, templateDataFromDiagram,
} from '../services/customTemplates';

export interface ComponentLibraryProps {
    onAddComponent: (template: ComponentTemplate) => void;
    isOpen: boolean;
    onClose: () => void;
    currentDiagram: DiagramData;
}

const iconMap: Record<string, React.ReactNode> = {
    TrendingDown: <TrendingDown className="w-4 h-4" />,
    TrendingUp: <TrendingUp className="w-4 h-4" />,
    Activity: <Activity className="w-4 h-4" />,
    Minus: <Minus className="w-4 h-4" />,
    ArrowDownRight: <ArrowDownRight className="w-4 h-4" />,
    ArrowUp: <ArrowUp className="w-4 h-4" />,
    Triangle: <Triangle className="w-4 h-4" />,
    AlertTriangle: <AlertTriangle className="w-4 h-4" />,
    Square: <Square className="w-4 h-4" />,
    Target: <Target className="w-4 h-4" />,
    Circle: <Circle className="w-4 h-4" />,
    BarChart2: <BarChart2 className="w-4 h-4" />,
    Crown: <Crown className="w-4 h-4" />,
    Receipt: <Receipt className="w-4 h-4" />,
};

const categoryLabels: Record<string, { label: string; color: string }> = {
    curves: { label: 'Curves & Lines', color: 'text-blue-600 bg-blue-50' },
    areas: { label: 'Shaded Areas', color: 'text-green-600 bg-green-50' },
    points: { label: 'Points & Labels', color: 'text-purple-600 bg-purple-50' },
    complete: { label: 'Complete Diagrams', color: 'text-amber-600 bg-amber-50' },
};

const ComponentLibrary: React.FC<ComponentLibraryProps> = ({
    onAddComponent,
    isOpen,
    onClose,
    currentDiagram,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<string[]>(['custom', 'curves', 'areas', 'points', 'complete']);

    const { showTooltip, hideTooltip, TooltipPortal } = usePortalTooltip({ delay: 400, placement: 'left' });

    // ── Custom templates (Supporter feature, synced) ──
    const { configured: cloudConfigured, user, isPro } = useAuth();
    const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
    const [showSaveForm, setShowSaveForm] = useState(false);
    const [saveName, setSaveName] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    // Template awaiting delete confirmation (null when the dialog is closed).
    const [pendingDelete, setPendingDelete] = useState<CustomTemplate | null>(null);

    // Only ever show templates belonging to the signed-in user; clear when
    // signed out so a previous user's cache never leaks on a shared browser.
    useEffect(() => {
        if (!user) {
            setCustomTemplates([]);
            return;
        }
        setCustomTemplates(listCachedTemplates(user.id));
        if (isOpen && isPro) {
            fetchCustomTemplates(user.id).then(setCustomTemplates);
        }
    }, [isOpen, user, isPro]);

    if (!isOpen) return null;

    const handleSaveTemplate = async () => {
        if (!user) {
            setSaveError('Sign in (Settings) to save templates.');
            return;
        }
        setSaving(true);
        setSaveError(null);
        const result = await saveCustomTemplate(user.id, {
            name: saveName,
            data: templateDataFromDiagram(currentDiagram),
        });
        setSaving(false);
        if (result.error) {
            setSaveError(result.error);
        } else if (result.template) {
            setCustomTemplates(prev => [result.template!, ...prev]);
            setShowSaveForm(false);
            setSaveName('');
        }
    };

    const handleDeleteTemplate = async (id: string) => {
        if (!user) return;
        const prevList = customTemplates;
        setCustomTemplates(prev => prev.filter(t => t.id !== id));
        const { error } = await deleteCustomTemplate(user.id, id);
        if (error) {
            setCustomTemplates(prevList); // roll back the optimistic removal
            setSaveError(error);
        }
    };

    // Deleting a synced template removes it from every device, so confirm first
    // (same pattern as the destructive actions in Settings).
    const confirmDeleteTemplate = () => {
        if (!pendingDelete) return;
        handleDeleteTemplate(pendingDelete.id);
        setPendingDelete(null);
    };

    const addCustomTemplate = (t: CustomTemplate) => {
        onAddComponent({
            id: t.id,
            name: t.name,
            description: t.description,
            category: 'complete',
            icon: 'Star',
            data: t.data,
        });
    };

    const filteredCustom = customTemplates.filter(
        t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggleCategory = (category: string) => {
        setExpandedCategories(prev =>
            prev.includes(category)
                ? prev.filter(c => c !== category)
                : [...prev, category]
        );
    };

    const filteredTemplates = COMPONENT_TEMPLATES.filter(
        t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const groupedTemplates = filteredTemplates.reduce((acc, template) => {
        if (!acc[template.category]) acc[template.category] = [];
        acc[template.category].push(template);
        return acc;
    }, {} as Record<string, ComponentTemplate[]>);

    return (
        <div className="w-64 bg-white border-l border-gray-200 flex flex-col overflow-hidden shadow-lg h-full">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                        <Package className="w-4 h-4 text-blue-600" />
                        Components
                    </h3>
                    <button
                        onClick={onClose}
                        onMouseEnter={(e) => showTooltip(e.currentTarget, 'Close Component Library')}
                        onMouseLeave={hideTooltip}
                        className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search components..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                    />
                </div>
            </div>

            {/* Component List */}
            <div className="flex-1 overflow-y-auto p-2">
                {/* My Templates (Supporter) */}
                {cloudConfigured && (
                    <div className="mb-2">
                        <button
                            onClick={() => toggleCategory('custom')}
                            className="w-full flex items-center gap-2 p-2 rounded-lg text-sm font-medium transition-colors text-indigo-600 bg-indigo-50"
                        >
                            {expandedCategories.includes('custom') ? (
                                <ChevronDown className="w-4 h-4" />
                            ) : (
                                <ChevronRight className="w-4 h-4" />
                            )}
                            My Templates
                            <span className="ml-auto text-xs opacity-60">{filteredCustom.length}</span>
                        </button>

                        {expandedCategories.includes('custom') && (
                            <div className="mt-1 space-y-1">
                                {showSaveForm ? (
                                    <div className="p-2 border border-indigo-100 rounded-lg bg-indigo-50/50 space-y-2">
                                        <input
                                            value={saveName}
                                            onChange={(e) => setSaveName(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTemplate(); }}
                                            placeholder="Template name…"
                                            autoFocus
                                            className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 outline-none"
                                        />
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={handleSaveTemplate}
                                                disabled={saving || !saveName.trim()}
                                                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-300 transition-colors"
                                            >
                                                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                                            </button>
                                            <button
                                                onClick={() => { setShowSaveForm(false); setSaveError(null); }}
                                                className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowSaveForm(true)}
                                        className="w-full flex items-center gap-2 p-2 rounded-lg text-xs font-medium text-indigo-600 border border-dashed border-indigo-200 hover:bg-indigo-50 transition-colors"
                                    >
                                        <BookmarkPlus className="w-3.5 h-3.5" />
                                        Save current diagram as template
                                    </button>
                                )}

                                {/* Errors from save OR delete show regardless of form state */}
                                {saveError && <p className="text-xs text-red-600 px-1">{saveError}</p>}

                                {filteredCustom.map((t) => (
                                    <div
                                        key={t.id}
                                        className="group flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all cursor-pointer"
                                        onClick={() => addCustomTemplate(t)}
                                    >
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-indigo-100 text-indigo-600">
                                            <Star className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-medium text-gray-800 truncate">{t.name}</h4>
                                            <p className="text-xs text-gray-500 truncate">
                                                {t.description || new Date(t.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setPendingDelete(t); }}
                                            onMouseEnter={(e) => showTooltip(e.currentTarget, 'Delete template')}
                                            onMouseLeave={hideTooltip}
                                            className="p-1.5 rounded-md text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}

                                {filteredCustom.length === 0 && !showSaveForm && (
                                    <p className="text-xs text-gray-400 px-2 py-1">
                                        {user && isPro
                                            ? 'No templates yet, save your favourite curve setups.'
                                            : 'Save & sync your own templates with the Supporter plan.'}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {Object.entries(categoryLabels).map(([category, { label, color }]) => {
                    const templates = groupedTemplates[category];
                    if (!templates || templates.length === 0) return null;

                    const isExpanded = expandedCategories.includes(category);

                    return (
                        <div key={category} className="mb-2">
                            <button
                                onClick={() => toggleCategory(category)}
                                className={`w-full flex items-center gap-2 p-2 rounded-lg text-sm font-medium transition-colors ${color}`}
                            >
                                {isExpanded ? (
                                    <ChevronDown className="w-4 h-4" />
                                ) : (
                                    <ChevronRight className="w-4 h-4" />
                                )}
                                {label}
                                <span className="ml-auto text-xs opacity-60">{templates.length}</span>
                            </button>

                            {isExpanded && (
                                <div className="mt-1 space-y-1">
                                    {templates.map((template) => (
                                        <ComponentCard
                                            key={template.id}
                                            template={template}
                                            onAdd={() => onAddComponent(template)}
                                            showTooltip={showTooltip}
                                            hideTooltip={hideTooltip}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                {filteredTemplates.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                        <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No components found</p>
                    </div>
                )}
            </div>

            {/* Drag hint */}
            <div className="p-3 border-t border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-500 text-center">
                    Click <Plus className="w-3 h-3 inline" /> to add to canvas
                </p>
            </div>
            <TooltipPortal />

            <ConfirmModal
                isOpen={pendingDelete !== null}
                onClose={() => setPendingDelete(null)}
                onConfirm={confirmDeleteTemplate}
                title="Delete Template"
                message={`Delete the template "${pendingDelete?.name ?? ''}"? It will be removed from your library on all your devices. This can't be undone.`}
                confirmText="Delete"
                variant="danger"
            />
        </div>
    );
};

interface ComponentCardProps {
    template: ComponentTemplate;
    onAdd: () => void;
    showTooltip: (anchor: HTMLElement, text: string, placement?: 'left' | 'right' | 'top' | 'bottom') => void;
    hideTooltip: () => void;
}

const ComponentCard: React.FC<ComponentCardProps> = ({ template, onAdd, showTooltip, hideTooltip }) => {
    const icon = iconMap[template.icon] || <Circle className="w-4 h-4" />;

    const getPreviewColor = () => {
        if (template.data.curves && template.data.curves.length > 0) {
            return template.data.curves[0].color;
        }
        if (template.data.shadedRegions && template.data.shadedRegions.length > 0) {
            return template.data.shadedRegions[0].color;
        }
        if (template.data.annotatedPoints && template.data.annotatedPoints.length > 0) {
            return template.data.annotatedPoints[0].color || '#111827';
        }
        return '#3b82f6';
    };

    return (
        <div
            className="group flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all cursor-pointer"
            onClick={onAdd}
        >
            <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{
                    backgroundColor: getPreviewColor() + '20',
                    color: getPreviewColor()
                }}
            >
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-gray-800 truncate">{template.name}</h4>
                <p className="text-xs text-gray-500 truncate">{template.description}</p>
            </div>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onAdd();
                }}
                onMouseEnter={(e) => showTooltip(e.currentTarget, 'Add to canvas')}
                onMouseLeave={hideTooltip}
                className="p-1.5 rounded-md bg-blue-600 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-700"
            >
                <Plus className="w-3 h-3" />
            </button>
        </div>
    );
};

export default ComponentLibrary;
