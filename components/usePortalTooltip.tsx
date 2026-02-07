import React from 'react';
import { createPortal } from 'react-dom';

interface UsePortalTooltipOptions {
    /** Delay in ms before tooltip appears. Default: 400 */
    delay?: number;
    /** Default placement relative to anchor. Default: 'right' */
    placement?: 'left' | 'right' | 'top' | 'bottom';
}

export function usePortalTooltip(options: UsePortalTooltipOptions = {}) {
    const { delay = 400, placement: defaultPlacement = 'right' } = options;

    const tooltipRef = React.useRef<HTMLDivElement>(null);
    const tooltipTextRef = React.useRef<HTMLDivElement>(null);
    const showTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentPlacement = React.useRef<string>(defaultPlacement);
    const [mounted, setMounted] = React.useState(false);
    const portalTargetRef = React.useRef<HTMLElement | null>(null);

    React.useEffect(() => {
        setMounted(true);
        portalTargetRef.current = document.body;
        return () => {
            if (showTimeout.current) {
                clearTimeout(showTimeout.current);
                showTimeout.current = null;
            }
            setMounted(false);
            portalTargetRef.current = null;
        };
    }, []);

    const positionTooltip = (anchor: HTMLElement, placement: string) => {
        const el = tooltipRef.current;
        if (!el) return;
        const rect = anchor.getBoundingClientRect();
        const offset = 8;

        let top: number, left: number, transform: string;

        switch (placement) {
            case 'left':
                top = rect.top + rect.height / 2;
                left = rect.left - offset;
                transform = 'translateY(-50%) translateX(-100%)';
                break;
            case 'top':
                top = rect.top - offset;
                left = rect.left + rect.width / 2;
                transform = 'translateX(-50%) translateY(-100%)';
                break;
            case 'bottom':
                top = rect.bottom + offset;
                left = rect.left + rect.width / 2;
                transform = 'translateX(-50%)';
                break;
            case 'right':
            default:
                top = rect.top + rect.height / 2;
                left = rect.right + offset;
                transform = 'translateY(-50%)';
                break;
        }

        el.style.top = `${top}px`;
        el.style.left = `${left}px`;
        el.style.transform = transform;
    };

    const showTooltip = (
        anchor: HTMLElement,
        text: string,
        placement?: 'left' | 'right' | 'top' | 'bottom'
    ) => {
        const p = placement || defaultPlacement;
        currentPlacement.current = p;

        // Clear any pending hide or show
        if (showTimeout.current) {
            clearTimeout(showTimeout.current);
            showTimeout.current = null;
        }

        // Immediately hide if currently visible (prevents stale position flash)
        const el = tooltipRef.current;
        if (el) el.style.opacity = '0';

        showTimeout.current = setTimeout(() => {
            const el = tooltipRef.current;
            const textEl = tooltipTextRef.current;
            if (!el || !textEl) return;
            textEl.textContent = text;
            positionTooltip(anchor, p);
            el.style.opacity = '1';
        }, delay);
    };

    const hideTooltip = () => {
        if (showTimeout.current) {
            clearTimeout(showTimeout.current);
            showTimeout.current = null;
        }
        const el = tooltipRef.current;
        if (el) el.style.opacity = '0';
    };

    const TooltipPortal = React.useCallback(() => {
        if (!mounted || !portalTargetRef.current) return null;
        return createPortal(
            <div
                ref={tooltipRef}
                className="fixed z-[9999] pointer-events-none"
                style={{
                    top: 0,
                    left: 0,
                    opacity: 0,
                    transition: 'opacity 250ms ease-in-out',
                    willChange: 'opacity',
                }}
            >
                <div
                    ref={tooltipTextRef}
                    className="px-2.5 py-2.5 bg-gray-700 text-white text-xs rounded-xl whitespace-pre-wrap shadow-lg"
                />
            </div>,
            portalTargetRef.current
        );
    }, [mounted]);

    return { showTooltip, hideTooltip, TooltipPortal };
}
