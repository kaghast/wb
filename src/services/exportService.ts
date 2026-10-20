import type * as fabric from 'fabric';
import { jsPDF } from 'jspdf';
import { embedStateInSvg, saveSvgToDisk } from './fileSystemService';

/**
 * SVG kodunu panoya kopyalar ("Copy to HTML / SVG" özelliği)
 */
export async function copySvgToClipboard(canvas: fabric.Canvas): Promise<{ success: boolean; svgText: string }> {
  try {
    const svgText = canvas.toSVG();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(svgText);
      return { success: true, svgText };
    } else {
      // Fallback kopyalama
      const textArea = document.createElement('textarea');
      textArea.value = svgText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return { success: true, svgText };
    }
  } catch (err) {
    console.error('Panoya kopyalama hatası:', err);
    return { success: false, svgText: '' };
  }
}

/**
 * SVG olarak yerel diske dışa aktarır (File System Access API ile)
 */
export async function exportSvg(
  canvas: fabric.Canvas,
  fileName: string
): Promise<{ success: boolean; fileName: string; method: string; canceled?: boolean }> {
  const rawSvg = canvas.toSVG();
  const fabricJson = JSON.stringify(canvas.toJSON());
  const finalSvg = embedStateInSvg(rawSvg, fabricJson);
  return await saveSvgToDisk(fileName, finalSvg);
}

/**
 * PNG olarak yüksek çözünürlüklü dışa aktarır (Varsayılan 2x Retina ölçeği)
 */
export function exportPng(canvas: fabric.Canvas, fileName: string, multiplier: number = 2): boolean {
  try {
    const dataUrl = canvas.toDataURL({
      format: 'png',
      multiplier,
      quality: 1
    });

    const safeName = fileName.replace(/\.[^/.]+$/, '') + '.png';
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = safeName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (err) {
    console.error('PNG dışa aktarma hatası:', err);
    return false;
  }
}

/**
 * PDF olarak dışa aktarır
 */
export function exportPdf(canvas: fabric.Canvas, fileName: string): boolean {
  try {
    const width = canvas.getWidth();
    const height = canvas.getHeight();
    const orientation = width >= height ? 'landscape' : 'portrait';

    // jsPDF örneği oluştur
    const pdf = new jsPDF({
      orientation,
      unit: 'pt',
      format: [width, height]
    });

    const imgData = canvas.toDataURL({
      format: 'png',
      multiplier: 2,
      quality: 1
    });

    pdf.addImage(imgData, 'PNG', 0, 0, width, height);
    const safeName = fileName.replace(/\.[^/.]+$/, '') + '.pdf';
    pdf.save(safeName);
    return true;
  } catch (err) {
    console.error('PDF dışa aktarma hatası:', err);
    return false;
  }
}

/**
 * JSON proje dosyası olarak dışa aktarır
 */
export function exportJson(canvas: fabric.Canvas, fileName: string): boolean {
  try {
    const jsonStr = JSON.stringify(canvas.toJSON(), null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const safeName = fileName.replace(/\.[^/.]+$/, '') + '.json';
    const link = document.createElement('a');
    link.href = url;
    link.download = safeName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('JSON dışa aktarma hatası:', err);
    return false;
  }
}
