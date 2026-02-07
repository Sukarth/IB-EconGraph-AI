import React from 'react';
import {
    MousePointer2,
    SquareDashedMousePointer,
    Minus,
    Spline,
    Circle,
    Type,
    PaintBucket,
    Eraser,
    Hand,
    Layers,
    Palette,
    Pipette
} from 'lucide-react';
import { EditorTool } from '../types';
import { usePortalTooltip } from './usePortalTooltip';

export interface ToolbarLeftProps {
    activeTool: EditorTool;
    onToolChange: (tool: EditorTool) => void;
    activeColor: string;
    onOpenColorPicker: () => void;
    onColorSelect: (color: string) => void;
    strokeWidth: number;
    onStrokeWidthChange: (width: number) => void;
    onToggleComponentLibrary: () => void;
    specialColors: string[];
    standardColors: string[];
}

const tools: { id: EditorTool; icon: React.ReactNode; label: string; shortcut?: string }[] = [
    { id: 'select', icon: <MousePointer2 className="w-4 h-4" />, label: 'Select & Move', shortcut: 'S' },
    { id: 'boxSelect', icon: <SquareDashedMousePointer className="w-4 h-4" />, label: 'Box Select', shortcut: 'B' },
    { id: 'line', icon: <Minus className="w-4 h-4" />, label: 'Line Tool', shortcut: 'L' },
    { id: 'curve', icon: <Spline className="w-4 h-4" />, label: 'Curve Tool', shortcut: 'C' },
    { id: 'point', icon: <Circle className="w-4 h-4" />, label: 'Point Tool', shortcut: 'P' },
    { id: 'label', icon: <Type className="w-4 h-4" />, label: 'Label Tool', shortcut: 'T' },
    { id: 'fill', icon: <PaintBucket className="w-4 h-4" />, label: 'Fill/Shade Area', shortcut: 'F' },
    { id: 'eraser', icon: <Eraser className="w-4 h-4" />, label: 'Eraser', shortcut: 'E' },
    { id: 'pan', icon: <Hand className="w-4 h-4" />, label: 'Pan Canvas', shortcut: 'H' },
];

const ToolbarLeft: React.FC<ToolbarLeftProps> = ({
    activeTool,
    onToolChange,
    activeColor,
    onOpenColorPicker,
    onColorSelect,
    strokeWidth,
    onStrokeWidthChange,
    onToggleComponentLibrary,
    specialColors,
    standardColors
}) => {
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const [isOverflowing, setIsOverflowing] = React.useState(false);

    const { showTooltip, hideTooltip, TooltipPortal } = usePortalTooltip({ delay: 400, placement: 'right' });

    React.useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const check = () => setIsOverflowing(el.scrollHeight > el.clientHeight);
        check();
        const observer = new ResizeObserver(check);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const ToolButton = ({
        id,
        icon,
        label,
        shortcut
    }: {
        id: EditorTool;
        icon: React.ReactNode;
        label: string;
        shortcut?: string;
    }) => {
        const tooltipText = `${label}${shortcut ? ` (${shortcut})` : ''}`;

        return (
            <button
                onMouseEnter={(e) => showTooltip(e.currentTarget, tooltipText, 'right')}
                onMouseLeave={hideTooltip}
                onClick={() => onToolChange(id)}
                className={`relative p-2.5 rounded-lg transition-all ${activeTool === id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
            >
                {icon}
            </button>
        );
    };

    return (
        <>
            <div ref={scrollRef} className="bg-white border-r border-gray-200 flex flex-col items-center py-3 gap-1 shadow-sm h-full" style={{ width: isOverflowing ? '70px' : '56px', overflowY: 'auto', scrollbarWidth: 'thin', overflowX: 'hidden' }}>
                {/* Drawing Tools */}
                <div className="flex flex-col gap-0.5 pb-3 border-b border-gray-100 w-full items-center">
                    {tools.map((tool) => (
                        <ToolButton key={tool.id} id={tool.id} icon={tool.icon} label={tool.label} shortcut={tool.shortcut} />
                    ))}
                </div>

                {/* Component Library */}
                <div className="py-2 border-b border-gray-100 w-full flex justify-center">
                    <button
                        onClick={onToggleComponentLibrary}
                        onMouseEnter={(e) => showTooltip(e.currentTarget, 'Component Library', 'right')}
                        onMouseLeave={hideTooltip}
                        className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all"
                    >
                        <Layers className="w-4 h-4" />
                    </button>
                </div>

                {/* Color Palette */}
                <div className="py-3 w-full px-2 border-b border-gray-100 flex flex-col items-center">
                    {/* Standard Colors */}
                    <div className="grid grid-cols-2 gap-1 mb-2">
                        {standardColors.map((color, idx) => (
                            <button
                                key={`std-${idx}`}
                                onClick={() => onColorSelect(color)}
                                onMouseEnter={(e) => showTooltip(e.currentTarget, `Standard Slot ${idx + 1}\n${color.toUpperCase()}`, 'right')}
                                onMouseLeave={hideTooltip}
                                aria-label={`Standard Slot ${idx + 1} ${color.toUpperCase()}`}
                                className={`w-5 h-5 rounded-sm transition-transform hover:scale-110 ${activeColor === color ? 'ring-2 ring-offset-1 ring-blue-500 z-10' : ''
                                    }`}
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </div>

                    {/* Special/Custom Color Slots */}
                    <div className="grid grid-cols-2 gap-1 mb-2 pt-2 border-t border-gray-100 w-full justify-items-center">
                        {specialColors.map((color, idx) => (
                            <button
                                key={`special-${idx}`}
                                onClick={() => onColorSelect(color)}
                                onMouseEnter={(e) => showTooltip(e.currentTarget, `Special Slot ${idx + 1}\n${color.toUpperCase()}`, 'right')}
                                onMouseLeave={hideTooltip}
                                aria-label={`Special Slot ${idx + 1} ${color.toUpperCase()}`}
                                className={`w-5 h-5 rounded-sm transition-transform hover:scale-110 border border-gray-200 ${activeColor === color ? 'ring-2 ring-offset-1 ring-blue-500 z-10' : ''
                                    }`}
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </div>

                    {/* Color Picker Button */}
                    <div className="mt-1 flex items-center justify-center">
                        <button
                            onClick={onOpenColorPicker}
                            onMouseEnter={(e) => showTooltip(e.currentTarget, 'Custom Color', 'right')}
                            onMouseLeave={hideTooltip}
                            className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all"
                        >
                            <div className="relative">
                                <Palette className="w-4 h-4" />
                                <div
                                    className="absolute -bottom-1 -right-1 w-2 h-2 rounded-full border border-white"
                                    style={{ backgroundColor: activeColor }}
                                />
                            </div>
                        </button>
                    </div>
                </div>

                {/* Stroke width */}
                <div className="py-3 w-full flex flex-col items-center gap-1">
                    <span className="text-[10px] text-gray-400 uppercase font-bold text-center leading-tight">Line<br />Width</span>
                    <select
                        value={strokeWidth}
                        onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
                        aria-label="Line Width"
                        className="w-10 text-xs text-center border border-gray-200 rounded py-0.5"
                    >
                        {[1, 2, 3, 4, 5, 6].map((w) => (
                            <option key={w} value={w}>{w}</option>
                        ))}
                    </select>
                </div>
            </div>

            <TooltipPortal />
        </>
    );
};

export default ToolbarLeft;
