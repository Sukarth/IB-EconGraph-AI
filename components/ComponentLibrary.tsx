import React, { useState } from 'react';
import {
    TrendingDown, TrendingUp, Activity, Minus, ArrowDownRight, ArrowUp,
    Triangle, AlertTriangle, Square, Target, Circle, BarChart2, Crown, Receipt,
    ChevronDown, ChevronRight, Search, Plus, X, Package
} from 'lucide-react';
import { ComponentTemplate, COMPONENT_TEMPLATES } from '../types';
import { usePortalTooltip } from './usePortalTooltip';

export interface ComponentLibraryProps {
    onAddComponent: (template: ComponentTemplate) => void;
    isOpen: boolean;
    onClose: () => void;
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
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<string[]>(['curves', 'areas', 'points', 'complete']);

    const { showTooltip, hideTooltip, TooltipPortal } = usePortalTooltip({ delay: 400, placement: 'left' });

    if (!isOpen) return null;

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
