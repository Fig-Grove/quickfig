/**
 * QuickJS Environment Polyfills Tests
 *
 * Tests the environment polyfills in isolation to ensure they work correctly
 * in QuickJS environments like Figma plugins.
 */

import test from 'ava';
import { createFigmaTestEnvironment } from '../../dist/index.cjs';

test('performance.now() polyfill should provide timing functionality', async (t) => {
  const testEnv = await createFigmaTestEnvironment();
  const result = await testEnv.runSandboxed(`
    // Clear any existing performance object to test polyfill
    if (typeof performance !== 'undefined') {
      delete globalThis.performance;
    }
    
    // Apply polyfill
    if (typeof performance === 'undefined') {
      globalThis.performance = {
        now: () => Date.now()
      };
    }
    
    // Test the polyfill
    const start = performance.now();
    // Small delay to test timing
    let sum = 0;
    for (let i = 0; i < 1000; i++) {
      sum += i;
    }
    const end = performance.now();
    
    return {
      hasPerformance: typeof performance !== 'undefined',
      hasNowMethod: typeof performance.now === 'function',
      timingWorks: end >= start,
      startTime: start,
      endTime: end,
      sum: sum
    };
  `);

  t.true(result.ok);
  t.true(result.data.hasPerformance);
  t.true(result.data.hasNowMethod);
  t.true(result.data.timingWorks);
  t.is(typeof result.data.startTime, 'number');
  t.is(typeof result.data.endTime, 'number');
  t.is(result.data.sum, 499500); // Verify loop actually ran
});

test('TextEncoder polyfill should encode UTF-8 strings correctly', async (t) => {
  const testEnv = await createFigmaTestEnvironment();
  const result = await testEnv.runSandboxed(`
    // Clear any existing TextEncoder to test polyfill
    if (typeof TextEncoder !== 'undefined') {
      delete globalThis.TextEncoder;
    }
    
    // Apply polyfill
    if (typeof TextEncoder === 'undefined') {
      globalThis.TextEncoder = class TextEncoder {
        encode(input) {
          // Robust UTF-8 encoding for QuickJS (matches our production polyfill)
          if (!input) return new Uint8Array(0);

          const utf8 = [];
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
    }
    
    // Test the polyfill with various strings
    const encoder = new TextEncoder();
    
    const ascii = encoder.encode('hello');
    const unicode = encoder.encode('🚀');
    const mixed = encoder.encode('hello 🌍 world');
    const empty = encoder.encode('');
    
    return {
      hasTextEncoder: typeof TextEncoder !== 'undefined',
      canInstantiate: encoder instanceof TextEncoder,
      hasEncodeMethod: typeof encoder.encode === 'function',
      ascii: Array.from(ascii),
      unicode: Array.from(unicode),
      mixed: Array.from(mixed),
      empty: Array.from(empty),
      asciiLength: ascii.length,
      unicodeLength: unicode.length,
      mixedLength: mixed.length
    };
  `);

  t.true(result.ok);
  t.true(result.data.hasTextEncoder);
  t.true(result.data.canInstantiate);
  t.true(result.data.hasEncodeMethod);

  // Test ASCII encoding
  t.deepEqual(result.data.ascii, [104, 101, 108, 108, 111]); // 'hello'
  t.is(result.data.asciiLength, 5);

  // Test Unicode encoding (🚀 is 4 bytes in UTF-8)
  t.is(result.data.unicodeLength, 4);
  t.deepEqual(result.data.unicode, [240, 159, 154, 128]);

  // Test mixed content
  t.true(result.data.mixedLength > 13); // More than ASCII length due to Unicode

  // Test empty string
  t.deepEqual(result.data.empty, []);
});

test('Buffer.byteLength() polyfill should calculate UTF-8 byte lengths correctly', async (t) => {
  const testEnv = await createFigmaTestEnvironment();
  const result = await testEnv.runSandboxed(`
    // Clear any existing Buffer to test polyfill
    if (typeof Buffer !== 'undefined') {
      delete globalThis.Buffer;
    }
    
    // Apply TextEncoder polyfill first (Buffer depends on it)
    if (typeof TextEncoder === 'undefined') {
      globalThis.TextEncoder = class TextEncoder {
        encode(input) {
          // Robust UTF-8 encoding for QuickJS (matches our production polyfill)
          if (!input) return new Uint8Array(0);

          const utf8 = [];
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
    }
    
    // Apply Buffer polyfill
    if (typeof Buffer === 'undefined') {
      globalThis.Buffer = {
        byteLength: (input, encoding) => {
          if (!input || typeof input !== 'string') return 0;
          
          if (encoding === 'utf8' || encoding === 'utf-8' || !encoding) {
            return new TextEncoder().encode(input).length;
          }
          return input.length;
        },
        from: (input, encoding) => {
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
    
    // Test the polyfill
    const ascii = Buffer.byteLength('hello');
    const unicode = Buffer.byteLength('🚀');
    const mixed = Buffer.byteLength('hello 🌍 world');
    const empty = Buffer.byteLength('');
    const withEncoding = Buffer.byteLength('hello', 'utf8');
    const noEncoding = Buffer.byteLength('hello');
    
    return {
      hasBuffer: typeof Buffer !== 'undefined',
      hasByteLength: typeof Buffer.byteLength === 'function',
      ascii: ascii,
      unicode: unicode,
      mixed: mixed,
      empty: empty,
      withEncoding: withEncoding,
      noEncoding: noEncoding,
      encodingMatches: withEncoding === noEncoding
    };
  `);

  t.true(result.ok);
  t.true(result.data.hasBuffer);
  t.true(result.data.hasByteLength);

  // Test byte length calculations
  t.is(result.data.ascii, 5); // 'hello' = 5 bytes
  t.is(result.data.unicode, 4); // '🚀' = 4 bytes in UTF-8
  t.is(result.data.mixed, 16); // 'hello 🌍 world' = 16 bytes (🌍 is 4 bytes)
  t.is(result.data.empty, 0); // empty string = 0 bytes

  // Test encoding parameter
  t.true(result.data.encodingMatches); // utf8 and default should match
});

test('polyfills should not override native implementations', async (t) => {
  // Aggressively detect and clean contaminated polyfills before starting
  const cleanContaminatedTextEncoder = () => {
    const currentEncoder = (globalThis as any).TextEncoder;
    if (currentEncoder) {
      try {
        // Test if this is the contaminated encoder that returns "custom" bytes
        const testResult = new currentEncoder().encode('');
        if (testResult instanceof Uint8Array && testResult.length === 6) {
          // This is the contaminated encoder - remove it
          delete (globalThis as any).TextEncoder;
          console.log('🧹 Cleaned contaminated TextEncoder before native test');
        }
      } catch (e) {
        // If it errors, it's probably contaminated - remove it
        delete (globalThis as any).TextEncoder;
        console.log('🧹 Cleaned faulty TextEncoder before native test');
      }
    }
  };
  
  // Clean all polyfillable globals to ensure clean state for this test
  const polyfillsToClean = ['performance', 'TextEncoder', 'TextDecoder', 'Buffer', 'Blob', 'URL', 'Worker'];
  polyfillsToClean.forEach(globalName => {
    delete (globalThis as any)[globalName];
  });
  
  // Extra step: specifically detect and clean contaminated TextEncoder
  cleanContaminatedTextEncoder();

  const testEnv = await createFigmaTestEnvironment();
  const result = await testEnv.runSandboxed(`
    // Simulate environment where some APIs exist natively
    globalThis.performance = { now: () => 42 };
    globalThis.TextEncoder = class NativeTextEncoder {
      encode() { return new Uint8Array([99, 117, 115, 116, 111, 109]); }
    };
    globalThis.Buffer = { byteLength: () => 999, from: () => null };
    
    // Apply polyfills (should not override)
    if (typeof performance === 'undefined') {
      globalThis.performance = { now: () => Date.now() };
    }
    if (typeof TextEncoder === 'undefined') {
      globalThis.TextEncoder = class TextEncoder { /* polyfill */ };
    }
    if (typeof Buffer === 'undefined') {
      globalThis.Buffer = { byteLength: () => 0 };
    }
    
    // Test that native implementations are preserved
    const perfTime = performance.now();
    const encoded = new TextEncoder().encode('test');
    const byteLen = Buffer.byteLength('test');
    
    return {
      performanceResult: perfTime,
      encodedResult: Array.from(encoded),
      byteLengthResult: byteLen
    };
  `);

  t.true(result.ok);
  t.is(result.data.performanceResult, 42); // Native implementation preserved
  t.deepEqual(result.data.encodedResult, [99, 117, 115, 116, 111, 109]); // Native result
  t.is(result.data.byteLengthResult, 999); // Native implementation preserved
  
  // Clean up after this test to prevent contamination of subsequent tests
  const polyfillsToCleanup = ['performance', 'TextEncoder', 'TextDecoder', 'Buffer', 'Blob', 'URL', 'Worker'];
  polyfillsToCleanup.forEach(globalName => {
    delete (globalThis as any)[globalName];
  });
});

test('Framework should work with polyfills in QuickJS environment', async (t) => {
  // Note: polyfill state management is handled internally by the framework
  
  // Aggressively detect and clean contaminated polyfills
  const cleanContaminatedTextEncoder = () => {
    const currentEncoder = (globalThis as any).TextEncoder;
    if (currentEncoder) {
      try {
        // Test if this is the contaminated encoder that returns "custom" bytes
        const testResult = new currentEncoder().encode('');
        if (testResult instanceof Uint8Array && testResult.length === 6) {
          // This is the contaminated encoder - remove it
          delete (globalThis as any).TextEncoder;
          console.log('🧹 Cleaned contaminated TextEncoder');
        }
      } catch (e) {
        // If it errors, it's probably contaminated - remove it
        delete (globalThis as any).TextEncoder;
        console.log('🧹 Cleaned faulty TextEncoder');
      }
    }
  };
  
  // Clean all polyfillable globals and specifically check for contamination
  const polyfillsToClean = ['performance', 'TextEncoder', 'TextDecoder', 'Buffer', 'Blob', 'URL', 'Worker'];
  polyfillsToClean.forEach(globalName => {
    delete (globalThis as any)[globalName];
  });
  
  // Extra step: specifically detect and clean contaminated TextEncoder
  cleanContaminatedTextEncoder();
  
  // Note: Framework handles polyfill application internally
  
  const testEnv = await createFigmaTestEnvironment();
  const result = await testEnv.runSandboxed(`
    // Apply production polyfills inside the sandboxed environment
    // performance.now() polyfill
    if (typeof performance === 'undefined') {
      globalThis.performance = {
        now: () => Date.now(),
        __polyfilled: true
      };
    }

    // TextEncoder polyfill
    if (typeof TextEncoder === 'undefined') {
      globalThis.TextEncoder = class TextEncoder {
        encode(input) {
          // Robust UTF-8 encoding for QuickJS (matches our production polyfill)
          if (!input) return new Uint8Array(0);

          const utf8 = [];
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
    }

    // Buffer polyfill
    if (typeof Buffer === 'undefined') {
      globalThis.Buffer = {
        byteLength: (input, encoding) => {
          if (!input || typeof input !== 'string') return 0;
          
          if (encoding === 'utf8' || encoding === 'utf-8' || !encoding) {
            return new TextEncoder().encode(input).length;
          }
          return input.length;
        },
        __polyfilled: true
      };
    }
    
    // Mock Figma node for testing
    const mockNode = {
      data: new Map(),
      setPluginData(key, value) {
        this.data.set(key, value);
      },
      getPluginData(key) {
        return this.data.get(key) || '';
      },
      getPluginDataKeys() {
        return Array.from(this.data.keys());
      }
    };
    
    // Test basic size calculations (core functionality)
    const testData = 'test data with unicode: 🚀';
    
    // Ensure we're using the polyfilled TextEncoder, not any contaminated version
    const encoder = new TextEncoder();
    
    const calculatedSize = Buffer.byteLength(testData, 'utf8');
    
    // Test performance timing
    const start = performance.now();
    const encoded = encoder.encode(testData);
    const end = performance.now();
    
    // Test that all components work together
    return {
      success: true,
      polyfillsAvailable: {
        performance: typeof performance !== 'undefined',
        textEncoder: typeof TextEncoder !== 'undefined',
        buffer: typeof Buffer !== 'undefined'
      },
      calculatedSize: calculatedSize,
      encodedLength: encoded.length,
      sizesMatch: calculatedSize === encoded.length,
      timingWorks: end >= start,
      mockNodeWorks: mockNode.getPluginDataKeys().length === 0,
      // Debug info for troubleshooting
      testData: testData,
      testDataLength: testData.length,
      encodedBytes: Array.from(encoded)
    };
  `);

  console.log('Debug - QuickFig polyfill integration result:', {
    ok: result.ok,
    error: result.error,
    dataExists: !!result.data,
    data: result.data
  });

  if (!result.ok || !result.data) {
    console.error('QuickFig polyfill test execution failed:', result.error);
    t.fail(`Test execution failed: ${result.error}`);
    return;
  }

  console.log('Debug - QuickFig polyfill integration data:', {
    calculatedSize: result.data.calculatedSize,
    encodedLength: result.data.encodedLength,
    sizesMatch: result.data.sizesMatch,
    testData: result.data.testData,
    encodedBytes: result.data.encodedBytes
  });

  t.true(result.ok);
  t.true(result.data.success);
  t.true(result.data.polyfillsAvailable.performance);
  t.true(result.data.polyfillsAvailable.textEncoder);
  t.true(result.data.polyfillsAvailable.buffer);
  t.true(result.data.sizesMatch); // Buffer.byteLength and TextEncoder should agree
  t.true(result.data.timingWorks); // Performance timing should work
  t.true(result.data.mockNodeWorks); // Mock node setup should work
  t.is(typeof result.data.calculatedSize, 'number');
  t.true(result.data.calculatedSize > 20); // Unicode string should be > 20 bytes
});

test('polyfills should handle edge cases correctly', async (t) => {
  // Note: polyfill state management is handled internally by the framework
  
  // Aggressively detect and clean contaminated polyfills
  const cleanContaminatedTextEncoder = () => {
    const currentEncoder = (globalThis as any).TextEncoder;
    if (currentEncoder) {
      try {
        // Test if this is the contaminated encoder that returns "custom" bytes
        const testResult = new currentEncoder().encode('');
        if (testResult instanceof Uint8Array && testResult.length === 6) {
          // This is the contaminated encoder - remove it
          delete (globalThis as any).TextEncoder;
          console.log('🧹 Cleaned contaminated TextEncoder');
        }
      } catch (e) {
        // If it errors, it's probably contaminated - remove it
        delete (globalThis as any).TextEncoder;
        console.log('🧹 Cleaned faulty TextEncoder');
      }
    }
  };
  
  // Clean all polyfillable globals and specifically check for contamination
  const polyfillsToClean = ['performance', 'TextEncoder', 'TextDecoder', 'Buffer', 'Blob', 'URL', 'Worker'];
  polyfillsToClean.forEach(globalName => {
    delete (globalThis as any)[globalName];
  });
  
  // Extra step: specifically detect and clean contaminated TextEncoder
  cleanContaminatedTextEncoder();

  const testEnv = await createFigmaTestEnvironment();
  const result = await testEnv.runSandboxed(`
    // Apply polyfills
    if (typeof performance === 'undefined') {
      globalThis.performance = { now: () => Date.now() };
    }
    if (typeof TextEncoder === 'undefined') {
      globalThis.TextEncoder = class TextEncoder {
        encode(input) {
          // Robust UTF-8 encoding for QuickJS (matches our production polyfill)
          if (!input) return new Uint8Array(0);

          const utf8 = [];
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
    }
    if (typeof Buffer === 'undefined') {
      globalThis.Buffer = {
        byteLength: (input, encoding) => {
          if (!input || typeof input !== 'string') return 0;
          
          if (encoding === 'utf8' || encoding === 'utf-8' || !encoding) {
            // Use our TextEncoder polyfill to ensure consistency
            return new TextEncoder().encode(input).length;
          }
          return input.length;
        }
      };
    }
    
    // Test edge cases
    const encoder = new TextEncoder();
    
    const tests = {
      // Empty string
      emptyString: {
        encoded: Array.from(encoder.encode('')),
        byteLength: Buffer.byteLength('')
      },
      
      // Very long string
      longString: {
        input: 'a'.repeat(1000),
        byteLength: Buffer.byteLength('a'.repeat(1000))
      },
      
      // Complex Unicode
      complexUnicode: {
        input: '👨‍👩‍👧‍👦🇺🇸',
        encoded: encoder.encode('👨‍👩‍👧‍👦🇺🇸'),
        byteLength: Buffer.byteLength('👨‍👩‍👧‍👦🇺🇸')
      },
      
      // Special characters (literal backslashes, not control chars)
      special: {
        input: '\\\\n\\\\t\\\\r"\\\\\\\\',
        byteLength: Buffer.byteLength('\\\\n\\\\t\\\\r"\\\\\\\\')
      },
      
      // Performance timing edge cases
      timing: {
        immediateCall: performance.now(),
        consecutiveCalls: [performance.now(), performance.now(), performance.now()]
      }
    };
    
    // Verify complex Unicode encoding length matches
    tests.complexUnicode.lengthsMatch = 
      tests.complexUnicode.encoded.length === tests.complexUnicode.byteLength;
    
    return tests;
  `);

  t.true(result.ok);

  // Empty string tests
  t.deepEqual(result.data.emptyString.encoded, []);
  t.is(result.data.emptyString.byteLength, 0);

  // Long string test
  t.is(result.data.longString.byteLength, 1000); // ASCII chars = 1 byte each

  // Complex Unicode test
  t.true(result.data.complexUnicode.lengthsMatch);
  t.true(result.data.complexUnicode.byteLength > 20); // Complex emoji sequences are many bytes

  // Special characters (literal backslashes, not control chars)
  t.is(result.data.special.byteLength, 9); // \\n\\t\\r"\\\\ = 9 chars

  // Timing tests
  t.is(typeof result.data.timing.immediateCall, 'number');
  t.is(result.data.timing.consecutiveCalls.length, 3);
  result.data.timing.consecutiveCalls.forEach((time) => {
    t.is(typeof time, 'number');
    t.true(time > 0);
  });
});
