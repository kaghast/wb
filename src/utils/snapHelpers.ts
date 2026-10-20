import type * as fabric from 'fabric';

export interface SnapPoint {
  x: number;
  y: number;
  type: 'cardinal' | 'edge';
}

export interface SnapResult {
  snapped: boolean;
  point: { x: number; y: number };
  targetObject?: fabric.FabricObject;
  type?: 'cardinal' | 'edge';
}

const SNAP_THRESHOLD = 18; // Piksel cinsinden kenara/noktaya yapışma mesafesi

/**
 * Verilen bir doğru parçasındaki (A -> B) P noktasına en yakın noktayı bulur
 */
function closestPointOnSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): { x: number; y: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { x: a.x, y: a.y };

  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/**
 * Verilen bir nesne (kare, dikdörtgen, daire, eşkenar dörtgen) için kenar ve çapa noktalarını hesaplar
 */
export function getShapeAnchorPoints(obj: fabric.FabricObject): {
  cardinals: { x: number; y: number }[];
  segments: { a: { x: number; y: number }; b: { x: number; y: number } }[];
  isCircle?: boolean;
  circleData?: { cx: number; cy: number; rx: number; ry: number };
} {
  const bound = obj.getBoundingRect();
  const left = bound.left;
  const top = bound.top;
  const w = bound.width;
  const h = bound.height;
  const cx = left + w / 2;
  const cy = top + h / 2;

  const objType = (obj.type || '').toLowerCase();

  // 1. Daire / Elips
  if (objType === 'circle' || objType === 'ellipse') {
    const rx = w / 2;
    const ry = h / 2;
    return {
      cardinals: [
        { x: cx, y: top }, // Üst
        { x: left + w, y: cy }, // Sağ
        { x: cx, y: top + h }, // Alt
        { x: left, y: cy }, // Sol
        { x: cx, y: cy }, // Merkez
      ],
      segments: [],
      isCircle: true,
      circleData: { cx, cy, rx, ry },
    };
  }

  // 2. Eşkenar Dörtgen (Diamond / Rhombus)
  if (objType === 'polygon') {
    const topV = { x: cx, y: top };
    const rightV = { x: left + w, y: cy };
    const bottomV = { x: cx, y: top + h };
    const leftV = { x: left, y: cy };

    return {
      cardinals: [topV, rightV, bottomV, leftV, { x: cx, y: cy }],
      segments: [
        { a: topV, b: rightV },
        { a: rightV, b: bottomV },
        { a: bottomV, b: leftV },
        { a: leftV, b: topV },
      ],
    };
  }

  // 3. Kare, Dikdörtgen, Yuvarlak Kutu ve diğer bloklar
  const tl = { x: left, y: top };
  const tr = { x: left + w, y: top };
  const br = { x: left + w, y: top + h };
  const bl = { x: left, y: top + h };

  const topMid = { x: cx, y: top };
  const rightMid = { x: left + w, y: cy };
  const bottomMid = { x: cx, y: top + h };
  const leftMid = { x: left, y: cy };

  return {
    cardinals: [topMid, rightMid, bottomMid, leftMid, tl, tr, br, bl, { x: cx, y: cy }],
    segments: [
      { a: tl, b: tr }, // Üst kenar
      { a: tr, b: br }, // Sağ kenar
      { a: br, b: bl }, // Alt kenar
      { a: bl, b: tl }, // Sol kenar
    ],
  };
}

/**
 * Canvas üzerindeki şekillere (kare, dikdörtgen, daire, eşkenar dörtgen) en yakın snap noktasını bulur
 */
export function findSnapPoint(
  canvas: fabric.Canvas,
  cursor: { x: number; y: number },
  excludeObj?: fabric.FabricObject | null
): SnapResult {
  const objects = canvas.getObjects();
  let closestDist = SNAP_THRESHOLD;
  let bestPoint: { x: number; y: number } | null = null;
  let bestObj: fabric.FabricObject | undefined;
  let bestType: 'cardinal' | 'edge' = 'edge';

  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];

    // Görünmeyen veya çizilmekte olan nesneleri hariç tut
    if (obj.visible === false || obj === excludeObj) continue;

    // Yalnızca şekilleri kontrol et (çizgi, ok ve serbest kalem hariç)
    const type = (obj.type || '').toLowerCase();
    if (type === 'line' || type === 'path' || (obj as any).isArrow) continue;

    const bound = obj.getBoundingRect();

    // Hızlı eleme: fare nesnenin genişletilmiş sınır kutusunun dışındaysa atla
    if (
      cursor.x < bound.left - SNAP_THRESHOLD ||
      cursor.x > bound.left + bound.width + SNAP_THRESHOLD ||
      cursor.y < bound.top - SNAP_THRESHOLD ||
      cursor.y > bound.top + bound.height + SNAP_THRESHOLD
    ) {
      continue;
    }

    const { cardinals, segments, isCircle, circleData } = getShapeAnchorPoints(obj);

    // 1. Önce ana çapa noktalarını (orta noktalar, köşeler) kontrol et (Öncelikli Snap)
    for (const card of cardinals) {
      const d = Math.hypot(cursor.x - card.x, cursor.y - card.y);
      if (d < closestDist) {
        closestDist = d;
        bestPoint = card;
        bestObj = obj;
        bestType = 'cardinal';
      }
    }

    // Eğer ana çapa noktasına çok yakınsa kenar aramasını atlayabiliriz
    if (bestPoint && bestType === 'cardinal' && closestDist < 10) {
      continue;
    }

    // 2. Daire çevresine snap (Circumference)
    if (isCircle && circleData) {
      const angle = Math.atan2(cursor.y - circleData.cy, cursor.x - circleData.cx);
      const edgeX = circleData.cx + circleData.rx * Math.cos(angle);
      const edgeY = circleData.cy + circleData.ry * Math.sin(angle);
      const d = Math.hypot(cursor.x - edgeX, cursor.y - edgeY);

      if (d < closestDist) {
        closestDist = d;
        bestPoint = { x: edgeX, y: edgeY };
        bestObj = obj;
        bestType = 'edge';
      }
    }

    // 3. Kenar segmentlerine snap (Kare, dikdörtgen, eşkenar dörtgen kenarları)
    for (const seg of segments) {
      const edgePt = closestPointOnSegment(cursor, seg.a, seg.b);
      const d = Math.hypot(cursor.x - edgePt.x, cursor.y - edgePt.y);

      if (d < closestDist) {
        closestDist = d;
        bestPoint = edgePt;
        bestObj = obj;
        bestType = 'edge';
      }
    }
  }

  if (bestPoint) {
    return {
      snapped: true,
      point: bestPoint,
      targetObject: bestObj,
      type: bestType,
    };
  }

  return {
    snapped: false,
    point: cursor,
  };
}
