import React, { useState, useEffect, useRef, useCallback } from 'react';
import type * as fabric from 'fabric';
import {
  Layers as LayersIcon,
  ChevronLeft,
  ChevronRight,
  Sliders,
  CheckCircle,
} from 'lucide-react';
import type { ToolType, ShapeStyle, GridMode, LayerItem } from './types';
import { Navbar } from './components/Navbar';
import { Toolbar } from './components/Toolbar';
import { CanvasViewport } from './components/CanvasViewport';
import { PropertiesPanel } from './components/PropertiesPanel';
import { LayersPanel } from './components/LayersPanel';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { useAutoBackup } from './hooks/useAutoBackup';
import {
  getLayersFromCanvas,
  duplicateSelected,
} from './utils/canvasHelpers';
import { exportSvg } from './services/exportService';

const DEFAULT_STYLE: ShapeStyle = {
  fill: '#FFFFFF',
  stroke: '#2457A6',
  strokeWidth: 2,
  strokeDashArray: null,
  opacity: 1,
  rx: 14,
  ry: 14,
  fontSize: 14,
  fontFamily: 'Inter, sans-serif',
  fontWeight: 'normal',
  fontStyle: 'normal',
  textAlign: 'left',
};

export default function App() {
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const [currentTool, setCurrentTool] = useState<ToolType>('select');
  const [docTitle, setDocTitle] = useState<string>('Yeni Çizim');
  const [currentStyle, setCurrentStyle] = useState<ShapeStyle>(DEFAULT_STYLE);
  const [gridMode, setGridMode] = useState<GridMode>('dots');
  const [zoom, setZoom] = useState<number>(1);
  const [activeObject, setActiveObject] = useState<fabric.FabricObject | null>(null);
  const [layers, setLayers] = useState<LayerItem[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  // Yan panel durumları (Sol: Katmanlar, Sağ: Özellikler)
  const [showLayers, setShowLayers] = useState<boolean>(false);
  const [showProperties, setShowProperties] = useState<boolean>(true);
  const [showShortcuts, setShowShortcuts] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Undo / Redo Yığını
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const isHistoryAction = useRef<boolean>(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Otomatik Yedekleme Hook'u
  const { backupState, getSavedBackup } = useAutoBackup(canvas, docTitle);

  // Toast Bildirimi Göster
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 3000);
  }, []);

  // Katmanları Yenile
  const refreshLayers = useCallback(() => {
    if (!canvas) return;
    const l = getLayersFromCanvas(canvas);
    setLayers(l);
  }, [canvas]);

  // Canvas Değişikliğinde Geçmişe Kaydet
  const saveHistoryState = useCallback(() => {
    if (!canvas || isHistoryAction.current) return;
    try {
      const state = JSON.stringify(canvas.toJSON());
      undoStack.current.push(state);
      if (undoStack.current.length > 40) {
        undoStack.current.shift();
      }
      redoStack.current = [];
      setCanUndo(undoStack.current.length > 1);
      setCanRedo(false);
      refreshLayers();
    } catch (e) {
      console.warn('History kaydetme hatası:', e);
    }
  }, [canvas, refreshLayers]);

  // Geri Al (Undo)
  const handleUndo = useCallback(async () => {
    if (!canvas || undoStack.current.length <= 1) return;
    isHistoryAction.current = true;
    const currentState = undoStack.current.pop();
    if (currentState) {
      redoStack.current.push(currentState);
    }
    const prevState = undoStack.current[undoStack.current.length - 1];
    if (prevState) {
      await canvas.loadFromJSON(JSON.parse(prevState));
      canvas.requestRenderAll();
      refreshLayers();
    }
    setCanUndo(undoStack.current.length > 1);
    setCanRedo(true);
    isHistoryAction.current = false;
  }, [canvas, refreshLayers]);

  // İleri Al (Redo)
  const handleRedo = useCallback(async () => {
    if (!canvas || redoStack.current.length === 0) return;
    isHistoryAction.current = true;
    const nextState = redoStack.current.pop();
    if (nextState) {
      undoStack.current.push(nextState);
      await canvas.loadFromJSON(JSON.parse(nextState));
      canvas.requestRenderAll();
      refreshLayers();
    }
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
    isHistoryAction.current = false;
  }, [canvas, refreshLayers]);

  // Yeni Çizim Başlat (Tuvali temizler ve sıfırlar)
  const handleNewCanvas = useCallback(() => {
    if (!canvas) return;
    try {
      canvas.discardActiveObject();
      const objs = canvas.getObjects().slice();
      objs.forEach((o) => canvas.remove(o));
      canvas.clear();
      canvas.backgroundColor = '#FFFFFF';
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      setZoom(1);
      setDocTitle('Yeni Çizim');
      setCurrentTool('select');
      setActiveObject(null);
      setSelectedLayerId(null);
      setLayers([]);
      try {
        localStorage.removeItem('vektordraw_auto_backup_v1');
      } catch (e) {}
      undoStack.current = [JSON.stringify(canvas.toJSON())];
      redoStack.current = [];
      setCanUndo(false);
      setCanRedo(false);
      canvas.requestRenderAll();
      showToast('Yeni beyaz tahta oluşturuldu');
    } catch (err) {
      console.error('Yeni tuval oluşturma hatası:', err);
    }
  }, [canvas, showToast]);

  // Canvas hazır olduğunda temiz beyaz tahtayı başlat
  const handleCanvasReady = useCallback(
    async (readyCanvas: fabric.Canvas) => {
      setCanvas(readyCanvas);
      readyCanvas.clear();
      readyCanvas.backgroundColor = '#FFFFFF';
      readyCanvas.requestRenderAll();
      const state = JSON.stringify(readyCanvas.toJSON());
      undoStack.current = [state];
      setCanUndo(false);
      setLayers([]);
    },
    []
  );

  // Seçim Değiştiğinde
  const handleSelectionChange = useCallback((obj: fabric.FabricObject | null) => {
    setActiveObject(obj);
    if (obj) {
      setSelectedLayerId((obj as any).customId || null);
      // Nesne stilini mevcut panele yansıt
      setCurrentStyle((prev) => ({
        ...prev,
        fill: (obj.fill as string) || prev.fill,
        stroke: (obj.stroke as string) || prev.stroke,
        strokeWidth: obj.strokeWidth || prev.strokeWidth,
        strokeDashArray: obj.strokeDashArray || null,
        opacity: obj.opacity ?? prev.opacity,
        rx: (obj as any).rx ?? prev.rx,
        ry: (obj as any).ry ?? prev.ry,
      }));
    } else {
      setSelectedLayerId(null);
    }
  }, []);

  // Katman Seçimi
  const handleSelectLayer = useCallback(
    (layer: LayerItem) => {
      if (!canvas) return;
      canvas.setActiveObject(layer.objectRef);
      canvas.requestRenderAll();
      setSelectedLayerId(layer.id);
      setActiveObject(layer.objectRef);
    },
    [canvas]
  );

  // Klavye Kısayolları Dinleyicisi
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement as HTMLElement)?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || (document.activeElement as any)?.isContentEditable) {
        return;
      }

      // Ctrl + S (Kaydet)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (canvas) {
          exportSvg(canvas, `${docTitle}.svg`).then((res) => {
            if (res.success) showToast(`"${res.fileName}" kaydedildi`);
          });
        }
        return;
      }

      // Ctrl + Z (Geri Al)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Ctrl + Y veya Ctrl + Shift + Z (İleri Al)
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Ctrl + D (Çoğalt)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (canvas) {
          duplicateSelected(canvas).then(() => {
            refreshLayers();
            saveHistoryState();
          });
        }
        return;
      }

      // Delete veya Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (canvas && activeObject) {
          e.preventDefault();
          if (activeObject.type === 'activeSelection') {
            const objects = (activeObject as fabric.ActiveSelection).getObjects();
            canvas.discardActiveObject();
            objects.forEach((o) => canvas.remove(o));
          } else {
            canvas.remove(activeObject);
          }
          canvas.requestRenderAll();
          refreshLayers();
          saveHistoryState();
        }
        return;
      }

      // Araç Kısayolları (V, H, R, U, O, D, A, L, P, T, E)
      const key = e.key.toLowerCase();
      switch (key) {
        case 'v':
          setCurrentTool('select');
          break;
        case 'h':
          setCurrentTool('hand');
          break;
        case 'r':
          setCurrentTool('rectangle');
          break;
        case 'u':
          setCurrentTool('rounded-rect');
          break;
        case 'o':
          setCurrentTool('circle');
          break;
        case 'd':
          setCurrentTool('diamond');
          break;
        case 'a':
          setCurrentTool('arrow');
          break;
        case 'l':
          setCurrentTool('line');
          break;
        case 'p':
          setCurrentTool('pencil');
          break;
        case 't':
          setCurrentTool('text');
          break;
        case 'e':
          setCurrentTool('eraser');
          break;
        case '?':
          setShowShortcuts(true);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canvas, docTitle, activeObject, handleUndo, handleRedo, refreshLayers, saveHistoryState, showToast]);

  // Ekrana Sığdır (Fit to screen)
  const handleFitToScreen = () => {
    if (!canvas) return;
    const objects = canvas.getObjects();
    if (objects.length === 0) {
      setZoom(1);
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      canvas.requestRenderAll();
      return;
    }

    // Tüm nesnelerin sınırlayıcı kutusunu hesapla
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    objects.forEach((obj) => {
      const bound = obj.getBoundingRect();
      minX = Math.min(minX, bound.left);
      minY = Math.min(minY, bound.top);
      maxX = Math.max(maxX, bound.left + bound.width);
      maxY = Math.max(maxY, bound.top + bound.height);
    });

    const padding = 80;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;

    const scaleX = canvas.getWidth() / width;
    const scaleY = canvas.getHeight() / height;
    const newScale = Math.min(Math.min(scaleX, scaleY), 1.5);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const vpt = canvas.viewportTransform;
    if (vpt) {
      vpt[0] = newScale;
      vpt[3] = newScale;
      vpt[4] = canvas.getWidth() / 2 - centerX * newScale;
      vpt[5] = canvas.getHeight() / 2 - centerY * newScale;
      setZoom(newScale);
      canvas.requestRenderAll();
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 font-sans select-none">
      {/* Üst Navigasyon Çubuğu */}
      <Navbar
        canvas={canvas}
        docTitle={docTitle}
        setDocTitle={setDocTitle}
        backupState={backupState}
        gridMode={gridMode}
        setGridMode={setGridMode}
        zoom={zoom}
        onZoomChange={setZoom}
        onResetZoom={() => {
          if (canvas) {
            canvas.setZoom(1);
            setZoom(1);
            canvas.requestRenderAll();
          }
        }}
        onFitToScreen={handleFitToScreen}
        onRefreshLayers={refreshLayers}
        onShowShortcuts={() => setShowShortcuts(true)}
        onShowToast={showToast}
        onNewCanvas={handleNewCanvas}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      {/* Ana Çalışma Alanı (Viewport + Yan Paneller) */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Sol Panel: Katmanlar Çekmecesi */}
        <div
          className={`relative z-20 flex bg-white border-r border-slate-200 transition-all duration-200 shadow-sm ${
            showLayers ? 'w-64 sm:w-72' : 'w-12'
          }`}
        >
          {/* İkon Sekmesi: Katmanlar */}
          <div className="w-12 border-r border-slate-100 bg-slate-50 flex flex-col items-center py-3 gap-2 shrink-0">
            <button
              onClick={() => setShowLayers(!showLayers)}
              title={`Katmanlar (${layers.length})`}
              className={`relative p-2 rounded-xl transition ${
                showLayers
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <LayersIcon className="w-4 h-4" />
              {layers.length > 0 && (
                <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center">
                  {layers.length}
                </span>
              )}
            </button>
          </div>

          {/* Katmanlar Paneli İçeriği */}
          {showLayers && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <LayersPanel
                canvas={canvas}
                layers={layers}
                selectedLayerId={selectedLayerId}
                onSelectLayer={handleSelectLayer}
                onRefreshLayers={refreshLayers}
              />
            </div>
          )}
        </div>

        {/* Orta Canvas Alanı */}
        <div className="flex-1 relative overflow-hidden flex flex-col items-center justify-center">
          {/* Excalidraw Tarzı Yüzen Araç Çubuğu (Toolbar) */}
          <div className="absolute top-4 z-20 transition-all">
            <Toolbar currentTool={currentTool} onSelectTool={setCurrentTool} />
          </div>

          {/* Asıl Canvas Görünümü */}
          <CanvasViewport
            currentTool={currentTool}
            setCurrentTool={setCurrentTool}
            currentStyle={currentStyle}
            gridMode={gridMode}
            onCanvasReady={handleCanvasReady}
            onSelectionChange={handleSelectionChange}
            onCanvasModified={() => {
              saveHistoryState();
            }}
            zoom={zoom}
            setZoom={setZoom}
            onShowToast={showToast}
          />
        </div>

        {/* Sağ Panel: Özellikler Müfettişi */}
        {showProperties && (
          <div className="relative z-20 h-full flex shrink-0 shadow-sm animate-in slide-in-from-right-4 duration-150">
            <PropertiesPanel
              canvas={canvas}
              activeObject={activeObject}
              currentStyle={currentStyle}
              onChangeStyle={(newStyle) => setCurrentStyle((prev) => ({ ...prev, ...newStyle }))}
              onRefreshLayers={refreshLayers}
            />
          </div>
        )}

        {/* Sağ Paneli Açma / Kapatma Mini Düğmesi */}
        <button
          onClick={() => setShowProperties(!showProperties)}
          title={showProperties ? 'Özellikleri Gizle' : 'Özellikleri Göster'}
          className="absolute top-4 right-3 z-30 p-2 bg-white/90 backdrop-blur-md border border-slate-200/90 rounded-xl shadow-md text-slate-600 hover:text-slate-900 transition"
        >
          {showProperties ? <ChevronRight className="w-4 h-4" /> : <Sliders className="w-4 h-4" />}
        </button>
      </div>

      {/* Toast Bildirim Baloncuğu */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 text-xs font-medium animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Kısayol Tuşları Modal */}
      <KeyboardShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {/* Çevrimdışı Göstergesi */}
      <OfflineIndicator />
    </div>
  );
}
