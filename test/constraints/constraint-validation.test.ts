/**
 * QuickJS Constraint Validation Tests
 * 
 * Core constraint validation tests to validate key assumptions about QuickJS environment limits.
 * These tests validate memory constraints, API availability, string size limits, and execution timing.
 */

import test from 'ava';
import { createFigmaTestEnvironment } from '../../dist/index.cjs';

test('QuickJS basic execution and constraint validation', async (t) => {
  try {
    const testEnv = await createFigmaTestEnvironment();
    
    // Test 1: Basic execution works
    const basicTest = await testEnv.runSandboxed(`
      const result = {
        math: Math.sqrt(16),
        json: JSON.stringify({test: 'data'}),
        array: [1,2,3].map(x => x * 2),
        performance: typeof performance !== 'undefined'
      };
      return result;
    `);
    
    console.log('✅ Basic QuickJS execution test:', basicTest);
    
    // Check if we have the wrapper structure and need to extract data
    const testData = (basicTest && typeof basicTest === 'object' && 'data' in basicTest) ? basicTest.data : basicTest;
    
    t.is(testData.math, 4, 'Math operations should work');
    t.is(testData.json, '{"test":"data"}', 'JSON operations should work');
    t.deepEqual(testData.array, [2,4,6], 'Array operations should work');
    
    // Test 2: Memory constraints - test smaller allocations to start
    const memoryTest = await testEnv.runSandboxed(`
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
    const memoryData = (memoryTest && typeof memoryTest === 'object' && 'data' in memoryTest) ? memoryTest.data : memoryTest;
    
    t.true(memoryData.small.success, '100KB allocation should succeed');
    t.true(memoryData.medium.success, '1MB allocation should succeed');
    
    if (memoryData.large.success) {
      console.log('✅ 5MB allocation succeeded - our 8MB limit seems reasonable');
    } else {
      console.warn('⚠️ 5MB allocation failed - our 8MB limit may be too optimistic');
    }
    
    // Test 3: API availability constraints
    const apiTest = await testEnv.runSandboxed(`
      const apis = {
        // Should be available
        available: {
          console: typeof console !== 'undefined',
          Math: typeof Math !== 'undefined',
          JSON: typeof JSON !== 'undefined',
          Array: typeof Array !== 'undefined',
          Object: typeof Object !== 'undefined'
        },
        // Should be blocked/unavailable in Figma (but may be available in QuickJS)
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
    const apiData = (apiTest && typeof apiTest === 'object' && 'data' in apiTest) ? apiTest.data : apiTest;
    
    // Validate available APIs
    t.true(apiData.available.Math, 'Math should be available');
    t.true(apiData.available.JSON, 'JSON should be available');
    t.true(apiData.available.Array, 'Array should be available');
    
    // Validate blocked APIs - QuickJS has different constraints than Figma
    // setTimeout and fetch are available in QuickJS but not in real Figma plugins
    console.log('QuickJS API availability differs from Figma - this is expected');
    t.true(apiData.blocked.setTimeout, 'setTimeout is available in QuickJS (unlike Figma)');
    t.true(apiData.blocked.fetch, 'fetch is available in QuickJS (unlike Figma)');
    t.false(apiData.blocked.Worker, 'Worker should be blocked in QuickJS');
    
    console.log('Polyfill APIs available:', apiData.polyfills);
    
    // Test 4: String size constraints
    const stringTest = await testEnv.runSandboxed(`
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
    const stringData = (stringTest && typeof stringTest === 'object' && 'data' in stringTest) ? stringTest.data : stringTest;
    
    t.true(stringData.small.success, '10KB string should succeed');
    t.true(stringData.large.success, '100KB string should succeed');
    
    if (stringData.veryLarge.success) {
      console.log('✅ 1MB string succeeded - our 500KB limit may be conservative');
    } else {
      console.warn('⚠️ 1MB string failed - our 500KB limit seems appropriate');
    }
    
    // Test 5: Execution timing
    const timingTest = await testEnv.runSandboxed(`
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
    const timingData = (timingTest && typeof timingTest === 'object' && 'data' in timingTest) ? timingTest.data : timingTest;
    
    t.is(typeof timingData.lightComputation, 'number', 'Light computation should complete');
    t.is(typeof timingData.heavyComputation, 'number', 'Heavy computation should complete');
    
    console.log(`Light computation: ${timingData.lightComputation}ms`);
    console.log(`Heavy computation: ${timingData.heavyComputation}ms (blocks UI: ${timingData.uiBlocking})`);
    
    if (timingData.uiBlocking) {
      console.log('✅ Heavy computation exceeds 16ms - UI blocking detection would work');
    }
    
    t.pass('All constraint validation tests completed successfully');
    
  } catch (error) {
    console.error('❌ QuickJS constraint validation failed:', error);
    t.fail(`QuickJS test failed: ${error.message}`);
  }
});

test('QuickJS polyfill integration constraint test', async (t) => {
  try {
    const testEnv = await createFigmaTestEnvironment();
    
    // Test our polyfills work in QuickJS environment
    const polyfillTest = await testEnv.runSandboxed(`
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
    
    // Check if we have the wrapper structure and need to extract data
    const polyfillData = (polyfillTest && typeof polyfillTest === 'object' && 'data' in polyfillTest) ? polyfillTest.data : polyfillTest;
    
    t.is(typeof polyfillData.performanceNow, 'number', 'performance.now() should work');
    t.deepEqual(polyfillData.textEncoderEmpty, [], 'TextEncoder should handle empty strings');
    t.deepEqual(polyfillData.textEncoderHello, [104,101,108,108,111], 'TextEncoder should encode ASCII');
    t.is(polyfillData.bufferByteLength, 11, 'Buffer.byteLength should work');
    t.true(polyfillData.sizesMatch, 'TextEncoder and Buffer.byteLength should agree');
    
    t.pass('Polyfill integration test completed successfully');
    
  } catch (error) {
    console.error('❌ Polyfill integration test failed:', error);
    t.fail(`Polyfill integration test failed: ${error.message}`);
  }
});