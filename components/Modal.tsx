import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Download, Crop as CropIcon, Eye, Move, RotateCcw, Check, Palette } from 'lucide-react';
import { EditorSettings } from '../types';
import { usePortalTooltip } from './usePortalTooltip';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '80' | 'full';
    showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    size = 'md',
    showCloseButton = true,
}) => {
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'auto';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        '3xl': 'max-w-3xl',
        '4xl': 'max-w-4xl',
        '80': 'max-w-[80vw]',
        full: 'max-w-[95vw]', // Close to full width
    };

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
            onClick={(e) => e.target === overlayRef.current && onClose()}
        >
            <div className={`bg-white rounded-xl shadow-2xl w-full ${sizeClasses[size]} animate-scaleIn`}>
                {(title || showCloseButton) && (
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                        {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
                        {showCloseButton && (
                            <button
                                onClick={onClose}
                                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-700"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                )}
                <div className="p-5">{children}</div>
            </div>
        </div>
    );
};

// Prompt Modal - replaces window.prompt()
interface PromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (value: string) => void;
    title: string;
    message?: string;
    defaultValue?: string;
    placeholder?: string;
    confirmText?: string;
    cancelText?: string;
}

export const PromptModal: React.FC<PromptModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    defaultValue = '',
    placeholder = '',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
}) => {
    const [value, setValue] = useState(defaultValue);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setValue(defaultValue);
            setTimeout(() => inputRef.current?.select(), 50);
        }
    }, [isOpen, defaultValue]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(value);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
            <form onSubmit={handleSubmit}>
                {message && <p className="text-gray-600 text-sm mb-4">{message}</p>}
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                    autoFocus
                />
                <div className="flex justify-end gap-2 mt-5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="submit"
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                        {confirmText}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

// Confirm Modal - replaces window.confirm()
interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'primary';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'primary',
}) => {
    const handleConfirm = () => {
        onConfirm();
        onClose();
    };

    const buttonClass = variant === 'danger'
        ? 'bg-red-600 hover:bg-red-700'
        : 'bg-blue-600 hover:bg-blue-700';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
            <p className="text-gray-600 text-sm mb-6">{message}</p>
            <div className="flex justify-end gap-2">
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    {cancelText}
                </button>
                <button
                    onClick={handleConfirm}
                    className={`px-4 py-2 text-sm font-medium text-white ${buttonClass} rounded-lg transition-colors`}
                >
                    {confirmText}
                </button>
            </div>
        </Modal>
    );
};

// Color Picker Modal
interface ColorPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (color: string) => void;
    currentColor?: string;
    title?: string;
    specialColors: string[];
    standardColors: string[];
    onUpdateSpecialColor: (index: number, color: string) => void;
    onUpdateStandardColor: (index: number, color: string) => void;
    onResetSpecialColors: () => void;
    onResetStandardColors: () => void;
}

export const ColorPickerModal: React.FC<ColorPickerModalProps> = ({
    isOpen,
    onClose,
    onSelect,
    currentColor = '#3b82f6',
    title = 'Choose Color',
    specialColors,
    standardColors,
    onUpdateSpecialColor,
    onUpdateStandardColor,
    onResetSpecialColors,
    onResetStandardColors
}) => {
    // Current active color being edited/viewed in the picker
    const [editingColor, setEditingColor] = useState(currentColor);
    // Track which type of slot is selected: 'standard', 'special', or null
    const [selectedSlotType, setSelectedSlotType] = useState<'standard' | 'special' | null>(null);
    // Index of the slot we are currently editing
    const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);

    // Internal state for confirmations to keep App.tsx clean
    const [confirmResetType, setConfirmResetType] = useState<'standard' | 'special' | null>(null);

    const colorInputRef = useRef<HTMLInputElement>(null);
    // Ref for debouncing color updates
    const debounceTimeoutRef = useRef<number | null>(null);

    const { showTooltip, hideTooltip, TooltipPortal } = usePortalTooltip({ delay: 400, placement: 'top' });

    // Sync editing color when currentColor prop changes or modal opens
    useEffect(() => {
        if (isOpen) {
            setEditingColor(currentColor);
            setSelectedSlotType(null);
            setSelectedSlotIndex(null);
        }
    }, [isOpen, currentColor]);

    // Handle real-time color changes from the hidden input
    const handleColorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newColor = e.target.value;
        setEditingColor(newColor);

        // Debounce actual updates to the parent state to prevent lag
        if (selectedSlotType && selectedSlotIndex !== null) {
            if (debounceTimeoutRef.current) {
                window.clearTimeout(debounceTimeoutRef.current);
            }

            debounceTimeoutRef.current = window.setTimeout(() => {
                if (selectedSlotType === 'special') {
                    onUpdateSpecialColor(selectedSlotIndex, newColor);
                } else if (selectedSlotType === 'standard') {
                    onUpdateStandardColor(selectedSlotIndex, newColor);
                }
                // We also auto-select the color for drawing
                onSelect(newColor);
            }, 100); // 100ms delay
        } else {
            // If no slot is selected, just update selection
            onSelect(newColor);
        }
    };

    // Manual text input change
    const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEditingColor(e.target.value);
    };

    const handleHexInputBlur = () => {
        // Validate and apply on blur
        if (/^#[0-9A-F]{6}$/i.test(editingColor)) {
            if (selectedSlotType && selectedSlotIndex !== null) {
                if (selectedSlotType === 'special') {
                    onUpdateSpecialColor(selectedSlotIndex, editingColor);
                } else if (selectedSlotType === 'standard') {
                    onUpdateStandardColor(selectedSlotIndex, editingColor);
                }
            }
            onSelect(editingColor);
        }
    }

    const handleSlotClick = (type: 'standard' | 'special', index: number, color: string) => {
        setEditingColor(color);
        setSelectedSlotType(type);
        setSelectedSlotIndex(index);
        onSelect(color); // Also immediately select it for use
    };

    const triggerColorPicker = () => {
        colorInputRef.current?.click();
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title={title} size="xl">
                <div className="flex flex-col md:flex-row gap-6 h-[320px]">
                    {/* Left Column: Color Slots */}
                    <div className="w-full md:w-1/2 flex flex-col gap-6 border-b md:border-b-0 md:border-r border-gray-100 pr-0 md:pr-6 md:pl-6 overflow-y-auto">

                        {/* Standard Colors */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-semibold text-gray-900">Standard</h3>
                                <button
                                    onClick={() => setConfirmResetType('standard')}
                                    onMouseEnter={(e) => showTooltip(e.currentTarget, 'Reset Standard Colors')}
                                    onMouseLeave={hideTooltip}
                                    className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1 transition-colors px-2 py-1 hover:bg-red-50 rounded"
                                >
                                    <RotateCcw className="w-3 h-3" /> Reset
                                </button>
                            </div>
                            <div className="grid grid-cols-5 gap-2">
                                {standardColors.map((color, index) => (
                                    <button
                                        key={`std-${index}`}
                                        onClick={() => handleSlotClick('standard', index, color)}
                                        className={`relative w-9 h-9 rounded-lg border-2 transition-all ${selectedSlotType === 'standard' && selectedSlotIndex === index
                                            ? 'border-blue-500 ring-2 ring-blue-200 scale-110 z-10'
                                            : 'border-transparent hover:border-gray-300'
                                            }`}
                                        style={{ backgroundColor: color }}
                                        onMouseEnter={(e) => showTooltip(e.currentTarget, `Standard ${index + 1}\n${color.toUpperCase()}`)}
                                        onMouseLeave={hideTooltip}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Special Colors */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-semibold text-gray-900">Special</h3>
                                <button
                                    onClick={() => setConfirmResetType('special')}
                                    onMouseEnter={(e) => showTooltip(e.currentTarget, 'Reset Special Colors')}
                                    onMouseLeave={hideTooltip}
                                    className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1 transition-colors px-2 py-1 hover:bg-red-50 rounded"
                                >
                                    <RotateCcw className="w-3 h-3" /> Reset
                                </button>
                            </div>
                            <div className="grid grid-cols-5 gap-2">
                                {specialColors.map((color, index) => (
                                    <button
                                        key={`special-${index}`}
                                        onClick={() => handleSlotClick('special', index, color)}
                                        className={`relative w-9 h-9 rounded-lg border-2 transition-all ${selectedSlotType === 'special' && selectedSlotIndex === index
                                            ? 'border-blue-500 ring-2 ring-blue-200 scale-110 z-10'
                                            : 'border-transparent hover:border-gray-300'
                                            }`}
                                        style={{ backgroundColor: color }}
                                        onMouseEnter={(e) => showTooltip(e.currentTarget, `Special ${index + 1}\n${color.toUpperCase()}`)}
                                        onMouseLeave={hideTooltip}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Selector */}
                    <div className="w-full md:w-1/2 flex flex-col items-center justify-evenly gap-4">
                        <div className="text-sm text-gray-500 mb-1 w-full text-center">
                            {selectedSlotType
                                ? `Editing ${selectedSlotType} slot ${selectedSlotIndex! + 1}`
                                : 'Select a slot to edit'}
                        </div>

                        {/* Big Preview / Trigger */}
                        <div
                            className="w-32 h-32 rounded-2xl shadow-inner cursor-pointer hover:shadow-lg transition-shadow border-4 border-white ring-1 ring-gray-200"
                            style={{ backgroundColor: editingColor }}
                            onClick={triggerColorPicker}
                            onMouseEnter={(e) => showTooltip(e.currentTarget, 'Click to pick color')}
                            onMouseLeave={hideTooltip}
                        />

                        {/* Hidden Native Picker */}
                        <input
                            type="color"
                            ref={colorInputRef}
                            value={editingColor}
                            onChange={handleColorInputChange}
                            className="opacity-0 w-0 h-0 absolute pointer-events-none"
                        />

                        {/* Hex Input */}
                        <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 bg-white w-40 hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                            <span className="text-gray-400 select-none">#</span>
                            <input
                                type="text"
                                value={editingColor.replace('#', '')}
                                onChange={handleHexInputChange}
                                onBlur={handleHexInputBlur}
                                className="w-full outline-none text-gray-700 font-mono uppercase"
                                spellCheck={false}
                            />
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Confirmation Modal for Resets */}
            <ConfirmModal
                isOpen={confirmResetType !== null}
                onClose={() => setConfirmResetType(null)}
                onConfirm={() => {
                    if (confirmResetType === 'special') onResetSpecialColors();
                    if (confirmResetType === 'standard') onResetStandardColors();
                    setConfirmResetType(null);
                }}
                title={`Reset ${confirmResetType === 'special' ? 'Special' : 'Standard'} Colors?`}
                message={`Are you sure you want to reset the ${confirmResetType} colors to their defaults? This cannot be undone.`}
                confirmText="Reset Colors"
                variant="danger"
            />
            <TooltipPortal />
        </>
    );
};

// Export Modal - full export with preview, format, quality, crop, and annotations
interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    svgUrl: string | null;
    title: string;
    description?: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
    isOpen,
    onClose,
    svgUrl,
    title,
    description,
}) => {
    const [format, setFormat] = useState<'svg' | 'png' | 'jpeg'>('png');
    const [quality, setQuality] = useState(92);
    const [scale, setScale] = useState(2);
    const [bgColor, setBgColor] = useState('#ffffff');
    const [isExporting, setIsExporting] = useState(false);
    const [includeTitle, setIncludeTitle] = useState(true);
    const [includeDescription, setIncludeDescription] = useState(true);

    // View Mode: Preview (result) or Crop (edit)
    const [mode, setMode] = useState<'preview' | 'crop'>('preview');

    const [crop, setCrop] = useState({ top: 0, bottom: 0, left: 0, right: 0 });

    const { showTooltip: showExportTooltip, hideTooltip: hideExportTooltip, TooltipPortal: ExportTooltipPortal } = usePortalTooltip({ delay: 400, placement: 'top' });

    // Base SVG image url (loaded once)
    const [baseDataUrl, setBaseDataUrl] = useState<string | null>(null);
    // Final rendered preview (with crop/text applied)
    const [finalPreviewUrl, setFinalPreviewUrl] = useState<string | null>(null);

    const [previewMetrics, setPreviewMetrics] = useState({ scaleFactor: 1, baseW: 0, baseH: 0 });

    const previewImgRef = useRef<HTMLImageElement>(null);
    const [draggingHandle, setDraggingHandle] = useState<string | null>(null);
    const dragStartRef = useRef<{ x: number, y: number, crop: typeof crop } | null>(null);

    // Reset crop when opening
    useEffect(() => {
        if (isOpen) {
            setCrop({ top: 0, bottom: 0, left: 0, right: 0 });
            setMode('preview');
        }
    }, [isOpen]);

    // 1. Load the Base SVG Image
    useEffect(() => {
        if (!svgUrl || !isOpen) return;

        let active = true;
        const loadBase = async () => {
            try {
                const resp = await fetch(svgUrl);
                const svgText = await resp.text();
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
                const svgEl = svgDoc.querySelector('svg');
                if (!svgEl) return;

                const baseW = parseInt(svgEl.getAttribute('width') || '800');
                const baseH = parseInt(svgEl.getAttribute('height') || '550');

                const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(blob);

                if (active) {
                    setBaseDataUrl(url);
                    setPreviewMetrics(p => ({ ...p, baseW, baseH }));
                }
            } catch (e) {
                console.error("Failed to load base SVG", e);
            }
        };
        loadBase();
        return () => { active = false; };
    }, [svgUrl, isOpen]);


    // 2. Generate Final Preview URL (Debounced)
    const generateFinalPreview = useCallback(async () => {
        if (!baseDataUrl || !previewMetrics.baseW) return;

        const img = new Image();
        img.src = baseDataUrl;
        await new Promise<void>((r) => { img.onload = () => r(); });

        const { baseW, baseH } = previewMetrics;

        // Calculate dimensions
        const cropW = baseW - crop.left - crop.right;
        const cropH = baseH - crop.top - crop.bottom;

        // Use a reasonable scale for preview to look sharp but not kill performance
        // For final export we use 'scale' state (2x, 3x), for preview 1.5x is usually plenty
        const previewScale = 1.5;

        const titleH = includeTitle ? 60 * previewScale : 0;
        const descH = (includeDescription && description) ? 50 * previewScale : 0;
        const pad = 20 * previewScale;

        const canvasW = Math.max(cropW * previewScale + pad * 2, 600);
        const canvasH = titleH + (cropH * previewScale) + descH + pad * 2;

        const canvas = document.createElement('canvas');
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Background
        ctx.fillStyle = bgColor;
        if (bgColor === 'transparent') {
            ctx.clearRect(0, 0, canvasW, canvasH);
        } else {
            ctx.fillRect(0, 0, canvasW, canvasH);
        }

        const isDark = bgColor === '#1f2937';
        ctx.fillStyle = isDark ? '#ffffff' : '#000000';
        ctx.textAlign = 'center';

        // Draw Title
        if (includeTitle) {
            ctx.font = `bold ${24 * previewScale}px sans-serif`;
            ctx.textBaseline = 'top';
            ctx.fillText(title, canvasW / 2, pad);
        }

        // Draw Description
        if (includeDescription && description) {
            ctx.font = `${16 * previewScale}px sans-serif`;
            ctx.textBaseline = 'bottom';
            ctx.fillText(description, canvasW / 2, canvasH - pad);
        }

        // Draw Image Portion
        const destW = cropW * previewScale;
        const destH = cropH * previewScale;
        const destX = (canvasW - destW) / 2;
        const destY = titleH + pad / 2; // rough vertical centering in available space?

        ctx.drawImage(
            img,
            crop.left, crop.top, cropW, cropH,
            destX, destY, destW, destH
        );

        setFinalPreviewUrl(canvas.toDataURL('image/png'));
    }, [baseDataUrl, previewMetrics, crop, title, description, includeTitle, includeDescription, bgColor]);

    useEffect(() => {
        if (mode === 'preview') {
            const t = setTimeout(generateFinalPreview, 50);
            return () => clearTimeout(t);
        }
    }, [mode, generateFinalPreview]);


    // Mouse Handlers for Cropping
    const handleMouseDown = (e: React.MouseEvent, handle: string) => {
        if (mode !== 'crop') return;
        e.preventDefault();
        e.stopPropagation();
        setDraggingHandle(handle);
        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            crop: { ...crop } // Snapshot start crop
        };
    };

    useEffect(() => {
        if (!draggingHandle || !previewMetrics.baseW) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!previewImgRef.current || !dragStartRef.current) return;
            const start = dragStartRef.current;

            // Calculate scale of displayed image vs actual SVG coordinate space
            const rect = previewImgRef.current.getBoundingClientRect();
            // How many Display Pixels per SVG Unit?
            const scaleX = rect.width / previewMetrics.baseW;
            const scaleY = rect.height / previewMetrics.baseH;

            const deltaX = (e.clientX - start.x) / scaleX;
            const deltaY = (e.clientY - start.y) / scaleY;

            setCrop(prev => {
                const next = { ...start.crop };
                const minSize = 50; // Minimum crop area size

                const limitTop = previewMetrics.baseH - minSize - next.bottom;
                const limitBottom = previewMetrics.baseH - minSize - next.top;
                const limitLeft = previewMetrics.baseW - minSize - next.right;
                const limitRight = previewMetrics.baseW - minSize - next.left;

                if (draggingHandle === 'move') {
                    // Moving the whole box
                    // Check bounds
                    let dt = deltaY;
                    let dl = deltaX;

                    // Constrain vertical
                    if (start.crop.top + dt < 0) dt = -start.crop.top;
                    if (previewMetrics.baseH - (start.crop.bottom - dt) > previewMetrics.baseH) dt = start.crop.bottom; // Wait, logic hard.
                    // Easier: 
                    // New Top = start.top + dt. Ensure >= 0.
                    // New Bottom = start.bottom - dt. Ensure >= 0.

                    let newTop = start.crop.top + dt;
                    let newBottom = start.crop.bottom - dt;

                    if (newTop < 0) {
                        newBottom += newTop; // add negative = subtract
                        newTop = 0;
                    }
                    if (newBottom < 0) {
                        newTop += newBottom;
                        newBottom = 0;
                    }

                    let newLeft = start.crop.left + dl;
                    let newRight = start.crop.right - dl;

                    if (newLeft < 0) {
                        newRight += newLeft;
                        newLeft = 0;
                    }
                    if (newRight < 0) {
                        newLeft += newRight;
                        newRight = 0;
                    }

                    next.top = Math.round(newTop);
                    next.bottom = Math.round(newBottom);
                    next.left = Math.round(newLeft);
                    next.right = Math.round(newRight);
                } else {
                    // Resizing
                    if (draggingHandle.includes('n')) {
                        next.top = Math.min(Math.max(0, start.crop.top + deltaY), limitTop);
                    }
                    if (draggingHandle.includes('s')) {
                        next.bottom = Math.min(Math.max(0, start.crop.bottom - deltaY), limitBottom);
                    }
                    if (draggingHandle.includes('w')) {
                        next.left = Math.min(Math.max(0, start.crop.left + deltaX), limitLeft);
                    }
                    if (draggingHandle.includes('e')) {
                        next.right = Math.min(Math.max(0, start.crop.right - deltaX), limitRight);
                    }
                }
                return next;
            });
        };

        const handleMouseUp = () => {
            setDraggingHandle(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingHandle, previewMetrics]);


    const handleFinalExport = async () => {
        if (!baseDataUrl) return;
        setIsExporting(true);
        try {
            // Re-use logic to create high-res canvas or download SVG
            const img = new Image();
            img.src = baseDataUrl;
            await new Promise<void>((r) => { img.onload = () => r(); });

            if (format === 'svg') {
                // For SVG export, we actually need to modify the SVG viewbox or download as is?
                // The requirements usually imply downloading the SVG file. 
                // However, 'crop' on SVG is tricky without editing the viewbox.
                // For now, let's assume SVG export is just the raw file, OR we can crop the ViewBox.
                // Let's implement ViewBox cropping for SVG if we can, or just download raw.
                // Given the user wants "Export PNG/JPG" mostly, SVG might just be raw. 
                // Let's stick to raw download for SVG for safety, unless requested.
                const a = document.createElement('a');
                a.href = svgUrl!;
                a.download = `${title.replace(/\s+/g, '_').toLowerCase()}.svg`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } else {
                const { baseW, baseH } = previewMetrics;
                const cropW = baseW - crop.left - crop.right;
                const cropH = baseH - crop.top - crop.bottom;

                const titleH = includeTitle ? 60 * scale : 0;
                const descH = (includeDescription && description) ? 50 * scale : 0;
                const pad = 20 * scale;

                const canvasW = Math.max(cropW * scale + pad * 2, 600);
                const canvasH = titleH + (cropH * scale) + descH + pad * 2;

                const canvas = document.createElement('canvas');
                canvas.width = canvasW;
                canvas.height = canvasH;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    // Background
                    ctx.fillStyle = bgColor;
                    if (bgColor === 'transparent') {
                        ctx.clearRect(0, 0, canvasW, canvasH);
                    } else {
                        ctx.fillRect(0, 0, canvasW, canvasH);
                    }

                    const isDark = bgColor === '#1f2937';
                    ctx.fillStyle = isDark ? '#ffffff' : '#000000';
                    ctx.textAlign = 'center';

                    if (includeTitle) {
                        ctx.font = `bold ${24 * scale}px sans-serif`;
                        ctx.textBaseline = 'top';
                        ctx.fillText(title, canvasW / 2, pad);
                    }
                    if (includeDescription && description) {
                        ctx.font = `${16 * scale}px sans-serif`;
                        ctx.textBaseline = 'bottom';
                        ctx.fillText(description, canvasW / 2, canvasH - pad);
                    }

                    const destW = cropW * scale;
                    const destH = cropH * scale;
                    const destX = (canvasW - destW) / 2;
                    const destY = titleH + pad / 2;

                    ctx.drawImage(
                        img,
                        crop.left, crop.top, cropW, cropH,
                        destX, destY, destW, destH
                    );

                    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
                    const dataUrl = canvas.toDataURL(mimeType, quality / 100);
                    const a = document.createElement('a');
                    a.href = dataUrl;
                    a.download = `${title.replace(/\s+/g, '_').toLowerCase()}.${format}`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                }
            }
            onClose();
        } catch (e) {
            console.error(e);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title="Export Diagram" size="full">
                <div className="flex flex-col lg:flex-row gap-6 h-full lg:h-[80vh] min-h-[600px]">

                    {/* LEFT: Preview / Crop Area (Takes maximum space) */}
                    <div className="flex-1 flex flex-col min-w-0 bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                        {/* Toolbar */}
                        <div className="flex items-center justify-center p-3 border-b border-gray-200 bg-white z-10">
                            <div className="flex p-1 bg-gray-100 rounded-lg">
                                <button
                                    onClick={() => setMode('preview')}
                                    className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${mode === 'preview'
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    <Eye className="w-4 h-4" />
                                    Preview
                                </button>
                                <button
                                    onClick={() => setMode('crop')}
                                    className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${mode === 'crop'
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    <CropIcon className="w-4 h-4" />
                                    Crop
                                </button>
                            </div>
                        </div>

                        {/* Canvas Area */}
                        <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-checkered p-8" style={{ backgroundColor: '#dfdfdf' }}>
                            {mode === 'preview' ? (
                                // PREVIEW MODE
                                finalPreviewUrl ? (
                                    <img
                                        src={finalPreviewUrl}
                                        alt="Export Preview"
                                        className="max-w-full max-h-full object-contain shadow-xl bg-white transition-opacity duration-300"
                                    />
                                ) : (
                                    <div className="animate-pulse flex flex-col items-center">
                                        <div className="w-12 h-12 bg-gray-200 rounded-full mb-2"></div>
                                        <span className="text-gray-400 text-sm">Generating preview...</span>
                                    </div>
                                )
                            ) : (
                                // CROP MODE
                                baseDataUrl ? (
                                    <div className="relative inline-block shadow-2xl" style={{ backgroundColor: '#f9fafb' }}>
                                        {/* The Base Image */}
                                        <img
                                            ref={previewImgRef}
                                            src={baseDataUrl}
                                            alt="Original"
                                            className="max-w-full max-h-[calc(80vh-100px)] object-contain block select-none pointer-events-none"
                                            draggable={false}
                                        />

                                        {/* Crop Overlay */}
                                        {previewMetrics.baseW > 0 && (
                                            <div className="absolute inset-0">
                                                {/* Semi-transparent Mask (Outside Crop) */}
                                                {/* Top */}
                                                <div className="absolute left-0 right-0 top-0 bg-black/60 backdrop-blur-[1px]"
                                                    style={{ height: `${(crop.top / previewMetrics.baseH) * 100}%` }} />
                                                {/* Bottom */}
                                                <div className="absolute left-0 right-0 bottom-0 bg-black/60 backdrop-blur-[1px]"
                                                    style={{ height: `${(crop.bottom / previewMetrics.baseH) * 100}%` }} />
                                                {/* Left (between top/bottom) */}
                                                <div className="absolute left-0 bg-black/60 backdrop-blur-[1px]"
                                                    style={{
                                                        top: `${(crop.top / previewMetrics.baseH) * 100}%`,
                                                        bottom: `${(crop.bottom / previewMetrics.baseH) * 100}%`,
                                                        width: `${(crop.left / previewMetrics.baseW) * 100}%`
                                                    }} />
                                                {/* Right */}
                                                <div className="absolute right-0 bg-black/60 backdrop-blur-[1px]"
                                                    style={{
                                                        top: `${(crop.top / previewMetrics.baseH) * 100}%`,
                                                        bottom: `${(crop.bottom / previewMetrics.baseH) * 100}%`,
                                                        width: `${(crop.right / previewMetrics.baseW) * 100}%`
                                                    }} />

                                                {/* The Crop Box (Interactive) */}
                                                <div
                                                    className="absolute border-2 border-white box-content shadow-[0_0_0_1px_rgba(0,0,0,0.2)] cursor-move group"
                                                    style={{
                                                        top: `${(crop.top / previewMetrics.baseH) * 100}%`,
                                                        bottom: `${(crop.bottom / previewMetrics.baseH) * 100}%`,
                                                        left: `${(crop.left / previewMetrics.baseW) * 100}%`,
                                                        right: `${(crop.right / previewMetrics.baseW) * 100}%`
                                                    }}
                                                    onMouseDown={(e) => handleMouseDown(e, 'move')}
                                                >
                                                    {/* Grid Lines (Rule of Thirds) */}
                                                    <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30 pointer-events-none" />
                                                    <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30 pointer-events-none" />
                                                    <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30 pointer-events-none" />
                                                    <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30 pointer-events-none" />

                                                    {/* Corner Handles */}
                                                    <div onMouseDown={(e) => handleMouseDown(e, 'nw')} className="absolute -top-1.5 -left-1.5 w-4 h-4 border-l-2 border-t-2 border-white bg-transparent z-20 cursor-nw-resize hover:scale-110 transition-transform" />
                                                    <div onMouseDown={(e) => handleMouseDown(e, 'ne')} className="absolute -top-1.5 -right-1.5 w-4 h-4 border-r-2 border-t-2 border-white bg-transparent z-20 cursor-ne-resize hover:scale-110 transition-transform" />
                                                    <div onMouseDown={(e) => handleMouseDown(e, 'sw')} className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-l-2 border-b-2 border-white bg-transparent z-20 cursor-sw-resize hover:scale-110 transition-transform" />
                                                    <div onMouseDown={(e) => handleMouseDown(e, 'se')} className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-r-2 border-b-2 border-white bg-transparent z-20 cursor-se-resize hover:scale-110 transition-transform" />

                                                    {/* Edge Handles */}
                                                    <div onMouseDown={(e) => handleMouseDown(e, 'n')} className="absolute -top-1 left-4 right-4 h-2 cursor-ns-resize z-10" />
                                                    <div onMouseDown={(e) => handleMouseDown(e, 's')} className="absolute -bottom-1 left-4 right-4 h-2 cursor-ns-resize z-10" />
                                                    <div onMouseDown={(e) => handleMouseDown(e, 'w')} className="absolute -left-1 top-4 bottom-4 w-2 cursor-ew-resize z-10" />
                                                    <div onMouseDown={(e) => handleMouseDown(e, 'e')} className="absolute -right-1 top-4 bottom-4 w-2 cursor-ew-resize z-10" />

                                                    {/* Center Move Icon (visible on hover) */}
                                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                        <Move className="text-white drop-shadow-md w-8 h-8 opacity-50" />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <span className="text-gray-400">Loading original...</span>
                                )
                            )}
                        </div>
                    </div>

                    {/* RIGHT: Controls (Fixed width) */}
                    <div className="w-full lg:w-[320px] flex-shrink-0 flex flex-col h-full bg-white rounded-xl border border-gray-100 shadow-sm">
                        <div className="p-5 border-b border-gray-100">
                            <h3 className="font-semibold text-gray-900">Export Settings</h3>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 space-y-8">
                            {/* Format Selection */}
                            <div className="space-y-3">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">File Format</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['png', 'jpeg', 'svg'] as const).map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setFormat(f)}
                                            className={`px-3 py-2 text-sm rounded-lg border font-medium transition-all ${format === f
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                                                : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                                }`}
                                        >
                                            {f.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Dimensions & Quality */}
                            {format !== 'svg' && (
                                <div className="space-y-3">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Resolution & Quality</label>
                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <span className="text-sm text-gray-700">Scaling</span>
                                                <span className="text-sm font-medium text-blue-600">{scale}x</span>
                                            </div>
                                            <input
                                                type="range" min="1" max="4" step="0.5"
                                                value={scale}
                                                onChange={(e) => setScale(Number(e.target.value))}
                                                className="w-full accent-blue-600"
                                            />
                                            <div className="flex justify-between text-xs text-gray-400 mt-1">
                                                <span>Web (1x)</span>
                                                <span>Print (4x)</span>
                                            </div>
                                        </div>

                                        {format === 'jpeg' && (
                                            <div>
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-sm text-gray-700">Quality</span>
                                                    <span className="text-sm font-medium text-blue-600">{quality}%</span>
                                                </div>
                                                <input
                                                    type="range" min="10" max="100"
                                                    value={quality}
                                                    onChange={(e) => setQuality(Number(e.target.value))}
                                                    className="w-full accent-blue-600"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Content Options */}
                            <div className="space-y-3">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Content</label>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={includeTitle}
                                            onChange={(e) => setIncludeTitle(e.target.checked)}
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">Include Title</span>
                                    </label>
                                    <label className={`flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer transition-colors ${!description ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}>
                                        <input
                                            type="checkbox"
                                            checked={includeDescription}
                                            disabled={!description}
                                            onChange={(e) => setIncludeDescription(e.target.checked)}
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">Include Description</span>
                                    </label>
                                </div>
                            </div>

                            {/* Background */}
                            <div className="space-y-3">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Background</label>
                                <div className="flex gap-3">
                                    {['#ffffff', '#f3f4f6', '#1f2937'].map(c => (
                                        <button
                                            key={c}
                                            onClick={() => setBgColor(c)}
                                            onMouseEnter={(e) => showExportTooltip(e.currentTarget, c.toUpperCase())}
                                            onMouseLeave={hideExportTooltip}
                                            className={`w-10 h-10 rounded-full border shadow-sm transition-transform hover:scale-110 active:scale-95 ${bgColor === c ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                    {format === 'png' && (
                                        <button
                                            onClick={() => setBgColor('transparent')}
                                            onMouseEnter={(e) => showExportTooltip(e.currentTarget, 'Transparent')}
                                            onMouseLeave={hideExportTooltip}
                                            className={`w-10 h-10 rounded-full border shadow-sm transition-transform hover:scale-110 active:scale-95 flex items-center justify-center bg-white ${bgColor === 'transparent' ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                                        >
                                            <div className="w-full h-full rounded-full opacity-50" style={{ background: 'repeating-conic-gradient(#ccc 0% 25%, transparent 0% 50%) 0 0/8px 8px' }} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer - Button */}
                        <div className="p-5 border-t border-gray-100 bg-gray-50 rounded-b-xl">
                            <button
                                onClick={handleFinalExport}
                                disabled={isExporting}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl transition-all shadow-lg hover:shadow-blue-500/25 disabled:opacity-70 disabled:shadow-none"
                            >
                                {isExporting ? (
                                    <>Processing...</>
                                ) : (
                                    <>
                                        <Download className="w-5 h-5" />
                                        Export {format.toUpperCase()}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Modal footer is removed as we moved actions to the right panel */}
            </Modal>
            <ExportTooltipPortal />
        </>
    );
};

export default Modal;
