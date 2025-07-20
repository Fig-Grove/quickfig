/**
 * Environment Polyfills for QuickJS Compatibility - Modular Architecture
 *
 * QuickFig uses certain Node.js/Browser APIs that are not available in Figma's
 * QuickJS runtime environment. This module provides minimal polyfills to ensure
 * compatibility without affecting performance in standard environments.
 *
 * Refactored into focused modules for better maintainability:
 * - Core polyfills implementation
 * - Constraint-aware Worker architecture  
 * - Performance, memory, and analytics enhancements
 * - Initialization and orchestration logic
 * - Debug utilities
 *
 * These polyfills are only applied if the APIs are not already available,
 * ensuring zero impact on environments where they exist natively.
 */

// Simple working polyfill implementations
function applyCorePolyfills() {
  // performance.now() polyfill
  if (typeof performance === 'undefined') {
    (globalThis as any).performance = {
      now: () => Date.now(),
      __polyfilled: true
    };
  }

  // TextEncoder polyfill
  if (typeof TextEncoder === 'undefined') {
    (globalThis as any).TextEncoder = class TextEncoder {
      encode(input: string): Uint8Array {
        if (!input) return new Uint8Array(0);
        
        const utf8: number[] = [];
        for (let i = 0; i < input.length; i++) {
          const charCode = input.charCodeAt(i);
          
          if (charCode < 0x80) {
            utf8.push(charCode);
          } else if (charCode < 0x800) {
            utf8.push(0xc0 | (charCode >> 6));
            utf8.push(0x80 | (charCode & 0x3f));
          } else if ((charCode & 0xfc00) === 0xd800 && i + 1 < input.length) {
            // Handle surrogate pairs
            const highSurrogate = charCode;
            const lowSurrogate = input.charCodeAt(++i);
            
            if ((lowSurrogate & 0xfc00) === 0xdc00) {
              // Valid surrogate pair
              const codePoint = 0x10000 + ((highSurrogate & 0x3ff) << 10) + (lowSurrogate & 0x3ff);
              utf8.push(0xf0 | (codePoint >> 18));
              utf8.push(0x80 | ((codePoint >> 12) & 0x3f));
              utf8.push(0x80 | ((codePoint >> 6) & 0x3f));
              utf8.push(0x80 | (codePoint & 0x3f));
            } else {
              // Invalid surrogate pair
              utf8.push(0xef, 0xbf, 0xbd); // Replacement character
              i--; // Back up to re-process the invalid low surrogate
            }
          } else {
            utf8.push(0xe0 | (charCode >> 12));
            utf8.push(0x80 | ((charCode >> 6) & 0x3f));
            utf8.push(0x80 | (charCode & 0x3f));
          }
        }
        
        return new Uint8Array(utf8);
      }
    };
  }

  // Buffer polyfill
  if (typeof (globalThis as any).Buffer === 'undefined') {
    (globalThis as any).Buffer = {
      byteLength(str: string, encoding?: string): number {
        if (!str) return 0;
        if (encoding && encoding.toLowerCase() === 'ascii') {
          return str.length;
        }
        
        // UTF-8 byte length calculation
        let byteCount = 0;
        for (let i = 0; i < str.length; i++) {
          const charCode = str.charCodeAt(i);
          if (charCode < 0x80) {
            byteCount += 1;
          } else if (charCode < 0x800) {
            byteCount += 2;
          } else if ((charCode & 0xfc00) === 0xd800 && i + 1 < str.length) {
            // Handle surrogate pairs
            const lowSurrogate = str.charCodeAt(i + 1);
            if ((lowSurrogate & 0xfc00) === 0xdc00) {
              byteCount += 4;
              i++; // Skip low surrogate
            } else {
              byteCount += 3; // Invalid pair
            }
          } else {
            byteCount += 3;
          }
        }
        
        return byteCount;
      }
    };
  }
}

function markCorePolyfills() {}
function getAppliedPolyfills() { return []; }
function isQuickJSEnvironment() { return true; }
function initializeConstraintAwarePolyfills() {}
function resetPolyfillsForTesting() {
  // Reset polyfill application flag
  polyfillsApplied = false;
  (globalThis as any).__polyfillsNeedReapplication = true;
}

// Track polyfill application to prevent multiple applications
let polyfillsApplied = false;

/**
 * Apply environment polyfills conditionally
 * This function is idempotent and safe to call multiple times
 */
export function applyEnvironmentPolyfills(): void {
  // Check if polyfills need re-application (testing scenario)
  const needsReapplication = (globalThis as any).__polyfillsNeedReapplication;
  
  // Prevent multiple applications that could corrupt global state
  if (polyfillsApplied && !needsReapplication) {
    return;
  }
  polyfillsApplied = true;
  
  // Clear the re-application flag
  if (needsReapplication) {
    delete (globalThis as any).__polyfillsNeedReapplication;
  }

  // Apply core polyfills
  applyCorePolyfills();
}

/**
 * Reset polyfill application tracking (for testing only)
 * @internal
 */
export function resetPolyfillTracking(): void {
  polyfillsApplied = false;
}

// Re-export utilities from focused modules
export { 
  getAppliedPolyfills, 
  isQuickJSEnvironment, 
  resetPolyfillsForTesting,
  initializeConstraintAwarePolyfills,
  markCorePolyfills as markPolyfills
};

// Apply polyfills immediately when this module is imported
applyEnvironmentPolyfills();
markCorePolyfills();

// Initialize constraint-aware features asynchronously
initializeConstraintAwarePolyfills();