import React from 'react';
import type * as fabric from 'fabric';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalSpaceAround,
  AlignHorizontalSpaceAround,
  BringToFront,
  SendToBack,
  ArrowUp,
  ArrowDown,
  Layers,
  Copy,
  Trash2,
  Bold,
  Italic,
  Sliders,
  Group as GroupIcon,
  Ungroup as UngroupIcon,
} from 'lucide-react';
import type { ShapeStyle, AlignAction, ArrangeAction } from '../types';
import {
  alignObjects,
  arrangeObject,
  groupSelection,
  ungroupSelection,
  duplicateSelected,
} from '../utils/canvasHelpers';

interface PropertiesPanelProps {
  canvas: fabric.Canvas | null;
  activeObject: fabric.FabricObject | null;
  currentStyle: ShapeStyle;
  onChangeStyle: (newStyle: Partial<ShapeStyle>) => void;
  onRefreshLayers: () => void;
}

const PRESET_COLORS = [
  { name: 'Derin Mavi', value: '#2457A6' },
  { name: 'Vurgulu Turuncu', value: '#E68A3A' },
  { name: 'Koyu Hat', value: '#111111' },
  { name: 'Orta Gri', value: '#777777' },
  { name: 'Açık Çerçeve', value: '#E2E8F0' },
  { name: 'Beyaz', value: '#FFFFFF' },
  { name: 'Açık Mavi Zemin', value: '#EFF6FF' },
  { name: 'Açık Amber Zemin', value: '#FFFBEB' },
  { name: 'Şeffaf', value: 'transparent' },
];

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  canvas,
  activeObject,
  currentStyle,
  onChangeStyle,
  onRefreshLayers,
}) => {
  const isText = activeObject?.type === 'itext' || activeObject?.type === 'text';
  const isGroup = activeObject?.type === 'group';
  const isMultiSelection = activeObject?.type === 'activeSelection';

  // Nesne veya genel stil güncelleme
  const updateProp = (key: keyof ShapeStyle, value: any) => {
    onChangeStyle({ [key]: value });

    if (canvas && activeObject) {
      if (key === 'fill') {
        activeObject.set('fill', value);
      } else if (key === 'stroke') {
        activeObject.set('stroke', value);
      } else if (key === 'strokeWidth') {
        activeObject.set('strokeWidth', value);
      } else if (key === 'strokeDashArray') {
        activeObject.set('strokeDashArray', value || undefined);
      } else if (key === 'opacity') {
        activeObject.set('opacity', value);
      } else if (key === 'rx' || key === 'ry') {
        if (activeObject.type === 'rect') {
          activeObject.set({ rx: value, ry: value });
        }
      } else if (key === 'fontSize' && isText) {
        (activeObject as any).set('fontSize', value);
      } else if (key === 'fontWeight' && isText) {
        (activeObject as any).set('fontWeight', value);
      } else if (key === 'fontStyle' && isText) {
        (activeObject as any).set('fontStyle', value);
      } else if (key === 'textAlign' && isText) {
        (activeObject as any).set('textAlign', value);
      }

      activeObject.setCoords();
      canvas.requestRenderAll();
      onRefreshLayers();
    }
  };

  const handleAlign = (action: AlignAction) => {
    if (!canvas) return;
    alignObjects(canvas, action);
    onRefreshLayers();
  };

  const handleArrange = (action: ArrangeAction) => {
    if (!canvas) return;
    arrangeObject(canvas, action);
    onRefreshLayers();
  };

  const handleDelete = () => {
    if (!canvas || !activeObject) return;
    if (activeObject.type === 'activeSelection') {
      const objects = (activeObject as fabric.ActiveSelection).getObjects();
      canvas.discardActiveObject();
      objects.forEach((obj) => canvas.remove(obj));
    } else {
      canvas.remove(activeObject);
    }
    canvas.requestRenderAll();
    onRefreshLayers();
  };

  const handleDuplicate = async () => {
    if (!canvas) return;
    await duplicateSelected(canvas);
    onRefreshLayers();
  };

  const handleGroup = () => {
    if (!canvas) return;
    groupSelection(canvas);
    onRefreshLayers();
  };

  const handleUngroup = () => {
    if (!canvas) return;
    ungroupSelection(canvas);
    onRefreshLayers();
  };

  return (
    <div className="w-64 bg-white/95 backdrop-blur-md border-l border-slate-200 flex flex-col h-full text-xs text-slate-700 select-none overflow-y-auto">
      {/* Başlık */}
      <div className="p-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
          <Sliders className="w-3.5 h-3.5 text-blue-600" />
          <span>{activeObject ? 'Özellikler Müfettişi' : 'Varsayılan Çizim Stili'}</span>
        </div>
        {activeObject && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
            {activeObject.type}
          </span>
        )}
      </div>

      <div className="p-3 space-y-4">
        {/* Çizgi Rengi (Stroke) */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Çizgi Rengi (Stroke)
          </label>
          <div className="grid grid-cols-5 gap-1.5 mb-2">
            {PRESET_COLORS.filter((c) => c.value !== 'transparent').map((c) => (
              <button
                key={c.value}
                onClick={() => updateProp('stroke', c.value)}
                title={c.name}
                className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
                  currentStyle.stroke === c.value
                    ? 'ring-2 ring-blue-600 ring-offset-1 scale-105'
                    : 'hover:scale-105'
                }`}
                style={{
                  backgroundColor: c.value,
                  borderColor: c.value === '#FFFFFF' ? '#CBD5E1' : c.value,
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={currentStyle.stroke === 'transparent' ? '#111111' : currentStyle.stroke}
              onChange={(e) => updateProp('stroke', e.target.value)}
              className="w-6 h-6 rounded cursor-pointer border border-slate-300"
            />
            <input
              type="text"
              value={currentStyle.stroke}
              onChange={(e) => updateProp('stroke', e.target.value)}
              className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-800 font-mono text-[11px]"
            />
          </div>
        </div>

        {/* Dolgu Rengi (Fill) */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Dolgu Rengi (Fill)
          </label>
          <div className="grid grid-cols-5 gap-1.5 mb-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => updateProp('fill', c.value)}
                title={c.name}
                className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all relative ${
                  currentStyle.fill === c.value
                    ? 'ring-2 ring-blue-600 ring-offset-1 scale-105'
                    : 'hover:scale-105'
                }`}
                style={{
                  backgroundColor: c.value === 'transparent' ? '#ffffff' : c.value,
                  borderColor: '#CBD5E1',
                }}
              >
                {c.value === 'transparent' && (
                  <span className="w-full h-0.5 bg-red-400 rotate-45 transform block absolute" />
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={currentStyle.fill === 'transparent' ? '#ffffff' : currentStyle.fill}
              onChange={(e) => updateProp('fill', e.target.value)}
              className="w-6 h-6 rounded cursor-pointer border border-slate-300"
            />
            <input
              type="text"
              value={currentStyle.fill}
              onChange={(e) => updateProp('fill', e.target.value)}
              className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-800 font-mono text-[11px]"
            />
          </div>
        </div>

        {/* Çizgi Kalınlığı & Stili */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Çizgi Kalınlığı & Stili
          </label>
          <div className="flex items-center gap-1 mb-2">
            {[1, 2, 3, 5, 8].map((w) => (
              <button
                key={w}
                onClick={() => updateProp('strokeWidth', w)}
                className={`flex-1 py-1 rounded text-center font-medium transition ${
                  currentStyle.strokeWidth === w
                    ? 'bg-blue-600 text-white font-bold'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {w}px
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={() => updateProp('strokeDashArray', null)}
              className={`py-1 px-2 rounded border text-center font-medium transition ${
                !currentStyle.strokeDashArray
                  ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-600'
              }`}
            >
              Düz
            </button>
            <button
              onClick={() => updateProp('strokeDashArray', [6, 6])}
              className={`py-1 px-2 rounded border text-center font-medium transition ${
                currentStyle.strokeDashArray?.[0] === 6
                  ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-600'
              }`}
            >
              Kesikli
            </button>
            <button
              onClick={() => updateProp('strokeDashArray', [2, 4])}
              className={`py-1 px-2 rounded border text-center font-medium transition ${
                currentStyle.strokeDashArray?.[0] === 2
                  ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-600'
              }`}
            >
              Noktalı
            </button>
          </div>
        </div>

        {/* Köşe Yuvarlama (rx) */}
        {(!activeObject || activeObject.type === 'rect') && (
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Köşe Yuvarlama (Radius)
              </label>
              <span className="font-mono text-slate-400">{currentStyle.rx}px</span>
            </div>
            <div className="flex items-center gap-1">
              {[0, 6, 12, 18, 24].map((r) => (
                <button
                  key={r}
                  onClick={() => updateProp('rx', r)}
                  className={`flex-1 py-1 rounded text-center transition ${
                    currentStyle.rx === r
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Opaklık */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Opaklık
            </label>
            <span className="font-mono text-slate-400">{Math.round(currentStyle.opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={currentStyle.opacity}
            onChange={(e) => updateProp('opacity', parseFloat(e.target.value))}
            className="w-full accent-blue-600 cursor-pointer"
          />
        </div>

        {/* Metin Seçenekleri (Metin seçiliyse) */}
        {isText && (
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Yazı Tipi & Format
            </label>
            <div className="flex items-center gap-1 mb-2">
              {[12, 14, 16, 20, 24].map((sz) => (
                <button
                  key={sz}
                  onClick={() => updateProp('fontSize', sz)}
                  className={`flex-1 py-1 rounded text-center transition ${
                    currentStyle.fontSize === sz
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  updateProp('fontWeight', currentStyle.fontWeight === 'bold' ? 'normal' : 'bold')
                }
                className={`flex-1 py-1 px-2 rounded border flex items-center justify-center gap-1 ${
                  currentStyle.fontWeight === 'bold'
                    ? 'bg-blue-50 border-blue-600 text-blue-700 font-bold'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Bold className="w-3.5 h-3.5" />
                <span>Kalın</span>
              </button>
              <button
                onClick={() =>
                  updateProp('fontStyle', currentStyle.fontStyle === 'italic' ? 'normal' : 'italic')
                }
                className={`flex-1 py-1 px-2 rounded border flex items-center justify-center gap-1 ${
                  currentStyle.fontStyle === 'italic'
                    ? 'bg-blue-50 border-blue-600 text-blue-700'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Italic className="w-3.5 h-3.5" />
                <span>İtalik</span>
              </button>
            </div>
          </div>
        )}

        {/* Hizalama Araçları */}
        <div className="pt-2 border-t border-slate-100">
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Hizalama & Dağıtma
          </label>
          <div className="grid grid-cols-3 gap-1 mb-1">
            <button
              onClick={() => handleAlign('left')}
              title="Sola Hizala"
              className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 flex items-center justify-center"
            >
              <AlignLeft className="w-4 h-4 text-slate-700" />
            </button>
            <button
              onClick={() => handleAlign('center')}
              title="Yatay Ortala"
              className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 flex items-center justify-center"
            >
              <AlignCenter className="w-4 h-4 text-slate-700" />
            </button>
            <button
              onClick={() => handleAlign('right')}
              title="Sağa Hizala"
              className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 flex items-center justify-center"
            >
              <AlignRight className="w-4 h-4 text-slate-700" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1 mb-1">
            <button
              onClick={() => handleAlign('top')}
              title="Üste Hizala"
              className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-[10px] font-bold"
            >
              Üst
            </button>
            <button
              onClick={() => handleAlign('middle')}
              title="Dikey Ortala"
              className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-[10px] font-bold"
            >
              Orta
            </button>
            <button
              onClick={() => handleAlign('bottom')}
              title="Alta Hizala"
              className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-[10px] font-bold"
            >
              Alt
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => handleAlign('distribute-h')}
              title="Yatay Eşit Dağıt"
              className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 flex items-center justify-center gap-1 text-[10px]"
            >
              <AlignHorizontalSpaceAround className="w-3.5 h-3.5 text-slate-600" />
              <span>Yatay Dağıt</span>
            </button>
            <button
              onClick={() => handleAlign('distribute-v')}
              title="Dikey Eşit Dağıt"
              className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 flex items-center justify-center gap-1 text-[10px]"
            >
              <AlignVerticalSpaceAround className="w-3.5 h-3.5 text-slate-600" />
              <span>Dikey Dağıt</span>
            </button>
          </div>
        </div>

        {/* Katman Sırası (Z-Index) */}
        {activeObject && (
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Katman Sıralaması
            </label>
            <div className="grid grid-cols-4 gap-1">
              <button
                onClick={() => handleArrange('bringToFront')}
                title="En Öne Getir"
                className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 flex items-center justify-center"
              >
                <BringToFront className="w-4 h-4 text-slate-700" />
              </button>
              <button
                onClick={() => handleArrange('bringForward')}
                title="Bir Öne Getir"
                className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 flex items-center justify-center"
              >
                <ArrowUp className="w-4 h-4 text-slate-700" />
              </button>
              <button
                onClick={() => handleArrange('sendBackward')}
                title="Bir Arkaya Gönder"
                className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 flex items-center justify-center"
              >
                <ArrowDown className="w-4 h-4 text-slate-700" />
              </button>
              <button
                onClick={() => handleArrange('sendToBack')}
                title="En Arkaya Gönder"
                className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 flex items-center justify-center"
              >
                <SendToBack className="w-4 h-4 text-slate-700" />
              </button>
            </div>
          </div>
        )}

        {/* Gruplama & Çoğaltma & Silme */}
        {activeObject && (
          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            {isMultiSelection && (
              <button
                onClick={handleGroup}
                className="w-full py-1.5 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium flex items-center justify-center gap-1.5 transition"
              >
                <GroupIcon className="w-4 h-4" />
                <span>Seçilenleri Grupla</span>
              </button>
            )}

            {isGroup && (
              <button
                onClick={handleUngroup}
                className="w-full py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium flex items-center justify-center gap-1.5 transition"
              >
                <UngroupIcon className="w-4 h-4" />
                <span>Grubu Çöz</span>
              </button>
            )}

            <div className="flex items-center gap-1.5 pt-1">
              <button
                onClick={handleDuplicate}
                className="flex-1 py-1.5 px-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium flex items-center justify-center gap-1 transition"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Çoğalt</span>
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-1.5 px-2 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 font-medium flex items-center justify-center gap-1 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sil</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
