import React from 'react';
import {
    Undo2,
    Redo2,
    Grid3X3,
    Magnet,
    Link2,
    ZoomIn,
    ZoomOut,
    Maximize2,
    Download,
    Trash2,
    ScanEye
} from 'lucide-react';
import { usePortalTooltip } from './usePortalTooltip';

export interface ToolbarRightProps {
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    showGrid: boolean;
    onToggleGrid: () => void;
    snapEnabled: boolean;
    onToggleSnap: () => void;
    moveTogetherEnabled: boolean;
    onToggleMoveTogether: () => void;
    zoom: number;
    onZoomChange: (zoom: number) => void;
    onExport: () => void;
    onClear: () => void;
    onRecenter?: () => void;
}

const ToolbarRight: React.FC<ToolbarRightProps> = ({
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    showGrid,
    onToggleGrid,
    snapEnabled,
    onToggleSnap,
    moveTogetherEnabled,
    onToggleMoveTogether,
    zoom,
    onZoomChange,
    onExport,
    onClear,
    onRecenter
}) => {
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const [isOverflowing, setIsOverflowing] = React.useState(false);

    const { showTooltip, hideTooltip, TooltipPortal } = usePortalTooltip({ delay: 400, placement: 'left' });

    const ActionButton = ({
        onClick,
        icon,
        label,
        disabled = false,
        danger = false
    }: {
        onClick: () => void;
        icon: React.ReactNode;
        label: string;
        disabled?: boolean;
        danger?: boolean;
    }) => (
        <button
            onMouseEnter={(e) => showTooltip(e.currentTarget, label, 'left')}
            onMouseLeave={hideTooltip}
            onClick={() => {
                hideTooltip();
                onClick();
            }}
            disabled={disabled}
            className={`relative p-2 rounded-lg transition-all ${disabled
                ? 'text-gray-300 cursor-not-allowed'
                : danger
                    ? 'text-gray-500 hover:bg-red-50 hover:text-red-600'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`}
        >
            {icon}
        </button>
    );

    const ToggleButton = ({
        active,
        onClick,
        icon,
        label
    }: {
        active: boolean;
        onClick: () => void;
        icon: React.ReactNode;
        label: string;
    }) => (
        <button
            onMouseEnter={(e) => showTooltip(e.currentTarget, `${label} ${active ? '(On)' : '(Off)'}`, 'left')}
            onMouseLeave={hideTooltip}
            onClick={() => {
                hideTooltip();
                onClick();
            }}
            className={`relative p-2 rounded-lg transition-all ${active
                ? 'bg-blue-100 text-blue-600'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`}
        >
            {icon}
        </button>
    );

    React.useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const check = () => setIsOverflowing(el.scrollHeight > el.clientHeight);
        check();
        const observer = new ResizeObserver(check);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <>
            <div ref={scrollRef} className="bg-white border-l border-gray-200 flex flex-col items-center py-3 gap-1 shadow-sm h-full" style={{ width: isOverflowing ? '62px' : '56px', overflowY: 'auto', scrollbarWidth: 'thin', overflowX: 'hidden' }}>
                {/* Undo/Redo */}
                <div className="py-2 border-b border-gray-100 flex flex-col gap-0.5">
                    <ActionButton
                        onClick={onUndo}
                        icon={<Undo2 className="w-4 h-4" />}
                        label="Undo (Ctrl+Z)"
                        disabled={!canUndo}
                    />
                    <ActionButton
                        onClick={onRedo}
                        icon={<Redo2 className="w-4 h-4" />}
                        label="Redo (Ctrl+Y)"
                        disabled={!canRedo}
                    />
                </div>

                {/* Settings Toggles */}
                <div className="py-2 border-b border-gray-100 flex flex-col gap-0.5">
                    <ToggleButton
                        active={showGrid}
                        onClick={onToggleGrid}
                        icon={<Grid3X3 className="w-4 h-4" />}
                        label="Show Grid"
                    />
                    <ToggleButton
                        active={snapEnabled}
                        onClick={onToggleSnap}
                        icon={<Magnet className="w-4 h-4" />}
                        label="Snapping"
                    />
                    <ToggleButton
                        active={moveTogetherEnabled}
                        onClick={onToggleMoveTogether}
                        icon={<Link2 className="w-4 h-4" />}
                        label="Move Together"
                    />
                </div>

                {/* Zoom Controls */}
                <div className="py-2 border-b border-gray-100 flex flex-col gap-0.5 items-center">
                    <ActionButton
                        onClick={() => onZoomChange(Math.min(zoom + 0.1, 3))}
                        icon={<ZoomIn className="w-4 h-4" />}
                        label="Zoom In"
                    />
                    <span className="text-[10px] text-gray-500 font-medium">{Math.round(zoom * 100)}%</span>
                    <ActionButton
                        onClick={() => onZoomChange(Math.max(zoom - 0.1, 0.3))}
                        icon={<ZoomOut className="w-4 h-4" />}
                        label="Zoom Out"
                    />
                    <ActionButton
                        onClick={() => onZoomChange(1)}
                        icon={<Maximize2 className="w-4 h-4" />}
                        label="Reset Zoom"
                    />
                    {onRecenter && (
                        <ActionButton
                            onClick={onRecenter}
                            icon={<ScanEye className="w-4 h-4" />}
                            label="Recenter View"
                        />
                    )}
                </div>

                {/* Actions */}
                <div className="py-2 flex flex-col gap-0.5 mt-auto">
                    <ActionButton
                        onClick={onExport}
                        icon={<Download className="w-4 h-4" />}
                        label="Export"
                    />
                    <ActionButton
                        onClick={onClear}
                        icon={<Trash2 className="w-4 h-4" />}
                        label="Clear Canvas"
                        danger
                    />
                </div>
            </div>

            <TooltipPortal />
        </>
    );
};

export default ToolbarRight;
