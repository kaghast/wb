import * as fabric from 'fabric';
import type { AlignAction, ArrangeAction, ShapeStyle, LayerItem } from '../types';
import { extractStateFromSvg } from '../services/fileSystemService';

let objectIdCounter = 1;

export function generateObjectId(prefix: string = 'obj'): string {
  return `${prefix}_${Date.now()}_${objectIdCounter++}`;
}

export function getObjectDisplayName(obj: fabric.FabricObject): string {
  if ((obj as any).customName) {
    return (obj as any).customName;
  }
  const type = obj.type || 'nesne';
  switch (type.toLowerCase()) {
    case 'rect':
      return (obj as fabric.Rect).rx ? 'Yuvarlak Kutu' : 'Dikdörtgen';
    case 'circle':
      return 'Daire / Elips';
    case 'polygon':
      return 'Eşkenar Dörtgen';
    case 'line':
      return 'Çizgi';
    case 'group':
      return (obj as any).isArrow ? 'Ok Bağlantısı' : 'Grup';
    case 'itext':
    case 'text':
      const txt = (obj as any).text;
      return txt ? `Metin: "${txt.slice(0, 16)}"` : 'Metin Kutusu';
    case 'path':
      return 'Çizim / Yol';
    default:
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

/**
 * Canvas nesnelerini katman listesi olarak döner (En üstteki nesne listenin başında)
 */
export function getLayersFromCanvas(canvas: fabric.Canvas): LayerItem[] {
  const objects = canvas.getObjects();
  // Katman listesi için yukarıdan aşağıya (üst katman en üstte)
  return [...objects].reverse().map((obj) => {
    if (!(obj as any).customId) {
      (obj as any).customId = generateObjectId(obj.type);
    }
    const name = getObjectDisplayName(obj);
    return {
      id: (obj as any).customId,
      name,
      type: obj.type || 'object',
      visible: obj.visible !== false,
      locked: !!obj.lockMovementX,
      objectRef: obj,
    };
  });
}

/**
 * Hizalama araçları
 */
export function alignObjects(canvas: fabric.Canvas, action: AlignAction): void {
  const activeObj = canvas.getActiveObject();
  if (!activeObj) return;

  const canvasWidth = canvas.getWidth();
  const canvasHeight = canvas.getHeight();

  // Çoklu seçim mi yoksa tek nesne mi?
  if (activeObj.type === 'activeSelection') {
    const sel = activeObj as fabric.ActiveSelection;
    const objects = sel.getObjects();
    if (objects.length < 2 && (action === 'distribute-h' || action === 'distribute-v')) return;

    const bound = sel.getBoundingRect();

    objects.forEach((obj) => {
      const objBound = obj.getBoundingRect();
      switch (action) {
        case 'left':
          obj.set({ left: bound.left });
          break;
        case 'center':
          obj.set({ left: bound.left + (bound.width - objBound.width) / 2 });
          break;
        case 'right':
          obj.set({ left: bound.left + bound.width - objBound.width });
          break;
        case 'top':
          obj.set({ top: bound.top });
          break;
        case 'middle':
          obj.set({ top: bound.top + (bound.height - objBound.height) / 2 });
          break;
        case 'bottom':
          obj.set({ top: bound.top + bound.height - objBound.height });
          break;
      }
      obj.setCoords();
    });

    if (action === 'distribute-h') {
      const sorted = [...objects].sort((a, b) => (a.left || 0) - (b.left || 0));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalSpan = (last.left || 0) - (first.left || 0);
      const step = totalSpan / (sorted.length - 1);
      sorted.forEach((obj, idx) => {
        obj.set({ left: (first.left || 0) + idx * step });
        obj.setCoords();
      });
    }

    if (action === 'distribute-v') {
      const sorted = [...objects].sort((a, b) => (a.top || 0) - (b.top || 0));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalSpan = (last.top || 0) - (first.top || 0);
      const step = totalSpan / (sorted.length - 1);
      sorted.forEach((obj, idx) => {
        obj.set({ top: (first.top || 0) + idx * step });
        obj.setCoords();
      });
    }

    sel.setCoords();
  } else {
    // Tek nesneyi canvas merkezine / sınırına göre hizala
    const bound = activeObj.getBoundingRect();
    switch (action) {
      case 'left':
        activeObj.set({ left: 20 });
        break;
      case 'center':
        activeObj.set({ left: (canvasWidth - bound.width) / 2 });
        break;
      case 'right':
        activeObj.set({ left: canvasWidth - bound.width - 20 });
        break;
      case 'top':
        activeObj.set({ top: 20 });
        break;
      case 'middle':
        activeObj.set({ top: (canvasHeight - bound.height) / 2 });
        break;
      case 'bottom':
        activeObj.set({ top: canvasHeight - bound.height - 20 });
        break;
    }
    activeObj.setCoords();
  }

  canvas.requestRenderAll();
}

/**
 * Katman Sıralaması (Z-Index)
 */
export function arrangeObject(canvas: fabric.Canvas, action: ArrangeAction, targetObj?: fabric.FabricObject): void {
  const obj = targetObj || canvas.getActiveObject();
  if (!obj) return;

  switch (action) {
    case 'bringToFront':
      if (typeof (canvas as any).bringObjectToFront === 'function') {
        (canvas as any).bringObjectToFront(obj);
      } else if (typeof (canvas as any).bringToFront === 'function') {
        (canvas as any).bringToFront(obj);
      }
      break;
    case 'bringForward':
      if (typeof (canvas as any).bringObjectForward === 'function') {
        (canvas as any).bringObjectForward(obj);
      } else if (typeof (canvas as any).bringForward === 'function') {
        (canvas as any).bringForward(obj);
      }
      break;
    case 'sendBackward':
      if (typeof (canvas as any).sendObjectBackwards === 'function') {
        (canvas as any).sendObjectBackwards(obj);
      } else if (typeof (canvas as any).sendBackwards === 'function') {
        (canvas as any).sendBackwards(obj);
      }
      break;
    case 'sendToBack':
      if (typeof (canvas as any).sendObjectToBack === 'function') {
        (canvas as any).sendObjectToBack(obj);
      } else if (typeof (canvas as any).sendToBack === 'function') {
        (canvas as any).sendToBack(obj);
      }
      break;
  }
  canvas.requestRenderAll();
}

/**
 * Katmanı belirli bir z-index indeksine taşır
 */
export function moveLayerToIndex(canvas: fabric.Canvas, obj: fabric.FabricObject, newIndex: number): void {
  if (typeof (canvas as any).moveObjectTo === 'function') {
    (canvas as any).moveObjectTo(obj, newIndex);
  } else {
    canvas.remove(obj);
    canvas.insertAt(newIndex, obj);
  }
  canvas.requestRenderAll();
}

/**
 * Grupla / Grubu Çöz
 */
export function groupSelection(canvas: fabric.Canvas): void {
  const activeObj = canvas.getActiveObject();
  if (!activeObj || activeObj.type !== 'activeSelection') return;

  const sel = activeObj as fabric.ActiveSelection;
  const objects = sel.getObjects();
  if (objects.length < 2) return;

  canvas.discardActiveObject();
  objects.forEach((o) => canvas.remove(o));

  const group = new fabric.Group(objects);
  (group as any).customId = generateObjectId('group');
  (group as any).customName = 'Grup';

  canvas.add(group);
  canvas.setActiveObject(group);
  canvas.requestRenderAll();
}

export function ungroupSelection(canvas: fabric.Canvas): void {
  const activeObj = canvas.getActiveObject();
  if (!activeObj || activeObj.type !== 'group') return;

  const group = activeObj as fabric.Group;
  const objects = group.getObjects();

  group.removeAll();
  canvas.remove(group);

  objects.forEach((obj) => canvas.add(obj));

  const sel = new fabric.ActiveSelection(objects, { canvas });
  canvas.setActiveObject(sel);
  canvas.requestRenderAll();
}

/**
 * Seçili Nesneyi Çoğalt (Duplicate)
 */
export async function duplicateSelected(canvas: fabric.Canvas): Promise<void> {
  const activeObj = canvas.getActiveObject();
  if (!activeObj) return;

  try {
    const cloned = await activeObj.clone();
    cloned.set({
      left: (cloned.left || 0) + 25,
      top: (cloned.top || 0) + 25,
    });
    (cloned as any).customId = generateObjectId(cloned.type);
    (cloned as any).customName = ((activeObj as any).customName || getObjectDisplayName(activeObj)) + ' (Kopya)';

    canvas.add(cloned);
    canvas.setActiveObject(cloned);
    canvas.requestRenderAll();
  } catch (e) {
    console.error('Çoğaltma hatası:', e);
  }
}

/**
 * Ok (Arrow) Nesnesi Oluşturur (Çizgi + Üçgen uç)
 */
export function createArrowObject(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  style: ShapeStyle
): fabric.Group {
  const line = new fabric.Line([x1, y1, x2, y2], {
    stroke: style.stroke,
    strokeWidth: style.strokeWidth,
    strokeDashArray: style.strokeDashArray || undefined,
    strokeLineCap: 'round',
    originX: 'center',
    originY: 'center',
  });

  const dx = x2 - x1;
  const dy = y2 - y1;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  const headLength = Math.max(14, style.strokeWidth * 4);
  const headWidth = Math.max(10, style.strokeWidth * 3);

  const head = new fabric.Polygon(
    [
      { x: 0, y: 0 },
      { x: -headLength, y: -headWidth / 2 },
      { x: -headLength, y: headWidth / 2 },
    ],
    {
      left: x2,
      top: y2,
      angle: angle,
      fill: style.stroke,
      stroke: style.stroke,
      strokeWidth: 1,
      originX: 'center',
      originY: 'center',
    }
  );

  const arrowGroup = new fabric.Group([line, head], {
    selectable: true,
  });

  (arrowGroup as any).isArrow = true;
  (arrowGroup as any).customName = 'Ok Bağlantısı';
  (arrowGroup as any).customId = generateObjectId('arrow');

  return arrowGroup;
}

/**
 * SVG Dizgisini Canvas'a Yükler
 * Gömülü Fabric JSON varsa onu açar, yoksa Fabric loadSVGFromString ile ayrıştırır
 */
export async function loadSvgStringToCanvas(
  canvas: fabric.Canvas,
  svgString: string,
  clearCanvas: boolean = true
): Promise<boolean> {
  try {
    const { fabricJson } = extractStateFromSvg(svgString);

    if (fabricJson) {
      if (clearCanvas) canvas.clear();
      const parsed = JSON.parse(fabricJson);
      await canvas.loadFromJSON(parsed);
      canvas.requestRenderAll();
      return true;
    }

    // Normal / Harici SVG (Örn: Prompttaki OOP SVG'si)
    const res = await fabric.loadSVGFromString(svgString);
    const objects = res.objects.filter(Boolean) as fabric.FabricObject[];

    if (clearCanvas) {
      canvas.clear();
      canvas.backgroundColor = '#FFFFFF';
    }

    if (objects.length > 0) {
      // SVG nesnelerini ekle
      const group = new fabric.Group(objects);
      (group as any).customName = 'İçe Aktarılan Diagram';
      (group as any).customId = generateObjectId('imported_svg');

      // Ortalayarak yerleştir
      group.set({
        left: Math.max(40, (canvas.getWidth() - (group.width || 0)) / 2),
        top: Math.max(40, (canvas.getHeight() - (group.height || 0)) / 2),
      });

      canvas.add(group);
      canvas.setActiveObject(group);
      canvas.requestRenderAll();
    }
    return true;
  } catch (err) {
    console.error('SVG yükleme hatası:', err);
    return false;
  }
}
