import React from 'react';
import {
  MousePointer,
  Hand,
  Square,
  RectangleHorizontal,
  Circle,
  Diamond,
  MoveRight,
  Minus,
  Pencil,
  Type,
  Eraser,
} from 'lucide-react';
import type { ToolType } from '../types';

interface ToolbarProps {
  currentTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
}

const TOOLS: { id: ToolType; label: string; shortcut: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'select', label: 'Seçim & Taşı', shortcut: 'V', icon: MousePointer },
  { id: 'hand', label: 'Kaydırma (El)', shortcut: 'H', icon: Hand },
  { id: 'rectangle', label: 'Dikdörtgen', shortcut: 'R', icon: Square },
  { id: 'rounded-rect', label: 'Yuvarlak Kutu', shortcut: 'U', icon: RectangleHorizontal },
  { id: 'circle', label: 'Daire / Elips', shortcut: 'O', icon: Circle },
  { id: 'diamond', label: 'Eşkenar Dörtgen', shortcut: 'D', icon: Diamond },
  { id: 'arrow', label: 'Ok Bağlantısı', shortcut: 'A', icon: MoveRight },
  { id: 'line', label: 'Düz Çizgi', shortcut: 'L', icon: Minus },
  { id: 'pencil', label: 'Serbest Kalem', shortcut: 'P', icon: Pencil },
  { id: 'text', label: 'Metin', shortcut: 'T', icon: Type },
  { id: 'eraser', label: 'Silgi', shortcut: 'E', icon: Eraser },
];

export const Toolbar: React.FC<ToolbarProps> = ({ currentTool, onSelectTool }) => {
  return (
    <div className="bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-xl p-1.5 flex items-center gap-1 transition-all">
      {TOOLS.map((tool) => {
        const Icon = tool.icon;
        const isActive = currentTool === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => onSelectTool(tool.id)}
            title={`${tool.label} (${tool.shortcut})`}
            className={`relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl transition-all duration-150 group ${
              isActive
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-105'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95'
            }`}
          >
            <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
            <span
              className={`absolute -bottom-1 -right-1 text-[9px] font-bold px-1 rounded transition-colors ${
                isActive
                  ? 'bg-blue-800 text-blue-100'
                  : 'bg-slate-200 text-slate-500 group-hover:bg-slate-300'
              }`}
            >
              {tool.shortcut}
            </span>
          </button>
        );
      })}
    </div>
  );
};
