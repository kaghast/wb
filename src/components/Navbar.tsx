import React, { useState, useRef, useEffect } from 'react';
import type * as fabric from 'fabric';
import {
  FileText,
  FolderOpen,
  Save,
  Download,
  Copy,
  Clock,
  Check,
  ChevronDown,
  HelpCircle,
  Grid,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Undo2,
  Redo2,
  FileCode,
  Image,
  FileSpreadsheet,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import type { AutoBackupState, GridMode, RecentDoc } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import {
  saveSvgToDisk,
  openSvgFromDisk,
  getRecentDocuments,
  addRecentDocument,
  deleteRecentDocument,
} from '../services/fileSystemService';
import {
  exportSvg,
  exportPng,
  exportPdf,
  exportJson,
  copySvgToClipboard,
} from '../services/exportService';
import { loadSvgStringToCanvas } from '../utils/canvasHelpers';

interface NavbarProps {
  canvas: fabric.Canvas | null;
  docTitle: string;
  setDocTitle: (title: string) => void;
  backupState: AutoBackupState;
  gridMode: GridMode;
  setGridMode: (mode: GridMode) => void;
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  onResetZoom: () => void;
  onFitToScreen: () => void;
  onRefreshLayers: () => void;
  onShowShortcuts: () => void;
  onShowToast: (msg: string) => void;
  onNewCanvas: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  canvas,
  docTitle,
  setDocTitle,
  backupState,
  gridMode,
  setGridMode,
  zoom,
  onZoomChange,
  onResetZoom,
  onFitToScreen,
  onRefreshLayers,
  onShowShortcuts,
  onShowToast,
  onNewCanvas,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) => {
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [recentDocs, setRecentDocs] = useState<RecentDoc[]>([]);
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRecentDocs(getRecentDocuments());
  }, []);

  // Menü dışına tıklanınca kapatma
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setFileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Yeni Çalışma Alanı (Doğrudan ve temiz başlat)
  const handleNewCanvas = () => {
    setFileMenuOpen(false);
    onNewCanvas();
  };

  // Diskten Dosya Açma (File System Access API)
  const handleOpenFile = async () => {
    if (!canvas) return;
    setFileMenuOpen(false);
    try {
      const res = await openSvgFromDisk();
      if (res.success && res.content) {
        const cleanName = res.fileName?.replace(/\.[^/.]+$/, '') || 'Açılan Doküman';
        await loadSvgStringToCanvas(canvas, res.content, true);
        setDocTitle(cleanName);
        onRefreshLayers();

        // Son dokümanlara ekle
        let preview = '';
        try {
          preview = canvas.toDataURL({ format: 'png', multiplier: 0.15 });
        } catch (e) {}

        const updated = addRecentDocument({
          name: cleanName,
          previewUrl: preview,
          svgContent: res.content,
          fabricJson: JSON.stringify(canvas.toJSON()),
          elementCount: canvas.getObjects().length,
        });
        setRecentDocs(updated);
        onShowToast(`"${res.fileName}" başarıyla açıldı`);
      }
    } catch (e) {
      console.error('Dosya açma hatası:', e);
    }
  };

  // Diske Kaydetme (File System Access API)
  const handleSaveFile = async () => {
    if (!canvas) return;
    setFileMenuOpen(false);
    try {
      const res = await exportSvg(canvas, `${docTitle}.svg`);
      if (res.success) {
        let preview = '';
        try {
          preview = canvas.toDataURL({ format: 'png', multiplier: 0.15 });
        } catch (e) {}

        const updated = addRecentDocument({
          name: docTitle,
          previewUrl: preview,
          svgContent: canvas.toSVG(),
          fabricJson: JSON.stringify(canvas.toJSON()),
          elementCount: canvas.getObjects().length,
        });
        setRecentDocs(updated);
        onShowToast(`"${res.fileName}" yerel diske kaydedildi`);
      }
    } catch (e) {
      console.error('Kaydetme hatası:', e);
    }
  };

  // Son Dokümanı Aç
  const handleOpenRecent = async (doc: RecentDoc) => {
    if (!canvas) return;
    setFileMenuOpen(false);
    try {
      if (doc.fabricJson) {
        await canvas.loadFromJSON(JSON.parse(doc.fabricJson));
        canvas.requestRenderAll();
      } else if (doc.svgContent) {
        await loadSvgStringToCanvas(canvas, doc.svgContent, true);
      }
      setDocTitle(doc.name);
      onRefreshLayers();
      onShowToast(`"${doc.name}" yüklendi`);
    } catch (e) {
      console.error('Son doküman açma hatası:', e);
    }
  };

  // Son Dokümanı Listeden Sil
  const handleDeleteRecent = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = deleteRecentDocument(id);
    setRecentDocs(updated);
  };

  // HTML / SVG Panoya Kopyala
  const handleCopySvgToHtml = async () => {
    if (!canvas) return;
    setFileMenuOpen(false);
    const res = await copySvgToClipboard(canvas);
    if (res.success) {
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 2500);
      onShowToast('SVG kodu panoya kopyalandı! (HTML veya editöre doğrudan yapıştırabilirsiniz)');
    }
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-3 sm:px-4 flex items-center justify-between gap-2 select-none z-30">
      {/* Sol: Logo + Başlık + Dosya Menüsü */}
      <div className="flex items-center gap-3">
        {/* Brand Icon & Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-700 to-blue-500 text-white flex items-center justify-center shadow-md shadow-blue-500/20 font-bold text-sm tracking-tight">
            V
          </div>
          <span className="font-bold text-slate-900 text-sm hidden md:inline tracking-tight">
            Vektor<span className="text-blue-600">Draw</span>
          </span>
        </div>

        {/* Dosya Menüsü Butonu & Açılır Menü */}
        <div className="relative" ref={fileMenuRef}>
          <button
            onClick={() => setFileMenuOpen(!fileMenuOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition"
          >
            <span>Dosya</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${fileMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {fileMenuOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-2 z-50 text-xs text-slate-700 animate-in fade-in zoom-in-95">
              {/* Temel Dosya İşlemleri */}
              <div className="px-2 pb-1.5 border-b border-slate-100 space-y-0.5">
                <button
                  onClick={handleNewCanvas}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-left transition"
                >
                  <FileText className="w-4 h-4 text-blue-600" />
                  <div className="flex-1">
                    <div className="font-medium text-slate-800">Yeni Çizim</div>
                    <div className="text-[10px] text-slate-400">Temiz çalışma alanı başlat</div>
                  </div>
                </button>

                <button
                  onClick={handleOpenFile}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-left transition"
                >
                  <FolderOpen className="w-4 h-4 text-emerald-600" />
                  <div className="flex-1">
                    <div className="font-medium text-slate-800">Dosya Aç...</div>
                    <div className="text-[10px] text-slate-400">File System Access API (SVG / JSON)</div>
                  </div>
                </button>

                <button
                  onClick={handleSaveFile}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-left transition"
                >
                  <Save className="w-4 h-4 text-blue-600" />
                  <div className="flex-1">
                    <div className="font-medium text-slate-800">Yerel Diske Kaydet</div>
                    <div className="text-[10px] text-slate-400">Proje dizinine .svg formatında kaydet</div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1 py-0.5 rounded">Ctrl+S</span>
                </button>
              </div>

              {/* Son Kaydedilen 5 Doküman */}
              <div className="px-3 py-2 border-b border-slate-100">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Son Dokümanlar (En Son 5)</span>
                  </div>
                  <span>{recentDocs.length}/5</span>
                </div>

                {recentDocs.length === 0 ? (
                  <div className="py-2 text-center text-slate-400 text-[11px]">
                    Henüz kaydedilen dosya yok
                  </div>
                ) : (
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {recentDocs.map((doc) => (
                      <div
                        key={doc.id}
                        onClick={() => handleOpenRecent(doc)}
                        className="group flex items-center justify-between p-1.5 rounded-lg hover:bg-blue-50/70 border border-transparent hover:border-blue-200 cursor-pointer transition text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {doc.previewUrl ? (
                            <img
                              src={doc.previewUrl}
                              alt={doc.name}
                              className="w-6 h-6 rounded border border-slate-200 object-cover bg-white shrink-0"
                            />
                          ) : (
                            <FileCode className="w-4 h-4 text-blue-500 shrink-0" />
                          )}
                          <div className="truncate">
                            <div className="font-medium text-slate-800 text-[11px] truncate">{doc.name}</div>
                            <div className="text-[9px] text-slate-400">
                              {new Date(doc.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {doc.elementCount || 0} nesne
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDeleteRecent(e, doc.id)}
                          title="Listeden Kaldır"
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 rounded transition"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dışa Aktarma Seçenekleri */}
              <div className="px-2 pt-1.5 space-y-0.5">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1">
                  Dışa Aktarma & Paylaşım
                </div>

                <button
                  onClick={handleCopySvgToHtml}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 text-blue-700 text-left transition font-medium"
                >
                  <Copy className="w-4 h-4 text-blue-600" />
                  <span className="flex-1">Copy to HTML (SVG Kodunu Kopyala)</span>
                  {copiedSuccess && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                </button>

                <button
                  onClick={() => canvas && exportSvg(canvas, `${docTitle}.svg`)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 text-left transition"
                >
                  <FileCode className="w-4 h-4 text-slate-500" />
                  <span>SVG Vektör İndir (.svg)</span>
                </button>

                <button
                  onClick={() => canvas && exportPng(canvas, `${docTitle}.png`, 2)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 text-left transition"
                >
                  <Image className="w-4 h-4 text-slate-500" />
                  <span>PNG Görsel İndir (2x Retina .png)</span>
                </button>

                <button
                  onClick={() => canvas && exportPdf(canvas, `${docTitle}.pdf`)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 text-left transition"
                >
                  <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                  <span>PDF Doküman İndir (.pdf)</span>
                </button>

                <button
                  onClick={() => canvas && exportJson(canvas, `${docTitle}.json`)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 text-left transition"
                >
                  <Download className="w-4 h-4 text-slate-500" />
                  <span>JSON Proje Verisi İndir (.json)</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Doküman Başlığı (Düzenlenebilir) */}
        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
          <input
            type="text"
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            className="text-xs sm:text-sm font-semibold text-slate-800 hover:bg-slate-100 focus:bg-white focus:ring-1 focus:ring-blue-500 px-2 py-1 rounded-md border border-transparent hover:border-slate-300 transition outline-none max-w-[130px] sm:max-w-[200px] truncate"
            title="Doküman Adını Düzenle"
          />
        </div>
      </div>

      {/* Orta: Geri Al / İleri Al & Otomatik Yedekleme Rozeti */}
      <div className="flex items-center gap-2">
        {/* Undo / Redo */}
        <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Geri Al (Ctrl+Z)"
            className="p-1.5 rounded-md hover:bg-white text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="İleri Al (Ctrl+Y)"
            className="p-1.5 rounded-md hover:bg-white text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Otomatik Yedekleme Rozeti */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-full text-[11px] text-slate-500">
          <span
            className={`w-2 h-2 rounded-full transition-colors ${
              backupState.status === 'saving'
                ? 'bg-amber-400 animate-pulse'
                : backupState.lastSavedAt
                ? 'bg-emerald-500'
                : 'bg-slate-300'
            }`}
          />
          <span>
            {backupState.status === 'saving'
              ? 'Yedekleniyor...'
              : backupState.lastSavedAt
              ? `Otomatik yedeklendi (${new Date(backupState.lastSavedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })})`
              : 'Otomatik yedekleme aktif'}
          </span>
        </div>
      </div>

      {/* Sağ: Yakınlaştırma + Grid + PWA + Kısayollar */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Izgara Modu Butonu */}
        <button
          onClick={() => {
            const nextMode: Record<GridMode, GridMode> = {
              dots: 'grid',
              grid: 'none',
              none: 'dots',
            };
            setGridMode(nextMode[gridMode]);
          }}
          title={`Izgara Şekli: ${
            gridMode === 'dots' ? 'Noktalı' : gridMode === 'grid' ? 'Çizgili' : 'Düz Beyaz'
          }`}
          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
        >
          <Grid className="w-4 h-4" />
        </button>

        {/* Yakınlaştırma Kontrolleri */}
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs text-slate-700 font-medium">
          <button
            onClick={() => onZoomChange(Math.max(0.2, zoom - 0.1))}
            title="Uzaklaştır"
            className="p-1 hover:bg-white rounded transition"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onResetZoom}
            title="%100 Sıfırla"
            className="px-1.5 py-0.5 hover:bg-white rounded transition font-mono text-[11px]"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => onZoomChange(Math.min(3, zoom + 0.1))}
            title="Yakınlaştır"
            className="p-1 hover:bg-white rounded transition"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Sığdır Butonu */}
        <button
          onClick={onFitToScreen}
          title="Tüm Çizimi Ekrana Sığdır"
          className="hidden sm:flex p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Panoya Kopyala Hızlı Buton */}
        <button
          onClick={handleCopySvgToHtml}
          title="SVG Kodunu HTML Olarak Kopyala"
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium text-xs transition"
        >
          {copiedSuccess ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-700">Kopyalandı!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy HTML</span>
            </>
          )}
        </button>

        {/* PWA Kur Butonu */}
        <PWAInstallButton />

        {/* Kısayollar Butonu */}
        <button
          onClick={onShowShortcuts}
          title="Klavye Kısayolları (?)"
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

    </header>
  );
};
