import type * as fabric from 'fabric';

export type ToolType =
  | 'select'
  | 'hand'
  | 'rectangle'
  | 'rounded-rect'
  | 'circle'
  | 'diamond'
  | 'arrow'
  | 'line'
  | 'pencil'
  | 'text'
  | 'eraser';

export type GridMode = 'dots' | 'grid' | 'none';

export interface ShapeStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeDashArray: number[] | null;
  opacity: number;
  rx: number;
  ry: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  textAlign: string;
}

export interface LayerItem {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  locked: boolean;
  objectRef: fabric.FabricObject;
}

export interface RecentDoc {
  id: string;
  name: string;
  updatedAt: number;
  previewUrl: string;
  svgContent: string;
  fabricJson: string;
  elementCount: number;
}

export type AlignAction =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom'
  | 'distribute-h'
  | 'distribute-v';

export type ArrangeAction =
  | 'bringToFront'
  | 'bringForward'
  | 'sendBackward'
  | 'sendToBack';

export interface AutoBackupState {
  lastSavedAt: number | null;
  status: 'saved' | 'saving' | 'idle';
}
