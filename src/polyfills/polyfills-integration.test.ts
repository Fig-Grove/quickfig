/**
 * QuickFig Polyfills Integration Tests
 *
 * Tests that our actual polyfill module works correctly and integrates
 * properly with the QuickFig library in QuickJS environments.
 */

import test from "ava";
import { createFigmaTestEnvironment } from "../mocks/mock-quickjs-harness.ts";

// Note: We can't directly import our polyfills in QuickJS sandbox,
// so we'll inline the polyfill code for testing

const POLYFILL_CODE = `
// QuickFig Environment Polyfills (copy of actual implementation)
function applyEnvironmentPolyfills() {
  // performance.now() polyfill
  if (typeof performance === 'undefined') {
    globalThis.performance = {
      now: () => Date.now()
    };
  }
  
  // TextEncoder polyfill
  if (typeof TextEncoder === 'undefined') {
    globalThis.TextEncoder = class TextEncoder {
      encode(input) {
        const utf8 = unescape(encodeURIComponent(input));
        const result = new Uint8Array(utf8.length);
        for (let i = 0; i < utf8.length; i++) {
          result[i] = utf8.charCodeAt(i) || 0;
        }
        return result;
      }
    };
    
    globalThis.TextDecoder = class TextDecoder {
      decode(input) {
        let result = '';
        for (let i = 0; i < input.length; i++) {
          result += String.fromCharCode(input[i]);
        }
        return decodeURIComponent(escape(result));
      }
    };
  }
  
  // Buffer polyfill
  if (typeof Buffer === 'undefined') {
    globalThis.Buffer = {
      byteLength: (input, encoding) => {
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
}

function isQuickJSEnvironment() {
  return (
    typeof performance === 'undefined' ||
    typeof TextEncoder === 'undefined' ||
    typeof Buffer === 'undefined'
  );
}

// Apply polyfills immediately
applyEnvironmentPolyfills();
`;

test("QuickFig polyfills should be automatically applied when imported", async (t) => {
  const testEnv = await createFigmaTestEnvironment();
  const result = await testEnv.runSandboxed(`
    ${POLYFILL_CODE}
    
    // Verify all APIs are now available
    return {
      hasPerformance: typeof performance !== 'undefined',
      hasTextEncoder: typeof TextEncoder !== 'undefined',
      hasBuffer: typeof Buffer !== 'undefined',
      performanceHasNow: typeof performance.now === 'function',
      textEncoderWorks: new TextEncoder().encode('test').length > 0,
      bufferWorks: Buffer.byteLength('test') > 0
    };
  `);

  t.true(result.ok);
  t.true(result.data.hasPerformance);
  t.true(result.data.hasTextEncoder);
  t.true(result.data.hasBuffer);
  t.true(result.data.performanceHasNow);
  t.true(result.data.textEncoderWorks);
  t.true(result.data.bufferWorks);
});

test("polyfills should work with QuickFig core functionality", async (t) => {
  const testEnv = await createFigmaTestEnvironment();
  const result = await testEnv.runSandboxed(`
    ${POLYFILL_CODE}
    
    // Mock simplified version of QuickFig's SizeCalculator
    class SizeCalculator {
      calculateSize(data) {
        if (data === null || data === undefined) {
          throw new Error('Invalid input: data must not be null or undefined');
        }
        
        if (typeof data !== 'string') {
          throw new Error('Invalid input: data must be a string');
        }
        
        // Use Buffer.byteLength for accurate UTF-8 byte calculation
        return Buffer.byteLength(data, 'utf8');
      }
      
      calculateTotalSize(key, value) {
        return this.calculateSize(key) + this.calculateSize(value);
      }
      
      exceedsDirectLimit(size) {
        return size > (95 * 1024); // 95KB
      }
    }
    
    // Mock simplified version of QuickFig's timing functionality
    class PerformanceTracker {
      createTimer() {
        const start = performance.now();
        return {
          elapsed: () => performance.now() - start,
          stop: () => performance.now() - start
        };
      }
    }
    
    // Test the functionality
    const calculator = new SizeCalculator();
    const tracker = new PerformanceTracker();
    
    const testData = 'Hello, World! 🌍';
    const size = calculator.calculateSize(testData);
    const totalSize = calculator.calculateTotalSize('key', testData);
    const exceedsLimit = calculator.exceedsDirectLimit(size);
    
    const timer = tracker.createTimer();
    // Simulate some work
    let sum = 0;
    for (let i = 0; i < 1000; i++) {
      sum += i;
    }
    const elapsed = timer.elapsed();
    
    return {
      size: size,
      totalSize: totalSize,
      exceedsLimit: exceedsLimit,
      elapsed: elapsed,
      timerWorks: elapsed >= 0,
      sum: sum,
      utf8SizeCorrect: size > 15 // Unicode should make it larger than ASCII length
    };
  `);

  t.true(result.ok);
  t.is(typeof result.data.size, "number");
  t.true(result.data.size > 15); // UTF-8 size should be larger than ASCII
  t.true(result.data.utf8SizeCorrect);
  t.true(result.data.totalSize > result.data.size); // Total should include key
  t.false(result.data.exceedsLimit); // Small string shouldn't exceed limit
  t.true(result.data.timerWorks);
  t.true(result.data.elapsed >= 0);
  t.is(result.data.sum, 499500); // Verify loop ran correctly
});

test("polyfills should handle QuickFig boundary conditions correctly", async (t) => {
  const testEnv = await createFigmaTestEnvironment();
  const result = await testEnv.runSandboxed(`
    ${POLYFILL_CODE}
    
    // Test boundary conditions that QuickFig cares about
    const tests = [
      // ASCII string at 95KB boundary
      {
        name: '95KB ASCII',
        data: 'a'.repeat(95 * 1024),
        expected: 95 * 1024
      },
      
      // Unicode string that might be tricky
      {
        name: 'Unicode mixed',
        data: 'Hello 🌍 World 🚀 Test',
        expected: Buffer.byteLength('Hello 🌍 World 🚀 Test', 'utf8')
      },
      
      // Empty string edge case
      {
        name: 'Empty string',
        data: '',
        expected: 0
      },
      
      // Large Unicode string
      {
        name: 'Large Unicode',
        data: '🚀'.repeat(1000), // Each emoji is 4 bytes
        expected: 4000
      }
    ];
    
    const results = tests.map(test => {
      const calculated = Buffer.byteLength(test.data, 'utf8');
      const encoded = new TextEncoder().encode(test.data);
      
      return {
        name: test.name,
        calculated: calculated,
        expected: test.expected,
        encodedLength: encoded.length,
        matches: calculated === test.expected,
        bufferEncoderMatch: calculated === encoded.length
      };
    });
    
    // Test performance timing under load
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      Buffer.byteLength('test data ' + i, 'utf8');
    }
    const end = performance.now();
    
    return {
      results: results,
      performanceTest: {
        duration: end - start,
        reasonable: (end - start) < 100 // Should be fast
      }
    };
  `);

  t.true(result.ok);

  // Check each boundary test
  result.data.results.forEach((testResult) => {
    t.true(
      testResult.matches,
      `${testResult.name} size calculation should match expected`,
    );
    t.true(
      testResult.bufferEncoderMatch,
      `${testResult.name} Buffer and TextEncoder should agree`,
    );
  });

  // Check specific expected values
  const results = result.data.results;
  const emptyResult = results.find((r) => r.name === "Empty string");
  const asciiResult = results.find((r) => r.name === "95KB ASCII");
  const unicodeResult = results.find((r) => r.name === "Large Unicode");

  t.is(emptyResult.calculated, 0);
  t.is(asciiResult.calculated, 95 * 1024);
  t.is(unicodeResult.calculated, 4000);

  // Performance should be reasonable
  t.true(result.data.performanceTest.reasonable);
});

test("polyfills should work with JSON serialization (common in QuickFig)", async (t) => {
  const testEnv = await createFigmaTestEnvironment();
  const result = await testEnv.runSandboxed(`
    ${POLYFILL_CODE}
    
    // Test JSON serialization/deserialization with UTF-8 calculation
    const testObjects = [
      { name: 'simple', data: { hello: 'world' } },
      { name: 'unicode', data: { emoji: '🚀', text: 'Hello 🌍' } },
      { name: 'nested', data: { 
          user: { name: 'Alice', age: 30 }, 
          items: ['🍎', '🍌', '🍊'] 
        }
      },
      { name: 'large', data: { 
          items: Array.from({length: 100}, (_, i) => ({ id: i, name: \`Item \${i}\` }))
        }
      }
    ];
    
    const results = testObjects.map(test => {
      const jsonString = JSON.stringify(test.data);
      const byteLength = Buffer.byteLength(jsonString, 'utf8');
      const encoded = new TextEncoder().encode(jsonString);
      
      // Test round-trip
      const parsed = JSON.parse(jsonString);
      const roundTripWorks = JSON.stringify(parsed) === jsonString;
      
      return {
        name: test.name,
        jsonLength: jsonString.length,
        byteLength: byteLength,
        encodedLength: encoded.length,
        sizesMatch: byteLength === encoded.length,
        roundTripWorks: roundTripWorks,
        hasUnicode: byteLength > jsonString.length
      };
    });
    
    // Test that timing works during JSON operations
    const start = performance.now();
    const largeJson = JSON.stringify({ data: 'x'.repeat(10000) });
    const parseTime = performance.now() - start;
    
    return {
      results: results,
      jsonPerformance: {
        parseTime: parseTime,
        reasonable: parseTime < 50
      }
    };
  `);

  t.true(result.ok);

  // Check each JSON test
  result.data.results.forEach((testResult) => {
    t.true(
      testResult.sizesMatch,
      `${testResult.name} Buffer and TextEncoder sizes should match`,
    );
    t.true(
      testResult.roundTripWorks,
      `${testResult.name} JSON round-trip should work`,
    );
    t.is(typeof testResult.byteLength, "number");
    t.true(testResult.byteLength > 0);
  });

  // Check Unicode handling
  const unicodeResult = result.data.results.find((r) => r.name === "unicode");
  t.true(
    unicodeResult.hasUnicode,
    "Unicode JSON should have byte length > string length",
  );

  // Check performance
  t.true(
    result.data.jsonPerformance.reasonable,
    "JSON performance should be reasonable",
  );
});

test("polyfills should maintain compatibility with different encoding types", async (t) => {
  const testEnv = await createFigmaTestEnvironment();
  const result = await testEnv.runSandboxed(`
    ${POLYFILL_CODE}
    
    // Test different encoding scenarios
    const testString = 'Hello, 世界! 🌍';
    
    const tests = {
      utf8Explicit: Buffer.byteLength(testString, 'utf8'),
      utf8Dash: Buffer.byteLength(testString, 'utf-8'),
      defaultEncoding: Buffer.byteLength(testString),
      noEncoding: Buffer.byteLength(testString, undefined),
      
      // Test Buffer.from functionality
      fromString: Array.from(Buffer.from(testString)),
      fromStringUtf8: Array.from(Buffer.from(testString, 'utf8')),
      fromArray: Array.from(Buffer.from([72, 101, 108, 108, 111])),
      fromUint8Array: Array.from(Buffer.from(new Uint8Array([72, 101, 108, 108, 111]))),
      fromArrayBuffer: Array.from(Buffer.from(new ArrayBuffer(5))),
      
      // Edge cases
      fromEmptyString: Array.from(Buffer.from('')),
      fromEmptyArray: Array.from(Buffer.from([])),
      
      // Test TextEncoder directly
      textEncoderResult: Array.from(new TextEncoder().encode(testString))
    };
    
    // All UTF-8 variants should match
    const allUtf8Match = (
      tests.utf8Explicit === tests.utf8Dash &&
      tests.utf8Dash === tests.defaultEncoding &&
      tests.defaultEncoding === tests.noEncoding
    );
    
    // TextEncoder and Buffer should agree
    const encoderBufferMatch = tests.textEncoderResult.length === tests.utf8Explicit;
    
    return {
      ...tests,
      allUtf8Match: allUtf8Match,
      encoderBufferMatch: encoderBufferMatch,
      testStringBytes: tests.utf8Explicit
    };
  `);

  t.true(result.ok);
  t.true(result.data.allUtf8Match, "All UTF-8 encoding variants should match");
  t.true(result.data.encoderBufferMatch, "TextEncoder and Buffer should agree");
  t.true(
    result.data.testStringBytes > 15,
    "Unicode string should be larger than ASCII length",
  );

  // Test Buffer.from results
  t.deepEqual(result.data.fromArray, [72, 101, 108, 108, 111]); // 'Hello'
  t.deepEqual(result.data.fromUint8Array, [72, 101, 108, 108, 111]);
  t.deepEqual(result.data.fromEmptyString, []);
  t.deepEqual(result.data.fromEmptyArray, []);

  // String conversions should work
  t.true(Array.isArray(result.data.fromString));
  t.true(result.data.fromString.length > 15); // Unicode content
  t.deepEqual(result.data.fromString, result.data.fromStringUtf8);
});
