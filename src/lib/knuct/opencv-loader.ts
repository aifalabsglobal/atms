'use client';

/**
 * Loads vendor OpenCV.js on mobile browsers only (per Knuct readme.txt).
 * Sets window.opencv = { ready: true } when loaded.
 */
import { isMobileDevice } from './device';

declare global {
  interface Window {
    cv?: {
      imread: (img: HTMLImageElement) => { data: Uint8Array; delete: () => void };
    };
    opencv?: { ready: boolean };
  }
}

const OPENCV_SRC = '/opencv.js';
const LOAD_TIMEOUT_MS = 120_000;

let loadPromise: Promise<void> | null = null;

export function isOpenCvReady(): boolean {
  return typeof window !== 'undefined' && !!window.cv?.imread;
}

export function ensureOpenCvReady(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('OpenCV loader requires a browser environment'));
  }
  if (!isMobileDevice()) {
    return Promise.resolve();
  }
  if (isOpenCvReady()) {
    window.opencv = { ready: true };
    return Promise.resolve();
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${OPENCV_SRC}"]`) as HTMLScriptElement | null;
    if (existing) {
      const onReady = () => {
        window.opencv = { ready: true };
        resolve();
      };
      if (isOpenCvReady()) {
        onReady();
        return;
      }
      existing.addEventListener('load', onReady, { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load OpenCV.js')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = OPENCV_SRC;
    const timer = setTimeout(() => {
      reject(new Error('OpenCV.js load timed out'));
    }, LOAD_TIMEOUT_MS);

    script.onload = () => {
      clearTimeout(timer);
      window.opencv = { ready: true };
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Failed to load OpenCV.js'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
