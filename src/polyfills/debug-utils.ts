/**
 * Debug utilities for QuickJS polyfill testing
 */

export function createDebugLogger(context: string) {
  return {
    log: (message: string, ...args: any[]) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[${context}] ${message}`, ...args);
      }
    },
    warn: (message: string, ...args: any[]) => {
      console.warn(`[${context}] ${message}`, ...args);
    },
    error: (message: string, ...args: any[]) => {
      console.error(`[${context}] ${message}`, ...args);
    }
  };
}

export function debugPolyfillState(polyfillName: string, state: any) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Polyfill Debug] ${polyfillName}:`, state);
  }
}

export function debugWarn(message: string, ...args: any[]) {
  console.warn(`[Debug] ${message}`, ...args);
}

export function debugLog(message: string, ...args: any[]) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Debug] ${message}`, ...args);
  }
}

export function getSafeUserAgent(): string {
  try {
    return typeof globalThis !== 'undefined' && typeof (globalThis as any).navigator !== 'undefined' 
      ? (globalThis as any).navigator.userAgent 
      : 'Node.js';
  } catch {
    return 'Node.js';
  }
}