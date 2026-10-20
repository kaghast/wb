import * as fabric from 'fabric';

export interface SnapResult {
  point: { x: number; y: number };
  targetObj: fabric.FabricObject;
  isCardinal: boolean;
  shapeType: 'rect' | 'circle' | 'diamond' | 'shape';
  distance: number;
}

/**
 * Bir noktanın (P) verilen doğru parçasına (AB) olan en yakın izdüşüm noktasını hesaplar.
 */
function closestPointOnSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): { point: { x: number; y: number }; dist: number; t: number } {
  const abX = b.x - a.x;
  const abY = b.y - a.y;
  const abLenSq = abX * abX + abY * abY;
  if (abLenSq === 0) {
    return { point: { x: a.x, y: a.y }, dist: Math.hypot(p.x - a.x, p.y - a.y), t: 0 };
  }

  const apX = p.x - a.x;
  const apY = p.y - a.y;
  let t = (apX * abX + apY * abY) / abLenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = a.x + t * abX;
  const projY = a.y + t * abY;
  const dist = Math.hypot(p.x - projX, p.y - projY);
  return { point: { x: projX, y: projY }, dist, t };
}

/**
 * Tuval üzerindeki şekillerin (Kare, Dikdörtgen, Daire, Eşkenar Dörtgen vb.)
 * kenarlarına ve ana bağlantı noktalarına (kardinal noktalara) en yakın snap noktasını bulur.
 */
export function findSnapPoint(
  pointer: { x: number; y: number },
  canvas: fabric.Canvas,
  excludeObj?: fabric.FabricObject | null,
  snapThreshold = 22
): SnapResult | null {
  const objects = canvas.getObjects();
  let bestCandidate: SnapResult | null = null;
  let minDistance = snapThreshold;

  const CARDINAL_STICKY_RADIUS = 14;

  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];

    // Görünmeyen, silinen, çizgi/ok/metin olan veya hariç tutulan nesneleri atla
    if (
      !obj.visible ||
      obj === excludeObj ||
      obj.type === 'line' ||
      (obj as any).customId?.startsWith('line_') ||
      (obj as any).customId?.startsWith('arrow_') ||
      obj.type === 'itext' ||
      obj.type === 'text' ||
      (obj as any).isSnapPreview
    ) {
      continue;
    }

    const type = obj.type?.toLowerCase() || '';
    const customName = String((obj as any).customName || '').toLowerCase();
    const isCircle = type === 'circle' || customName.includes('daire');
    const isDiamond =
      type === 'polygon' ||
      customName.includes('eşkenar') ||
      (obj as any).customId?.startsWith('diamond');

    // Nesnenin koordinat sınırlarını güncelle
    try {
      obj.setCoords();
    } catch (e) {}

    // 1. Daire (Circle) Snap Hesaplaması
    if (isCircle) {
      const center = obj.getCenterPoint();
      const circleObj = obj as fabric.Circle;
      const radius = (circleObj.radius || 30) * Math.max(obj.scaleX || 1, obj.scaleY || 1);

      const dx = pointer.x - center.x;
      const dy = pointer.y - center.y;
      const distToCenter = Math.hypot(dx, dy);
      const distToPerimeter = Math.abs(distToCenter - radius);

      // Ana 4 bağlantı noktası (Üst, Sağ, Alt, Sol)
      const cardinals: { x: number; y: number }[] = [
        { x: center.x, y: center.y - radius }, // Üst
        { x: center.x + radius, y: center.y }, // Sağ
        { x: center.x, y: center.y + radius }, // Alt
        { x: center.x - radius, y: center.y }, // Sol
      ];

      for (const card of cardinals) {
        const d = Math.hypot(pointer.x - card.x, pointer.y - card.y);
        if (d < CARDINAL_STICKY_RADIUS && d < minDistance) {
          minDistance = d;
          bestCandidate = {
            point: card,
            targetObj: obj,
            isCardinal: true,
            shapeType: 'circle',
            distance: d,
          };
        }
      }

      // Çember kenarı boyunca sürekli snap
      if (distToPerimeter < snapThreshold && distToPerimeter < minDistance && distToCenter > 0.001) {
        const snapPoint = {
          x: center.x + (dx / distToCenter) * radius,
          y: center.y + (dy / distToCenter) * radius,
        };
        minDistance = distToPerimeter;
        bestCandidate = {
          point: snapPoint,
          targetObj: obj,
          isCardinal: false,
          shapeType: 'circle',
          distance: distToPerimeter,
        };
      }
      continue;
    }

    // 2. Eşkenar Dörtgen (Diamond) Snap Hesaplaması
    if (isDiamond) {
      const coords = obj.getCoords();
      if (!coords || coords.length < 4) continue;
      const [tl, tr, br, bl] = coords;

      // 4 ana tepe noktası
      const vTop = { x: (tl.x + tr.x) / 2, y: (tl.y + tr.y) / 2 };
      const vRight = { x: (tr.x + br.x) / 2, y: (tr.y + br.y) / 2 };
      const vBottom = { x: (br.x + bl.x) / 2, y: (br.y + bl.y) / 2 };
      const vLeft = { x: (bl.x + tl.x) / 2, y: (bl.y + tl.y) / 2 };

      const vertices = [vTop, vRight, vBottom, vLeft];
      for (const v of vertices) {
        const d = Math.hypot(pointer.x - v.x, pointer.y - v.y);
        if (d < CARDINAL_STICKY_RADIUS && d < minDistance) {
          minDistance = d;
          bestCandidate = {
            point: v,
            targetObj: obj,
            isCardinal: true,
            shapeType: 'diamond',
            distance: d,
          };
        }
      }

      // Eşkenar dörtgenin 4 kenarı
      const diamondEdges = [
        [vTop, vRight],
        [vRight, vBottom],
        [vBottom, vLeft],
        [vLeft, vTop],
      ];

      for (const [p1, p2] of diamondEdges) {
        const proj = closestPointOnSegment(pointer, p1, p2);
        if (proj.dist < snapThreshold && proj.dist < minDistance) {
          minDistance = proj.dist;
          bestCandidate = {
            point: proj.point,
            targetObj: obj,
            isCardinal: proj.t > 0.45 && proj.t < 0.55,
            shapeType: 'diamond',
            distance: proj.dist,
          };
        }
      }
      continue;
    }

    // 3. Kare, Dikdörtgen, Yuvarlak Kutu ve Genel Şekiller (Rect, Group vb.)
    const coords = obj.getCoords();
    if (!coords || coords.length < 4) continue;
    const [tl, tr, br, bl] = coords;

    // 4 kenar orta noktası (Ana bağlantı noktaları)
    const midTop = { x: (tl.x + tr.x) / 2, y: (tl.y + tr.y) / 2 };
    const midRight = { x: (tr.x + br.x) / 2, y: (tr.y + br.y) / 2 };
    const midBottom = { x: (br.x + bl.x) / 2, y: (br.y + bl.y) / 2 };
    const midLeft = { x: (bl.x + tl.x) / 2, y: (bl.y + tl.y) / 2 };

    const cardinalPoints = [midTop, midRight, midBottom, midLeft];

    // Köşeler
    const cornerPoints = [tl, tr, br, bl];

    // Önce orta noktalara yapışma kontrolü
    for (const card of cardinalPoints) {
      const d = Math.hypot(pointer.x - card.x, pointer.y - card.y);
      if (d < CARDINAL_STICKY_RADIUS && d < minDistance) {
        minDistance = d;
        bestCandidate = {
          point: card,
          targetObj: obj,
          isCardinal: true,
          shapeType: 'rect',
          distance: d,
        };
      }
    }

    // Köşelere yapışma
    for (const corner of cornerPoints) {
      const d = Math.hypot(pointer.x - corner.x, pointer.y - corner.y);
      if (d < CARDINAL_STICKY_RADIUS && d < minDistance) {
        minDistance = d;
        bestCandidate = {
          point: corner,
          targetObj: obj,
          isCardinal: true,
          shapeType: 'rect',
          distance: d,
        };
      }
    }

    // 4 Kenar çizgisi boyunca sürekli snap
    const rectEdges = [
      [tl, tr],
      [tr, br],
      [br, bl],
      [bl, tl],
    ];

    for (const [p1, p2] of rectEdges) {
      const proj = closestPointOnSegment(pointer, p1, p2);
      if (proj.dist < snapThreshold && proj.dist < minDistance) {
        minDistance = proj.dist;
        bestCandidate = {
          point: proj.point,
          targetObj: obj,
          isCardinal: proj.t > 0.45 && proj.t < 0.55,
          shapeType: 'rect',
          distance: proj.dist,
        };
      }
    }
  }

  return bestCandidate;
}
