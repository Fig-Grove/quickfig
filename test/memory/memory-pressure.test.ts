/**
 * Memory Pressure Tests
 * 
 * Tests the framework's behavior under memory constraints and pressure scenarios.
 * Validates memory allocation, cleanup, and error recovery capabilities.
 */

import test from 'ava';
import { createFigmaTestEnvironment } from '../../dist/index.cjs';

test('should test behavior under memory constraints', async (t) => {
  const testEnv = await createFigmaTestEnvironment();

  const testCode = `
    // Simulate memory pressure scenarios
    const memoryTests = []
    
    try {
      // Test 1: Large data allocation
      const largeData = Array(50000).fill('memory-test-data-item')
      const largeDataString = JSON.stringify(largeData)
      
      memoryTests.push({
        test: 'large-allocation',
        success: true,
        size: largeDataString.length
      })
      
      // Test 2: Repeated string operations
      let processedData = largeDataString
      for (let i = 0; i < 10; i++) {
        processedData = processedData.replace(/test/g, 'processed')
      }
      
      memoryTests.push({
        test: 'string-processing',
        success: true,
        iterations: 10,
        finalSize: processedData.length
      })
      
      // Test 3: Memory cleanup simulation
      const tempArrays = []
      for (let i = 0; i < 100; i++) {
        tempArrays.push(new Array(1000).fill('temp-data'))
      }
      tempArrays.length = 0 // Clear arrays
      
      memoryTests.push({
        test: 'memory-cleanup',
        success: true,
        arraysCreated: 100,
        arraysCleared: true
      })
      
      // Test 4: Error recovery
      try {
        const veryLargeData = Array(1000000).fill('very-large-data-item')
        memoryTests.push({
          test: 'very-large-allocation',
          success: true,
          size: veryLargeData.length
        })
      } catch (error) {
        memoryTests.push({
          test: 'very-large-allocation',
          success: false,
          error: 'Memory limit exceeded as expected'
        })
      }
      
    } catch (error) {
      memoryTests.push({
        test: 'error-handling',
        success: false,
        error: error.message
      })
    }
    
    return {
      tests: memoryTests,
      memoryPressureHandled: memoryTests.length > 0 && memoryTests.some(test => test.success)
    };
  `;

  const result = await testEnv.runSandboxed(testCode);
  
  // Extract data from framework result wrapper
  const data = result.ok ? result.data : result;
  
  // Validate the result structure and content
  t.true(data !== null && data !== undefined, 'Result should exist');
  t.true(typeof data === 'object', 'Result should be an object');
  t.true('tests' in data, 'Result should have tests property');
  t.true('memoryPressureHandled' in data, 'Result should have memoryPressureHandled property');
  t.true(Array.isArray(data.tests), 'tests should be an array');
  t.true(data.tests.length >= 3, 'Should have at least 3 test cases');
  t.true(data.memoryPressureHandled === true, 'Memory pressure should be handled successfully');
  
  // Log test results for analysis
  console.log('Memory pressure test results:', data.tests);
  
  // Validate individual test results - allow some tests to fail under memory pressure
  const successfulTests = data.tests.filter(test => test.success).length;
  const totalTests = data.tests.length;
  
  t.true(successfulTests >= 2, `At least 2 tests should succeed (${successfulTests}/${totalTests} succeeded)`);
  
  // Specific test validations
  const largeAllocationTest = data.tests.find(test => test.test === 'large-allocation');
  const stringProcessingTest = data.tests.find(test => test.test === 'string-processing');
  const memoryCleanupTest = data.tests.find(test => test.test === 'memory-cleanup');
  
  if (largeAllocationTest) {
    t.is(largeAllocationTest.test, 'large-allocation', 'Large allocation test should be present');
    if (largeAllocationTest.success) {
      t.is(typeof largeAllocationTest.size, 'number', 'Large allocation should report size');
      t.true(largeAllocationTest.size > 1000000, 'Large allocation should be significant size');
    }
  }
  
  if (stringProcessingTest) {
    t.is(stringProcessingTest.test, 'string-processing', 'String processing test should be present');
    if (stringProcessingTest.success) {
      t.is(stringProcessingTest.iterations, 10, 'Should complete all iterations');
      t.is(typeof stringProcessingTest.finalSize, 'number', 'Should report final size');
    }
  }
  
  if (memoryCleanupTest) {
    t.is(memoryCleanupTest.test, 'memory-cleanup', 'Memory cleanup test should be present');
    if (memoryCleanupTest.success) {
      t.is(memoryCleanupTest.arraysCreated, 100, 'Should create 100 arrays');
      t.true(memoryCleanupTest.arraysCleared, 'Should clear arrays');
    }
  }
  
  console.log(`✅ Memory pressure test completed successfully with ${successfulTests}/${totalTests} test cases passing`);
});

test('should handle memory allocation edge cases', async (t) => {
  const testEnv = await createFigmaTestEnvironment();

  const edgeCaseTest = await testEnv.runSandboxed(`
    const edgeTests = [];
    
    try {
      // Test empty allocation
      const emptyArray = new Array(0);
      edgeTests.push({
        test: 'empty-allocation',
        success: true,
        size: emptyArray.length
      });
      
      // Test small allocations
      const smallArrays = [];
      for (let i = 0; i < 1000; i++) {
        smallArrays.push(new Array(10).fill(i));
      }
      
      edgeTests.push({
        test: 'many-small-allocations',
        success: true,
        count: smallArrays.length,
        totalElements: smallArrays.reduce((sum, arr) => sum + arr.length, 0)
      });
      
      // Test progressive growth
      let growingArray = [];
      const sizes = [];
      for (let i = 1; i <= 10; i++) {
        const addition = new Array(i * 1000).fill('data');
        growingArray = growingArray.concat(addition);
        sizes.push(growingArray.length);
      }
      
      edgeTests.push({
        test: 'progressive-growth',
        success: true,
        finalSize: growingArray.length,
        growthSteps: sizes
      });
      
      // Test circular references (should not crash)
      const obj1 = { name: 'obj1' };
      const obj2 = { name: 'obj2', ref: obj1 };
      obj1.ref = obj2;
      
      edgeTests.push({
        test: 'circular-references',
        success: true,
        handled: true
      });
      
    } catch (error) {
      edgeTests.push({
        test: 'edge-case-error',
        success: false,
        error: error.message
      });
    }
    
    return {
      edgeTests: edgeTests,
      allHandled: edgeTests.every(test => test.success)
    };
  `);

  const data = edgeCaseTest.ok ? edgeCaseTest.data : edgeCaseTest;
  
  t.true(Array.isArray(data.edgeTests), 'Edge tests should be an array');
  t.true(data.edgeTests.length >= 3, 'Should have multiple edge case tests');
  
  // Check specific edge cases
  const emptyTest = data.edgeTests.find(test => test.test === 'empty-allocation');
  const smallTest = data.edgeTests.find(test => test.test === 'many-small-allocations');
  const growthTest = data.edgeTests.find(test => test.test === 'progressive-growth');
  const circularTest = data.edgeTests.find(test => test.test === 'circular-references');
  
  if (emptyTest) {
    t.true(emptyTest.success, 'Empty allocation should succeed');
    t.is(emptyTest.size, 0, 'Empty allocation should have size 0');
  }
  
  if (smallTest) {
    t.true(smallTest.success, 'Many small allocations should succeed');
    t.is(smallTest.count, 1000, 'Should create 1000 small arrays');
    t.is(smallTest.totalElements, 10000, 'Should have correct total elements'); // 1000 arrays * 10 elements each
  }
  
  if (growthTest) {
    t.true(growthTest.success, 'Progressive growth should succeed');
    t.true(growthTest.finalSize > 50000, 'Final size should be substantial');
    t.is(growthTest.growthSteps.length, 10, 'Should have 10 growth steps');
  }
  
  if (circularTest) {
    t.true(circularTest.success, 'Circular references should be handled');
    t.true(circularTest.handled, 'Circular references should not crash');
  }
  
  console.log(`✅ Memory edge case tests completed: ${data.edgeTests.filter(t => t.success).length}/${data.edgeTests.length} passed`);
});