import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'V', desc: 'Seçim ve Taşıma Aracı' },
  { key: 'H / Space', desc: 'Kaydırma / El Aracı (Pan)' },
  { key: 'R', desc: 'Dikdörtgen Çiz' },
  { key: 'U', desc: 'Yuvarlak Köşeli Kutu Çiz' },
  { key: 'O', desc: 'Daire / Elips Çiz' },
  { key: 'D', desc: 'Eşkenar Dörtgen (Karar) Çiz' },
  { key: 'A', desc: 'Ok Bağlantısı Çiz' },
  { key: 'L', desc: 'Düz Çizgi Çiz' },
  { key: 'P', desc: 'Serbest Kalem ile Çiz' },
  { key: 'T', desc: 'Metin Kutusu Ekle' },
  { key: 'E', desc: 'Silgi Aracı' },
  { key: 'Ctrl + S', desc: 'Yerel Diske SVG Olarak Kaydet' },
  { key: 'Ctrl + Z', desc: 'Geri Al (Undo)' },
  { key: 'Ctrl + Y', desc: 'İleri Al (Redo)' },
  { key: 'Ctrl + D', desc: 'Seçili Nesneyi Çoğalt' },
  { key: 'Ctrl + G', desc: 'Seçilenleri Grupla' },
  { key: 'Ctrl + Shift + G', desc: 'Grubu Çöz' },
  { key: 'Delete / Backspace', desc: 'Seçili Nesneyi Sil' },
  { key: 'Mouse Tekerleği', desc: 'Tuvali Yakınlaştır / Uzaklaştır' },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
            <Keyboard className="w-4 h-4 text-blue-600" />
            <span>Klavye Kısayolları & Çizim Rehberi</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 max-h-[70vh] overflow-y-auto space-y-2">
          {SHORTCUTS.map((s, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-xs"
            >
              <span className="text-slate-600">{s.desc}</span>
              <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded font-mono font-semibold text-slate-800 text-[11px] shadow-xs">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
