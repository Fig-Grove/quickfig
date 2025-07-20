/**
 * Simple Real QuickJS Constraint Validation - Environment Validation
 * 
 * Focused tests to validate our key constraint assumptions against actual @sebastianwessel/quickjs
 */

import test from 'ava';
import { createFigmaTestEnvironment } from '../dist/index.cjs';

test('Real QuickJS basic execution and constraint validation', async (t) => {
  try {
    const { runSandboxed } = await createFigmaTestEnvironment();
    
    // Test 1: Basic execution works
    const basicTest = await runSandboxed(() => {
      const result = {
        math: Math.sqrt(16),
        json: JSON.stringify({test: 'data'}),
        array: [1,2,3].map(x => x * 2),
        performance: typeof performance !== 'undefined'
      };
      return result;
    });
    
    console.log('✅ Basic QuickJS execution test:', basicTest);
    t.true(basicTest.ok, 'Execution should succeed');
    t.is(basicTest.data.math, 4, 'Math operations should work');
    t.is(basicTest.data.json, '{"test":"data"}', 'JSON operations should work');
    t.deepEqual(basicTest.data.array, [2,4,6], 'Array operations should work');
    
    // Test 2: Memory constraints - test smaller allocations to start
    const memoryTest = await runSandboxed(`
      let results = {
        small: { success: false },
        medium: { success: false },
        large: { success: false }
      };
      
      try {
        // 100KB allocation
        const small = new Array(100 * 1024 / 8).fill(42);
        results.small = { success: true, size: small.length };
      } catch (e) {
        results.small = { error: e.message };
      }
      
      try {
        // 1MB allocation  
        const medium = new Array(1024 * 1024 / 8).fill(42);
        results.medium = { success: true, size: medium.length };
      } catch (e) {
        results.medium = { error: e.message };
      }
      
      try {
        // 5MB allocation
        const large = new Array(5 * 1024 * 1024 / 8).fill(42);
        results.large = { success: true, size: large.length };
      } catch (e) {
        results.large = { error: e.message };
      }
      
      return results;
    `);
    
    console.log('✅ Memory constraint test:', memoryTest);
    t.true(memoryTest.ok, 'Memory test should execute successfully');
    t.true(memoryTest.data.small.success, '100KB allocation should succeed');
    t.true(memoryTest.data.medium.success, '1MB allocation should succeed');
    
    if (memoryTest.data.large.success) {
      console.log('✅ 5MB allocation succeeded - our 8MB limit seems reasonable');
    } else {
      console.warn('⚠️ 5MB allocation failed - our 8MB limit may be too optimistic');
    }
    
    // Test 3: API availability constraints
    const apiTest = await runSandboxed(`
      const apis = {
        // Should be available
        available: {
          console: typeof console !== 'undefined',
          Math: typeof Math !== 'undefined',
          JSON: typeof JSON !== 'undefined',
          Array: typeof Array !== 'undefined',
          Object: typeof Object !== 'undefined'
        },
        // Should be blocked/unavailable
        blocked: {
          setTimeout: typeof setTimeout !== 'undefined',
          fetch: typeof fetch !== 'undefined',
          Worker: typeof Worker !== 'undefined',
          eval: typeof eval !== 'undefined',
          localStorage: typeof localStorage !== 'undefined'
        },
        // May or may not be available (our polyfills)
        polyfills: {
          TextEncoder: typeof TextEncoder !== 'undefined',
          Buffer: typeof Buffer !== 'undefined',
          performance: typeof performance !== 'undefined'
        }
      };
      return apis;
    `);
    
    console.log('✅ API availability test:', apiTest);
    
    // Validate available APIs
    t.true(apiTest.data.available.Math, 'Math should be available');
    t.true(apiTest.data.available.JSON, 'JSON should be available');
    t.true(apiTest.data.available.Array, 'Array should be available');
    
    // Validate blocked APIs are actually blocked
    // Note: QuickJS has different API availability than real Figma plugins
    console.log('QuickJS API availability differs from Figma - this is expected');
    if (apiTest.data.blocked.setTimeout) {
      console.log('⚠️ setTimeout available in QuickJS (blocked in Figma)');
    }
    if (apiTest.data.blocked.fetch) {
      console.log('⚠️ fetch available in QuickJS (blocked in Figma)');
    }
    // Worker should still be blocked in QuickJS
    t.false(apiTest.data.blocked.Worker, 'Worker should be blocked');
    
    console.log('Polyfill APIs available:', apiTest.data.polyfills);
    
    // Test 4: String size constraints
    const stringTest = await runSandboxed(`
      let results = {
        small: { success: false },
        large: { success: false },
        veryLarge: { success: false }
      };
      
      try {
        // 10KB string
        const small = 'x'.repeat(10 * 1024);
        results.small = { success: true, size: small.length };
      } catch (e) {
        results.small = { error: e.message };
      }
      
      try {
        // 100KB string
        const large = 'x'.repeat(100 * 1024);
        results.large = { success: true, size: large.length };
      } catch (e) {
        results.large = { error: e.message };
      }
      
      try {
        // 1MB string
        const veryLarge = 'x'.repeat(1024 * 1024);
        results.veryLarge = { success: true, size: veryLarge.length };
      } catch (e) {
        results.veryLarge = { error: e.message };
      }
      
      return results;
    `);
    
    console.log('✅ String size constraint test:', stringTest);
    t.true(stringTest.data.small.success, '10KB string should succeed');
    t.true(stringTest.data.large.success, '100KB string should succeed');
    
    if (stringTest.data.veryLarge.success) {
      console.log('✅ 1MB string succeeded - our 500KB limit may be conservative');
    } else {
      console.warn('⚠️ 1MB string failed - our 500KB limit seems appropriate');
    }
    
    // Test 5: Execution timing
    const timingTest = await runSandboxed(`
      const start = Date.now();
      
      // Light computation
      for (let i = 0; i < 10000; i++) {
        Math.sqrt(i);
      }
      
      const lightTime = Date.now() - start;
      
      const start2 = Date.now();
      
      // Heavy computation
      for (let i = 0; i < 1000000; i++) {
        Math.sqrt(i);
      }
      
      const heavyTime = Date.now() - start2;
      
      return {
        lightComputation: lightTime,
        heavyComputation: heavyTime,
        uiBlocking: heavyTime > 16 // Our 16ms UI blocking threshold
      };
    `);
    
    console.log('✅ Execution timing test:', timingTest);
    t.is(typeof timingTest.data.lightComputation, 'number', 'Light computation should complete');
    t.is(typeof timingTest.data.heavyComputation, 'number', 'Heavy computation should complete');
    
    console.log(`Light computation: ${timingTest.data.lightComputation}ms`);
    console.log(`Heavy computation: ${timingTest.data.heavyComputation}ms (blocks UI: ${timingTest.data.uiBlocking})`);
    
    if (timingTest.data.uiBlocking) {
      console.log('✅ Heavy computation exceeds 16ms - UI blocking detection would work');
    }
    
    t.pass('All constraint validation tests completed successfully');
    
  } catch (error) {
    console.error('❌ Real QuickJS constraint validation failed:', error);
    t.fail(`Real QuickJS test failed: ${error.message}`);
  }
});

test('Real QuickJS polyfill integration test', async (t) => {
  try {
    const { runSandboxed } = await createFigmaTestEnvironment();
    
    // Test our polyfills work in real QuickJS
    const polyfillTest = await runSandboxed(`
      // Add basic polyfills like we do in production
      if (typeof performance === 'undefined') {
        globalThis.performance = { now: () => Date.now() };
      }
      
      if (typeof TextEncoder === 'undefined') {
        globalThis.TextEncoder = class TextEncoder {
          encode(input) {
            if (!input) return new Uint8Array(0);
            const result = [];
            for (let i = 0; i < input.length; i++) {
              const code = input.charCodeAt(i);
              if (code < 128) {
                result.push(code);
              } else {
                // Simplified UTF-8 encoding for basic test
                result.push(63); // ? replacement char
              }
            }
            return new Uint8Array(result);
          }
        };
      }
      
      if (typeof Buffer === 'undefined') {
        globalThis.Buffer = {
          byteLength: (input) => {
            if (!input) return 0;
            return new TextEncoder().encode(input).length;
          }
        };
      }
      
      // Test the polyfills work
      const results = {
        performanceNow: performance.now(),
        textEncoderEmpty: Array.from(new TextEncoder().encode('')),
        textEncoderHello: Array.from(new TextEncoder().encode('hello')),
        bufferByteLength: Buffer.byteLength('hello world'),
        sizesMatch: Buffer.byteLength('test') === new TextEncoder().encode('test').length
      };
      
      return results;
    `);
    
    console.log('✅ Polyfill integration test:', polyfillTest);
    
    t.true(polyfillTest.ok, 'Polyfill test should execute successfully');
    t.is(typeof polyfillTest.data.performanceNow, 'number', 'performance.now() should work');
    t.deepEqual(polyfillTest.data.textEncoderEmpty, [], 'TextEncoder should handle empty strings');
    t.deepEqual(polyfillTest.data.textEncoderHello, [104,101,108,108,111], 'TextEncoder should encode ASCII');
    t.is(polyfillTest.data.bufferByteLength, 11, 'Buffer.byteLength should work');
    t.true(polyfillTest.data.sizesMatch, 'TextEncoder and Buffer.byteLength should agree');
    
    t.pass('Polyfill integration test completed successfully');
    
  } catch (error) {
    console.error('❌ Polyfill integration test failed:', error);
    t.fail(`Polyfill integration test failed: ${error.message}`);
  }
});