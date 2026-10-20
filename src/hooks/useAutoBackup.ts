import { useState, useEffect, useRef, useCallback } from 'react';
import type * as fabric from 'fabric';
import type { AutoBackupState } from '../types';

const BACKUP_STORAGE_KEY = 'vektordraw_auto_backup_v1';

export function useAutoBackup(canvas: fabric.Canvas | null, docTitle: string) {
  const [backupState, setBackupState] = useState<AutoBackupState>({
    lastSavedAt: null,
    status: 'idle',
  });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const saveBackup = useCallback(() => {
    if (!canvas) return;

    try {
      setBackupState((prev) => ({ ...prev, status: 'saving' }));
      const json = JSON.stringify(canvas.toJSON());
      let previewUrl = '';
      try {
        previewUrl = canvas.toDataURL({
          format: 'png',
          multiplier: 0.15,
          quality: 0.5,
        });
      } catch (e) {
        // DataURL ignore error
      }

      const backupPayload = {
        title: docTitle,
        json,
        previewUrl,
        timestamp: Date.now(),
      };

      localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(backupPayload));

      setBackupState({
        lastSavedAt: Date.now(),
        status: 'saved',
      });
    } catch (err) {
      console.warn('Otomatik yedekleme hatası:', err);
      setBackupState((prev) => ({ ...prev, status: 'idle' }));
    }
  }, [canvas, docTitle]);

  const scheduleBackup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      saveBackup();
    }, 800);
  }, [saveBackup]);

  // Canvas olaylarını dinle
  useEffect(() => {
    if (!canvas) return;

    const handleChange = () => {
      scheduleBackup();
    };

    canvas.on('object:modified', handleChange);
    canvas.on('object:added', handleChange);
    canvas.on('object:removed', handleChange);
    canvas.on('path:created', handleChange);

    return () => {
      canvas.off('object:modified', handleChange);
      canvas.off('object:added', handleChange);
      canvas.off('object:removed', handleChange);
      canvas.off('path:created', handleChange);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [canvas, scheduleBackup]);

  const getSavedBackup = useCallback((): { title: string; json: string; timestamp: number } | null => {
    try {
      const stored = localStorage.getItem(BACKUP_STORAGE_KEY);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch (e) {
      return null;
    }
  }, []);

  return {
    backupState,
    saveBackupNow: saveBackup,
    getSavedBackup,
  };
}
