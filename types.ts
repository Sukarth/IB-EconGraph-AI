export interface Point {
  x: number;
  y: number;
}

export interface Curve {
  id: string;
  label: string;
  color: string;
  type: 'linear' | 'bezier' | 'vertical' | 'horizontal';
  width: number;
  strokeDasharray?: string; // "5,5" for dashed
  points: Point[]; // For linear: [start, end]. For bezier: [start, control, end]
  locked?: boolean; // If true, curve cannot be edited
  fontSize?: number;
}

export interface AnnotationPoint {
  x: number;
  y: number;
  label: string;
  labelPosition?: 'top' | 'bottom' | 'left' | 'right' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  showDottedLines: boolean;
  color?: string;
  linkedCurveIds?: string[]; // IDs of curves this point is linked to (for move-together)
  fontSize?: number;
}

export interface ShadedRegion {
  id: string;
  label: string;
  color: string; // rgba string usually
  points: Point[]; // Polygon vertices
  linkedPointIds?: string[]; // Linked to annotation points for auto-update
}

export interface TextLabel {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize?: number;
  color?: string;
  fontWeight?: 'normal' | 'bold';
}

export interface DiagramData {
  title: string;
  summary: string;
  caption?: string; // User-editable figure caption (e.g., "Figure 1: Supply and Demand")
  xAxis: {
    label: string;
    min: number;
    max: number;
  };
  yAxis: {
    label: string;
    min: number;
    max: number;
  };
  curves: Curve[];
  annotatedPoints: AnnotationPoint[];
  shadedRegions: ShadedRegion[];
  textLabels?: TextLabel[];
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  diagramData?: DiagramData; // Snapshot of the diagram at this point
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  diagramData?: DiagramData; // Autosaved current diagram state
  lastModified: number;
}

// Graph is the main entity (renamed from analysis)
export interface Graph {
  id: string;
  title: string;
  /**
   * Set once the user names the graph themselves (rename dialog, or editing the
   * title on the canvas). While it is unset the AI is free to retitle the graph
   * on each generation. Absent on graphs saved before this flag existed, which
   * fall back to a title-based heuristic.
   */
  titleSetByUser?: boolean;
  caption: string; // User-editable figure caption
  projectId?: string; // Optional: which project this graph belongs to
  messages: Message[];
  diagramData: DiagramData;
  createdAt: number;
  lastModified: number;
}

// Project is a folder to group multiple graphs
export interface Project {
  id: string;
  name: string;
  description: string;
  color: string; // Accent color for the project
  createdAt: number;
  lastModified: number;
}

// Editor Tools
export type EditorTool =
  | 'select'      // Select and move elements
  | 'boxSelect'   // Draw rectangle to select multiple elements
  | 'line'        // Draw straight lines
  | 'curve'       // Draw bezier curves  
  | 'point'       // Add annotation points
  | 'label'       // Add text labels
  | 'fill'        // Area fill tool for shading
  | 'eraser'      // Delete elements
  | 'pan';        // Pan the canvas

// Editor Settings
export interface EditorSettings {
  showGrid: boolean;
  gridSize: number;
  snapToGrid: boolean;
  snapToPoints: boolean;
  moveTogether: boolean; // When dragging a point, linked elements move too
  snapThreshold: number; // Distance in pixels for snapping
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  showGrid: true,
  gridSize: 10,
  snapToGrid: true,
  snapToPoints: true,
  moveTogether: true,
  snapThreshold: 8,
};

// Component Templates for the Component Library
export interface ComponentTemplate {
  id: string;
  name: string;
  description: string;
  category: 'curves' | 'areas' | 'points' | 'complete';
  icon: string; // Lucide icon name
  data: Partial<DiagramData>;
}

// Undo/Redo History
export interface HistoryState {
  past: DiagramData[];
  present: DiagramData;
  future: DiagramData[];
}

export const INITIAL_DIAGRAM: DiagramData = {
  title: "Supply and Demand Equilibrium",
  summary: "A standard market equilibrium where supply meets demand.",
  caption: "Figure 1: Supply and Demand Diagram",
  xAxis: { label: "Quantity (Q)", min: 0, max: 100 },
  yAxis: { label: "Price (P)", min: 0, max: 100 },
  curves: [
    {
      id: "demand",
      label: "D",
      color: "#ef4444", // red-500
      type: "linear",
      width: 2,
      points: [{ x: 10, y: 90 }, { x: 90, y: 10 }]
    },
    {
      id: "supply",
      label: "S",
      color: "#3b82f6", // blue-500
      type: "linear",
      width: 2,
      points: [{ x: 10, y: 10 }, { x: 90, y: 90 }]
    }
  ],
  annotatedPoints: [
    { x: 50, y: 50, label: "E_1", showDottedLines: true, labelPosition: "top-right" }
  ],
  shadedRegions: [],
  textLabels: []
};

export const EMPTY_DIAGRAM: DiagramData = {
  title: "Untitled Graph",
  summary: "Start creating your economic diagram.",
  caption: "Figure 1: Economic Diagram",
  xAxis: { label: "Quantity (Q)", min: 0, max: 100 },
  yAxis: { label: "Price (P)", min: 0, max: 100 },
  curves: [],
  annotatedPoints: [],
  shadedRegions: [],
  textLabels: []
};

// Component Library Templates
export const COMPONENT_TEMPLATES: ComponentTemplate[] = [
  {
    id: 'demand-curve',
    name: 'Demand Curve',
    description: 'Standard downward-sloping demand curve',
    category: 'curves',
    icon: 'TrendingDown',
    data: {
      curves: [{
        id: 'demand-' + Date.now(),
        label: 'D',
        color: '#ef4444',
        type: 'linear',
        width: 2,
        points: [{ x: 10, y: 90 }, { x: 90, y: 10 }]
      }]
    }
  },
  {
    id: 'supply-curve',
    name: 'Supply Curve',
    description: 'Standard upward-sloping supply curve',
    category: 'curves',
    icon: 'TrendingUp',
    data: {
      curves: [{
        id: 'supply-' + Date.now(),
        label: 'S',
        color: '#3b82f6',
        type: 'linear',
        width: 2,
        points: [{ x: 10, y: 10 }, { x: 90, y: 90 }]
      }]
    }
  },
  {
    id: 'marginal-cost',
    name: 'Marginal Cost (MC)',
    description: 'U-shaped marginal cost curve',
    category: 'curves',
    icon: 'Activity',
    data: {
      curves: [{
        id: 'mc-' + Date.now(),
        label: 'MC',
        color: '#22c55e',
        type: 'bezier',
        width: 2,
        points: [{ x: 10, y: 60 }, { x: 40, y: 15 }, { x: 90, y: 90 }]
      }]
    }
  },
  {
    id: 'average-total-cost',
    name: 'Average Total Cost (ATC)',
    description: 'U-shaped average total cost curve',
    category: 'curves',
    icon: 'Minus',
    data: {
      curves: [{
        id: 'atc-' + Date.now(),
        label: 'ATC',
        color: '#8b5cf6',
        type: 'bezier',
        width: 2,
        points: [{ x: 10, y: 85 }, { x: 50, y: 25 }, { x: 90, y: 70 }]
      }]
    }
  },
  {
    id: 'marginal-revenue',
    name: 'Marginal Revenue (MR)',
    description: 'Marginal revenue curve (steeper than demand)',
    category: 'curves',
    icon: 'ArrowDownRight',
    data: {
      curves: [{
        id: 'mr-' + Date.now(),
        label: 'MR',
        color: '#ec4899',
        type: 'linear',
        width: 2,
        strokeDasharray: '5,5',
        points: [{ x: 10, y: 80 }, { x: 50, y: 10 }]
      }]
    }
  },
  {
    id: 'price-line',
    name: 'Price Line',
    description: 'Horizontal price line (P = AR = MR in perfect competition)',
    category: 'curves',
    icon: 'Minus',
    data: {
      curves: [{
        id: 'price-' + Date.now(),
        label: 'P = AR = MR',
        color: '#f59e0b',
        type: 'horizontal',
        width: 2,
        points: [{ x: 10, y: 50 }, { x: 90, y: 50 }]
      }]
    }
  },
  {
    id: 'vertical-line',
    name: 'Vertical Line',
    description: 'Perfectly inelastic supply/demand',
    category: 'curves',
    icon: 'ArrowUp',
    data: {
      curves: [{
        id: 'vertical-' + Date.now(),
        label: 'S',
        color: '#64748b',
        type: 'vertical',
        width: 2,
        points: [{ x: 50, y: 10 }, { x: 50, y: 90 }]
      }]
    }
  },
  {
    id: 'consumer-surplus',
    name: 'Consumer Surplus',
    description: 'Shaded area representing consumer surplus',
    category: 'areas',
    icon: 'Triangle',
    data: {
      shadedRegions: [{
        id: 'cs-' + Date.now(),
        label: 'CS',
        color: 'rgba(34, 197, 94, 0.25)',
        points: [{ x: 10, y: 90 }, { x: 50, y: 50 }, { x: 50, y: 90 }]
      }]
    }
  },
  {
    id: 'producer-surplus',
    name: 'Producer Surplus',
    description: 'Shaded area representing producer surplus',
    category: 'areas',
    icon: 'Triangle',
    data: {
      shadedRegions: [{
        id: 'ps-' + Date.now(),
        label: 'PS',
        color: 'rgba(59, 130, 246, 0.25)',
        points: [{ x: 10, y: 10 }, { x: 50, y: 50 }, { x: 50, y: 10 }]
      }]
    }
  },
  {
    id: 'deadweight-loss',
    name: 'Deadweight Loss',
    description: 'Shaded triangle for deadweight loss',
    category: 'areas',
    icon: 'AlertTriangle',
    data: {
      shadedRegions: [{
        id: 'dwl-' + Date.now(),
        label: 'DWL',
        color: 'rgba(239, 68, 68, 0.3)',
        points: [{ x: 40, y: 60 }, { x: 50, y: 50 }, { x: 40, y: 40 }]
      }]
    }
  },
  {
    id: 'tax-revenue',
    name: 'Tax Revenue',
    description: 'Rectangle showing government tax revenue',
    category: 'areas',
    icon: 'Square',
    data: {
      shadedRegions: [{
        id: 'tax-' + Date.now(),
        label: 'Tax Revenue',
        color: 'rgba(245, 158, 11, 0.3)',
        points: [{ x: 10, y: 60 }, { x: 40, y: 60 }, { x: 40, y: 40 }, { x: 10, y: 40 }]
      }]
    }
  },
  {
    id: 'equilibrium-point',
    name: 'Equilibrium Point',
    description: 'Point marking market equilibrium',
    category: 'points',
    icon: 'Target',
    data: {
      annotatedPoints: [{
        x: 50,
        y: 50,
        label: 'E',
        showDottedLines: true,
        labelPosition: 'top-right',
        color: '#111827'
      }]
    }
  },
  {
    id: 'price-quantity-point',
    name: 'P-Q Point',
    description: 'Point with price and quantity labels',
    category: 'points',
    icon: 'Circle',
    data: {
      annotatedPoints: [{
        x: 50,
        y: 50,
        label: 'P^*, Q^*',
        showDottedLines: true,
        labelPosition: 'top-right',
        color: '#3b82f6'
      }]
    }
  },
  {
    id: 'supply-demand-equilibrium',
    name: 'Supply & Demand',
    description: 'Complete supply and demand diagram with equilibrium',
    category: 'complete',
    icon: 'BarChart2',
    data: {
      curves: [
        {
          id: 'demand',
          label: 'D',
          color: '#ef4444',
          type: 'linear',
          width: 2,
          points: [{ x: 10, y: 90 }, { x: 90, y: 10 }]
        },
        {
          id: 'supply',
          label: 'S',
          color: '#3b82f6',
          type: 'linear',
          width: 2,
          points: [{ x: 10, y: 10 }, { x: 90, y: 90 }]
        }
      ],
      annotatedPoints: [
        { x: 50, y: 50, label: 'E', showDottedLines: true, labelPosition: 'top-right' }
      ]
    }
  },
  {
    id: 'monopoly',
    name: 'Monopoly',
    description: 'Monopoly diagram with MR, MC, and profit',
    category: 'complete',
    icon: 'Crown',
    data: {
      curves: [
        {
          id: 'demand',
          label: 'D = AR',
          color: '#ef4444',
          type: 'linear',
          width: 2,
          points: [{ x: 10, y: 90 }, { x: 90, y: 10 }]
        },
        {
          id: 'mr',
          label: 'MR',
          color: '#ec4899',
          type: 'linear',
          width: 2,
          strokeDasharray: '5,5',
          points: [{ x: 10, y: 90 }, { x: 50, y: 10 }]
        },
        {
          id: 'mc',
          label: 'MC',
          color: '#3b82f6',
          type: 'linear',
          width: 2,
          points: [{ x: 10, y: 10 }, { x: 90, y: 90 }]
        }
      ],
      annotatedPoints: [
        { x: 30, y: 30, label: 'Q_m', showDottedLines: true, labelPosition: 'bottom' },
        { x: 30, y: 70, label: 'P_m', showDottedLines: true, labelPosition: 'top-right' }
      ]
    }
  },
  {
    id: 'tax-incidence',
    name: 'Tax Incidence',
    description: 'Tax effect showing supply shift and DWL',
    category: 'complete',
    icon: 'Receipt',
    data: {
      curves: [
        {
          id: 'demand',
          label: 'D',
          color: '#ef4444',
          type: 'linear',
          width: 2,
          points: [{ x: 10, y: 90 }, { x: 90, y: 10 }]
        },
        {
          id: 'supply',
          label: 'S',
          color: '#3b82f6',
          type: 'linear',
          width: 2,
          points: [{ x: 10, y: 10 }, { x: 90, y: 90 }]
        },
        {
          id: 'supply-tax',
          label: 'S + Tax',
          color: '#3b82f6',
          type: 'linear',
          width: 2,
          strokeDasharray: '5,5',
          points: [{ x: 10, y: 30 }, { x: 70, y: 90 }]
        }
      ],
      annotatedPoints: [
        { x: 50, y: 50, label: 'E_0', showDottedLines: true, labelPosition: 'top-right' },
        { x: 40, y: 60, label: 'E_1', showDottedLines: true, labelPosition: 'top-left' }
      ],
      shadedRegions: [{
        id: 'dwl',
        label: 'DWL',
        color: 'rgba(239, 68, 68, 0.2)',
        points: [{ x: 40, y: 60 }, { x: 50, y: 50 }, { x: 40, y: 40 }]
      }]
    }
  }
];
