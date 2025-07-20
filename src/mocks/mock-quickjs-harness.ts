// Mock QuickJS environment for testing QuickFig performance characteristics
// This simulates Figma plugin constraints without actual QuickJS VM

// Import polyfills to ensure QuickJS-compatible environment (commented due to path issues)
// import '../../../src/utils/environment-polyfills.ts';

// Store safe timing reference that won't be affected by global cleanup
const safePerformanceNow = (() => {
  // Try performance.now() first (most accurate)
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now.bind(performance);
  }
  // Fallback to Date.now()
  return Date.now;
})();

export interface MockSandboxConfig {
  executionTimeout: number;
  memoryLimit: number;
  maxStackSize: number;
  env: Record<string, string>;
}

export const FIGMA_SANDBOX_CONFIG: MockSandboxConfig = {
  executionTimeout: 50, // 50ms UI blocking threshold
  memoryLimit: 100 * 1024 * 1024, // 100MB per plugin operation
  maxStackSize: 1024 * 1024, // 1MB stack limit
  env: {
    NODE_ENV: 'figma-plugin-test',
    FIGMA_PLUGIN_SIMULATION: 'true',
  },
};

export interface MockSandboxResult<T = any> {
  ok: boolean;
  data: T;
  error?: string;
  executionTime: number;
}

export class MockQuickJSEnvironment {
  private config: MockSandboxConfig;

  constructor(config: MockSandboxConfig) {
    this.config = config;
  }

  async runSandboxed<T = any>(code: string): Promise<MockSandboxResult<T>> {
    const start = safePerformanceNow();

    try {
      // Simulate QuickJS constraints
      if (code.length > this.config.memoryLimit / 1000) {
        throw new Error('Code exceeds memory limit');
      }

      // Execute the code with timeout simulation
      const result = await this.executeWithTimeout(
        code,
        this.config.executionTimeout
      );
      const executionTime = safePerformanceNow() - start;

      // Simulate UI blocking check
      if (executionTime > this.config.executionTimeout) {
        console.warn(
          `[QuickJS]: Operation took ${executionTime}ms, exceeds UI threshold`
        );
      }

      return {
        ok: true,
        data: result as T,
        executionTime,
      };
    } catch (error) {
      const executionTime = safePerformanceNow() - start;
      return {
        ok: false,
        data: null as T,
        error: error instanceof Error ? error.message : String(error),
        executionTime,
      };
    }
  }

  private async executeWithTimeout<T>(
    code: string,
    timeoutMs: number
  ): Promise<T> {
    try {
      // Mock Figma environment constraints (APIs not available in QuickJS)
      const mockGlobals = {
        CompressionStream: undefined,
        DecompressionStream: undefined,
        fetch: undefined,
        XMLHttpRequest: undefined,
        WebAssembly: undefined,
      };

      // Create execution context with mocked globals and polyfills
      // Polyfills are now applied within the contextCode itself
      
      // Determine if this is a simple expression or complex code
      // Check if this is an IIFE (immediately invoked function expression)
      const isIIFE = code.trim().match(/^\([\s\S]*\)\(\)$/); // ES2016 compatible multiline
      const isSimpleExpression = (!code.includes(';') && !code.includes('{') && !code.includes('class') && !code.includes('function') && !code.trim().includes('\n')) || isIIFE;
      
      let contextCode;
      if (isSimpleExpression) {
        // Simple expression - wrap in return
        contextCode = `
          // Apply polyfills - always override to ensure clean state
          // Clear any potentially contaminated globals first
          delete globalThis.performance;
          delete globalThis.TextEncoder;
          delete globalThis.Buffer;
          
          // Apply fresh polyfills
          if (typeof performance === 'undefined') {
            performance = {
              now: () => Date.now(),
              __polyfilled: true
            };
          }
          if (typeof TextEncoder === 'undefined') {
            TextEncoder = class TextEncoder {
              encode(input) {
                if (!input) return new Uint8Array(0);
                
                const utf8 = [];
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
          if (typeof Buffer === 'undefined') {
            Buffer = {
              byteLength: function(str, encoding) {
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
              },
              
              from: function(input, encoding) {
                if (typeof input === 'string') {
                  if (encoding === 'utf8' || encoding === 'utf-8' || !encoding) {
                    return new TextEncoder().encode(input);
                  }
                  const result = new Uint8Array(input.length);
                  for (let i = 0; i < input.length; i++) {
                    result[i] = (input.charCodeAt(i) || 0) & 0xFF;
                  }
                  return result;
                }
                if (input instanceof Uint8Array) return input;
                if (Array.isArray(input)) return new Uint8Array(input);
                if (input instanceof ArrayBuffer) return new Uint8Array(input);
                return new Uint8Array(0);
              }
            };
          }
          
          // User code - simple expression
          return (${code});
        `;
      } else {
        // Complex code - execute as-is and look for return value
        contextCode = `
          // Apply polyfills - always override to ensure clean state
          // Clear any potentially contaminated globals first
          delete globalThis.performance;
          delete globalThis.TextEncoder;
          delete globalThis.Buffer;
          
          // Apply fresh polyfills
          if (typeof performance === 'undefined') {
            performance = {
              now: () => Date.now(),
              __polyfilled: true
            };
          }
          if (typeof TextEncoder === 'undefined') {
            TextEncoder = class TextEncoder {
              encode(input) {
                if (!input) return new Uint8Array(0);
                
                const utf8 = [];
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
          if (typeof Buffer === 'undefined') {
            Buffer = {
              byteLength: function(str, encoding) {
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
              },
              
              from: function(input, encoding) {
                if (typeof input === 'string') {
                  if (encoding === 'utf8' || encoding === 'utf-8' || !encoding) {
                    return new TextEncoder().encode(input);
                  }
                  const result = new Uint8Array(input.length);
                  for (let i = 0; i < input.length; i++) {
                    result[i] = (input.charCodeAt(i) || 0) & 0xFF;
                  }
                  return result;
                }
                if (input instanceof Uint8Array) return input;
                if (Array.isArray(input)) return new Uint8Array(input);
                if (input instanceof ArrayBuffer) return new Uint8Array(input);
                return new Uint8Array(0);
              }
            };
          }
          
          // User code - complex statements
          ${code}
        `;
      }

      // Execute the function - polyfills are now applied within the contextCode
      const func = new Function(contextCode);
      
      const result = func.call({});
      
      return result;
    } catch (error) {
      throw new Error(
        `QuickJS execution error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export async function createFigmaTestEnvironment() {
  const mockEnv = new MockQuickJSEnvironment(FIGMA_SANDBOX_CONFIG);
  return {
    runSandboxed: (code: string | (() => any)) => {
      // Handle function inputs by converting to string
      if (typeof code === 'function') {
        // Convert function to string, wrapping in parentheses and calling it
        const funcStr = `(${code.toString()})()`;
        return mockEnv.runSandboxed(funcStr);
      }
      return mockEnv.runSandboxed(code);
    },
    config: FIGMA_SANDBOX_CONFIG,
  };
}
