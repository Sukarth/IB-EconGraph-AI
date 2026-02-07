import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { DiagramData, Point, EditorTool, EditorSettings, Curve, ShadedRegion, AnnotationPoint, TextLabel } from '../types';
import { usePortalTooltip } from './usePortalTooltip';

interface DiagramRendererProps {
    data: DiagramData;
    onDataChange?: (newData: DiagramData) => void;
    width?: number;
    height?: number;
    className?: string;
    onDownloadReady?: (url: string) => void;
    readOnly?: boolean;
    activeTool?: EditorTool;
    settings?: EditorSettings;
    activeColor?: string;
    strokeWidth?: number;
    zoom?: number;
    onZoomChange?: (zoom: number) => void;
    pan?: { x: number; y: number };
    onPanChange?: (pan: { x: number; y: number }) => void;
    onLabelEdit?: (type: string, index: number, currentValue: string) => void;
}

const PADDING = 60;
const HANDLE_RADIUS = 6;
const LINE_HIT_TOLERANCE = 8;

// Helper to render text with subscripts (P_1) and superscripts (P^*)
const FormattedText = ({ text, x, y, className, textAnchor = "middle", dominantBaseline, style, ...props }: any) => {
    const parts = useMemo(() => {
        const tokens: { type: string; content: string }[] = [];
        let i = 0;
        while (i < text.length) {
            const char = text[i];
            if (char === '_') {
                const next = text[i + 1];
                if (next === '{') {
                    const end = text.indexOf('}', i + 2);
                    if (end !== -1) {
                        tokens.push({ type: 'sub', content: text.substring(i + 2, end) });
                        i = end + 1;
                    } else {
                        tokens.push({ type: 'text', content: char });
                        i++;
                    }
                } else if (next) {
                    tokens.push({ type: 'sub', content: next });
                    i += 2;
                } else {
                    tokens.push({ type: 'text', content: char });
                    i++;
                }
            } else if (char === '^') {
                const next = text[i + 1];
                if (next === '{') {
                    const end = text.indexOf('}', i + 2);
                    if (end !== -1) {
                        tokens.push({ type: 'sup', content: text.substring(i + 2, end) });
                        i = end + 1;
                    } else {
                        tokens.push({ type: 'text', content: char });
                        i++;
                    }
                } else if (next) {
                    tokens.push({ type: 'sup', content: next });
                    i += 2;
                } else {
                    tokens.push({ type: 'text', content: char });
                    i++;
                }
            } else {
                let j = i;
                while (j < text.length && text[j] !== '_' && text[j] !== '^') {
                    j++;
                }
                tokens.push({ type: 'text', content: text.substring(i, j) });
                i = j;
            }
        }
        return tokens;
    }, [text]);

    const isInteractive = !!props.onDoubleClick;

    return (
        <text
            x={x}
            y={y}
            className={className}
            textAnchor={textAnchor}
            dominantBaseline={dominantBaseline}
            style={{
                userSelect: 'none',
                paintOrder: 'stroke',
                stroke: 'rgba(255, 255, 255, 0)',
                strokeWidth: '20px',
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
                cursor: isInteractive ? 'pointer' : 'default',
                pointerEvents: isInteractive ? 'all' : undefined,
                ...style
            }}
            {...props}
        >
            {parts.map((token, index) => {
                let dy = '0';
                if (token.type === 'sub') dy = '0.3em';
                if (token.type === 'sup') dy = '-0.6em';
                if (index > 0) {
                    const prev = parts[index - 1];
                    if (token.type === 'text') {
                        if (prev.type === 'sub') dy = '-0.3em';
                        if (prev.type === 'sup') dy = '0.6em';
                    }
                }
                return (
                    <tspan
                        key={index}
                        dy={dy}
                        fontSize={token.type !== 'text' ? '0.7em' : undefined}
                    >
                        {token.content}
                    </tspan>
                );
            })}
        </text>
    );
};

const DiagramRenderer: React.FC<DiagramRendererProps> = ({
    data,
    onDataChange,
    width = 600,
    height = 500,
    className = "",
    onDownloadReady,
    readOnly = false,
    activeTool = 'select',
    settings = { showGrid: true, gridSize: 10, snapToGrid: true, snapToPoints: true, moveTogether: true, snapThreshold: 8 },
    activeColor = '#3b82f6',
    strokeWidth = 2,
    zoom = 1,
    onZoomChange,
    pan = { x: 0, y: 0 },
    onPanChange,
    onLabelEdit,
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { showTooltip, hideTooltip, TooltipPortal } = usePortalTooltip({ delay: 400, placement: 'bottom' });
    // const [pan, setPan] = useState({ x: 0, y: 0 }); // Lifted to App
    const [dragging, setDragging] = useState<{
        type: 'point' | 'line' | 'region' | 'fillVertex' | 'pan' | 'textLabel';
        key: string;
        startX: number;
        startY: number;
        curveIndex?: number;
        pointIndex?: number;
        regionIndex?: number;
        originalPoints?: Point[];
        snapshot?: {
            curves: Record<number, Point[]>;
            regions: Record<number, Point[]>;
            annotations: Record<number, Point>;
            textLabels: Record<number, Point>;
        };
        initialPan?: { x: number; y: number };
    } | null>(null);
    const [hoveredElement, setHoveredElement] = useState<string | null>(null);
    const [drawingState, setDrawingState] = useState<{
        active: boolean;
        points: Point[];
        type?: 'line' | 'curve' | 'fill';
    }>({ active: false, points: [] });

    // Selection state
    const [selectedElements, setSelectedElements] = useState<Set<string>>(new Set());
    const [boxSelectRect, setBoxSelectRect] = useState<{
        startX: number;
        startY: number;
        currentX: number;
        currentY: number;
    } | null>(null);

    // Scales
    const mapX = useCallback((x: number) =>
        PADDING + (x - data.xAxis.min) / (data.xAxis.max - data.xAxis.min) * (width - 2 * PADDING),
        [data.xAxis, width]
    );
    const mapY = useCallback((y: number) =>
        (height - PADDING) - (y - data.yAxis.min) / (data.yAxis.max - data.yAxis.min) * (height - 2 * PADDING),
        [data.yAxis, height]
    );
    const invMapX = useCallback((svgX: number) =>
        ((svgX - PADDING) / (width - 2 * PADDING)) * (data.xAxis.max - data.xAxis.min) + data.xAxis.min,
        [data.xAxis, width]
    );
    const invMapY = useCallback((svgY: number) =>
        ((height - PADDING - svgY) / (height - 2 * PADDING)) * (data.yAxis.max - data.yAxis.min) + data.yAxis.min,
        [data.yAxis, height]
    );

    // Snapping logic
    const snapToGrid = useCallback((value: number, gridSize: number): number => {
        return Math.round(value / gridSize) * gridSize;
    }, []);

    const findNearbyPoint = useCallback((x: number, y: number, threshold: number): Point | null => {
        const allPoints: Point[] = [];
        data.curves.forEach(c => c.points.forEach(p => allPoints.push(p)));
        data.annotatedPoints.forEach(p => allPoints.push({ x: p.x, y: p.y }));
        data.shadedRegions.forEach(r => r.points.forEach(p => allPoints.push(p)));

        let closest: Point | null = null;
        let closestDist = Infinity;

        for (const point of allPoints) {
            const distance = Math.sqrt((point.x - x) ** 2 + (point.y - y) ** 2);
            if (distance < threshold && distance > 0.01 && distance < closestDist) {
                closest = point;
                closestDist = distance;
            }
        }
        return closest;
    }, [data]);

    // Find axis-aligned snap (same X or Y as existing point)
    const findAxisSnap = useCallback((x: number, y: number, threshold: number): { x?: number; y?: number } => {
        const result: { x?: number; y?: number } = {};
        const allPoints: Point[] = [];
        data.curves.forEach(c => c.points.forEach(p => allPoints.push(p)));
        data.annotatedPoints.forEach(p => allPoints.push({ x: p.x, y: p.y }));
        data.shadedRegions.forEach(r => r.points.forEach(p => allPoints.push(p)));

        let closestXDist = Infinity;
        let closestYDist = Infinity;

        for (const point of allPoints) {
            const xDist = Math.abs(point.x - x);
            const yDist = Math.abs(point.y - y);
            if (xDist < threshold && xDist < closestXDist && xDist > 0.01) {
                closestXDist = xDist;
                result.x = point.x;
            }
            if (yDist < threshold && yDist < closestYDist && yDist > 0.01) {
                closestYDist = yDist;
                result.y = point.y;
            }
        }

        // Also snap to axis origins (0)
        if (Math.abs(x) < threshold * 0.5) result.x = 0;
        if (Math.abs(y) < threshold * 0.5) result.y = 0;

        return result;
    }, [data]);

    const applySnapping = useCallback((x: number, y: number): Point => {
        let snappedX = x;
        let snappedY = y;

        if (settings.snapToPoints) {
            // First try exact point snap
            const nearbyPoint = findNearbyPoint(x, y, settings.snapThreshold);
            if (nearbyPoint) {
                return nearbyPoint;
            }

            // Then try axis-aligned snap
            const axisSnap = findAxisSnap(x, y, settings.snapThreshold * 0.6);
            if (axisSnap.x !== undefined) snappedX = axisSnap.x;
            if (axisSnap.y !== undefined) snappedY = axisSnap.y;
            if (axisSnap.x !== undefined || axisSnap.y !== undefined) {
                // If we got axis snap, still apply grid to the non-snapped axis
                if (settings.snapToGrid) {
                    if (axisSnap.x === undefined) snappedX = snapToGrid(x, settings.gridSize);
                    if (axisSnap.y === undefined) snappedY = snapToGrid(y, settings.gridSize);
                }
                return { x: snappedX, y: snappedY };
            }
        }

        if (settings.snapToGrid) {
            snappedX = snapToGrid(x, settings.gridSize);
            snappedY = snapToGrid(y, settings.gridSize);
        }

        return { x: snappedX, y: snappedY };
    }, [settings, findNearbyPoint, findAxisSnap, snapToGrid]);

    // Identify all interactive points
    const pointGroups = useMemo(() => {
        const groups: Record<string, { type: string, index: number, pointIndex?: number }[]> = {};
        const add = (x: number, y: number, ref: { type: string; index: number; pointIndex?: number }) => {
            const key = `${x.toFixed(2)},${y.toFixed(2)}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(ref);
        };

        data.curves.forEach((c, cIdx) => {
            c.points.forEach((p, pIdx) => add(p.x, p.y, { type: 'curve', index: cIdx, pointIndex: pIdx }));
        });
        data.shadedRegions.forEach((r, rIdx) => {
            r.points.forEach((p, pIdx) => add(p.x, p.y, { type: 'region', index: rIdx, pointIndex: pIdx }));
        });
        data.annotatedPoints.forEach((p, pIdx) => {
            add(p.x, p.y, { type: 'annotation', index: pIdx });
        });

        return groups;
    }, [data]);

    const getSVGPoint = useCallback((clientX: number, clientY: number) => {
        if (!svgRef.current) return { x: 0, y: 0 };
        const pt = svgRef.current.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const ctm = svgRef.current.getScreenCTM();
        if (!ctm) return { x: 0, y: 0 };
        const svgP = pt.matrixTransform(ctm.inverse());
        return {
            x: svgP.x - pan.x,
            y: svgP.y - pan.y
        };
    }, [pan]);

    // Check if a point is near a line segment
    const pointToLineDistance = (px: number, py: number, x1: number, y1: number, x2: number, y2: number): number => {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        return Math.sqrt((px - xx) ** 2 + (py - yy) ** 2);
    };

    // Helper to capture snapshot of all selected elements
    const captureSelectionSnapshot = useCallback(() => {
        const snapshot = {
            curves: {} as Record<number, Point[]>,
            regions: {} as Record<number, Point[]>,
            annotations: {} as Record<number, Point>,
            textLabels: {} as Record<number, Point>
        };

        selectedElements.forEach(key => {
            const [type, idxStr] = key.split('-');
            const idx = parseInt(idxStr);
            if (type === 'curve') snapshot.curves[idx] = data.curves[idx].points.map(p => ({ ...p }));
            else if (type === 'region') snapshot.regions[idx] = data.shadedRegions[idx].points.map(p => ({ ...p }));
            else if (type === 'annotation') snapshot.annotations[idx] = { ...data.annotatedPoints[idx] };
            else if (type === 'textLabel' && data.textLabels) snapshot.textLabels[idx] = { ...data.textLabels[idx] };
        });
        return snapshot;
    }, [data, selectedElements]);

    // Classic Flood Fill Implementation
    const performFloodFill = (clientX: number, clientY: number) => {
        if (!onDataChange) return;

        // 1. Setup Canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // 2. Draw all boundaries (curves and axes)
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2; // Make boundaries slightly thick to avoid leaks
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Draw Axes
        const xAxisY = mapY(data.yAxis.min); // Actually we should draw axes at 0 if present, or just the frame
        // Drawing the bounding box frame
        ctx.strokeRect(PADDING, PADDING, width - 2 * PADDING, height - 2 * PADDING);

        // Draw Curves
        data.curves.forEach(curve => {
            const pts = curve.points.map(p => ({ x: mapX(p.x), y: mapY(p.y) }));
            if (pts.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            if (curve.type === 'bezier') {
                if (pts.length === 3) {
                    ctx.quadraticCurveTo(pts[1].x, pts[1].y, pts[2].x, pts[2].y);
                } else if (pts.length === 4) {
                    ctx.bezierCurveTo(pts[1].x, pts[1].y, pts[2].x, pts[2].y, pts[3].x, pts[3].y);
                } else {
                    pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
                }
            } else {
                pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
            }
            ctx.stroke();
        });

        // 3. Get click position in SVG space
        const { x: svgX, y: svgY } = getSVGPoint(clientX, clientY);

        // Ensure within bounds
        if (svgX < 0 || svgX >= width || svgY < 0 || svgY >= height) return;

        const startX = Math.floor(svgX);
        const startY = Math.floor(svgY);

        const imageData = ctx.getImageData(0, 0, width, height);
        const pixelData = imageData.data;

        // Check if start pixel is already black (on line)
        const startIdx = (startY * width + startX) * 4;
        if (pixelData[startIdx] < 128) return; // Black-ish

        // 4. Flood Fill (BFS)
        const visited = new Uint8Array(width * height); // 1 = filled
        const queue = [startX, startY];
        const filledPoints: Point[] = [];

        // Define color to fill (doesn't matter visually, just for tracking) - we use visited array
        // But to extract boundary, we'll need to know which pixels are filled.

        let minX = width, maxX = 0, minY = height, maxY = 0;

        while (queue.length > 0) {
            const y = queue.pop()!;
            const x = queue.pop()!;

            const idx = y * width + x;
            if (visited[idx]) continue;

            visited[idx] = 1;

            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;

            // Check neighbors
            const check = (nx: number, ny: number) => {
                if (nx < 0 || nx >= width || ny < 0 || ny >= height) return;
                const nIdx = ny * width + nx;
                if (visited[nIdx]) return;

                // Check if boundary (black) on canvas
                const pIdx = (ny * width + nx) * 4;
                // If Not Black (R > 100) -> Empty space
                if (pixelData[pIdx] > 100) {
                    queue.push(nx, ny);
                }
            };

            check(x + 1, y);
            check(x - 1, y);
            check(x, y + 1);
            check(x, y - 1);
        }

        // 5. Trace Boundary (Marching Squares-ish or just simplistic Outline)
        // Simplistic approach: Scan lines? No.
        // Moore-Neighbor Tracing requires a starting boundary pixel.
        // Let's find top-left most pixel.

        // Optimization: We could use a library if available, but we must implement.
        // Let's try to extract points by checking "edges" of the filled mask.
        // Actually, since we have the mask in `visited`, we can iterate specifically to find the contour.
        // Or simpler: Construct a dense polygon from border pixels and simplify it.

        const boundaryPixels: { x: number, y: number }[] = [];
        // Scan to find boundary pixels
        // A pixel is boundary if it is 1 (filled) and has at least one 0 (unfilled) neighbor (4-connectivity)
        // This gives a set of pixels. We need to order them. 
        // Ordering is key for Polygon.

        // Let's use Moore-Neighbor Tracing.
        // Find first pixel (top-left)
        let foundStart = false;
        let currX = 0, currY = 0;

        // Search for starting pixel (filled)
        outer: for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                if (visited[y * width + x]) {
                    // Check if it's a boundary (left is empty)
                    if (x === 0 || !visited[y * width + (x - 1)]) {
                        currX = x;
                        currY = y;
                        foundStart = true;
                        break outer;
                    }
                }
            }
        }

        if (!foundStart) return;

        // Tracing direction: 0:N, 1:E, 2:S, 3:W
        // Actually, let's use standard direction vectors
        // P: current boundary pixel.
        // Backtrack: came from direction.

        const boundary: { x: number, y: number }[] = [];
        boundary.push({ x: currX, y: currY });

        // Simple contour following (Jacob's stopping criterion)
        // This is tricky to get perfect in one go.
        // Fallback: Just take the bounding box? No, user wants shapes.
        // Let's settle for a simplified "Convex Hull" OR just collecting ALL boundary pixels and sorting by angle? No, not convex.

        // Let's try a simple "Ray cast" collection or accepting the fact that without a robust library (d3-contour), 
        // doing this perfectly is hard.
        // However, I can collect "edge" pixels and try to order them by proximity.
        // Simpler: Just rely on "Concave Hull" logic? No.

        // Let's implement a BASIC version:
        // Collect a subset of boundary pixels (downsampled) to form a rough polygon.
        // It won't be perfect but "Classic MS Paint" usually rasterizes.
        // We need vector.

        // Let's try to use the `drawingState` to visualize the result.
        // Since `visited` is a binary mask, we can use `d3-contour` approach logic:
        // Walk the perimeter.

        // Simple Walker:
        // Always keep "Filled" on Right Hand.
        // Start at currX, currY. Facing North (0, -1). 
        // If Front-Right is Filled -> Turn Right, Move.
        // Else If Front is Filled -> Move.
        // Else If Front-Left is Filled -> Turn Left, Move.
        // ... this is specific to grid.

        // Let's try the "follow the edge" algorithm.
        let dir = 0; // 0=Right, 1=Down, 2=Left, 3=Up
        let px = currX;
        let py = currY;
        const startPx = px;
        const startPy = py;

        // Limit iterations
        let maxIter = width * height;

        const isFilled = (tx: number, ty: number) => {
            if (tx < 0 || tx >= width || ty < 0 || ty >= height) return false;
            return visited[ty * width + tx] === 1;
        };

        // Standard Moore-Neighbor
        // Directions: N, NE, E, SE, S, SW, W, NW (0-7)
        // But we have 4-connectivity filled.
        // Let's use the layout:
        // Current pixel P is ON. 
        // We look at neighbors in clockwise order starting from "backtrack".

        // Let's just grab the pixels efficiently.
        // Just sampling the grid is faster and safer for this environment than a buggy tracer.
        // Wait, I can't just sample. I need an ordered loop.

        // Okay, I will try a simple wall follower.
        // We found a pixel (currX, currY) that is ON, and (currX-1, currY) is OFF.
        // This means we are on the LEFT edge.
        // 'dir' = 0 (Up), 1 (Right), 2 (Down), 3 (Left).
        // Let's say we want to keep "OFF" on our Left.
        // Initially OFF is at (px-1, py). So we are facing Up (0). LEFT is (-1, 0).

        // Algorithm:
        // 1. Check Forward-Left. If ON -> Move there, Turn Left.
        // 2. Else Check Forward. If ON -> Move there.
        // 3. Else Check Forward-Right. If ON -> Move there, Turn Right.
        // 4. Else Turn Right (rotate in place) and repeat. (Backwards)

        // Wait, standard definition:
        // Relative to current direction: 
        // Left, Front, Right, Back.
        // Priority: Left > Front > Right > Back.

        // Directions (dx, dy)
        const dirs = [
            { dx: 0, dy: -1 }, // 0: Up
            { dx: 1, dy: 0 },  // 1: Right
            { dx: 0, dy: 1 },  // 2: Down
            { dx: -1, dy: 0 }  // 3: Left
        ];

        // Initial state: We found a pixel on the left edge. So (x-1, y) is empty.
        // We want to walk UP along the edge. so dir = 0.
        dir = 0;

        const resultPoints: Point[] = [];
        let steps = 0;

        do {
            if (px % 4 === 0 && py % 4 === 0) { // Downsample points slightly for smoother polygon
                resultPoints.push({ x: invMapX(px), y: invMapY(py) });
            }

            // Look for next pixel
            // Try Left relative to current dir
            const leftDir = (dir + 3) % 4;
            const frontDir = dir;
            const rightDir = (dir + 1) % 4;
            const backDir = (dir + 2) % 4; // Should essentially act as rotation if trapped

            // Check relative Left (if we move Left, is it filled?)
            // Actually, we are following the boundary of ON pixels.
            // If Left is ON, we must turn Left and go there (it sticks out).
            if (isFilled(px + dirs[leftDir].dx, py + dirs[leftDir].dy)) {
                dir = leftDir;
                px += dirs[dir].dx;
                py += dirs[dir].dy;
            }
            // Else if Front is ON
            else if (isFilled(px + dirs[frontDir].dx, py + dirs[frontDir].dy)) {
                px += dirs[dir].dx;
                py += dirs[dir].dy;
            }
            // Else if Right is ON
            else if (isFilled(px + dirs[rightDir].dx, py + dirs[rightDir].dy)) {
                dir = rightDir;
                px += dirs[dir].dx;
                py += dirs[dir].dy;
            }
            // Else (Dead end), turn Right (rotate in place)
            else {
                dir = rightDir;
            }

            steps++;
            // Safety break
            if (steps > 10000) break;

        } while ((px !== startPx || py !== startPy) && steps < 10000);

        // Filter and simplify points (basic distance filter)
        const simplified: Point[] = [];
        if (resultPoints.length > 0) {
            simplified.push(resultPoints[0]);
            for (let i = 1; i < resultPoints.length; i++) {
                const last = simplified[simplified.length - 1];
                const curr = resultPoints[i];
                const dist = Math.sqrt((curr.x - last.x) ** 2 + (curr.y - last.y) ** 2);
                if (dist > (data.xAxis.max - data.xAxis.min) * 0.01) { // 1% threshold
                    simplified.push(curr);
                }
            }
        }

        // Add region
        const newData = { ...data };
        const newRegion: ShadedRegion = {
            id: `region-${Date.now()}`,
            label: '',
            color: activeColor.includes('rgba') ? activeColor : activeColor + '40',
            points: simplified
        };
        newData.shadedRegions = [...newData.shadedRegions, newRegion];
        onDataChange(newData);
    };

    // Handle mouse down for different tools
    const handleMouseDown = (e: React.MouseEvent) => {
        // Pan tool or Right Click
        if (activeTool === 'pan' || e.button === 2) {
            e.preventDefault();
            setDragging({
                type: 'pan',
                key: 'pan',
                startX: e.clientX,
                startY: e.clientY,
                initialPan: { ...pan }
            });
            return;
        }

        if (activeTool === 'fill') {
            const { x: mouseX, y: mouseY } = getSVGPoint(e.clientX, e.clientY);

            // Start manual polygon drawing immediately
            // We removed the automatic flood fill to prevent accidental filling of wrong areas
            // User now explicitly clicks to define vertices
        }

        if (readOnly) return;

        const { x: mouseX, y: mouseY } = getSVGPoint(e.clientX, e.clientY);
        const dataX = invMapX(mouseX);
        const dataY = invMapY(mouseY);

        // Clamp to bounds
        const clampedX = Math.max(data.xAxis.min, Math.min(data.xAxis.max, dataX));
        const clampedY = Math.max(data.yAxis.min, Math.min(data.yAxis.max, dataY));

        if (activeTool === 'boxSelect') {
            // Start box selection rectangle
            setBoxSelectRect({
                startX: clampedX,
                startY: clampedY,
                currentX: clampedX,
                currentY: clampedY
            });
            if (!e.ctrlKey && !e.metaKey) {
                setSelectedElements(new Set());
            }
            return;
        }

        if (activeTool === 'select') {
            // Click on empty space clears selection (unless Ctrl held)
            if (!e.ctrlKey && !e.metaKey) {
                setSelectedElements(new Set());
            }
        }

        if (activeTool === 'line' || activeTool === 'curve') {
            const snapped = applySnapping(clampedX, clampedY);
            setDrawingState({
                active: true,
                points: [snapped],
                type: activeTool === 'line' ? 'line' : 'curve'
            });
        } else if (activeTool === 'fill') {
            const snapped = applySnapping(clampedX, clampedY);
            if (drawingState.active && drawingState.type === 'fill') {
                // Check if clicking near first point = close polygon
                if (drawingState.points.length >= 3) {
                    const firstPt = drawingState.points[0];
                    const dist = Math.sqrt((snapped.x - firstPt.x) ** 2 + (snapped.y - firstPt.y) ** 2);
                    const closeThreshold = (data.xAxis.max - data.xAxis.min) * 0.05; // 5% range for easier closing
                    if (dist < closeThreshold) {
                        // Complete the polygon
                        if (onDataChange) {
                            const newData = { ...data };
                            const newRegion: ShadedRegion = {
                                id: `region-${Date.now()}`,
                                label: '',
                                color: activeColor.includes('rgba') ? activeColor : activeColor + '40',
                                points: drawingState.points
                            };
                            newData.shadedRegions = [...newData.shadedRegions, newRegion];
                            onDataChange(newData);
                        }
                        setDrawingState({ active: false, points: [] });
                        return;
                    }
                }
                // Add point to fill polygon
                setDrawingState(prev => ({
                    ...prev,
                    points: [...prev.points, snapped]
                }));
            } else {
                setDrawingState({
                    active: true,
                    points: [snapped],
                    type: 'fill'
                });
            }
        } else if (activeTool === 'point') {
            const snapped = applySnapping(clampedX, clampedY);
            if (onDataChange) {
                const newData = { ...data };
                newData.annotatedPoints = [
                    ...newData.annotatedPoints,
                    {
                        x: snapped.x,
                        y: snapped.y,
                        label: `P_${newData.annotatedPoints.length + 1}`,
                        showDottedLines: true,
                        labelPosition: 'top-right' as const,
                        color: activeColor
                    }
                ];
                onDataChange(newData);
            }
        } else if (activeTool === 'label') {
            const snapped = applySnapping(clampedX, clampedY);
            if (onDataChange) {
                const newData = { ...data };
                if (!newData.textLabels) newData.textLabels = [];
                newData.textLabels = [
                    ...newData.textLabels,
                    {
                        id: `label-${Date.now()}`,
                        x: snapped.x,
                        y: snapped.y,
                        text: 'Label',
                        fontSize: 14,
                        color: activeColor,
                        fontWeight: 'normal' as const
                    }
                ];
                onDataChange(newData);
            }
        }
    };

    const handlePointMouseDown = (e: React.MouseEvent, key: string) => {
        if (readOnly || (activeTool !== 'select' && activeTool !== 'boxSelect')) return;
        e.preventDefault();
        e.stopPropagation();

        // Check if I clicked on an element that is already selected
        let isClickingSelected = isPointInSelectedElement(key);

        // Update selection state
        if (!isClickingSelected) {
            // Select the element(s) this point belongs to
            const refs = pointGroups[key];
            if (refs) {
                refs.forEach(ref => {
                    const elemKey = ref.type === 'curve' ? `curve-${ref.index}` :
                        ref.type === 'region' ? `region-${ref.index}` :
                            `annotation-${ref.index}`;
                    setSelectedElements(prev => {
                        const next = new Set(prev);
                        if (e.ctrlKey || e.metaKey) {
                            next.add(elemKey);
                        } else {
                            if (!next.has(elemKey)) {
                                next.clear();
                                next.add(elemKey);
                            }
                        }
                        return next;
                    });
                });
            }
        } else if (e.ctrlKey || e.metaKey) {
            // Deselect if clicking selected with Ctrl
            const refs = pointGroups[key];
            if (refs) {
                refs.forEach(ref => {
                    const elemKey = ref.type === 'curve' ? `curve-${ref.index}` :
                        ref.type === 'region' ? `region-${ref.index}` :
                            `annotation-${ref.index}`;
                    toggleElementSelection(ref.type, ref.index, true);
                });
            }
            return; // Don't drag if deselecting
        }

        // Before setting dragging, capture snapshot of ALL selected elements
        // (Wait for state update? No, we need to calculate it based on current selection + new click)
        // Actually, if we just selected it, 'selectedElements' might be stale in this closure?
        // Yes, setState is async. 
        // We can force the "snapshot" logic to include the newly selected item if it wasn't selected.

        // However, for simplicity:
        // If it was NOT selected, we cleared and selected ONLY this one (handled above "if (!isClickingSelected)").
        // But the state update hasn't happened yet.

        // Simple Fix: Construct the "effective selection" to snapshot.
        const effectiveSelection = new Set(selectedElements);
        if (!isClickingSelected && !(e.ctrlKey || e.metaKey)) {
            effectiveSelection.clear();
            const refs = pointGroups[key];
            refs?.forEach(ref => {
                effectiveSelection.add(ref.type === 'curve' ? `curve-${ref.index}` : ref.type === 'region' ? `region-${ref.index}` : `annotation-${ref.index}`);
            });
        }

        // Snapshot helper using effectiveSelection
        const snapshot = {
            curves: {} as Record<number, Point[]>,
            regions: {} as Record<number, Point[]>,
            annotations: {} as Record<number, Point>,
            textLabels: {} as Record<number, Point>
        };
        effectiveSelection.forEach(k => {
            const [type, idxStr] = k.split('-');
            const idx = parseInt(idxStr);
            if (type === 'curve') snapshot.curves[idx] = data.curves[idx].points.map(p => ({ ...p }));
            else if (type === 'region') snapshot.regions[idx] = data.shadedRegions[idx].points.map(p => ({ ...p }));
            else if (type === 'annotation') snapshot.annotations[idx] = { ...data.annotatedPoints[idx] };
            else if (type === 'textLabel' && data.textLabels) snapshot.textLabels[idx] = { ...data.textLabels[idx] };
        });

        setDragging({
            type: 'point',
            key,
            startX: e.clientX,
            startY: e.clientY,
            snapshot // Pass the snapshot
        });
    };

    const handleLineMouseDown = (e: React.MouseEvent, curveIndex: number) => {
        if (readOnly || (activeTool !== 'select' && activeTool !== 'boxSelect')) return;
        e.preventDefault();
        e.stopPropagation();

        const isSelected = isElementSelected('curve', curveIndex);
        let effectiveSelection = new Set(selectedElements);

        if (!isSelected) {
            if (!(e.ctrlKey || e.metaKey)) effectiveSelection.clear();
            effectiveSelection.add(`curve-${curveIndex}`);
            toggleElementSelection('curve', curveIndex, e.ctrlKey || e.metaKey);
        } else if (e.ctrlKey || e.metaKey) {
            toggleElementSelection('curve', curveIndex, true);
            return;
        }

        const snapshot = {
            curves: {} as Record<number, Point[]>,
            regions: {} as Record<number, Point[]>,
            annotations: {} as Record<number, Point>,
            textLabels: {} as Record<number, Point>
        };
        effectiveSelection.forEach(k => {
            const [type, idxStr] = k.split('-');
            const idx = parseInt(idxStr);
            if (type === 'curve') snapshot.curves[idx] = data.curves[idx].points.map(p => ({ ...p }));
            else if (type === 'region') snapshot.regions[idx] = data.shadedRegions[idx].points.map(p => ({ ...p }));
            else if (type === 'annotation') snapshot.annotations[idx] = { ...data.annotatedPoints[idx] };
            else if (type === 'textLabel' && data.textLabels) snapshot.textLabels[idx] = { ...data.textLabels[idx] };
        });

        const curve = data.curves[curveIndex];
        setDragging({
            type: 'line',
            key: `line-${curveIndex}`,
            startX: e.clientX,
            startY: e.clientY,
            curveIndex,
            originalPoints: [...curve.points],
            snapshot
        });
    };

    const handleRegionMouseDown = (e: React.MouseEvent, regionIndex: number) => {
        if (readOnly || (activeTool !== 'select' && activeTool !== 'boxSelect')) return;
        e.preventDefault();
        e.stopPropagation();

        const isSelected = isElementSelected('region', regionIndex);
        let effectiveSelection = new Set(selectedElements);

        if (!isSelected) {
            if (!(e.ctrlKey || e.metaKey)) effectiveSelection.clear();
            effectiveSelection.add(`region-${regionIndex}`);
            toggleElementSelection('region', regionIndex, e.ctrlKey || e.metaKey);
        } else if (e.ctrlKey || e.metaKey) {
            toggleElementSelection('region', regionIndex, true);
            return;
        }

        const snapshot = {
            curves: {} as Record<number, Point[]>,
            regions: {} as Record<number, Point[]>,
            annotations: {} as Record<number, Point>,
            textLabels: {} as Record<number, Point>
        };
        effectiveSelection.forEach(k => {
            const [type, idxStr] = k.split('-');
            const idx = parseInt(idxStr);
            if (type === 'curve') snapshot.curves[idx] = data.curves[idx].points.map(p => ({ ...p }));
            else if (type === 'region') snapshot.regions[idx] = data.shadedRegions[idx].points.map(p => ({ ...p }));
            else if (type === 'annotation') snapshot.annotations[idx] = { ...data.annotatedPoints[idx] };
            else if (type === 'textLabel' && data.textLabels) snapshot.textLabels[idx] = { ...data.textLabels[idx] };
        });

        const region = data.shadedRegions[regionIndex];
        setDragging({
            type: 'region',
            key: `region-${regionIndex}`,
            startX: e.clientX,
            startY: e.clientY,
            regionIndex,
            originalPoints: [...region.points],
            snapshot
        });
    };

    const handleTextLabelMouseDown = (e: React.MouseEvent, labelIndex: number) => {
        if (readOnly || (activeTool !== 'select' && activeTool !== 'boxSelect')) return;
        e.preventDefault();
        e.stopPropagation();

        const isSelected = isElementSelected('textLabel', labelIndex);
        let effectiveSelection = new Set(selectedElements);

        if (!isSelected) {
            if (!(e.ctrlKey || e.metaKey)) effectiveSelection.clear();
            effectiveSelection.add(`textLabel-${labelIndex}`);
            toggleElementSelection('textLabel', labelIndex, e.ctrlKey || e.metaKey);
        } else if (e.ctrlKey || e.metaKey) {
            toggleElementSelection('textLabel', labelIndex, true);
            return;
        }

        const snapshot = {
            curves: {} as Record<number, Point[]>,
            regions: {} as Record<number, Point[]>,
            annotations: {} as Record<number, Point>,
            textLabels: {} as Record<number, Point>
        };
        effectiveSelection.forEach(k => {
            const [type, idxStr] = k.split('-');
            const idx = parseInt(idxStr);
            if (type === 'curve') snapshot.curves[idx] = data.curves[idx].points.map(p => ({ ...p }));
            else if (type === 'region') snapshot.regions[idx] = data.shadedRegions[idx].points.map(p => ({ ...p }));
            else if (type === 'annotation') snapshot.annotations[idx] = { ...data.annotatedPoints[idx] };
            else if (type === 'textLabel' && data.textLabels) snapshot.textLabels[idx] = { ...data.textLabels[idx] };
        });

        setDragging({
            type: 'textLabel',
            key: `textLabel-${labelIndex}`,
            startX: e.clientX,
            startY: e.clientY,
            snapshot
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        // Handle Pan Drag
        if (dragging?.type === 'pan') {
            const dx = e.clientX - dragging.startX;
            const dy = e.clientY - dragging.startY;
            onPanChange?.({
                x: (dragging.initialPan?.x || 0) + dx,
                y: (dragging.initialPan?.y || 0) + dy
            });
            return;
        }

        const { x: mouseX, y: mouseY } = getSVGPoint(e.clientX, e.clientY);
        let newDataX = invMapX(mouseX);
        let newDataY = invMapY(mouseY);

        // Box select drag
        if (boxSelectRect) {
            const clampedX = Math.max(data.xAxis.min, Math.min(data.xAxis.max, newDataX));
            const clampedY = Math.max(data.yAxis.min, Math.min(data.yAxis.max, newDataY));
            setBoxSelectRect(prev => prev ? { ...prev, currentX: clampedX, currentY: clampedY } : null);
            return;
        }

        // Clamp to bounds
        newDataX = Math.max(data.xAxis.min, Math.min(data.xAxis.max, newDataX));
        newDataY = Math.max(data.yAxis.min, Math.min(data.yAxis.max, newDataY));

        // Drawing tools
        if (drawingState.active && (activeTool === 'line' || activeTool === 'curve')) {
            const snapped = applySnapping(newDataX, newDataY);
            setDrawingState(prev => ({
                ...prev,
                points: [prev.points[0], snapped]
            }));
            return;
        }

        // --- Dragging Logic with Snapshot (Multi-Select Support) ---
        if (dragging && dragging.snapshot && onDataChange) {
            // Calculate delta in DATA units
            const { x: startSvgX, y: startSvgY } = getSVGPoint(dragging.startX, dragging.startY);
            const startDataX = invMapX(startSvgX);
            const startDataY = invMapY(startSvgY);

            let deltaX = newDataX - startDataX;
            let deltaY = newDataY - startDataY;
            let originX = 0;
            let originY = 0;

            if (dragging.type === 'point') {
                // Snap the current pointer location for precise point placement
                const snapped = applySnapping(newDataX, newDataY);
                // Parse original location from key to calculate exact displacement from origin
                const [ox, oy] = dragging.key.split(',').map(parseFloat);
                originX = ox;
                originY = oy;
                deltaX = snapped.x - originX;
                deltaY = snapped.y - originY;
            }

            const newData = JSON.parse(JSON.stringify(data)) as DiagramData;

            // Apply delta to all snapshot elements
            // Curves
            Object.entries(dragging.snapshot.curves).forEach(([idxStr, points]) => {
                const idx = parseInt(idxStr);
                if (newData.curves[idx]) {
                    if (dragging.type === 'point') {
                        // Point Move Mode (Reshaping): Only move points matching the dragged origin
                        newData.curves[idx].points = points.map(p => {
                            // Use a small epsilon for float comparison
                            if (Math.abs(p.x - originX) < 0.01 && Math.abs(p.y - originY) < 0.01) {
                                return { x: p.x + deltaX, y: p.y + deltaY };
                            }
                            return p;
                        });
                    } else {
                        // Element Move Mode: Move all points
                        newData.curves[idx].points = points.map(p => ({
                            x: p.x + deltaX,
                            y: p.y + deltaY
                        }));
                    }
                }
            });
            // Regions
            Object.entries(dragging.snapshot.regions).forEach(([idxStr, points]) => {
                const idx = parseInt(idxStr);
                if (newData.shadedRegions[idx]) {
                    if (dragging.type === 'point') {
                        // Point Move Mode
                        newData.shadedRegions[idx].points = points.map(p => {
                            if (Math.abs(p.x - originX) < 0.01 && Math.abs(p.y - originY) < 0.01) {
                                return { x: p.x + deltaX, y: p.y + deltaY };
                            }
                            return p;
                        });
                    } else {
                        // Element Move Mode
                        newData.shadedRegions[idx].points = points.map(p => ({
                            x: p.x + deltaX,
                            y: p.y + deltaY
                        }));
                    }
                }
            });
            // Annotations
            Object.entries(dragging.snapshot.annotations).forEach(([idxStr, pt]) => {
                const idx = parseInt(idxStr);
                if (newData.annotatedPoints[idx]) {
                    newData.annotatedPoints[idx].x = pt.x + deltaX;
                    newData.annotatedPoints[idx].y = pt.y + deltaY;
                }
            });
            // Labels
            Object.entries(dragging.snapshot.textLabels).forEach(([idxStr, lbl]) => {
                const idx = parseInt(idxStr);
                if (newData.textLabels && newData.textLabels[idx]) {
                    newData.textLabels[idx].x = lbl.x + deltaX;
                    newData.textLabels[idx].y = lbl.y + deltaY;
                }
            });

            onDataChange(newData);
            return;
        }


        // Fallback for single dragging (should ideally be covered by above if snapshot is always present)
        // Point dragging legacy (just in case)
        if (dragging?.type === 'point' && onDataChange) {
            const snapped = applySnapping(newDataX, newDataY);
            // ... (rest of legacy logic omitted as we replaced it with snapshot) ...
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        // Finalize box select
        if (boxSelectRect) {
            const elementsInRect = getElementsInRect(
                boxSelectRect.startX, boxSelectRect.startY,
                boxSelectRect.currentX, boxSelectRect.currentY
            );
            setSelectedElements(prev => {
                if (e?.ctrlKey || e?.metaKey) {
                    const next = new Set(prev);
                    elementsInRect.forEach(k => next.add(k));
                    return next;
                }
                return elementsInRect;
            });
            setBoxSelectRect(null);
            return;
        }

        // Finish drawing
        if (drawingState.active && onDataChange) {
            if ((drawingState.type === 'line' || drawingState.type === 'curve') && drawingState.points.length >= 2) {
                const newData = { ...data };

                let points = drawingState.points;
                let type: 'linear' | 'bezier' = drawingState.type === 'curve' ? 'bezier' : 'linear';

                if (type === 'bezier' && points.length === 2) {
                    const p1 = points[0];
                    const p2 = points[1];
                    const dx = p2.x - p1.x;
                    const dy = p2.y - p1.y;

                    // Creates a cubic bezier with 4 points
                    // Offset control points slightly to make the curve visible and editable immediately
                    // Using a perpendicular offset for a gentle arch
                    const len = Math.sqrt(dx * dx + dy * dy);
                    const nx = -dy / (len || 1);
                    const ny = dx / (len || 1);
                    const offset = Math.min(len * 0.2, 30); // Max 30px offset

                    points = [
                        p1,
                        { x: p1.x + dx * 0.33 + nx * offset, y: p1.y + dy * 0.33 + ny * offset },
                        { x: p1.x + dx * 0.66 + nx * offset, y: p1.y + dy * 0.66 + ny * offset },
                        p2
                    ];
                }

                const newCurve: Curve = {
                    id: `curve-${Date.now()}`,
                    label: '',
                    color: activeColor,
                    type: type,
                    width: strokeWidth,
                    points: points
                };
                newData.curves = [...newData.curves, newCurve];
                onDataChange(newData);
            }

            // Only clear drawing state if NOT fill tool (fill tool keeps state until explicitly finished)
            if (drawingState.type !== 'fill') {
                setDrawingState({ active: false, points: [] });
            }
        }

        setDragging(null);
    };

    // Double click to complete fill region
    const handleDoubleClick = (e: React.MouseEvent) => {
        if (activeTool === 'fill' && drawingState.active && drawingState.points.length >= 3 && onDataChange) {
            const newData = { ...data };
            const newRegion: ShadedRegion = {
                id: `region-${Date.now()}`,
                label: '',
                color: activeColor.includes('rgba') ? activeColor : activeColor + '40', // Add transparency
                points: drawingState.points
            };
            newData.shadedRegions = [...newData.shadedRegions, newRegion];
            onDataChange(newData);
            setDrawingState({ active: false, points: [] });
        }
    };

    const handleLabelEdit = (type: string, index: number) => {
        if (readOnly || !onLabelEdit) return;
        let currentLabel = "";
        if (type === 'curve') currentLabel = data.curves[index].label;
        if (type === 'annotation') currentLabel = data.annotatedPoints[index].label;
        if (type === 'axisX') currentLabel = data.xAxis.label;
        if (type === 'axisY') currentLabel = data.yAxis.label;
        if (type === 'title') currentLabel = data.title;
        if (type === 'region') currentLabel = data.shadedRegions[index].label;
        if (type === 'textLabel' && data.textLabels) currentLabel = data.textLabels[index].text;
        onLabelEdit(type, index, currentLabel);
    };

    // Handle eraser tool
    const handleElementClick = (type: string, index: number, e: React.MouseEvent) => {
        if (activeTool === 'eraser' && onDataChange) {
            e.stopPropagation();
            const newData = { ...data };
            if (type === 'curve') {
                newData.curves = newData.curves.filter((_, i) => i !== index);
            } else if (type === 'region') {
                newData.shadedRegions = newData.shadedRegions.filter((_, i) => i !== index);
            } else if (type === 'annotation') {
                newData.annotatedPoints = newData.annotatedPoints.filter((_, i) => i !== index);
            } else if (type === 'label' && newData.textLabels) {
                newData.textLabels = newData.textLabels.filter((_, i) => i !== index);
            }
            onDataChange(newData);
        }
    };

    // Generate SVG paths
    const getPath = (curve: Curve) => {
        const pts = curve.points.map(p => ({ x: mapX(p.x), y: mapY(p.y) }));
        if (pts.length < 2) return "";

        if (curve.type === 'bezier') {
            if (pts.length === 3) {
                return `M ${pts[0].x},${pts[0].y} Q ${pts[1].x},${pts[1].y} ${pts[2].x},${pts[2].y}`;
            }
            if (pts.length === 4) {
                return `M ${pts[0].x},${pts[0].y} C ${pts[1].x},${pts[1].y} ${pts[2].x},${pts[2].y} ${pts[3].x},${pts[3].y}`;
            }
        }

        // Linear polyline for any other cases
        let d = `M ${pts[0].x},${pts[0].y}`;
        for (let i = 1; i < pts.length; i++) {
            d += ` L ${pts[i].x},${pts[i].y}`;
        }
        return d;
    };

    const getPolygonPath = (points: Point[]) => {
        if (points.length < 3) return "";
        const mapped = points.map(p => `${mapX(p.x)},${mapY(p.y)}`).join(" L ");
        return `M ${mapped} Z`;
    };

    const getLabelPos = (p: { x: number; y: number }, pos?: string) => {
        const x = mapX(p.x);
        const y = mapY(p.y);
        const gap = 12;

        switch (pos) {
            case 'top': return { x, y: y - gap, anchor: 'middle' as const, baseline: 'alphabetic' as const };
            case 'bottom': return { x, y: y + gap, anchor: 'middle' as const, baseline: 'hanging' as const };
            case 'left': return { x: x - gap, y: y, anchor: 'end' as const, baseline: 'central' as const };
            case 'right': return { x: x + gap, y: y, anchor: 'start' as const, baseline: 'central' as const };
            case 'top-left': return { x: x - gap, y: y - gap, anchor: 'end' as const, baseline: 'alphabetic' as const };
            case 'bottom-left': return { x: x - gap, y: y + gap, anchor: 'end' as const, baseline: 'hanging' as const };
            case 'bottom-right': return { x: x + gap, y: y + gap, anchor: 'start' as const, baseline: 'hanging' as const };
            case 'top-right': default: return { x: x + gap, y: y - gap, anchor: 'start' as const, baseline: 'alphabetic' as const };
        }
    };

    useEffect(() => {
        if (svgRef.current && onDownloadReady) {
            const svgData = new XMLSerializer().serializeToString(svgRef.current);
            const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            onDownloadReady(url);
        }
    }, [data, onDownloadReady]);

    // Ctrl+scroll zoom
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                e.stopPropagation();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                const newZoom = Math.max(0.3, Math.min(3, zoom + delta));
                onZoomChange?.(newZoom);
            }
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [zoom, onZoomChange]);

    // Clear selection when tool changes
    useEffect(() => {
        if (activeTool !== 'select' && activeTool !== 'boxSelect') {
            setSelectedElements(new Set());
        }
    }, [activeTool]);

    // Helper: get element key for selection
    const getElementKey = (type: string, index: number) => `${type}-${index}`;

    // Helper: check if an element is selected
    const isElementSelected = (type: string, index: number) => selectedElements.has(getElementKey(type, index));

    // Helper: check if a point belongs to a selected element
    const isPointInSelectedElement = useCallback((key: string) => {
        const refs = pointGroups[key];
        if (!refs) return false;
        return refs.some(ref => {
            if (ref.type === 'curve') return selectedElements.has(`curve-${ref.index}`);
            if (ref.type === 'region') return selectedElements.has(`region-${ref.index}`);
            if (ref.type === 'annotation') return selectedElements.has(`annotation-${ref.index}`);
            return false;
        });
    }, [pointGroups, selectedElements]);

    // Toggle element selection (for Ctrl+click)
    const toggleElementSelection = (type: string, index: number, ctrlKey: boolean) => {
        const key = getElementKey(type, index);
        setSelectedElements(prev => {
            const next = new Set(prev);
            if (ctrlKey) {
                if (next.has(key)) next.delete(key);
                else next.add(key);
            } else {
                if (next.has(key) && next.size === 1) {
                    next.clear();
                } else {
                    next.clear();
                    next.add(key);
                }
            }
            return next;
        });
    };

    // Delete selected elements
    const deleteSelectedElements = useCallback(() => {
        if (!onDataChange || selectedElements.size === 0) return;
        const newData = JSON.parse(JSON.stringify(data)) as DiagramData;

        const curvesToDelete = new Set<number>();
        const regionsToDel = new Set<number>();
        const annotationsToDel = new Set<number>();
        const labelsToDel = new Set<number>();

        selectedElements.forEach(key => {
            const [type, idxStr] = key.split('-');
            const idx = parseInt(idxStr);
            if (type === 'curve') curvesToDelete.add(idx);
            else if (type === 'region') regionsToDel.add(idx);
            else if (type === 'annotation') annotationsToDel.add(idx);
            else if (type === 'textLabel') labelsToDel.add(idx);
        });

        newData.curves = newData.curves.filter((_, i) => !curvesToDelete.has(i));
        newData.shadedRegions = newData.shadedRegions.filter((_, i) => !regionsToDel.has(i));
        newData.annotatedPoints = newData.annotatedPoints.filter((_, i) => !annotationsToDel.has(i));
        if (newData.textLabels) newData.textLabels = newData.textLabels.filter((_, i) => !labelsToDel.has(i));

        onDataChange(newData);
        setSelectedElements(new Set());
    }, [data, onDataChange, selectedElements]);

    // Box select: find elements within rectangle
    const getElementsInRect = useCallback((x1: number, y1: number, x2: number, y2: number): Set<string> => {
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);
        const selected = new Set<string>();

        data.curves.forEach((c, i) => {
            const allInside = c.points.some(p => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY);
            if (allInside) selected.add(`curve-${i}`);
        });
        data.annotatedPoints.forEach((p, i) => {
            if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) selected.add(`annotation-${i}`);
        });
        data.shadedRegions.forEach((r, i) => {
            const anyInside = r.points.some(p => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY);
            if (anyInside) selected.add(`region-${i}`);
        });
        data.textLabels?.forEach((l, i) => {
            if (l.x >= minX && l.x <= maxX && l.y >= minY && l.y <= maxY) selected.add(`textLabel-${i}`);
        });

        return selected;
    }, [data]);

    // Keyboard handler for fill tool completion + selection
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Enter to complete fill region
            if (e.key === 'Enter' && activeTool === 'fill' && drawingState.active && drawingState.points.length >= 3 && onDataChange) {
                e.preventDefault();
                const newData = { ...data };
                const newRegion: ShadedRegion = {
                    id: `region-${Date.now()}`,
                    label: '',
                    color: activeColor.includes('rgba') ? activeColor : activeColor + '40',
                    points: drawingState.points
                };
                newData.shadedRegions = [...newData.shadedRegions, newRegion];
                onDataChange(newData);
                setDrawingState({ active: false, points: [] });
            }
            // Escape to cancel current drawing or clear selection
            if (e.key === 'Escape') {
                if (drawingState.active) {
                    setDrawingState({ active: false, points: [] });
                } else if (selectedElements.size > 0) {
                    setSelectedElements(new Set());
                }
                if (boxSelectRect) setBoxSelectRect(null);
            }
            // Delete selected elements
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElements.size > 0 && !drawingState.active) {
                e.preventDefault();
                deleteSelectedElements();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeTool, drawingState, data, activeColor, onDataChange, selectedElements, boxSelectRect, deleteSelectedElements]);

    const gridLines = useMemo(() => {
        if (!settings.showGrid) return null;
        const lines = [];
        const gridStep = settings.gridSize;

        for (let x = data.xAxis.min; x <= data.xAxis.max; x += gridStep) {
            lines.push(
                <line
                    key={`grid-x-${x}`}
                    x1={mapX(x)}
                    y1={mapY(data.yAxis.min)}
                    x2={mapX(x)}
                    y2={mapY(data.yAxis.max)}
                    stroke="#e5e7eb"
                    strokeWidth="0.5"
                />
            );
        }
        for (let y = data.yAxis.min; y <= data.yAxis.max; y += gridStep) {
            lines.push(
                <line
                    key={`grid-y-${y}`}
                    x1={mapX(data.xAxis.min)}
                    y1={mapY(y)}
                    x2={mapX(data.xAxis.max)}
                    y2={mapY(y)}
                    stroke="#e5e7eb"
                    strokeWidth="0.5"
                />
            );
        }
        return lines;
    }, [settings.showGrid, settings.gridSize, data.xAxis, data.yAxis, mapX, mapY]);

    const getCursor = () => {
        switch (activeTool) {
            case 'line':
            case 'curve':
            case 'fill':
            case 'point':
                return 'crosshair';
            case 'eraser':
                return 'pointer';
            case 'pan':
                return 'grab';
            case 'label':
                return 'text';
            case 'boxSelect':
                return 'crosshair';
            default:
                return 'default';
        }
    };

    return (
        <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col ${className}`}>
            <div className="p-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center shrink-0" style={{ height: '50px' }}>
                <h2
                    className={`text-lg font-bold text-gray-800 ${!readOnly && onLabelEdit ? 'cursor-pointer hover:text-blue-600 select-none' : ''}`}
                    onDoubleClick={() => handleLabelEdit('title', -1)}
                    onMouseEnter={(e) => { if (!readOnly && onLabelEdit) showTooltip(e.currentTarget, 'Double-click to edit title'); }}
                    onMouseLeave={hideTooltip}
                >
                    {data.title}
                </h2>

                {/* Paint Tool Instructions */}
                {!readOnly && activeTool === 'fill' && selectedElements.size === 0 && (
                    <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-1.5 animate-in fade-in zoom-in duration-200">
                        <span className="text-xs font-medium text-purple-700">
                            {drawingState.active && drawingState.type === 'fill'
                                ? `Points selected: ${drawingState.points.length}`
                                : "Click to add points (min 3) to fill area"}
                        </span>

                        {drawingState.active && drawingState.type === 'fill' && drawingState.points.length >= 3 && (
                            <button
                                onClick={() => {
                                    if (onDataChange) {
                                        const newData = { ...data };
                                        const newRegion: ShadedRegion = {
                                            id: `region-${Date.now()}`,
                                            label: '',
                                            color: activeColor.includes('rgba') ? activeColor : activeColor + '40',
                                            points: drawingState.points
                                        };
                                        newData.shadedRegions = [...newData.shadedRegions, newRegion];
                                        onDataChange(newData);
                                        setDrawingState({ active: false, points: [] });
                                    }
                                }}
                                className="ml-2 text-xs px-2 py-0.5 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors shadow-sm font-bold"
                            >
                                Finish Fill
                            </button>
                        )}

                        {drawingState.active && drawingState.type === 'fill' && (
                            <button
                                onClick={() => setDrawingState({ active: false, points: [] })}
                                className="text-xs px-2 py-0.5 text-purple-600 hover:bg-purple-100 rounded"
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                )}

                {/* Selection actions bar */}
                {!readOnly && selectedElements.size > 0 && (
                    <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 animate-in fade-in zoom-in duration-200">
                        <span className="text-xs font-medium text-blue-700">{selectedElements.size} selected</span>

                        {/* Curve Label Toggle */}
                        {Array.from(selectedElements).some(k => k.startsWith('curve-')) && (
                            <div className="flex items-center gap-1.5 border-l border-blue-200 pl-2 ml-1">
                                <label className="flex items-center gap-1.5 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        className="w-3.5 h-3.5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                                        checked={(() => {
                                            const curveKeys = Array.from(selectedElements).filter(k => k.startsWith('curve-'));
                                            return curveKeys.every(k => {
                                                const idx = parseInt(k.split('-')[1]);
                                                return !!data.curves[idx]?.label;
                                            });
                                        })()}
                                        onChange={(e) => {
                                            const show = e.target.checked;
                                            const newData = { ...data };
                                            selectedElements.forEach(key => {
                                                if (key.startsWith('curve-')) {
                                                    const idx = parseInt(key.split('-')[1]);
                                                    if (newData.curves[idx]) {
                                                        newData.curves[idx].label = show ? (newData.curves[idx].label || 'Label') : '';
                                                    }
                                                }
                                            });
                                            onDataChange?.(newData);
                                        }}
                                    />
                                    <span className="text-[10px] uppercase font-bold text-blue-500 group-hover:text-blue-700 transition-colors">Show Label</span>
                                </label>
                            </div>
                        )}

                        {(Array.from(selectedElements).some(k => k.startsWith('textLabel-')) ||
                            Array.from(selectedElements).some(k => k.startsWith('curve-') && data.curves[parseInt(k.split('-')[1])].label) ||
                            Array.from(selectedElements).some(k => k.startsWith('annotation-'))) && (
                                <div className="flex items-center gap-1.5 border-l border-blue-200 pl-2 ml-1">
                                    <span className="text-[10px] uppercase font-bold text-blue-400">Font</span>
                                    <input
                                        type="number"
                                        min="8"
                                        max="64"
                                        className="w-12 h-6 text-xs border border-blue-200 rounded px-1 focus:ring-1 focus:ring-blue-400 outline-none"
                                        value={(() => {
                                            const firstLabel = Array.from(selectedElements).find(k => k.startsWith('textLabel-'));
                                            if (firstLabel) {
                                                const idx = parseInt(firstLabel.split('-')[1]);
                                                return data.textLabels?.[idx]?.fontSize || 14;
                                            }
                                            const firstCurve = Array.from(selectedElements).find(k => k.startsWith('curve-') && data.curves[parseInt(k.split('-')[1])].label);
                                            if (firstCurve) {
                                                const idx = parseInt(firstCurve.split('-')[1]);
                                                return data.curves[idx].fontSize || 14;
                                            }
                                            const firstAnnotation = Array.from(selectedElements).find(k => k.startsWith('annotation-'));
                                            if (firstAnnotation) {
                                                const idx = parseInt(firstAnnotation.split('-')[1]);
                                                return data.annotatedPoints[idx].fontSize || 14;
                                            }
                                            return 14;
                                        })()}
                                        onChange={(e) => {
                                            const size = parseInt(e.target.value);
                                            if (isNaN(size)) return;
                                            const newData = { ...data };
                                            selectedElements.forEach(key => {
                                                if (key.startsWith('textLabel-')) {
                                                    const idx = parseInt(key.split('-')[1]);
                                                    if (newData.textLabels && newData.textLabels[idx]) newData.textLabels[idx].fontSize = size;
                                                } else if (key.startsWith('curve-')) {
                                                    const idx = parseInt(key.split('-')[1]);
                                                    if (newData.curves[idx]) newData.curves[idx].fontSize = size;
                                                } else if (key.startsWith('annotation-')) {
                                                    const idx = parseInt(key.split('-')[1]);
                                                    if (newData.annotatedPoints[idx]) newData.annotatedPoints[idx].fontSize = size;
                                                }
                                            });
                                            onDataChange?.(newData);
                                        }}
                                    />
                                    <div className="flex flex-col -space-y-1">
                                        <button
                                            className="p-0.5 hover:bg-blue-100 rounded text-blue-500"
                                            onClick={() => {
                                                const newData = { ...data };
                                                selectedElements.forEach(key => {
                                                    if (key.startsWith('textLabel-')) {
                                                        const idx = parseInt(key.split('-')[1]);
                                                        if (newData.textLabels?.[idx]) {
                                                            newData.textLabels[idx].fontSize = (newData.textLabels[idx].fontSize || 14) + 1;
                                                        }
                                                    } else if (key.startsWith('curve-')) {
                                                        const idx = parseInt(key.split('-')[1]);
                                                        if (newData.curves[idx]) {
                                                            newData.curves[idx].fontSize = (newData.curves[idx].fontSize || 14) + 1;
                                                        }
                                                    } else if (key.startsWith('annotation-')) {
                                                        const idx = parseInt(key.split('-')[1]);
                                                        if (newData.annotatedPoints[idx]) {
                                                            newData.annotatedPoints[idx].fontSize = (newData.annotatedPoints[idx].fontSize || 14) + 1;
                                                        }
                                                    }
                                                });
                                                onDataChange?.(newData);
                                            }}
                                        >
                                            <ChevronUp className="w-3 h-3" />
                                        </button>
                                        <button
                                            className="p-0.5 hover:bg-blue-100 rounded text-blue-500"
                                            onClick={() => {
                                                const newData = { ...data };
                                                selectedElements.forEach(key => {
                                                    if (key.startsWith('textLabel-')) {
                                                        const idx = parseInt(key.split('-')[1]);
                                                        if (newData.textLabels?.[idx]) {
                                                            newData.textLabels[idx].fontSize = Math.max(8, (newData.textLabels[idx].fontSize || 14) - 1);
                                                        }
                                                    } else if (key.startsWith('curve-')) {
                                                        const idx = parseInt(key.split('-')[1]);
                                                        if (newData.curves[idx]) {
                                                            newData.curves[idx].fontSize = Math.max(8, (newData.curves[idx].fontSize || 14) - 1);
                                                        }
                                                    } else if (key.startsWith('annotation-')) {
                                                        const idx = parseInt(key.split('-')[1]);
                                                        if (newData.annotatedPoints[idx]) {
                                                            newData.annotatedPoints[idx].fontSize = Math.max(8, (newData.annotatedPoints[idx].fontSize || 14) - 1);
                                                        }
                                                    }
                                                });
                                                onDataChange?.(newData);
                                            }}
                                        >
                                            <ChevronDown className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            )}

                        <button
                            onClick={deleteSelectedElements}
                            onMouseEnter={(e) => showTooltip(e.currentTarget, 'Delete selected (Del)')}
                            onMouseLeave={hideTooltip}
                            className="text-xs px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
                        >
                            Delete
                        </button>
                        <button
                            onClick={() => setSelectedElements(new Set())}
                            onMouseEnter={(e) => showTooltip(e.currentTarget, 'Clear selection (Esc)')}
                            onMouseLeave={hideTooltip}
                            className="text-xs px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                )}
            </div>

            <div
                ref={containerRef}
                className="relative flex-1 overflow-hidden flex justify-center items-center bg-white"
                style={{ cursor: getCursor() }}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={(e) => handleMouseUp(e as any)}
                onContextMenu={(e) => e.preventDefault()}
            >
                <svg
                    ref={svgRef}
                    width={width}
                    height={height}
                    viewBox={`0 0 ${width} ${height}`}
                    className="select-none"
                    style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', transform: `scale(${zoom})` }}
                    onMouseDown={handleMouseDown}
                    onDoubleClick={handleDoubleClick}
                    onContextMenu={(e) => e.preventDefault()}
                >
                    <defs>
                        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#374151" />
                        </marker>
                        {/* Clip path for graph area - elements outside are hidden */}
                        <clipPath id="graph-area-clip">
                            <rect x={PADDING} y={PADDING} width={width - 2 * PADDING} height={height - 2 * PADDING} />
                        </clipPath>
                    </defs>

                    <g transform={`translate(${pan.x}, ${pan.y})`}>
                        {/* Grid */}
                        {gridLines}

                        {/* Shaded Regions */}
                        {data.shadedRegions.map((region, i) => {
                            const isSelected = isElementSelected('region', i);
                            return (
                                <g key={`region-${i}`}>
                                    {/* Selection highlight */}
                                    {isSelected && (
                                        <path
                                            d={getPolygonPath(region.points)}
                                            fill="none"
                                            stroke="rgba(59, 130, 246, 0.5)"
                                            strokeWidth={3}
                                            strokeDasharray="6,3"
                                            className="pointer-events-none"
                                        />
                                    )}
                                    <path
                                        d={getPolygonPath(region.points)}
                                        fill={region.color}
                                        stroke={hoveredElement === `region-${i}` ? '#3b82f6' : 'none'}
                                        strokeWidth={hoveredElement === `region-${i}` ? 2 : 0}
                                        className={`transition-all duration-200 ${activeTool === 'select' || activeTool === 'boxSelect' || activeTool === 'eraser' ? 'cursor-pointer' : ''}`}
                                        onMouseDown={(e) => handleRegionMouseDown(e, i)}
                                        onMouseEnter={() => setHoveredElement(`region-${i}`)}
                                        onMouseLeave={() => setHoveredElement(null)}
                                        onClick={(e) => handleElementClick('region', i, e)}
                                    />
                                    {region.points.length > 0 && region.label && (
                                        <FormattedText
                                            x={mapX(region.points.reduce((sum, p) => sum + p.x, 0) / region.points.length)}
                                            y={mapY(region.points.reduce((sum, p) => sum + p.y, 0) / region.points.length)}
                                            text={region.label}
                                            className={`text-xs font-semibold uppercase tracking-wider pointer-events-auto ${!readOnly && onLabelEdit ? 'cursor-pointer hover:fill-blue-600' : ''}`}
                                            fill="#374151"
                                            onDoubleClick={(e: React.MouseEvent) => { e.stopPropagation(); handleLabelEdit('region', i); }}
                                        />
                                    )}
                                </g>
                            );
                        })}

                        {/* Drawing preview for fill tool */}
                        {drawingState.active && drawingState.type === 'fill' && drawingState.points.length >= 1 && (
                            <g>
                                {/* Preview polygon */}
                                {drawingState.points.length >= 2 && (
                                    <path
                                        d={`M ${drawingState.points.map(p => `${mapX(p.x)},${mapY(p.y)}`).join(' L ')} Z`}
                                        fill={activeColor + '40'}
                                        stroke={activeColor}
                                        strokeWidth={1}
                                        strokeDasharray="4,4"
                                    />
                                )}
                                {/* Vertices */}
                                {drawingState.points.map((p, i) => (
                                    <circle
                                        key={i}
                                        cx={mapX(p.x)}
                                        cy={mapY(p.y)}
                                        r={4}
                                        fill={i === 0 ? '#22c55e' : activeColor}
                                        stroke="white"
                                        strokeWidth={2}
                                    />
                                ))}
                                {/* Hint text */}
                                {drawingState.points.length >= 3 && (
                                    <text
                                        x={width / 2}
                                        y={30}
                                        textAnchor="middle"
                                        className="text-xs fill-gray-500"
                                    >
                                        Press Enter or double-click to complete region
                                    </text>
                                )}
                            </g>
                        )}

                        {/* Axes */}
                        <g className="axes">
                            <line
                                x1={PADDING}
                                y1={height - PADDING}
                                x2={width - PADDING}
                                y2={height - PADDING}
                                stroke="#374151"
                                strokeWidth="2"
                                markerEnd="url(#arrowhead)"
                            />
                            <FormattedText
                                x={width - PADDING}
                                y={height - PADDING + 35}
                                text={data.xAxis.label}
                                textAnchor="end"
                                className={`text-sm font-semibold fill-gray-700 ${!readOnly && onLabelEdit ? 'cursor-pointer hover:fill-blue-600' : ''}`}
                                onDoubleClick={(e: React.MouseEvent) => { e.stopPropagation(); handleLabelEdit('axisX', -1); }}
                            />

                            <line
                                x1={PADDING}
                                y1={height - PADDING}
                                x2={PADDING}
                                y2={PADDING}
                                stroke="#374151"
                                strokeWidth="2"
                                markerEnd="url(#arrowhead)"
                            />
                            <FormattedText
                                x={PADDING}
                                y={PADDING - 15}
                                text={data.yAxis.label}
                                textAnchor="middle"
                                className={`text-sm font-semibold fill-gray-700 ${!readOnly && onLabelEdit ? 'cursor-pointer hover:fill-blue-600' : ''}`}
                                onDoubleClick={(e: React.MouseEvent) => { e.stopPropagation(); handleLabelEdit('axisY', -1); }}
                            />
                        </g>

                        {/* Curves - clipped to graph area */}
                        <g clipPath="url(#graph-area-clip)">
                            {data.curves.map((curve, i) => {
                                const d = getPath(curve);
                                const isHovered = hoveredElement === `curve-${i}`;
                                const isSelected = isElementSelected('curve', i);
                                return (
                                    <g key={curve.id}>
                                        {/* Helper lines for Cubic Bezier handles */}
                                        {isSelected && curve.type === 'bezier' && curve.points.length === 4 && (
                                            <g className="pointer-events-none">
                                                <line
                                                    x1={mapX(curve.points[0].x)} y1={mapY(curve.points[0].y)}
                                                    x2={mapX(curve.points[1].x)} y2={mapY(curve.points[1].y)}
                                                    stroke="#94a3b8" strokeWidth="1" strokeDasharray="4,4"
                                                />
                                                <line
                                                    x1={mapX(curve.points[3].x)} y1={mapY(curve.points[3].y)}
                                                    x2={mapX(curve.points[2].x)} y2={mapY(curve.points[2].y)}
                                                    stroke="#94a3b8" strokeWidth="1" strokeDasharray="4,4"
                                                />
                                            </g>
                                        )}

                                        {/* Selection highlight */}
                                        {isSelected && (
                                            <path
                                                d={d}
                                                fill="none"
                                                stroke="rgba(59, 130, 246, 0.3)"
                                                strokeWidth={curve.width + 8}
                                                strokeLinecap="round"
                                                className="pointer-events-none"
                                            />
                                        )}
                                        {/* Invisible wider path for easier clicking/dragging */}
                                        <path
                                            d={d}
                                            fill="none"
                                            stroke="transparent"
                                            strokeWidth={Math.max(curve.width + 10, 15)}
                                            strokeLinecap="round"
                                            className={activeTool === 'select' || activeTool === 'boxSelect' || activeTool === 'eraser' ? 'cursor-pointer' : ''}
                                            onMouseDown={(e) => handleLineMouseDown(e, i)}
                                            onMouseEnter={() => setHoveredElement(`curve-${i}`)}
                                            onMouseLeave={() => setHoveredElement(null)}
                                            onClick={(e) => handleElementClick('curve', i, e)}
                                        />
                                        {/* Visible path */}
                                        <path
                                            d={d}
                                            fill="none"
                                            stroke={isHovered ? '#3b82f6' : curve.color}
                                            strokeWidth={isHovered ? curve.width + 1 : curve.width}
                                            strokeDasharray={curve.strokeDasharray}
                                            strokeLinecap="round"
                                            className="pointer-events-none transition-all duration-200"
                                        />
                                    </g>
                                );
                            })}
                        </g>

                        {/* Drawing preview for line/curve */}
                        {drawingState.active && (drawingState.type === 'line' || drawingState.type === 'curve') && drawingState.points.length === 2 && (
                            <line
                                x1={mapX(drawingState.points[0].x)}
                                y1={mapY(drawingState.points[0].y)}
                                x2={mapX(drawingState.points[1].x)}
                                y2={mapY(drawingState.points[1].y)}
                                stroke={activeColor}
                                strokeWidth={strokeWidth}
                                strokeDasharray="4,4"
                            />
                        )}

                        {/* Point handles - only for selected elements or when dragging */}
                        {!readOnly && (activeTool === 'select' || activeTool === 'boxSelect') && Object.keys(pointGroups).map((key) => {
                            // Only show handles for points belonging to selected elements
                            if (selectedElements.size > 0 && !isPointInSelectedElement(key)) return null;
                            // If nothing selected, don't show any handles
                            if (selectedElements.size === 0 && !dragging) return null;

                            const [xStr, yStr] = key.split(',');
                            const x = parseFloat(xStr);
                            const y = parseFloat(yStr);
                            const cx = mapX(x);
                            const cy = mapY(y);
                            const isHovered = hoveredElement === `point-${key}`;
                            const isDragging = dragging?.key === key;

                            return (
                                <g key={key}>
                                    {/* Larger invisible hit area for easier grabbing */}
                                    <circle
                                        cx={cx}
                                        cy={cy}
                                        r={HANDLE_RADIUS * 3}
                                        fill="transparent"
                                        className="cursor-move"
                                        onMouseDown={(e) => handlePointMouseDown(e, key)}
                                        onMouseEnter={() => setHoveredElement(`point-${key}`)}
                                        onMouseLeave={() => setHoveredElement(null)}
                                    />
                                    {/* Visible handle */}
                                    <circle
                                        cx={cx}
                                        cy={cy}
                                        r={isHovered || isDragging ? HANDLE_RADIUS + 2 : HANDLE_RADIUS}
                                        fill={isHovered || isDragging ? "rgba(59, 130, 246, 0.5)" : "rgba(59, 130, 246, 0.2)"}
                                        stroke={isHovered || isDragging ? "#2563eb" : "#3b82f6"}
                                        strokeWidth="2"
                                        className="pointer-events-none transition-all"
                                    />
                                </g>
                            );
                        })}

                        {/* Curve Labels */}
                        {data.curves.map((curve, i) => {
                            const lastPoint = curve.points[curve.points.length - 1];
                            if (!curve.label) return null;
                            const isSelected = isElementSelected('curve', i);
                            return (
                                <FormattedText
                                    key={`curve-label-${i}`}
                                    x={mapX(lastPoint.x) + 8}
                                    y={mapY(lastPoint.y)}
                                    text={curve.label}
                                    textAnchor="start"
                                    dominantBaseline="central"
                                    fill={curve.color}
                                    className={`text-sm font-bold ${!readOnly && onLabelEdit ? 'cursor-pointer' : ''}`}
                                    style={{
                                        fontSize: curve.fontSize || 14,
                                        filter: isSelected ? 'drop-shadow(0 0 2px #3b82f6)' : undefined
                                    }}
                                    onDoubleClick={(e: React.MouseEvent) => { e.stopPropagation(); handleLabelEdit('curve', i); }}
                                />
                            );
                        })}

                        {/* Annotated Points */}
                        {data.annotatedPoints.map((pt, i) => {
                            const cx = mapX(pt.x);
                            const cy = mapY(pt.y);
                            const labelPos = getLabelPos(pt, pt.labelPosition);
                            const isSelected = isElementSelected('annotation', i);

                            return (
                                <g
                                    key={`pt-${i}`}
                                    className={activeTool === 'eraser' ? 'cursor-pointer' : ''}
                                    onClick={(e) => {
                                        handleElementClick('annotation', i, e);
                                        if (activeTool === 'select' || activeTool === 'boxSelect') {
                                            e.stopPropagation();
                                            toggleElementSelection('annotation', i, e.ctrlKey || e.metaKey);
                                        }
                                    }}
                                >
                                    {pt.showDottedLines && (
                                        <>
                                            <line x1={cx} y1={cy} x2={cx} y2={height - PADDING} stroke="#9ca3af" strokeWidth="1" strokeDasharray="4,4" />
                                            <line x1={cx} y1={cy} x2={PADDING} y2={cy} stroke="#9ca3af" strokeWidth="1" strokeDasharray="4,4" />
                                        </>
                                    )}
                                    {/* Selection highlight ring */}
                                    {isSelected && (
                                        <circle cx={cx} cy={cy} r="10" fill="none" stroke="rgba(59, 130, 246, 0.4)" strokeWidth="3" className="pointer-events-none" />
                                    )}
                                    {/* Larger invisible hit area for easier clicking/dragging - UPDATED based on request */}
                                    <circle cx={cx} cy={cy} r="20" fill="transparent" className="cursor-pointer" />
                                    <circle cx={cx} cy={cy} r="5" fill={pt.color || "#111827"} stroke="white" strokeWidth="2" className="pointer-events-none" />
                                    <FormattedText
                                        x={labelPos.x}
                                        y={labelPos.y}
                                        text={pt.label}
                                        textAnchor={labelPos.anchor}
                                        dominantBaseline={labelPos.baseline}
                                        className={`text-sm font-bold fill-gray-800 pointer-events-auto ${!readOnly && onLabelEdit ? 'cursor-pointer hover:fill-blue-600' : ''}`}
                                        style={{
                                            fontSize: pt.fontSize || 14,
                                            filter: isSelected ? 'drop-shadow(0 0 2px #3b82f6)' : undefined
                                        }}
                                        onDoubleClick={(e: React.MouseEvent) => { e.stopPropagation(); handleLabelEdit('annotation', i); }}
                                    />
                                </g>
                            );
                        })}

                        {/* Text Labels */}
                        {data.textLabels?.map((label, i) => (
                            <FormattedText
                                key={label.id}
                                x={mapX(label.x)}
                                y={mapY(label.y)}
                                text={label.text}
                                fill={label.color || '#111827'}
                                style={{
                                    fontSize: label.fontSize || 14,
                                    fontWeight: label.fontWeight || 'normal',
                                    filter: isElementSelected('textLabel', i) ? 'drop-shadow(0 0 2px #3b82f6)' : undefined
                                }}
                                className={`pointer-events-auto ${!readOnly ? 'cursor-move' : ''} ${activeTool === 'eraser' ? 'hover:fill-red-500' : ''}`}
                                onDoubleClick={(e: React.MouseEvent) => { e.stopPropagation(); handleLabelEdit('textLabel', i); }}
                                onClick={(e: React.MouseEvent) => handleElementClick('label', i, e)}
                                onMouseDown={(e: React.MouseEvent) => handleTextLabelMouseDown(e, i)}
                            />
                        ))}

                        {/* Fill tool vertex markers */}
                        {drawingState.active && drawingState.type === 'fill' && drawingState.points.map((pt, i) => (
                            <circle
                                key={`fill-pt-${i}`}
                                cx={mapX(pt.x)}
                                cy={mapY(pt.y)}
                                r={4}
                                fill={activeColor}
                                stroke="white"
                                strokeWidth={2}
                            />
                        ))}

                        {/* Fill tool hint - click near first point to close */}
                        {drawingState.active && drawingState.type === 'fill' && drawingState.points.length >= 1 && drawingState.points.length < 3 && (
                            <text
                                x={width / 2}
                                y={30}
                                textAnchor="middle"
                                className="text-xs fill-gray-500"
                            >
                                Click to add vertices ({drawingState.points.length}/3 min)
                            </text>
                        )}

                        {/* Box select rectangle */}
                        {boxSelectRect && (
                            <rect
                                x={Math.min(mapX(boxSelectRect.startX), mapX(boxSelectRect.currentX))}
                                y={Math.min(mapY(boxSelectRect.startY), mapY(boxSelectRect.currentY))}
                                width={Math.abs(mapX(boxSelectRect.currentX) - mapX(boxSelectRect.startX))}
                                height={Math.abs(mapY(boxSelectRect.currentY) - mapY(boxSelectRect.startY))}
                                fill="rgba(59, 130, 246, 0.1)"
                                stroke="#3b82f6"
                                strokeWidth="1"
                                strokeDasharray="4,4"
                                className="pointer-events-none"
                            />
                        )}
                    </g>
                </svg>
            </div>

            <div className="bg-gray-50 p-3 text-sm text-gray-600 border-t border-gray-200 shrink-0">
                <span
                    className={`${!readOnly && onLabelEdit ? 'cursor-pointer hover:text-blue-600' : ''}`}
                    onDoubleClick={() => !readOnly && onLabelEdit && onLabelEdit('caption', -1, data.caption || 'Figure 1: Economic Diagram')}
                    onMouseEnter={(e) => { if (!readOnly && onLabelEdit) showTooltip(e.currentTarget, 'Double-click to edit caption'); }}
                    onMouseLeave={hideTooltip}
                >
                    {data.caption || 'Figure 1: Economic Diagram'}
                </span>
            </div>
            <TooltipPortal />
        </div>
    );
};

export default DiagramRenderer;
