import type { RecentDoc } from '../types';

const RECENT_DOCS_KEY = 'vektordraw_recent_documents_v1';
const MAX_RECENT_DOCS = 5;

/**
 * Fabric JSON durumunu SVG içine gömer (Tekrar açıldığında %100 kusursuz düzenlenebilirlik sağlar)
 */
export function embedStateInSvg(svgString: string, fabricJson: string): string {
  const metadataTag = `  <metadata id="vektordraw-state"><![CDATA[${fabricJson}]]></metadata>\n`;
  const insertIdx = svgString.indexOf('>');
  if (insertIdx !== -1) {
    return svgString.slice(0, insertIdx + 1) + '\n' + metadataTag + svgString.slice(insertIdx + 1);
  }
  return svgString;
}

/**
 * SVG içerisinden gömülü Fabric JSON durumunu ayıklar
 */
export function extractStateFromSvg(svgString: string): { fabricJson: string | null; isGenericSvg: boolean } {
  const regex = /<metadata id="vektordraw-state"><!\[CDATA\[([\s\S]*?)\]\]><\/metadata>/;
  const match = svgString.match(regex);
  if (match && match[1]) {
    try {
      // JSON doğrula
      JSON.parse(match[1]);
      return { fabricJson: match[1], isGenericSvg: false };
    } catch (e) {
      console.warn('Gömülü metadata ayrıştırılamadı:', e);
    }
  }
  return { fabricJson: null, isGenericSvg: true };
}

/**
 * File System Access API kullanarak dosyayı yerel diske kaydeder (Gerekirse tarayıcı indirmesine fallback yapar)
 */
export async function saveSvgToDisk(
  fileName: string,
  svgContent: string
): Promise<{ success: boolean; fileName: string; method: 'native' | 'fallback'; canceled?: boolean }> {
  const safeName = fileName.endsWith('.svg') ? fileName : `${fileName}.svg`;

  // 1. File System Access API destekleniyorsa
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: safeName,
        types: [
          {
            description: 'SVG Vektör Grafiği',
            accept: {
              'image/svg+xml': ['.svg']
            }
          }
        ]
      });

      const writable = await handle.createWritable();
      await writable.write(svgContent);
      await writable.close();

      return { success: true, fileName: handle.name || safeName, method: 'native' };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, fileName: safeName, method: 'native', canceled: true };
      }
      console.warn('File System Access API hatası, fallback indirmeye geçiliyor:', err);
    }
  }

  // 2. Klasik Blob indirme fallback'i
  try {
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = safeName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return { success: true, fileName: safeName, method: 'fallback' };
  } catch (err) {
    console.error('Dosya kaydetme hatası:', err);
    return { success: false, fileName: safeName, method: 'fallback' };
  }
}

/**
 * File System Access API ile yerel diskten SVG veya JSON dosyası açar
 */
export async function openSvgFromDisk(): Promise<{
  success: boolean;
  content?: string;
  fileName?: string;
  canceled?: boolean;
}> {
  // 1. File System Access API
  if ('showOpenFilePicker' in window) {
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: 'Vektör & Diagram Dosyaları (*.svg, *.json)',
            accept: {
              'image/svg+xml': ['.svg'],
              'application/json': ['.json']
            }
          }
        ],
        multiple: false
      });

      const file = await handle.getFile();
      const content = await file.text();
      return { success: true, content, fileName: file.name };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, canceled: true };
      }
      console.warn('File System Access open hatası, fallback input açılıyor:', err);
    }
  }

  // 2. Hidden input fallback
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.svg,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve({ success: false, canceled: true });
        return;
      }
      const content = await file.text();
      resolve({ success: true, content, fileName: file.name });
    };
    input.click();
  });
}

/**
 * Son açılan / kaydedilen 5 dokümanı getirir
 */
export function getRecentDocuments(): RecentDoc[] {
  try {
    const data = localStorage.getItem(RECENT_DOCS_KEY);
    if (!data) return [];
    return JSON.parse(data) as RecentDoc[];
  } catch (e) {
    console.error('Son dokümanlar okunamadı:', e);
    return [];
  }
}

/**
 * Dokümanı son 5 listesine kaydeder (en başa ekler, maksimum 5 adet saklar)
 */
export function addRecentDocument(doc: Omit<RecentDoc, 'id' | 'updatedAt'> & { id?: string }): RecentDoc[] {
  try {
    const existing = getRecentDocuments();
    const id = doc.id || `doc_${Date.now()}`;
    const newDoc: RecentDoc = {
      ...doc,
      id,
      updatedAt: Date.now()
    };

    // Aynı ada veya id'ye sahip olanı çıkart
    const filtered = existing.filter((item) => item.name !== doc.name && item.id !== id);
    const updated = [newDoc, ...filtered].slice(0, MAX_RECENT_DOCS);

    localStorage.setItem(RECENT_DOCS_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn('Son doküman kaydedilemedi (kotayı aşmış olabilir):', e);
    return getRecentDocuments();
  }
}

/**
 * Son doküman listesinden bir öğeyi siler
 */
export function deleteRecentDocument(id: string): RecentDoc[] {
  try {
    const existing = getRecentDocuments();
    const updated = existing.filter((item) => item.id !== id);
    localStorage.setItem(RECENT_DOCS_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Doküman silinemedi:', e);
    return getRecentDocuments();
  }
}
