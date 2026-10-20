import React, { useState } from 'react';
import type * as fabric from 'fabric';
import {
  Layers,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  GripVertical,
  Edit2,
  Check,
} from 'lucide-react';
import type { LayerItem } from '../types';
import { moveLayerToIndex } from '../utils/canvasHelpers';

interface LayersPanelProps {
  canvas: fabric.Canvas | null;
  layers: LayerItem[];
  selectedLayerId: string | null;
  onSelectLayer: (layer: LayerItem) => void;
  onRefreshLayers: () => void;
}

export const LayersPanel: React.FC<LayersPanelProps> = ({
  canvas,
  layers,
  selectedLayerId,
  onSelectLayer,
  onRefreshLayers,
}) => {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');

  const handleToggleVisible = (e: React.MouseEvent, layer: LayerItem) => {
    e.stopPropagation();
    if (!canvas) return;
    const nextVal = !layer.visible;
    layer.objectRef.set('visible', nextVal);
    if (!nextVal && canvas.getActiveObject() === layer.objectRef) {
      canvas.discardActiveObject();
    }
    canvas.requestRenderAll();
    onRefreshLayers();
  };

  const handleToggleLock = (e: React.MouseEvent, layer: LayerItem) => {
    e.stopPropagation();
    if (!canvas) return;
    const nextLocked = !layer.locked;
    layer.objectRef.set({
      lockMovementX: nextLocked,
      lockMovementY: nextLocked,
      lockRotation: nextLocked,
      lockScalingX: nextLocked,
      lockScalingY: nextLocked,
      selectable: !nextLocked,
    });
    canvas.requestRenderAll();
    onRefreshLayers();
  };

  const startRename = (e: React.MouseEvent, layer: LayerItem) => {
    e.stopPropagation();
    setEditingId(layer.id);
    setEditingName(layer.name);
  };

  const saveRename = (layer: LayerItem) => {
    if (editingName.trim()) {
      (layer.objectRef as any).customName = editingName.trim();
    }
    setEditingId(null);
    onRefreshLayers();
  };

  // Sürükle Bırak Katman Sıralaması
  const handleDragStart = (e: React.DragEvent, idx: number) => {
    e.dataTransfer.setData('text/plain', idx.toString());
    e.dataTransfer.effectAllowed = 'move';
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIdx !== idx) {
      setDragOverIdx(idx);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (!canvas || draggedIdx === null || draggedIdx === targetIdx) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }

    const total = layers.length;
    // layers listesi ters sıralı (üst katman en üstte): canvas index = total - 1 - idx
    const fromCanvasIdx = total - 1 - draggedIdx;
    const toCanvasIdx = total - 1 - targetIdx;

    const obj = layers[draggedIdx].objectRef;
    moveLayerToIndex(canvas, obj, toCanvasIdx);

    setDraggedIdx(null);
    setDragOverIdx(null);
    onRefreshLayers();
  };

  return (
    <div className="flex flex-col h-full bg-white select-none">
      <div className="p-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-semibold text-slate-800 text-xs">
          <Layers className="w-3.5 h-3.5 text-blue-600" />
          <span>Katmanlar ({layers.length})</span>
        </div>
        <span className="text-[10px] text-slate-400">Sürükleyip Sırala</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {layers.length === 0 ? (
          <div className="text-center py-10 px-4 text-slate-400 text-xs">
            <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-[10px] mt-1 text-slate-400">Çizim araçlarını kullanarak yeni şekiller ekleyin</p>
          </div>
        ) : (
          layers.map((layer, idx) => {
            const isSelected = selectedLayerId === layer.id;
            const isDragging = draggedIdx === idx;
            const isOver = dragOverIdx === idx;

            return (
              <div
                key={layer.id}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onClick={() => onSelectLayer(layer)}
                className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-blue-50/80 border-blue-400 text-blue-900 font-medium shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-slate-150 text-slate-700'
                } ${isDragging ? 'opacity-40 border-dashed border-blue-500' : ''} ${
                  isOver ? 'border-t-2 border-t-blue-600 bg-blue-50/40' : ''
                }`}
              >
                {/* Sürükleme Tutamacı */}
                <span className="cursor-grab active:cursor-grabbing text-slate-300 group-hover:text-slate-500 p-0.5">
                  <GripVertical className="w-3.5 h-3.5" />
                </span>

                {/* Katman Adı & Düzenleme */}
                <div className="flex-1 min-w-0 flex items-center gap-1">
                  {editingId === layer.id ? (
                    <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveRename(layer)}
                        autoFocus
                        className="flex-1 px-1 py-0.5 bg-white border border-blue-400 rounded text-xs outline-none"
                      />
                      <button
                        onClick={() => saveRename(layer)}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="truncate text-[11px]">{layer.name}</span>
                      <button
                        onClick={(e) => startRename(e, layer)}
                        title="Katmanı Yeniden Adlandır"
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-slate-700 rounded transition"
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                      </button>
                    </>
                  )}
                </div>

                {/* Görünürlük Düğmesi */}
                <button
                  onClick={(e) => handleToggleVisible(e, layer)}
                  title={layer.visible ? 'Gizle' : 'Göster'}
                  className={`p-1 rounded transition ${
                    layer.visible ? 'text-slate-400 hover:text-slate-700' : 'text-amber-500 bg-amber-50'
                  }`}
                >
                  {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>

                {/* Kilit Düğmesi */}
                <button
                  onClick={(e) => handleToggleLock(e, layer)}
                  title={layer.locked ? 'Kilidi Aç' : 'Kilitle'}
                  className={`p-1 rounded transition ${
                    layer.locked ? 'text-red-500 bg-red-50' : 'text-slate-300 hover:text-slate-600'
                  }`}
                >
                  {layer.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
