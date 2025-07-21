/**
 * Core Polyfills for QuickJS Compatibility
 *
 * Provides minimal polyfills for essential APIs that are not available
 * in Figma's QuickJS runtime environment. Enhanced with comprehensive
 * error boundaries and type safety.
 */

// Conditional diagnostic imports for better tree-shaking
// Types are imported dynamically when needed to avoid heavy dependencies
import { debugWarn, getSafeUserAgent } from "./debug-utils.js";
import { initializeWorkerConstraint } from "./worker-constraint.js";
import { executeWithErrorBoundarySynchronous } from "./polyfill-error-boundaries.js";
import type { PolyfillOperationContext } from "./polyfill-types.js";

/**
 * Apply core environment polyfills conditionally
 * This function is idempotent and safe to call multiple times
 */
export function applyCorePolyfills(): void {
  // Get constraint detector for enhanced polyfill behavior
  const constraintDetector = (globalThis as any).__figmaConstraintDetector;

  // performance.now() polyfill
  if (typeof performance === "undefined") {
    const perfPolyfill = {
      now: () => Date.now(),
      __polyfilled: true,
    };

    (globalThis as any).performance = perfPolyfill;

    if (constraintDetector) {
      constraintDetector.checkOperation({
        type: "api",
        api: "performance",
      });
    }
  }

  // TextEncoder polyfill with diagnostic framework
  if (typeof TextEncoder === "undefined") {
    (globalThis as any).TextEncoder = class TextEncoder {
      constructor() {
        // Explicit constructor required for 'new TextEncoder()' calls in QuickJS
      }

      encode(input: string): Uint8Array {
        // Create operation context for diagnostic tracking and error boundaries
        const context: PolyfillOperationContext = {
          api: "TextEncoder",
          operation: "encode",
          dataSize: input ? input.length : 0,
          timestamp: Date.now(),
          userAgent: getSafeUserAgent(),
          attemptCount: 1,
          sessionId: "", // Will be set by diagnostic engine
          codeLocation: {
            function: "TextEncoder.encode",
          },
        };

        // Execute with error boundary protection (synchronous)
        return executeWithErrorBoundarySynchronous(
          () => {
            // Get diagnostic engine for enhanced error handling (conditionally loaded)
            let diagnosticEngine: any = null;
            try {
              diagnosticEngine = (globalThis as any).__polyfillDiagnosticEngine;
              if (diagnosticEngine) {
                diagnosticEngine.trackUsagePattern("TextEncoder", context);
              }
            } catch (error) {
              // Diagnostic engine not available
            }

            // Check constraints for large strings
            if (input && input.length > 100 * 1024) {
              let shouldThrow = false;
              let errorMessage = "Data too large for TextEncoder";

              const currentConstraintDetector = (globalThis as any)
                .__figmaConstraintDetector;
              if (currentConstraintDetector) {
                const result = currentConstraintDetector.checkOperation({
                  type: "data",
                  data: input,
                });

                if (!result.allowed) {
                  shouldThrow = true;
                  errorMessage =
                    result.violations[0]?.message || "Data too large";
                }
              }

              if (shouldThrow) {
                if (diagnosticEngine) {
                  // Generate comprehensive diagnostic error
                  const diagnosticInfo = diagnosticEngine.generateEnhancedError(
                    "TextEncoder",
                    "encode",
                    errorMessage,
                    context,
                  );
                  const error = new Error(diagnosticInfo.message);
                  (error as any).diagnostic = diagnosticInfo;
                  throw error;
                } else {
                  throw new Error(`TextEncoder: ${errorMessage}`);
                }
              }
            }

            // Robust UTF-8 encoding for QuickJS
            return this.performTextEncoding(input);
          },
          context,
          // Fallback function for error recovery
          () => {
            // Minimal fallback - ASCII-only encoding
            if (!input) return new Uint8Array(0);
            const bytes: number[] = [];
            for (let i = 0; i < input.length; i++) {
              const code = input.charCodeAt(i);
              bytes.push(code < 128 ? code : 63); // '?' for non-ASCII
            }
            return new Uint8Array(bytes);
          },
        );
      }

      // Extracted encoding logic for budget management
      performTextEncoding(input: string): Uint8Array {
        if (!input) return new Uint8Array(0);

        const utf8: number[] = [];
        for (let i = 0; i < input.length; i++) {
          const charCode = input.charCodeAt(i);

          if (charCode < 0x80) {
            // ASCII: 0xxxxxxx
            utf8.push(charCode);
          } else if (charCode < 0x800) {
            // 2-byte: 110xxxxx 10xxxxxx
            utf8.push(0xc0 | (charCode >> 6));
            utf8.push(0x80 | (charCode & 0x3f));
          } else if ((charCode & 0xfc00) === 0xd800 && i + 1 < input.length) {
            // High surrogate: handle surrogate pair
            const highSurrogate = charCode;
            const lowSurrogate = input.charCodeAt(++i);

            if ((lowSurrogate & 0xfc00) === 0xdc00) {
              // Valid surrogate pair
              const codePoint =
                0x10000 +
                (((highSurrogate & 0x3ff) << 10) | (lowSurrogate & 0x3ff));
              // 4-byte: 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
              utf8.push(0xf0 | (codePoint >> 18));
              utf8.push(0x80 | ((codePoint >> 12) & 0x3f));
              utf8.push(0x80 | ((codePoint >> 6) & 0x3f));
              utf8.push(0x80 | (codePoint & 0x3f));
            } else {
              // Invalid low surrogate - use replacement character
              utf8.push(0xef, 0xbf, 0xbd);
              i--; // Back up to process low surrogate properly
            }
          } else if ((charCode & 0xfc00) === 0xdc00) {
            // Invalid low surrogate without high surrogate
            utf8.push(0xef, 0xbf, 0xbd);
          } else {
            // 3-byte: 1110xxxx 10xxxxxx 10xxxxxx
            utf8.push(0xe0 | (charCode >> 12));
            utf8.push(0x80 | ((charCode >> 6) & 0x3f));
            utf8.push(0x80 | (charCode & 0x3f));
          }
        }

        return new Uint8Array(utf8);
      }
    };

    // Mark as polyfilled
    (globalThis as any).TextEncoder.__polyfilled = true;

    if (constraintDetector) {
      constraintDetector.checkOperation({
        type: "api",
        api: "TextEncoder",
      });
    }
  }

  // TextDecoder polyfill with diagnostic framework
  if (typeof TextDecoder === "undefined") {
    (globalThis as any).TextDecoder = class TextDecoder {
      private _encoding: string;
      private _fatal: boolean;
      private _ignoreBOM: boolean;
      private _buffer: number[]; // Buffer for streaming decode

      constructor(
        encoding: string = "utf-8",
        options: { fatal?: boolean; ignoreBOM?: boolean } = {},
      ) {
        // Normalize encoding name
        this._encoding = encoding.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (this._encoding !== "utf8" && this._encoding !== "utf8") {
          // For now, only support UTF-8
          this._encoding = "utf8";
        }

        this._fatal = options.fatal || false;
        this._ignoreBOM = options.ignoreBOM !== false; // Default true
        this._buffer = [];
      }

      get encoding(): string {
        return "utf-8";
      }

      get fatal(): boolean {
        return this._fatal;
      }

      get ignoreBOM(): boolean {
        return this._ignoreBOM;
      }

      decode(
        input?: ArrayBufferView | ArrayBuffer,
        options: { stream?: boolean } = {},
      ): string {
        // Create operation context for diagnostic tracking
        const context: PolyfillOperationContext = {
          api: "TextDecoder",
          operation: "decode",
          dataSize: input
            ? (input as any).byteLength || (input as any).length || 0
            : 0,
          timestamp: Date.now(),
          userAgent: getSafeUserAgent(),
          attemptCount: 1,
          sessionId: "",
          codeLocation: {
            function: "TextDecoder.decode",
          },
        };

        // Execute with error boundary protection
        return executeWithErrorBoundarySynchronous(
          () => {
            // Get diagnostic engine for enhanced error handling
            let diagnosticEngine: any = null;
            try {
              diagnosticEngine = (globalThis as any).__polyfillDiagnosticEngine;
              if (diagnosticEngine) {
                diagnosticEngine.trackUsagePattern("TextDecoder", context);
              }
            } catch (error) {
              // Diagnostic engine not available
            }

            // Handle null/undefined input
            if (!input) {
              return "";
            }

            // Convert input to Uint8Array
            let bytes: Uint8Array;
            if (input instanceof Uint8Array) {
              bytes = input;
            } else if (input instanceof ArrayBuffer) {
              bytes = new Uint8Array(input);
            } else if (ArrayBuffer.isView(input)) {
              bytes = new Uint8Array(
                input.buffer,
                input.byteOffset,
                input.byteLength,
              );
            } else {
              if (this._fatal) {
                throw new TypeError("Failed to decode: invalid input type");
              }
              return "";
            }

            // Check constraints for large data
            if (bytes.length > 100 * 1024) {
              const currentConstraintDetector = (globalThis as any)
                .__figmaConstraintDetector;
              if (currentConstraintDetector) {
                const result = currentConstraintDetector.checkOperation({
                  type: "data",
                  size: bytes.length,
                });

                if (!result.allowed) {
                  if (this._fatal) {
                    const errorMessage =
                      result.violations[0]?.message || "Data too large";
                    throw new Error(`TextDecoder: ${errorMessage}`);
                  } else {
                    debugWarn(
                      `TextDecoder: ${result.violations[0]?.message || "Large data warning"}`,
                    );
                  }
                }
              }
            }

            // Combine with buffered bytes for streaming
            let allBytes: number[];
            if (this._buffer.length > 0) {
              allBytes = [...this._buffer, ...bytes];
              this._buffer = [];
            } else {
              allBytes = Array.from(bytes);
            }

            // Handle BOM
            if (this._ignoreBOM && allBytes.length >= 3) {
              if (
                allBytes[0] === 0xef &&
                allBytes[1] === 0xbb &&
                allBytes[2] === 0xbf
              ) {
                allBytes = allBytes.slice(3);
              }
            }

            // Decode UTF-8
            return this.performTextDecoding(allBytes, options.stream || false);
          },
          context,
          // Fallback function for error recovery
          () => {
            // Minimal fallback - return empty string
            return "";
          },
        );
      }

      // Extracted decoding logic
      private performTextDecoding(
        bytes: number[],
        isStreaming: boolean,
      ): string {
        let result = "";
        let i = 0;

        while (i < bytes.length) {
          const byte1 = bytes[i];

          if (byte1 < 0x80) {
            // ASCII character (0xxxxxxx)
            result += String.fromCharCode(byte1);
            i++;
          } else if ((byte1 & 0xe0) === 0xc0) {
            // 2-byte sequence (110xxxxx 10xxxxxx)
            if (i + 1 >= bytes.length) {
              if (isStreaming) {
                // Buffer incomplete sequence for next decode
                this._buffer = bytes.slice(i);
                break;
              } else {
                if (this._fatal) {
                  throw new Error(
                    "Invalid UTF-8 sequence: incomplete 2-byte sequence",
                  );
                }
                result += "\uFFFD"; // Replacement character
                i++;
              }
            } else {
              const byte2 = bytes[i + 1];
              if ((byte2 & 0xc0) !== 0x80) {
                // Invalid continuation byte
                if (this._fatal) {
                  throw new Error(
                    "Invalid UTF-8 sequence: invalid continuation byte",
                  );
                }
                result += "\uFFFD";
                i++;
              } else {
                // Valid 2-byte sequence
                const codePoint = ((byte1 & 0x1f) << 6) | (byte2 & 0x3f);
                // Check for overlong encoding
                if (codePoint < 0x80) {
                  if (this._fatal) {
                    throw new Error(
                      "Invalid UTF-8 sequence: overlong 2-byte sequence",
                    );
                  }
                  result += "\uFFFD";
                } else {
                  result += String.fromCharCode(codePoint);
                }
                i += 2;
              }
            }
          } else if ((byte1 & 0xf0) === 0xe0) {
            // 3-byte sequence (1110xxxx 10xxxxxx 10xxxxxx)
            if (i + 2 >= bytes.length) {
              if (isStreaming) {
                this._buffer = bytes.slice(i);
                break;
              } else {
                if (this._fatal) {
                  throw new Error(
                    "Invalid UTF-8 sequence: incomplete 3-byte sequence",
                  );
                }
                result += "\uFFFD";
                i++;
              }
            } else {
              const byte2 = bytes[i + 1];
              const byte3 = bytes[i + 2];
              if ((byte2 & 0xc0) !== 0x80 || (byte3 & 0xc0) !== 0x80) {
                if (this._fatal) {
                  throw new Error(
                    "Invalid UTF-8 sequence: invalid continuation byte",
                  );
                }
                result += "\uFFFD";
                i++;
              } else {
                const codePoint =
                  ((byte1 & 0x0f) << 12) |
                  ((byte2 & 0x3f) << 6) |
                  (byte3 & 0x3f);
                // Check for overlong encoding
                if (codePoint < 0x800) {
                  if (this._fatal) {
                    throw new Error(
                      "Invalid UTF-8 sequence: overlong 3-byte sequence",
                    );
                  }
                  result += "\uFFFD";
                } else if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
                  // Surrogate code points are invalid in UTF-8
                  if (this._fatal) {
                    throw new Error(
                      "Invalid UTF-8 sequence: surrogate code point",
                    );
                  }
                  result += "\uFFFD";
                } else {
                  result += String.fromCharCode(codePoint);
                }
                i += 3;
              }
            }
          } else if ((byte1 & 0xf8) === 0xf0) {
            // 4-byte sequence (11110xxx 10xxxxxx 10xxxxxx 10xxxxxx)
            if (i + 3 >= bytes.length) {
              if (isStreaming) {
                this._buffer = bytes.slice(i);
                break;
              } else {
                if (this._fatal) {
                  throw new Error(
                    "Invalid UTF-8 sequence: incomplete 4-byte sequence",
                  );
                }
                result += "\uFFFD";
                i++;
              }
            } else {
              const byte2 = bytes[i + 1];
              const byte3 = bytes[i + 2];
              const byte4 = bytes[i + 3];
              if (
                (byte2 & 0xc0) !== 0x80 ||
                (byte3 & 0xc0) !== 0x80 ||
                (byte4 & 0xc0) !== 0x80
              ) {
                if (this._fatal) {
                  throw new Error(
                    "Invalid UTF-8 sequence: invalid continuation byte",
                  );
                }
                result += "\uFFFD";
                i++;
              } else {
                const codePoint =
                  ((byte1 & 0x07) << 18) |
                  ((byte2 & 0x3f) << 12) |
                  ((byte3 & 0x3f) << 6) |
                  (byte4 & 0x3f);

                // Check for overlong encoding
                if (codePoint < 0x10000) {
                  if (this._fatal) {
                    throw new Error(
                      "Invalid UTF-8 sequence: overlong 4-byte sequence",
                    );
                  }
                  result += "\uFFFD";
                } else if (codePoint > 0x10ffff) {
                  // Code point out of Unicode range
                  if (this._fatal) {
                    throw new Error(
                      "Invalid UTF-8 sequence: code point out of range",
                    );
                  }
                  result += "\uFFFD";
                } else {
                  // Convert to UTF-16 surrogate pair
                  const adjusted = codePoint - 0x10000;
                  const high = 0xd800 + (adjusted >> 10);
                  const low = 0xdc00 + (adjusted & 0x3ff);
                  result += String.fromCharCode(high, low);
                }
                i += 4;
              }
            }
          } else {
            // Invalid start byte
            if (this._fatal) {
              throw new Error(
                `Invalid UTF-8 sequence: invalid start byte 0x${byte1.toString(16)}`,
              );
            }
            result += "\uFFFD";
            i++;
          }
        }

        return result;
      }
    };

    // Mark as polyfilled
    (globalThis as any).TextDecoder.__polyfilled = true;

    if (constraintDetector) {
      constraintDetector.checkOperation({
        type: "api",
        api: "TextDecoder",
      });
    }
  }

  // Buffer polyfill for QuickJS environments
  if (typeof (globalThis as any).Buffer === "undefined") {
    (globalThis as any).Buffer = {
      byteLength(str: string, encoding?: string): number {
        const context: PolyfillOperationContext = {
          api: "Buffer",
          operation: "byteLength",
          dataSize: str ? str.length : 0,
          timestamp: Date.now(),
          userAgent: getSafeUserAgent(),
          attemptCount: 1,
          sessionId: "",
          codeLocation: {
            function: "Buffer.byteLength",
          },
        };

        // Execute with error boundary protection (synchronous)
        return executeWithErrorBoundarySynchronous(
          () => {
            // Get diagnostic engine (conditionally loaded)
            let diagnosticEngine: any = null;
            try {
              diagnosticEngine = (globalThis as any).__polyfillDiagnosticEngine;
              if (diagnosticEngine) {
                diagnosticEngine.trackUsagePattern("Buffer", context);
              }
            } catch (error) {
              // Continue without diagnostic engine
            }

            // Check constraints for large strings
            if (str && str.length > 100 * 1024) {
              let warningMessage = "Large string in Buffer.byteLength";

              const currentConstraintDetector = (globalThis as any)
                .__figmaConstraintDetector;
              if (currentConstraintDetector) {
                const result = currentConstraintDetector.checkOperation({
                  type: "data",
                  data: str,
                });

                if (result.violations.length > 0) {
                  warningMessage = result.violations[0].message;
                }
              }

              if (diagnosticEngine) {
                const diagnosticInfo = diagnosticEngine.generateEnhancedError(
                  "Buffer",
                  "byteLength",
                  warningMessage,
                  context,
                );
                debugWarn(diagnosticInfo.message);
              } else {
                debugWarn(`Buffer.byteLength: ${warningMessage}`);
              }
            }

            // Simple UTF-8 byte length calculation
            if (!str) return 0;
            if (encoding && encoding.toLowerCase() === "ascii") {
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
                // High surrogate, check for valid pair
                const lowSurrogate = str.charCodeAt(i + 1);
                if ((lowSurrogate & 0xfc00) === 0xdc00) {
                  // Valid surrogate pair
                  byteCount += 4;
                  i++; // Skip low surrogate
                } else {
                  // Invalid pair, use replacement
                  byteCount += 3;
                }
              } else {
                byteCount += 3;
              }
            }
            return byteCount;
          },
          context,
          // Fallback function for error recovery
          () => {
            // Fast approximation fallback
            if (!str) return 0;
            if (encoding && encoding.toLowerCase() === "ascii") {
              return str.length;
            }
            // Rough UTF-8 estimate
            return Math.ceil(str.length * 1.5);
          },
        );
      },

      from(arrayLike: any, _encoding?: string): Uint8Array {
        // Track Buffer.from usage for diagnostics
        const context: PolyfillOperationContext = {
          api: "Buffer",
          operation: "from",
          dataSize:
            typeof arrayLike === "string"
              ? arrayLike.length
              : Array.isArray(arrayLike)
                ? arrayLike.length
                : 0,
          timestamp: Date.now(),
          userAgent: getSafeUserAgent(),
          attemptCount: 1,
          sessionId: "",
          codeLocation: {
            function: "Buffer.from",
          },
        };

        // Get diagnostic engine for tracking
        try {
          const diagnosticEngine = (globalThis as any)
            .__polyfillDiagnosticEngine;
          if (diagnosticEngine) {
            diagnosticEngine.trackUsagePattern("Buffer", context);
          }
        } catch (error) {
          // Continue without diagnostic engine
        }

        if (typeof arrayLike === "string") {
          // Convert string to Uint8Array using TextEncoder
          const encoder = new (globalThis as any).TextEncoder();
          return encoder.encode(arrayLike);
        }
        if (Array.isArray(arrayLike)) {
          return new Uint8Array(arrayLike);
        }
        if (arrayLike instanceof ArrayBuffer) {
          return new Uint8Array(arrayLike);
        }
        return new Uint8Array(0);
      },

      __polyfilled: true,
    };

    if (constraintDetector) {
      constraintDetector.checkOperation({
        type: "api",
        api: "Buffer",
      });
    }
  }

  // Set polyfill for QuickJS environments (needed by fflate compression)
  if (typeof Set === "undefined") {
    (globalThis as any).Set = class Set {
      constructor(iterable?: any) {
        this._values = [];
        if (iterable) {
          for (const value of iterable) {
            this.add(value);
          }
        }
      }

      add(value: any): this {
        if (!this.has(value)) {
          this._values.push(value);
        }
        return this;
      }

      has(value: any): boolean {
        return this._values.indexOf(value) !== -1;
      }

      delete(value: any): boolean {
        const index = this._values.indexOf(value);
        if (index !== -1) {
          this._values.splice(index, 1);
          return true;
        }
        return false;
      }

      clear(): void {
        this._values = [];
      }

      get size(): number {
        return this._values.length;
      }

      *[Symbol.iterator]() {
        for (const value of this._values) {
          yield value;
        }
      }

      forEach(callback: (value: any, value2: any, set: any) => void): void {
        for (const value of this._values) {
          callback(value, value, this);
        }
      }

      private _values: any[];
    };

    if (constraintDetector) {
      constraintDetector.checkOperation({
        type: "api",
        api: "Set",
      });
    }
  }

  // Map polyfill for QuickJS environments (needed by fflate compression)
  if (typeof Map === "undefined") {
    (globalThis as any).Map = class Map {
      constructor(iterable?: any) {
        this._keys = [];
        this._values = [];
        if (iterable) {
          for (const [key, value] of iterable) {
            this.set(key, value);
          }
        }
      }

      set(key: any, value: any): this {
        const index = this._keys.indexOf(key);
        if (index !== -1) {
          this._values[index] = value;
        } else {
          this._keys.push(key);
          this._values.push(value);
        }
        return this;
      }

      get(key: any): any {
        const index = this._keys.indexOf(key);
        return index !== -1 ? this._values[index] : undefined;
      }

      has(key: any): boolean {
        return this._keys.indexOf(key) !== -1;
      }

      delete(key: any): boolean {
        const index = this._keys.indexOf(key);
        if (index !== -1) {
          this._keys.splice(index, 1);
          this._values.splice(index, 1);
          return true;
        }
        return false;
      }

      clear(): void {
        this._keys = [];
        this._values = [];
      }

      get size(): number {
        return this._keys.length;
      }

      *[Symbol.iterator]() {
        for (let i = 0; i < this._keys.length; i++) {
          yield [this._keys[i], this._values[i]];
        }
      }

      forEach(callback: (value: any, key: any, map: any) => void): void {
        for (let i = 0; i < this._keys.length; i++) {
          callback(this._values[i], this._keys[i], this);
        }
      }

      private _keys: any[];
      private _values: any[];
    };

    if (constraintDetector) {
      constraintDetector.checkOperation({
        type: "api",
        api: "Map",
      });
    }
  }

  // Blob polyfill for QuickJS environments (needed by fflate compression)
  if (typeof Blob === "undefined") {
    (globalThis as any).Blob = class Blob {
      constructor(parts?: any[], options?: { type?: string }) {
        // Minimal Blob implementation for QuickJS
        this.size = 0;
        this.type = options?.type || "";

        if (parts) {
          for (const part of parts) {
            if (typeof part === "string") {
              this.size += part.length;
            } else if (part && typeof part.length === "number") {
              this.size += part.length;
            }
          }
        }

        // Check constraints for large blobs
        if (constraintDetector && this.size > 100 * 1024) {
          const result = constraintDetector.checkOperation({
            type: "data",
            size: this.size,
          });

          if (!result.allowed) {
            // Warn about large blob but continue processing
            debugWarn(
              `Blob: ${result.violations[0]?.message || "Large blob created"}`,
            );
          }
        }
      }

      size: number;
      type: string;
    };

    if (constraintDetector) {
      constraintDetector.checkOperation({
        type: "api",
        api: "Blob",
      });
    }
  }

  // URL polyfill for QuickJS environments (needed by fflate compression)
  if (typeof URL === "undefined") {
    (globalThis as any).URL = class URL {
      constructor(url: string, _base?: string) {
        this.href = url;
      }

      href: string;

      static createObjectURL(_object: any): string {
        // Return a fake object URL that won't be used in QuickJS
        if (constraintDetector) {
          constraintDetector.checkOperation({
            type: "api",
            api: "URL.createObjectURL",
          });
        }
        return "blob:fake-url-for-quickjs";
      }

      static revokeObjectURL(_url: string): void {
        // No-op for QuickJS compatibility
        if (constraintDetector) {
          constraintDetector.checkOperation({
            type: "api",
            api: "URL.revokeObjectURL",
          });
        }
      }
    };

    if (constraintDetector) {
      constraintDetector.checkOperation({
        type: "api",
        api: "URL",
      });
    }
  }

  // Initialize constraint-aware Worker architecture
  initializeWorkerConstraint();
}

/**
 * Mark polyfills for detection
 */
export function markCorePolyfills(): void {
  if (
    (globalThis as any).performance &&
    !(globalThis as any).performance.now.toString().includes("[native code]")
  ) {
    (globalThis as any).performance.__polyfilled = true;
  }
  if (
    (globalThis as any).TextEncoder &&
    !(globalThis as any).TextEncoder.toString().includes("[native code]")
  ) {
    (globalThis as any).TextEncoder.__polyfilled = true;
  }
  if (
    (globalThis as any).TextDecoder &&
    !(globalThis as any).TextDecoder.toString().includes("[native code]")
  ) {
    (globalThis as any).TextDecoder.__polyfilled = true;
  }
  if (
    (globalThis as any).Buffer &&
    typeof (globalThis as any).Buffer.byteLength === "function"
  ) {
    (globalThis as any).Buffer.__polyfilled = true;
  }
}

/**
 * Get information about which polyfills were applied
 */
export function getAppliedPolyfills(): {
  performance: boolean;
  textEncoder: boolean;
  textDecoder: boolean;
  buffer: boolean;
} {
  return {
    performance: !!(globalThis as any).performance?.__polyfilled,
    textEncoder: !!(globalThis as any).TextEncoder?.__polyfilled,
    textDecoder: !!(globalThis as any).TextDecoder?.__polyfilled,
    buffer: !!(globalThis as any).Buffer?.__polyfilled,
  };
}

/**
 * Check if we're running in a QuickJS-like environment
 */
export function isQuickJSEnvironment(): boolean {
  // Check for missing standard APIs that would indicate QuickJS
  return (
    typeof performance === "undefined" ||
    typeof TextEncoder === "undefined" ||
    typeof TextDecoder === "undefined" ||
    typeof (globalThis as any).Buffer === "undefined"
  );
}
