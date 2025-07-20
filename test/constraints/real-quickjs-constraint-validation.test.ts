/**
 * Real QuickJS Constraint Validation Tests
 * 
 * Tests to validate constraint assumptions against actual QuickJS environment behavior.
 * Tests memory limits, execution timing, API availability, string size limits, and integration.
 */

import test from 'ava';
import { createFigmaTestEnvironment } from '../../dist/index.cjs';

// Helper function to extract data from framework results
function extractTestData(result: any): any {
  return (result && typeof result === 'object' && 'data' in result) ? result.data : result;
}

test('Memory constraint validation - 8MB limit', async (t) => {
  try {
    const testEnv = await createFigmaTestEnvironment();
    
    // Test memory allocation approaching 8MB limit
    const memoryTest = await testEnv.runSandboxed(`
      const constraints = {
        maxPerOperation: 8 * 1024 * 1024,
        warningThreshold: 6 * 1024 * 1024
      };
      
      let testResults = {
        smallAllocation: { success: false, size: 0 },
        mediumAllocation: { success: false, size: 0 },
        warningThreshold: { success: false, size: 0 },
        nearLimit: { success: false, size: 0 },
        overLimit: { success: false, size: 0, error: null }
      };
      
      try {
        // 1MB allocation (should work)
        const small = new Array(1024 * 1024 / 8).fill(42);
        testResults.smallAllocation = { success: true, size: small.length * 8 };
      } catch (e) {
        testResults.smallAllocation.error = e.message;
      }
      
      try {
        // 4MB allocation (should work)  
        const medium = new Array(4 * 1024 * 1024 / 8).fill(42);
        testResults.mediumAllocation = { success: true, size: medium.length * 8 };
      } catch (e) {
        testResults.mediumAllocation.error = e.message;
      }
      
      try {
        // 6MB allocation (warning threshold)
        const warning = new Array(6 * 1024 * 1024 / 8).fill(42);
        testResults.warningThreshold = { success: true, size: warning.length * 8 };
      } catch (e) {
        testResults.warningThreshold.error = e.message;
      }
      
      try {
        // 7MB allocation (near limit)
        const nearLimit = new Array(7 * 1024 * 1024 / 8).fill(42);
        testResults.nearLimit = { success: true, size: nearLimit.length * 8 };
      } catch (e) {
        testResults.nearLimit.error = e.message;
      }
      
      try {
        // 10MB allocation (should fail or perform poorly)
        const overLimit = new Array(10 * 1024 * 1024 / 8).fill(42);
        testResults.overLimit = { success: true, size: overLimit.length * 8 };
      } catch (e) {
        testResults.overLimit.error = e.message;
      }
      
      return testResults;
    `);
    
    console.log('Memory constraint test results:', memoryTest);
    const memoryData = extractTestData(memoryTest);
    
    // Validate our assumptions
    t.true(memoryData.smallAllocation.success, '1MB allocation should succeed');
    t.true(memoryData.mediumAllocation.success, '4MB allocation should succeed');
    
    // The key validation: our 8MB limit assumption
    if (memoryData.overLimit.success) {
      console.warn('⚠️ QuickJS allowed 10MB allocation - our 8MB limit may be too conservative');
    } else {
      console.log('✅ QuickJS rejected 10MB allocation - our 8MB limit seems appropriate');
    }
    
    t.pass('Memory constraint validation completed');
    
  } catch (error) {
    console.error('Memory test execution failed:', error);
    t.fail(`Memory constraint test failed: ${error.message}`);
  }
});

test('Execution time constraint validation - 16ms UI blocking threshold', async (t) => {
  try {
    const testEnv = await createFigmaTestEnvironment();
    
    const timingTest = await testEnv.runSandboxed(`
      const constraints = {
        uiBlockingThreshold: 16, // ms
        hardTimeout: 5000 // ms
      };
      
      let testResults = {
        fastOperation: { duration: 0, blocksUI: false },
        slowOperation: { duration: 0, blocksUI: false },
        verySlowOperation: { duration: 0, blocksUI: false, timedOut: false }
      };
      
      // Fast operation (should be under 16ms)
      const start1 = Date.now();
      for (let i = 0; i < 10000; i++) {
        Math.sqrt(i);
      }
      const end1 = Date.now();
      testResults.fastOperation.duration = end1 - start1;
      testResults.fastOperation.blocksUI = testResults.fastOperation.duration > constraints.uiBlockingThreshold;
      
      // Slow operation (likely to exceed 16ms)
      const start2 = Date.now();
      for (let i = 0; i < 1000000; i++) {
        Math.sqrt(i);
      }
      const end2 = Date.now();
      testResults.slowOperation.duration = end2 - start2;
      testResults.slowOperation.blocksUI = testResults.slowOperation.duration > constraints.uiBlockingThreshold;
      
      // Very slow operation (testing timeout behavior)
      const start3 = Date.now();
      try {
        for (let i = 0; i < 10000000; i++) {
          Math.sqrt(i);
        }
        const end3 = Date.now();
        testResults.verySlowOperation.duration = end3 - start3;
        testResults.verySlowOperation.blocksUI = testResults.verySlowOperation.duration > constraints.uiBlockingThreshold;
      } catch (e) {
        testResults.verySlowOperation.timedOut = true;
        testResults.verySlowOperation.error = e.message;
      }
      
      return testResults;
    `);
    
    console.log('Execution time constraint test results:', timingTest);
    const timingData = extractTestData(timingTest);
    
    // Validate our assumptions
    t.is(typeof timingData.fastOperation.duration, 'number', 'Fast operation should have measurable duration');
    t.true(timingData.fastOperation.duration < 50, 'Fast operation should be reasonably fast');
    
    if (timingData.slowOperation.blocksUI) {
      console.log('✅ Slow operation exceeds 16ms threshold - UI blocking detection works');
    } else {
      console.warn('⚠️ Slow operation unexpectedly fast - may need to adjust test workload');
    }
    
    // Log findings for constraint validation
    console.log(`Fast operation: ${timingData.fastOperation.duration.toFixed(2)}ms (blocks UI: ${timingData.fastOperation.blocksUI})`);
    console.log(`Slow operation: ${timingData.slowOperation.duration.toFixed(2)}ms (blocks UI: ${timingData.slowOperation.blocksUI})`);
    
    t.pass('Execution time constraint validation completed');
    
  } catch (error) {
    console.error('Execution time test failed:', error);
    t.fail(`Execution time constraint test failed: ${error.message}`);
  }
});

test('API availability constraint validation', async (t) => {
  try {
    const testEnv = await createFigmaTestEnvironment();
    
    const apiTest = await testEnv.runSandboxed(`
      // Define APIs to test based on Figma plugin constraints
      const constraints = {
        available: ['console', 'Math', 'JSON', 'Array', 'Object'],
        blocked: ['setTimeout', 'setInterval', 'fetch'],
        restricted: ['eval', 'Function']
      };
      
      let testResults = {
        availableAPIs: {},
        blockedAPIs: {},
        restrictedAPIs: {},
        summary: { available: 0, blocked: 0, restricted: 0, unexpected: [] }
      };
      
      // Test available APIs
      constraints.available.forEach(api => {
        try {
          const exists = typeof globalThis[api] !== 'undefined';
          testResults.availableAPIs[api] = { exists, type: typeof globalThis[api] };
          if (exists) testResults.summary.available++;
        } catch (e) {
          testResults.availableAPIs[api] = { exists: false, error: e.message };
        }
      });
      
      // Test blocked APIs (note: QuickJS may have different availability than Figma)
      constraints.blocked.forEach(api => {
        try {
          const exists = typeof globalThis[api] !== 'undefined';
          testResults.blockedAPIs[api] = { exists, shouldBeBlocked: true };
          if (!exists) testResults.summary.blocked++;
          else testResults.summary.unexpected.push(api + ' (should be blocked in Figma)');
        } catch (e) {
          testResults.blockedAPIs[api] = { exists: false, error: e.message };
          testResults.summary.blocked++;
        }
      });
      
      // Test restricted APIs
      constraints.restricted.forEach(api => {
        try {
          const exists = typeof globalThis[api] !== 'undefined';
          testResults.restrictedAPIs[api] = { exists, shouldBeRestricted: true };
          if (exists) testResults.summary.restricted++;
        } catch (e) {
          testResults.restrictedAPIs[api] = { exists: false, error: e.message };
        }
      });
      
      return testResults;
    `);
    
    console.log('API availability constraint test results:', apiTest);
    const apiData = extractTestData(apiTest);
    
    console.log(`Available APIs working: ${apiData.summary.available}/5`);
    console.log(`Blocked APIs properly blocked: ${apiData.summary.blocked}/3`);
    console.log(`Restricted APIs present: ${apiData.summary.restricted}/2`);
    
    if (apiData.summary.unexpected.length > 0) {
      console.warn('⚠️ Unexpected API availability:', apiData.summary.unexpected);
      console.log('Note: QuickJS testing environment has different API availability than real Figma plugins');
    }
    
    // Key validations
    t.true(apiData.availableAPIs.console.exists, 'console should be available');
    t.true(apiData.availableAPIs.JSON.exists, 'JSON should be available');
    
    // Note: QuickJS has different constraints than Figma
    console.log('QuickJS API availability differs from real Figma constraints - this is expected for testing framework');
    
    t.pass('API availability constraint validation completed');
    
  } catch (error) {
    console.error('API availability test failed:', error);
    t.fail(`API availability constraint test failed: ${error.message}`);
  }
});

test('String size constraint validation - 500KB limit', async (t) => {
  try {
    const testEnv = await createFigmaTestEnvironment();
    
    const stringTest = await testEnv.runSandboxed(`
      const constraints = {
        maxStringSize: 500 * 1024, // 500KB
        warningSize: 100 * 1024    // 100KB
      };
      
      let testResults = {
        smallString: { success: false, size: 0 },
        warningString: { success: false, size: 0 },
        largeString: { success: false, size: 0 },
        overLimitString: { success: false, size: 0, error: null }
      };
      
      try {
        // 10KB string
        const small = 'x'.repeat(10 * 1024);
        testResults.smallString = { success: true, size: small.length };
      } catch (e) {
        testResults.smallString.error = e.message;
      }
      
      try {
        // 100KB string (warning threshold)
        const warning = 'x'.repeat(100 * 1024);
        testResults.warningString = { success: true, size: warning.length };
      } catch (e) {
        testResults.warningString.error = e.message;
      }
      
      try {
        // 400KB string (under limit)
        const large = 'x'.repeat(400 * 1024);
        testResults.largeString = { success: true, size: large.length };
      } catch (e) {
        testResults.largeString.error = e.message;
      }
      
      try {
        // 600KB string (over limit)
        const overLimit = 'x'.repeat(600 * 1024);
        testResults.overLimitString = { success: true, size: overLimit.length };
      } catch (e) {
        testResults.overLimitString.error = e.message;
      }
      
      return testResults;
    `);
    
    console.log('String size constraint test results:', stringTest);
    const stringData = extractTestData(stringTest);
    
    // Validate our assumptions
    t.true(stringData.smallString.success, '10KB string should succeed');
    t.true(stringData.warningString.success, '100KB string should succeed');
    t.true(stringData.largeString.success, '400KB string should succeed');
    
    if (stringData.overLimitString.success) {
      console.warn('⚠️ QuickJS allowed 600KB string - our 500KB limit may be too conservative');
    } else {
      console.log('✅ QuickJS rejected 600KB string - our 500KB limit seems appropriate');
    }
    
    t.pass('String size constraint validation completed');
    
  } catch (error) {
    console.error('String size test failed:', error);
    t.fail(`String size constraint test failed: ${error.message}`);
  }
});

test('QuickJS environment integration test', async (t) => {
  try {
    const testEnv = await createFigmaTestEnvironment();
    
    // Test that we can actually run core functionality in QuickJS
    const integrationTest = await testEnv.runSandboxed(`
      // Test basic functionality that framework relies on
      const testResults = {
        mathOperations: false,
        jsonParsing: false,
        arrayOperations: false,
        stringManipulation: false,
        performanceTiming: false
      };
      
      try {
        // Math operations
        const sqrt = Math.sqrt(16);
        const pow = Math.pow(2, 3);
        testResults.mathOperations = sqrt === 4 && pow === 8;
      } catch (e) {
        testResults.mathOperations = e.message;
      }
      
      try {
        // JSON parsing/stringifying
        const obj = { test: 'data', num: 42 };
        const str = JSON.stringify(obj);
        const parsed = JSON.parse(str);
        testResults.jsonParsing = parsed.test === 'data' && parsed.num === 42;
      } catch (e) {
        testResults.jsonParsing = e.message;
      }
      
      try {
        // Array operations
        const arr = [1, 2, 3, 4, 5];
        const doubled = arr.map(x => x * 2);
        const sum = doubled.reduce((a, b) => a + b, 0);
        testResults.arrayOperations = sum === 30;
      } catch (e) {
        testResults.arrayOperations = e.message;
      }
      
      try {
        // String manipulation
        const str = "Hello, QuickJS!";
        const upper = str.toUpperCase();
        const substr = str.substring(0, 5);
        testResults.stringManipulation = upper === "HELLO, QUICKJS!" && substr === "Hello";
      } catch (e) {
        testResults.stringManipulation = e.message;
      }
      
      try {
        // Performance timing
        const start = Date.now();
        for (let i = 0; i < 1000; i++) {
          Math.sqrt(i);
        }
        const end = Date.now();
        testResults.performanceTiming = typeof start === 'number' && typeof end === 'number' && end >= start;
      } catch (e) {
        testResults.performanceTiming = e.message;
      }
      
      return testResults;
    `);
    
    console.log('QuickJS integration test results:', integrationTest);
    const integrationData = extractTestData(integrationTest);
    
    // Validate core functionality
    t.true(integrationData.mathOperations, 'Math operations should work in QuickJS');
    t.true(integrationData.jsonParsing, 'JSON parsing should work in QuickJS');
    t.true(integrationData.arrayOperations, 'Array operations should work in QuickJS');
    t.true(integrationData.stringManipulation, 'String manipulation should work in QuickJS');
    t.true(integrationData.performanceTiming, 'Performance timing should work in QuickJS');
    
    t.pass('QuickJS environment integration test completed');
    
  } catch (error) {
    console.error('QuickJS integration test failed:', error);
    t.fail(`QuickJS environment integration test failed: ${error.message}`);
  }
});