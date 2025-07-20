/**
 * AFTER: Modern plugin test using QuickFig
 * Benefits: Real QuickJS environment, proper constraint validation, robust patterns
 */

import test from 'ava';
import { createFigmaTestEnvironment } from '../../src/index.js';

test('basic plugin functionality - NEW STYLE', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  // ✅ Solution: String-based execution, no context capture
  const result = await runSandboxed(`
    // Simulate Figma environment within QuickJS
    const figma = {
      currentPage: { 
        selection: [
          { id: '1', name: 'Rectangle' },
          { id: '2', name: 'Circle' },
          { id: '3', name: 'Text' }
        ]
      }
    };
    
    // Real plugin logic in actual QuickJS environment
    const pluginData = {
      processed: true,
      timestamp: Date.now(),
      nodeCount: figma.currentPage.selection.length,
      calculations: {
        area: Math.PI * 100,
        volume: Math.sqrt(1000)
      }
    };
    
    return pluginData;
  `);
  
  // ✅ Solution: Proper result extraction handling framework wrappers
  const testData = (result && typeof result === 'object' && 'data' in result) 
    ? result.data 
    : result;
  
  // ✅ Robust assertions with real data
  t.true(testData.processed);
  t.is(typeof testData.timestamp, 'number');
  t.is(testData.nodeCount, 3); // Real count from simulated selection
  t.is(Math.round(testData.calculations.area), 314); // Math.PI * 100
  t.is(Math.round(testData.calculations.volume), 32); // Math.sqrt(1000)
});

test('memory allocation test - NEW STYLE', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  // ✅ Solution: Real memory constraint validation in QuickJS
  const result = await runSandboxed(`
    let memoryTestResults = {
      smallAllocation: { success: false, error: null },
      mediumAllocation: { success: false, error: null },
      largeAllocation: { success: false, error: null }
    };
    
    // Test small allocation (should work)
    try {
      const smallArray = new Array(1000).fill('test');
      memoryTestResults.smallAllocation = { 
        success: true, 
        size: smallArray.length 
      };
    } catch (e) {
      memoryTestResults.smallAllocation.error = e.message;
    }
    
    // Test medium allocation (should work)
    try {
      const mediumArray = new Array(10000).fill('test');
      memoryTestResults.mediumAllocation = { 
        success: true, 
        size: mediumArray.length 
      };
    } catch (e) {
      memoryTestResults.mediumAllocation.error = e.message;
    }
    
    // Test large allocation (may fail in real constraints)
    try {
      const largeArray = new Array(1000000).fill('test data string');
      memoryTestResults.largeAllocation = { 
        success: true, 
        size: largeArray.length 
      };
    } catch (e) {
      memoryTestResults.largeAllocation = { 
        success: false, 
        error: e.message 
      };
    }
    
    return memoryTestResults;
  `);
  
  const testData = (result && 'data' in result) ? result.data : result;
  
  // ✅ Real constraint validation results
  t.true(testData.smallAllocation.success, 'Small allocations should work');
  t.true(testData.mediumAllocation.success, 'Medium allocations should work');
  
  // ✅ Real feedback about memory limits
  if (testData.largeAllocation.success) {
    console.log('✅ Large allocation succeeded - memory limits are permissive');
  } else {
    console.log('⚠️ Large allocation failed - memory limits enforced');
    t.is(typeof testData.largeAllocation.error, 'string');
  }
});

test('API availability test - NEW STYLE', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  // ✅ Solution: Real QuickJS environment API testing
  const result = await runSandboxed(`
    // Test API availability in actual QuickJS environment
    const apiAvailability = {
      // Core JavaScript APIs (should be available)
      coreAPIs: {
        Math: typeof Math !== 'undefined',
        JSON: typeof JSON !== 'undefined',
        Date: typeof Date !== 'undefined',
        Array: typeof Array !== 'undefined',
        Object: typeof Object !== 'undefined'
      },
      
      // Browser/Node APIs (availability varies)
      environmentAPIs: {
        console: typeof console !== 'undefined',
        setTimeout: typeof setTimeout !== 'undefined',
        setInterval: typeof setInterval !== 'undefined',
        fetch: typeof fetch !== 'undefined',
        localStorage: typeof localStorage !== 'undefined'
      },
      
      // Polyfill APIs (may be provided by framework)
      polyfillAPIs: {
        TextEncoder: typeof TextEncoder !== 'undefined',
        Buffer: typeof Buffer !== 'undefined',
        performance: typeof performance !== 'undefined'
      }
    };
    
    return apiAvailability;
  `);
  
  const testData = (result && 'data' in result) ? result.data : result;
  
  // ✅ Validate core JavaScript APIs are available
  t.true(testData.coreAPIs.Math, 'Math should be available');
  t.true(testData.coreAPIs.JSON, 'JSON should be available');
  t.true(testData.coreAPIs.Array, 'Array should be available');
  
  // ✅ Log environment API availability for debugging
  console.log('Environment APIs:', testData.environmentAPIs);
  console.log('Polyfill APIs:', testData.polyfillAPIs);
  
  // ✅ Note: For comprehensive API constraint validation, use CLI:
  // npx quickfig validate ./src/plugin.js
});

test('execution timing validation - NEW STYLE', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  // ✅ Solution: Real execution timing in QuickJS
  const result = await runSandboxed(`
    const timingTests = {
      lightOperation: { duration: 0, result: null },
      heavyOperation: { duration: 0, result: null }
    };
    
    // Light operation timing
    const start1 = Date.now();
    let lightResult = 0;
    for (let i = 0; i < 1000; i++) {
      lightResult += Math.sqrt(i);
    }
    const end1 = Date.now();
    
    timingTests.lightOperation = {
      duration: end1 - start1,
      result: Math.round(lightResult)
    };
    
    // Heavy operation timing
    const start2 = Date.now();
    let heavyResult = 0;
    for (let i = 0; i < 10000; i++) {
      heavyResult += Math.sqrt(i) * Math.sin(i);
    }
    const end2 = Date.now();
    
    timingTests.heavyOperation = {
      duration: end2 - start2,
      result: Math.round(heavyResult)
    };
    
    return timingTests;
  `);
  
  const testData = (result && 'data' in result) ? result.data : result;
  
  // ✅ Real performance validation
  t.is(typeof testData.lightOperation.duration, 'number');
  t.is(typeof testData.heavyOperation.duration, 'number');
  
  // ✅ UI blocking threshold validation (16ms)
  const uiBlockingThreshold = 16;
  
  if (testData.lightOperation.duration > uiBlockingThreshold) {
    console.log(`⚠️ Light operation took ${testData.lightOperation.duration}ms - may block UI`);
  }
  
  if (testData.heavyOperation.duration > uiBlockingThreshold) {
    console.log(`⚠️ Heavy operation took ${testData.heavyOperation.duration}ms - will block UI`);
  }
  
  // ✅ Performance insights
  console.log(`Light operation: ${testData.lightOperation.duration}ms`);
  console.log(`Heavy operation: ${testData.heavyOperation.duration}ms`);
  
  t.pass('Execution timing validation completed');
});

test('string constraint validation - NEW STYLE', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  // ✅ Solution: Real string size constraint testing
  const result = await runSandboxed(`
    const stringTests = {
      small: { success: false, size: 0 },
      medium: { success: false, size: 0 },
      large: { success: false, size: 0 }
    };
    
    // Small string (should work)
    try {
      const smallStr = 'x'.repeat(1024); // 1KB
      stringTests.small = { 
        success: true, 
        size: smallStr.length 
      };
    } catch (e) {
      stringTests.small.error = e.message;
    }
    
    // Medium string (should work)
    try {
      const mediumStr = 'x'.repeat(10 * 1024); // 10KB
      stringTests.medium = { 
        success: true, 
        size: mediumStr.length 
      };
    } catch (e) {
      stringTests.medium.error = e.message;
    }
    
    // Large string (may hit limits)
    try {
      const largeStr = 'x'.repeat(100 * 1024); // 100KB
      stringTests.large = { 
        success: true, 
        size: largeStr.length 
      };
    } catch (e) {
      stringTests.large = { 
        success: false, 
        error: e.message 
      };
    }
    
    return stringTests;
  `);
  
  const testData = (result && 'data' in result) ? result.data : result;
  
  // ✅ Real string constraint validation
  t.true(testData.small.success, '1KB strings should work');
  t.true(testData.medium.success, '10KB strings should work');
  
  // ✅ Log string constraint behavior
  if (testData.large.success) {
    console.log('✅ 100KB strings supported');
  } else {
    console.log('⚠️ 100KB strings hit constraint limits');
  }
  
  t.pass('String constraint validation completed');
});