import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import type { ToolType, GridMode, ShapeStyle } from '../types';
import { generateObjectId, createArrowObject, loadSvgStringToCanvas } from '../utils/canvasHelpers';
import { findSnapPoint } from '../utils/snapping';

interface CanvasViewportProps {
  currentTool: ToolType;
  setCurrentTool: (tool: ToolType) => void;
  currentStyle: ShapeStyle;
  gridMode: GridMode;
  onCanvasReady: (canvas: fabric.Canvas) => void;
  onSelectionChange: (activeObject: fabric.FabricObject | null) => void;
  onCanvasModified: () => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  onShowToast: (msg: string) => void;
}

export const CanvasViewport: React.FC<CanvasViewportProps> = ({
  currentTool,
  setCurrentTool,
  currentStyle,
  gridMode,
  onCanvasReady,
  onSelectionChange,
  onCanvasModified,
  zoom,
  setZoom,
  onShowToast,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);

  // Çizim durumu referansları
  const isDrawingShape = useRef(false);
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  const activeShape = useRef<fabric.FabricObject | null>(null);
  const isPanning = useRef(false);
  const lastPanPoint = useRef<{ x: number; y: number } | null>(null);
  const spacePressed = useRef(false);

  // 2 Noktalı Ok / Çizgi ve Kenar Snap Durumu
  const lineStartPoint = useRef<{ x: number; y: number } | null>(null);
  const linePreviewObj = useRef<fabric.FabricObject | null>(null);
  const currentSnapPointRef = useRef<{ x: number; y: number } | null>(null);
  const mouseDownTime = useRef<number>(0);
  const isDraggingLine = useRef<boolean>(false);

  // Görsel Snap ve 1. Nokta Göstergeleri (Overlay)
  const [snapIndicator, setSnapIndicator] = useState<{
    x: number;
    y: number;
    isCardinal: boolean;
  } | null>(null);
  const [point1Indicator, setPoint1Indicator] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Canvas ilk oluşturma
  useEffect(() => {
    if (!canvasElRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const canvas = new fabric.Canvas(canvasElRef.current, {
      width,
      height,
      backgroundColor: '#FFFFFF',
      selection: true,
      preserveObjectStacking: true,
      stopContextMenu: true,
    });

    fabricRef.current = canvas;
    onCanvasReady(canvas);

    // Seçim Olayları
    canvas.on('selection:created', (e) => onSelectionChange(e.selected?.[0] || canvas.getActiveObject() || null));
    canvas.on('selection:updated', (e) => onSelectionChange(e.selected?.[0] || canvas.getActiveObject() || null));
    canvas.on('selection:cleared', () => onSelectionChange(null));

    // Değişiklik Olayları
    canvas.on('object:modified', () => onCanvasModified());
    canvas.on('object:added', () => onCanvasModified());
    canvas.on('object:removed', (e) => {
      // Şekil silindiğinde bağlı metnini de temizle
      if (e.target) {
        const obj = e.target;
        const attached = (obj as any).attachedText;
        if (attached && canvas.contains(attached)) {
          canvas.remove(attached);
        }
      }
      onCanvasModified();
    });
    canvas.on('path:created', (e) => {
      const pathObj = (e as any).path;
      if (pathObj) {
        pathObj.customId = generateObjectId('pencil');
        pathObj.customName = 'Serbest Çizim';
      }
      onCanvasModified();
    });

    // Boyut güncelleme dinleyicisi
    const handleResize = () => {
      if (!containerRef.current || !fabricRef.current) return;
      fabricRef.current.setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
      fabricRef.current.requestRenderAll();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.dispose();
      fabricRef.current = null;
    };
  }, []);

  // Araç ve Çizim Modu Senkronizasyonu
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    if (currentTool === 'pencil') {
      canvas.isDrawingMode = true;
      if (canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.color = currentStyle.stroke;
        canvas.freeDrawingBrush.width = currentStyle.strokeWidth;
      }
      canvas.selection = false;
      canvas.defaultCursor = 'crosshair';
    } else {
      canvas.isDrawingMode = false;
      if (currentTool === 'hand' || spacePressed.current) {
        canvas.selection = false;
        canvas.defaultCursor = 'grab';
        canvas.forEachObject((obj) => (obj.selectable = false));
      } else if (currentTool === 'select') {
        canvas.selection = true;
        canvas.defaultCursor = 'default';
        canvas.forEachObject((obj) => (obj.selectable = !(obj as any).lockMovementX));
      } else if (currentTool === 'eraser') {
        canvas.selection = false;
        canvas.defaultCursor = 'not-allowed';
      } else {
        canvas.selection = false;
        canvas.defaultCursor = 'crosshair';
      }
    }

    // Çizgi veya Ok aracından çıkıldıysa devam eden çizim önizlemesini temizle
    if (currentTool !== 'line' && currentTool !== 'arrow') {
      if (linePreviewObj.current && canvas) {
        canvas.remove(linePreviewObj.current);
        linePreviewObj.current = null;
        canvas.requestRenderAll();
      }
      lineStartPoint.current = null;
      currentSnapPointRef.current = null;
      setSnapIndicator(null);
      setPoint1Indicator(null);
      isDraggingLine.current = false;
    }

    canvas.requestRenderAll();
  }, [currentTool, currentStyle]);

  // Space Tuşu ile Geçici El (Pan) Modu & Escape ile Çizim İptali
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape ile devam eden ok/çizgi çizimini iptal et
      if (e.key === 'Escape') {
        if (linePreviewObj.current && fabricRef.current) {
          fabricRef.current.remove(linePreviewObj.current);
          linePreviewObj.current = null;
          fabricRef.current.requestRenderAll();
        }
        lineStartPoint.current = null;
        currentSnapPointRef.current = null;
        setSnapIndicator(null);
        setPoint1Indicator(null);
        isDraggingLine.current = false;
      }

      if (e.code === 'Space' && !spacePressed.current && (e.target as HTMLElement).tagName !== 'INPUT') {
        spacePressed.current = true;
        if (fabricRef.current) {
          fabricRef.current.defaultCursor = 'grab';
          fabricRef.current.selection = false;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spacePressed.current = false;
        if (fabricRef.current) {
          fabricRef.current.defaultCursor = currentTool === 'hand' ? 'grab' : 'default';
          fabricRef.current.selection = currentTool === 'select';
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [currentTool]);

  // Çift Tıklama ile Şeklin Ortasına Metin Ekleme / Düzenleme Fonksiyonu
  const handleShapeTextEdit = (target: fabric.FabricObject) => {
    const canvas = fabricRef.current;
    if (!canvas || !target) return;

    // 1. Zaten bir metin nesnesi ise doğrudan düzenlemeye al
    if (target.type === 'itext' || target.type === 'text') {
      canvas.setActiveObject(target);
      setCurrentTool('select');
      setTimeout(() => {
        (target as fabric.IText).enterEditing();
        (target as fabric.IText).selectAll();
        canvas.requestRenderAll();
      }, 50);
      return;
    }

    // 2. Bir şekil ise ve önceden bağlanmış metin hala tuvalde varsa onu aç
    const attachedText = (target as any).attachedText as fabric.IText | undefined;
    if (attachedText && canvas.contains(attachedText)) {
      const center = target.getCenterPoint();
      attachedText.set({ left: center.x, top: center.y });
      attachedText.setCoords();
      canvas.setActiveObject(attachedText);
      setCurrentTool('select');
      setTimeout(() => {
        attachedText.enterEditing();
        attachedText.selectAll();
        canvas.requestRenderAll();
      }, 50);
      return;
    }

    // 3. Şeklin merkez koordinatını hesapla ve yeni metin oluştur
    const center = target.getCenterPoint();

    // Kontrast metin rengi belirle
    const fillVal = String(target.fill || '').toLowerCase();
    let isDarkFill = false;
    if (fillVal.startsWith('#') && fillVal.length === 7) {
      const r = parseInt(fillVal.substring(1, 3), 16);
      const g = parseInt(fillVal.substring(3, 5), 16);
      const b = parseInt(fillVal.substring(5, 7), 16);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      isDarkFill = brightness < 135;
    } else if (
      fillVal === 'black' ||
      fillVal.includes('rgb(0') ||
      fillVal === '#2457a6' ||
      fillVal === '#111111' ||
      fillVal === '#1e293b'
    ) {
      isDarkFill = true;
    }

    let textColor = isDarkFill ? '#FFFFFF' : '#111111';
    if (!isDarkFill && (fillVal === 'transparent' || !fillVal) && target.stroke) {
      textColor = String(target.stroke);
    }

    const bound = target.getBoundingRect();
    const autoFontSize = Math.max(12, Math.min(22, Math.floor((bound.height || 60) / 4.5)));

    const text = new fabric.IText('Metin...', {
      left: center.x,
      top: center.y,
      originX: 'center',
      originY: 'center',
      fontFamily: currentStyle.fontFamily || 'Inter, sans-serif',
      fontSize: autoFontSize,
      fill: textColor,
      fontWeight: '500',
      textAlign: 'center',
      selectable: true,
    });

    (text as any).customId = generateObjectId('shape_text');
    (text as any).customName = `Metin (${(target as any).customName || target.type || 'Şekil'})`;
    (text as any).parentShape = target;
    (target as any).attachedText = text;

    canvas.add(text);
    canvas.setActiveObject(text);
    setCurrentTool('select');
    canvas.requestRenderAll();
    onCanvasModified();

    // Event döngüsü sonrası düzenleme modunu başlat
    setTimeout(() => {
      text.enterEditing();
      text.selectAll();
      canvas.requestRenderAll();
    }, 60);
  };

  // Fare Olayları: Çizim, Snap, Kaydırma, Yakınlaştırma
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    // Viewport koordinatını ekrana çevir
    const toScreenCoords = (scenePt: { x: number; y: number }) => {
      const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
      return {
        x: scenePt.x * vpt[0] + vpt[4],
        y: scenePt.y * vpt[3] + vpt[5],
      };
    };

    const onMouseDown = (opt: any) => {
      const evt = opt.e;
      const pointer = canvas.getScenePoint(opt.e);

      // 1. Pan (El) Modu
      if (currentTool === 'hand' || spacePressed.current || evt.altKey || evt.button === 1) {
        isPanning.current = true;
        lastPanPoint.current = { x: evt.clientX, y: evt.clientY };
        canvas.defaultCursor = 'grabbing';
        return;
      }

      // 2. Silgi Modu
      if (currentTool === 'eraser') {
        if (opt.target) {
          canvas.remove(opt.target);
          canvas.requestRenderAll();
          onCanvasModified();
        }
        return;
      }

      // 3. Metin Ekleme Modu
      if (currentTool === 'text') {
        const text = new fabric.IText('Metin buraya...', {
          left: pointer.x,
          top: pointer.y,
          fontFamily: currentStyle.fontFamily,
          fontSize: currentStyle.fontSize,
          fill: currentStyle.stroke === 'transparent' ? '#111111' : currentStyle.stroke,
          fontWeight: currentStyle.fontWeight as any,
          fontStyle: currentStyle.fontStyle as any,
        });
        (text as any).customId = generateObjectId('text');
        (text as any).customName = 'Metin Kutusu';
        canvas.add(text);
        canvas.setActiveObject(text);
        setCurrentTool('select');
        canvas.requestRenderAll();
        onCanvasModified();
        setTimeout(() => {
          text.enterEditing();
          text.selectAll();
          canvas.requestRenderAll();
        }, 50);
        return;
      }

      // 4. İki Noktalı Ok ve Çizgi Çizimi (Önce 1. nokta, sonra 2. nokta + Kenarlara Snap)
      if (currentTool === 'line' || currentTool === 'arrow') {
        mouseDownTime.current = Date.now();
        isDraggingLine.current = false;

        // Snap noktası varsa başlangıç noktası olarak kenara yapış
        const snapCandidate = findSnapPoint(pointer, canvas, null, 24);
        const effectivePoint = snapCandidate ? snapCandidate.point : { x: pointer.x, y: pointer.y };

        if (!lineStartPoint.current) {
          // 1. TIKLAMA: Başlangıç Noktası Belirlendi (Kenara snap olabilir)
          lineStartPoint.current = effectivePoint;
          setPoint1Indicator(toScreenCoords(effectivePoint));

          if (currentTool === 'line') {
            const preview = new fabric.Line(
              [effectivePoint.x, effectivePoint.y, effectivePoint.x, effectivePoint.y],
              {
                stroke: currentStyle.stroke,
                strokeWidth: currentStyle.strokeWidth,
                strokeDashArray: [4, 4],
                strokeLineCap: 'round',
                selectable: false,
                evented: false,
              }
            );
            linePreviewObj.current = preview;
            canvas.add(preview);
          } else {
            const preview = createArrowObject(
              effectivePoint.x,
              effectivePoint.y,
              effectivePoint.x + 0.1,
              effectivePoint.y + 0.1,
              { ...currentStyle, strokeDashArray: [4, 4] }
            );
            preview.set({ selectable: false, evented: false });
            linePreviewObj.current = preview;
            canvas.add(preview);
          }
          canvas.requestRenderAll();
          return;
        } else {
          // 2. TIKLAMA: Bitiş Noktası Belirlendi & Çizim Tamamlandı
          const start = lineStartPoint.current;
          const end = effectivePoint;

          if (linePreviewObj.current) {
            canvas.remove(linePreviewObj.current);
            linePreviewObj.current = null;
          }

          const dist = Math.hypot(end.x - start.x, end.y - start.y);
          if (dist > 3) {
            if (currentTool === 'line') {
              const lineObj = new fabric.Line([start.x, start.y, end.x, end.y], {
                stroke: currentStyle.stroke,
                strokeWidth: currentStyle.strokeWidth,
                strokeDashArray: currentStyle.strokeDashArray || undefined,
                strokeLineCap: 'round',
                selectable: true,
              });
              (lineObj as any).customId = generateObjectId('line');
              (lineObj as any).customName = 'Çizgi';
              canvas.add(lineObj);
              canvas.setActiveObject(lineObj);
            } else {
              const arrowObj = createArrowObject(start.x, start.y, end.x, end.y, currentStyle);
              canvas.add(arrowObj);
              canvas.setActiveObject(arrowObj);
            }
            onCanvasModified();
            onShowToast(currentTool === 'arrow' ? 'Ok bağlantısı oluşturuldu' : 'Çizgi eklendi');
          }

          lineStartPoint.current = null;
          currentSnapPointRef.current = null;
          setSnapIndicator(null);
          setPoint1Indicator(null);
          setCurrentTool('select');
          canvas.requestRenderAll();
          return;
        }
      }

      // 5. Standart Sürüklemeli Şekil Çizimi (Dikdörtgen, Yuvarlak Kutu, Daire, Eşkenar Dörtgen)
      if (['rectangle', 'rounded-rect', 'circle', 'diamond'].includes(currentTool)) {
        isDrawingShape.current = true;
        startPoint.current = { x: pointer.x, y: pointer.y };

        const commonProps = {
          left: pointer.x,
          top: pointer.y,
          fill: currentStyle.fill,
          stroke: currentStyle.stroke,
          strokeWidth: currentStyle.strokeWidth,
          strokeDashArray: currentStyle.strokeDashArray || undefined,
          opacity: currentStyle.opacity,
          selectable: false,
        };

        let shape: fabric.FabricObject | null = null;

        if (currentTool === 'rectangle') {
          shape = new fabric.Rect({
            ...commonProps,
            width: 1,
            height: 1,
            rx: 0,
            ry: 0,
          });
          (shape as any).customName = 'Dikdörtgen';
        } else if (currentTool === 'rounded-rect') {
          shape = new fabric.Rect({
            ...commonProps,
            width: 1,
            height: 1,
            rx: currentStyle.rx || 14,
            ry: currentStyle.ry || 14,
          });
          (shape as any).customName = 'Yuvarlak Kutu';
        } else if (currentTool === 'circle') {
          shape = new fabric.Circle({
            ...commonProps,
            radius: 1,
          });
          (shape as any).customName = 'Daire';
        } else if (currentTool === 'diamond') {
          shape = new fabric.Polygon(
            [
              { x: 0, y: 1 },
              { x: 1, y: 0 },
              { x: 0, y: -1 },
              { x: -1, y: 0 },
            ],
            {
              ...commonProps,
              scaleX: 1,
              scaleY: 1,
            }
          );
          (shape as any).customName = 'Eşkenar Dörtgen';
        }

        if (shape) {
          (shape as any).customId = generateObjectId(currentTool);
          activeShape.current = shape;
          canvas.add(shape);
        }
      }
    };

    const onMouseMove = (opt: any) => {
      const evt = opt.e;

      // 1. Pan yapılıyorsa
      if (isPanning.current && lastPanPoint.current) {
        const vpt = canvas.viewportTransform;
        if (vpt) {
          vpt[4] += evt.clientX - lastPanPoint.current.x;
          vpt[5] += evt.clientY - lastPanPoint.current.y;
          canvas.requestRenderAll();
        }
        lastPanPoint.current = { x: evt.clientX, y: evt.clientY };
        return;
      }

      // 2. Ok / Çizgi Çiziminde Kenarlara Manyetik Snap ve Canlı Önizleme
      if (currentTool === 'line' || currentTool === 'arrow') {
        const pointer = canvas.getScenePoint(opt.e);

        // Snap kontrolü (Kare, Dikdörtgen, Daire, Eşkenar Dörtgen kenarları)
        const snapCandidate = findSnapPoint(pointer, canvas, linePreviewObj.current, 24);
        const effectivePoint = snapCandidate ? snapCandidate.point : { x: pointer.x, y: pointer.y };
        currentSnapPointRef.current = snapCandidate ? snapCandidate.point : null;

        if (snapCandidate) {
          const screenPos = toScreenCoords(snapCandidate.point);
          setSnapIndicator({
            x: screenPos.x,
            y: screenPos.y,
            isCardinal: snapCandidate.isCardinal,
          });
        } else {
          setSnapIndicator(null);
        }

        // Eğer 1. nokta zaten belirlendiyse, 2. noktaya doğru önizleme çiz
        if (lineStartPoint.current) {
          isDraggingLine.current = true;
          const start = lineStartPoint.current;

          // 1. Nokta göstergesini viewport'a göre güncelle
          setPoint1Indicator(toScreenCoords(start));

          if (currentTool === 'line' && linePreviewObj.current) {
            (linePreviewObj.current as fabric.Line).set({
              x1: start.x,
              y1: start.y,
              x2: effectivePoint.x,
              y2: effectivePoint.y,
            });
            linePreviewObj.current.setCoords();
            canvas.requestRenderAll();
          } else if (currentTool === 'arrow') {
            if (linePreviewObj.current) {
              canvas.remove(linePreviewObj.current);
            }
            const preview = createArrowObject(
              start.x,
              start.y,
              effectivePoint.x,
              effectivePoint.y,
              { ...currentStyle, strokeDashArray: [4, 4] }
            );
            preview.set({ selectable: false, evented: false });
            linePreviewObj.current = preview;
            canvas.add(preview);
            canvas.requestRenderAll();
          }
        }
        return;
      }

      // 3. Şekil sürüklenerek boyutlandırılıyorsa
      if (isDrawingShape.current && startPoint.current && activeShape.current) {
        const pointer = canvas.getScenePoint(opt.e);
        const x1 = startPoint.current.x;
        const y1 = startPoint.current.y;
        const x2 = pointer.x;
        const y2 = pointer.y;

        const left = Math.min(x1, x2);
        const top = Math.min(y1, y2);
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);

        if (currentTool === 'rectangle' || currentTool === 'rounded-rect') {
          activeShape.current.set({ left, top, width, height });
        } else if (currentTool === 'circle') {
          const radius = Math.max(width, height) / 2;
          (activeShape.current as fabric.Circle).set({
            left: Math.min(x1, x2),
            top: Math.min(y1, y2),
            radius,
          });
        } else if (currentTool === 'diamond') {
          activeShape.current.set({
            left,
            top,
            scaleX: Math.max(1, width / 2),
            scaleY: Math.max(1, height / 2),
          });
        }

        activeShape.current.setCoords();
        canvas.requestRenderAll();
      }
    };

    const onMouseUp = (opt: any) => {
      if (isPanning.current) {
        isPanning.current = false;
        lastPanPoint.current = null;
        canvas.defaultCursor = currentTool === 'hand' || spacePressed.current ? 'grab' : 'default';
        return;
      }

      // Ok veya çizgi çizilirken kullanıcı basılı tutup sürüklediyse (drag & drop çizim desteği)
      if (
        (currentTool === 'line' || currentTool === 'arrow') &&
        lineStartPoint.current &&
        isDraggingLine.current &&
        Date.now() - mouseDownTime.current > 160
      ) {
        const pointer = canvas.getScenePoint(opt.e);
        const snapCandidate = findSnapPoint(pointer, canvas, linePreviewObj.current, 24);
        const start = lineStartPoint.current;
        const end = snapCandidate ? snapCandidate.point : { x: pointer.x, y: pointer.y };

        const dist = Math.hypot(end.x - start.x, end.y - start.y);
        if (dist > 12) {
          if (linePreviewObj.current) {
            canvas.remove(linePreviewObj.current);
            linePreviewObj.current = null;
          }

          if (currentTool === 'line') {
            const lineObj = new fabric.Line([start.x, start.y, end.x, end.y], {
              stroke: currentStyle.stroke,
              strokeWidth: currentStyle.strokeWidth,
              strokeDashArray: currentStyle.strokeDashArray || undefined,
              strokeLineCap: 'round',
              selectable: true,
            });
            (lineObj as any).customId = generateObjectId('line');
            (lineObj as any).customName = 'Çizgi';
            canvas.add(lineObj);
            canvas.setActiveObject(lineObj);
          } else {
            const arrowObj = createArrowObject(start.x, start.y, end.x, end.y, currentStyle);
            canvas.add(arrowObj);
            canvas.setActiveObject(arrowObj);
          }
          onCanvasModified();
          onShowToast(currentTool === 'arrow' ? 'Ok bağlantısı oluşturuldu' : 'Çizgi eklendi');

          lineStartPoint.current = null;
          currentSnapPointRef.current = null;
          setSnapIndicator(null);
          setPoint1Indicator(null);
          isDraggingLine.current = false;
          setCurrentTool('select');
          canvas.requestRenderAll();
          return;
        }
      }

      // Sürüklemeli şekillerin bitirilmesi
      if (isDrawingShape.current && startPoint.current && activeShape.current) {
        isDrawingShape.current = false;
        activeShape.current.set({ selectable: true });
        activeShape.current.setCoords();
        canvas.setActiveObject(activeShape.current);

        activeShape.current = null;
        startPoint.current = null;
        setCurrentTool('select');
        canvas.requestRenderAll();
        onCanvasModified();
      }
    };

    // Fare Tekerleği ile Yakınlaştırma (Zoom)
    const onMouseWheel = (opt: any) => {
      const evt = opt.e;
      evt.preventDefault();
      evt.stopPropagation();

      const delta = evt.deltaY;
      let newZoom = canvas.getZoom();
      newZoom *= 0.999 ** delta;
      if (newZoom > 5) newZoom = 5;
      if (newZoom < 0.15) newZoom = 0.15;

      const point = new fabric.Point(evt.offsetX, evt.offsetY);
      canvas.zoomToPoint(point, newZoom);
      setZoom(newZoom);
    };

    // Çift Tıklama Dinleyicisi
    const handleDoubleClick = (opt: any) => {
      let target = opt.target;

      if (!target) {
        target = canvas.getActiveObject();
      }

      if (!target && opt.e) {
        const pointer = canvas.getScenePoint(opt.e);
        const objects = canvas.getObjects();
        for (let i = objects.length - 1; i >= 0; i--) {
          const obj = objects[i];
          if (obj.visible !== false && (obj as any).containsPoint?.(pointer)) {
            target = obj;
            break;
          }
        }
      }

      if (target) {
        handleShapeTextEdit(target);
      }
    };

    // Şekil taşındığında, boyutlandırıldığında veya döndürüldüğünde bağlı metni de senkronize et
    const syncAttachedText = (e: any) => {
      const obj = e.target;
      if (obj && (obj as any).attachedText) {
        const text = (obj as any).attachedText;
        if (canvas.contains(text)) {
          const c = obj.getCenterPoint();
          text.set({ left: c.x, top: c.y });
          text.setCoords();
        }
      }
    };

    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:up', onMouseUp);
    canvas.on('mouse:wheel', onMouseWheel);
    canvas.on('mouse:dblclick', handleDoubleClick);
    (canvas as any).on('mousedblclick', handleDoubleClick);
    canvas.on('object:moving', syncAttachedText);
    canvas.on('object:scaling', syncAttachedText);
    canvas.on('object:rotating', syncAttachedText);

    // Native DOM çift tıklama garantisi
    const canvasUpperEl = canvas.upperCanvasEl;
    const onDomDblClick = (e: MouseEvent) => {
      const pointer = canvas.getScenePoint(e);
      let hitTarget = canvas.getActiveObject();
      if (!hitTarget) {
        const objects = canvas.getObjects();
        for (let i = objects.length - 1; i >= 0; i--) {
          const obj = objects[i];
          if (obj.visible !== false && (obj as any).containsPoint?.(pointer)) {
            hitTarget = obj;
            break;
          }
        }
      }
      if (hitTarget) {
        handleShapeTextEdit(hitTarget);
      }
    };

    if (canvasUpperEl) {
      canvasUpperEl.addEventListener('dblclick', onDomDblClick);
    }

    return () => {
      canvas.off('mouse:down', onMouseDown);
      canvas.off('mouse:move', onMouseMove);
      canvas.off('mouse:up', onMouseUp);
      canvas.off('mouse:wheel', onMouseWheel);
      canvas.off('mouse:dblclick', handleDoubleClick);
      (canvas as any).off('mousedblclick', handleDoubleClick);
      canvas.off('object:moving', syncAttachedText);
      canvas.off('object:scaling', syncAttachedText);
      canvas.off('object:rotating', syncAttachedText);
      if (canvasUpperEl) {
        canvasUpperEl.removeEventListener('dblclick', onDomDblClick);
      }
    };
  }, [currentTool, currentStyle, setZoom, setCurrentTool, onCanvasModified]);

  // Zoom Değişikliğini Canvas'a Uygula
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (Math.abs(canvas.getZoom() - zoom) > 0.01) {
      const center = new fabric.Point(canvas.getWidth() / 2, canvas.getHeight() / 2);
      canvas.zoomToPoint(center, zoom);
      canvas.requestRenderAll();
    }
  }, [zoom]);

  // Sürükle ve Bırak Desteği (Kullanıcının diskinden SVG veya Görsel bırakması)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const canvas = fabricRef.current;
    if (!canvas || !containerRef.current) return;

    const pointer = canvas.getScenePoint({ clientX: e.clientX, clientY: e.clientY } as any);

    // Masaüstünden dosya mı sürüklendi? (SVG / PNG / JPG)
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === 'image/svg+xml') {
        const text = await file.text();
        await loadSvgStringToCanvas(canvas, text, false);
        onShowToast(`"${file.name}" tuvale eklendi`);
        onCanvasModified();
      } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = async (fEvt) => {
          const dataUrl = fEvt.target?.result as string;
          const imgEl = new Image();
          imgEl.src = dataUrl;
          imgEl.onload = () => {
            const fabricImg = new (fabric as any).FabricImage(imgEl, {
              left: pointer.x,
              top: pointer.y,
            });
            fabricImg.scaleToWidth(Math.min(300, canvas.getWidth() / 2));
            fabricImg.customId = generateObjectId('image');
            fabricImg.customName = file.name;
            canvas.add(fabricImg);
            canvas.setActiveObject(fabricImg);
            canvas.requestRenderAll();
            onCanvasModified();
            onShowToast(`Görsel "${file.name}" eklendi`);
          };
        };
        reader.readAsDataURL(file);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative w-full h-full overflow-hidden select-none outline-none ${
        gridMode === 'dots' ? 'canvas-dots' : gridMode === 'grid' ? 'canvas-grid' : 'bg-slate-50'
      }`}
    >
      <canvas ref={canvasElRef} className="block w-full h-full" />

      {/* Manyetik Kenar Snap Noktası Göstergesi (Pulsing Glow Anchor) */}
      {snapIndicator && (
        <div
          style={{ left: snapIndicator.x, top: snapIndicator.y }}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-40 flex items-center justify-center"
        >
          <div
            className={`rounded-full border-2 border-white shadow-xl animate-ping opacity-75 ${
              snapIndicator.isCardinal ? 'w-5 h-5 bg-blue-500' : 'w-4 h-4 bg-sky-400'
            }`}
          />
          <div
            className={`rounded-full border-2 border-white shadow-md absolute ${
              snapIndicator.isCardinal ? 'w-3 h-3 bg-blue-600' : 'w-2.5 h-2.5 bg-sky-500'
            }`}
          />
        </div>
      )}

      {/* 1. Nokta Belirlendi Göstergesi */}
      {point1Indicator && (currentTool === 'line' || currentTool === 'arrow') && (
        <div
          style={{ left: point1Indicator.x, top: point1Indicator.y }}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-40 flex items-center justify-center"
        >
          <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-md" />
        </div>
      )}

      {/* Ok ve Çizgi Çiziminde Kullanıcı İpucu Rozeti */}
      {(currentTool === 'line' || currentTool === 'arrow') && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-medium rounded-full shadow-lg border border-slate-700/80 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span>
            {lineStartPoint.current
              ? 'Bitiş noktasını belirlemek için tıklayın (İptal: Esc)'
              : 'İlk noktayı belirlemek için şekil kenarına veya tuvale tıklayın'}
          </span>
        </div>
      )}
    </div>
  );
};
