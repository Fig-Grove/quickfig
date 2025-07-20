# QuickFig: Testing Patterns & Best Practices

A comprehensive guide to effective testing patterns with QuickFig for Figma plugin development.

## Table of Contents

1. [Core Testing Patterns](#core-testing-patterns)
2. [Constraint-Aware Testing](#constraint-aware-testing)  
3. [Performance Testing Patterns](#performance-testing-patterns)
4. [Error Handling Patterns](#error-handling-patterns)
5. [Integration Patterns](#integration-patterns)
6. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
7. [Advanced Techniques](#advanced-techniques)

---

## Core Testing Patterns

### 1. String-Based Test Execution Pattern

**✅ Recommended Pattern:**
```javascript
import { createFigmaTestEnvironment } from '@fig-grove/quickfig';

test('plugin data processing', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  const result = await runSandboxed(`
    // Self-contained plugin logic
    const data = { nodes: ['rect1', 'circle2'], processed: false };
    
    // Process the data
    const processed = data.nodes.map(node => ({
      id: node,
      type: node.startsWith('rect') ? 'rectangle' : 'circle',
      processed: true
    }));
    
    return { original: data, processed };
  `);
  
  // Extract with framework compatibility
  const testData = (result && 'data' in result) ? result.data : result;
  
  t.is(testData.processed.length, 2);
  t.true(testData.processed.every(item => item.processed));
});
```

**❌ Avoid Function-Based Pattern:**
```javascript
// Don't do this - causes serialization issues
const result = await runSandboxed(() => {
  const data = outsideVariable; // Context capture problem
  return processData(data);
});
```

### 2. Figma Environment Simulation Pattern

**✅ Comprehensive Environment Setup:**
```javascript
test('figma plugin environment', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  const result = await runSandboxed(`
    // Complete Figma environment simulation
    const figma = {
      currentPage: {
        selection: [
          { id: '1', name: 'Rectangle', type: 'RECTANGLE' },
          { id: '2', name: 'Text', type: 'TEXT' }
        ],
        findAll: (criteria) => {
          return figma.currentPage.selection.filter(node => 
            criteria ? node.type === criteria.type : true
          );
        }
      },
      createRectangle: () => ({
        id: Math.random().toString(),
        type: 'RECTANGLE',
        width: 100,
        height: 100
      }),
      notify: (message) => ({ type: 'notification', message })
    };
    
    // Plugin logic using simulated environment
    const rectangles = figma.currentPage.findAll({ type: 'RECTANGLE' });
    const newRect = figma.createRectangle();
    const notification = figma.notify('Created rectangle');
    
    return {
      existingRectangles: rectangles.length,
      newRectangle: newRect,
      notification
    };
  `);
  
  const testData = (result && 'data' in result) ? result.data : result;
  
  t.is(testData.existingRectangles, 1);
  t.is(testData.newRectangle.type, 'RECTANGLE');
  t.is(testData.notification.type, 'notification');
});
```

### 3. Data Validation Pattern

**✅ Robust Data Validation:**
```javascript
test('data validation with type checking', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  const result = await runSandboxed(`
    // Validation helper functions
    const validators = {
      isValidNode: (node) => {
        return node && 
               typeof node.id === 'string' && 
               typeof node.name === 'string' &&
               ['RECTANGLE', 'CIRCLE', 'TEXT'].includes(node.type);
      },
      isValidColor: (color) => {
        return color && 
               typeof color.r === 'number' && 
               typeof color.g === 'number' && 
               typeof color.b === 'number' &&
               [color.r, color.g, color.b].every(c => c >= 0 && c <= 1);
      }
    };
    
    // Test data
    const testNodes = [
      { id: '1', name: 'Valid Rectangle', type: 'RECTANGLE' },
      { id: '2', name: 'Valid Text', type: 'TEXT' },
      { id: '', name: 'Invalid Node', type: 'UNKNOWN' } // Invalid
    ];
    
    const testColors = [
      { r: 0.5, g: 0.8, b: 0.2 }, // Valid
      { r: 1.5, g: 0.8, b: 0.2 }, // Invalid - out of range
      { r: 0.1, g: 0.2 }           // Invalid - missing b
    ];
    
    return {
      nodeValidation: testNodes.map(node => ({
        node,
        isValid: validators.isValidNode(node)
      })),
      colorValidation: testColors.map(color => ({
        color,
        isValid: validators.isValidColor(color)
      }))
    };
  `);
  
  const testData = (result && 'data' in result) ? result.data : result;
  
  // Validate node validation results
  t.true(testData.nodeValidation[0].isValid);
  t.true(testData.nodeValidation[1].isValid);
  t.false(testData.nodeValidation[2].isValid);
  
  // Validate color validation results
  t.true(testData.colorValidation[0].isValid);
  t.false(testData.colorValidation[1].isValid);
  t.false(testData.colorValidation[2].isValid);
});
```

---

## Constraint-Aware Testing

### 1. Memory Constraint Testing Pattern

**✅ Progressive Memory Testing:**
```javascript
test('memory constraint validation', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  const result = await runSandboxed(`
    const memoryTests = {
      small: { success: false, size: 0 },
      medium: { success: false, size: 0 },
      large: { success: false, size: 0 },
      cleanup: { success: false }
    };
    
    // Small allocation (1KB) - should always work
    try {
      const smallData = new Array(128).fill('x'.repeat(8)); // ~1KB
      memoryTests.small = { 
        success: true, 
        size: smallData.length * 8 
      };
    } catch (e) {
      memoryTests.small = { success: false, error: e.message };
    }
    
    // Medium allocation (100KB) - should work in most cases
    try {
      const mediumData = new Array(12800).fill('x'.repeat(8)); // ~100KB
      memoryTests.medium = { 
        success: true, 
        size: mediumData.length * 8 
      };
    } catch (e) {
      memoryTests.medium = { success: false, error: e.message };
    }
    
    // Large allocation (1MB) - may hit constraints
    try {
      const largeData = new Array(128000).fill('x'.repeat(8)); // ~1MB
      memoryTests.large = { 
        success: true, 
        size: largeData.length * 8 
      };
    } catch (e) {
      memoryTests.large = { success: false, error: e.message };
    }
    
    // Test cleanup (important for plugins)
    try {
      let data = new Array(1000).fill('temp');
      data = null; // Explicit cleanup
      memoryTests.cleanup = { success: true };
    } catch (e) {
      memoryTests.cleanup = { success: false, error: e.message };
    }
    
    return memoryTests;
  `);
  
  const testData = (result && 'data' in result) ? result.data : result;
  
  // Small allocations should always work
  t.true(testData.small.success, 'Small memory allocations should succeed');
  
  // Medium allocations should typically work
  t.true(testData.medium.success, 'Medium memory allocations should succeed');
  
  // Large allocations - log result for monitoring
  if (testData.large.success) {
    console.log('✅ Large memory allocation succeeded - generous memory limits');
  } else {
    console.log('⚠️ Large memory allocation failed - strict memory limits detected');
  }
  
  t.true(testData.cleanup.success, 'Memory cleanup should work');
});
```

### 2. UI Blocking Prevention Pattern

**✅ Execution Time Monitoring:**
```javascript
test('ui blocking prevention', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  const result = await runSandboxed(`
    const uiTests = {
      lightComputation: { duration: 0, blocksUI: false },
      mediumComputation: { duration: 0, blocksUI: false },
      optimizedLargeTask: { duration: 0, blocksUI: false, chunks: 0 }
    };
    
    const UI_BLOCKING_THRESHOLD = 16; // 16ms to maintain 60fps
    
    // Light computation - should never block UI
    const start1 = Date.now();
    let lightResult = 0;
    for (let i = 0; i < 1000; i++) {
      lightResult += Math.sqrt(i);
    }
    const duration1 = Date.now() - start1;
    uiTests.lightComputation = {
      duration: duration1,
      blocksUI: duration1 > UI_BLOCKING_THRESHOLD,
      result: Math.round(lightResult)
    };
    
    // Medium computation - might block UI
    const start2 = Date.now();
    let mediumResult = 0;
    for (let i = 0; i < 10000; i++) {
      mediumResult += Math.sqrt(i) * Math.sin(i);
    }
    const duration2 = Date.now() - start2;
    uiTests.mediumComputation = {
      duration: duration2,
      blocksUI: duration2 > UI_BLOCKING_THRESHOLD,
      result: Math.round(mediumResult)
    };
    
    // Optimized large task - chunked to prevent UI blocking
    const start3 = Date.now();
    let optimizedResult = 0;
    let chunks = 0;
    const CHUNK_SIZE = 1000;
    const TOTAL_WORK = 50000;
    
    for (let i = 0; i < TOTAL_WORK; i += CHUNK_SIZE) {
      const chunkStart = Date.now();
      for (let j = i; j < Math.min(i + CHUNK_SIZE, TOTAL_WORK); j++) {
        optimizedResult += Math.sqrt(j);
      }
      chunks++;
      
      // Simulate async break (in real plugin, you'd use setTimeout/yield)
      const chunkDuration = Date.now() - chunkStart;
      if (chunkDuration > UI_BLOCKING_THRESHOLD / 2) {
        break; // Exit if chunk itself is taking too long
      }
    }
    const duration3 = Date.now() - start3;
    uiTests.optimizedLargeTask = {
      duration: duration3,
      blocksUI: duration3 > UI_BLOCKING_THRESHOLD,
      chunks,
      result: Math.round(optimizedResult)
    };
    
    return uiTests;
  `);
  
  const testData = (result && 'data' in result) ? result.data : result;
  
  // Light computation should never block UI
  t.false(testData.lightComputation.blocksUI, 
    `Light computation (${testData.lightComputation.duration}ms) should not block UI`);
  
  // Medium computation - log performance characteristics
  if (testData.mediumComputation.blocksUI) {
    console.log(`⚠️ Medium computation blocks UI (${testData.mediumComputation.duration}ms)`);
  } else {
    console.log(`✅ Medium computation UI-friendly (${testData.mediumComputation.duration}ms)`);
  }
  
  // Optimized task should demonstrate chunking effectiveness
  console.log(`Optimized task: ${testData.optimizedLargeTask.chunks} chunks, ${testData.optimizedLargeTask.duration}ms total`);
  
  t.is(typeof testData.lightComputation.result, 'number');
  t.is(typeof testData.mediumComputation.result, 'number');
  t.is(typeof testData.optimizedLargeTask.result, 'number');
});
```

### 3. API Compatibility Testing Pattern

**✅ API Availability Checking:**
```javascript
test('api compatibility validation', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  const result = await runSandboxed(`
    const apiCompatibility = {
      coreAPIs: {
        required: ['Math', 'JSON', 'Date', 'Array', 'Object'],
        available: [],
        missing: []
      },
      blockedAPIs: {
        expected: ['setTimeout', 'setInterval', 'fetch', 'XMLHttpRequest'],
        found: [],
        properlyBlocked: []
      },
      polyfillAPIs: {
        expected: ['console', 'Buffer', 'TextEncoder'],
        available: [],
        missing: []
      }
    };
    
    // Check core JavaScript APIs (should be available)
    apiCompatibility.coreAPIs.required.forEach(api => {
      if (typeof globalThis[api] !== 'undefined') {
        apiCompatibility.coreAPIs.available.push(api);
      } else {
        apiCompatibility.coreAPIs.missing.push(api);
      }
    });
    
    // Check blocked APIs (should NOT be available in Figma)
    apiCompatibility.blockedAPIs.expected.forEach(api => {
      if (typeof globalThis[api] !== 'undefined') {
        apiCompatibility.blockedAPIs.found.push(api);
      } else {
        apiCompatibility.blockedAPIs.properlyBlocked.push(api);
      }
    });
    
    // Check polyfill APIs (may be provided by framework)
    apiCompatibility.polyfillAPIs.expected.forEach(api => {
      if (typeof globalThis[api] !== 'undefined') {
        apiCompatibility.polyfillAPIs.available.push(api);
      } else {
        apiCompatibility.polyfillAPIs.missing.push(api);
      }
    });
    
    // Calculate compatibility score
    const totalChecks = apiCompatibility.coreAPIs.required.length + 
                       apiCompatibility.blockedAPIs.expected.length;
    const passedChecks = apiCompatibility.coreAPIs.available.length + 
                        apiCompatibility.blockedAPIs.properlyBlocked.length;
    
    apiCompatibility.score = Math.round((passedChecks / totalChecks) * 100);
    
    return apiCompatibility;
  `);
  
  const testData = (result && 'data' in result) ? result.data : result;
  
  // Core APIs should be available
  testData.coreAPIs.required.forEach(api => {
    t.true(testData.coreAPIs.available.includes(api), 
      `Core API ${api} should be available`);
  });
  
  // Blocked APIs should not be available (this is good!)
  testData.blockedAPIs.found.forEach(api => {
    console.log(`⚠️ Blocked API ${api} is available - may not work in real Figma`);
  });
  
  // Log polyfill status for debugging
  console.log('Polyfill APIs available:', testData.polyfillAPIs.available);
  console.log('Polyfill APIs missing:', testData.polyfillAPIs.missing);
  
  // Overall compatibility score
  console.log(`API Compatibility Score: ${testData.score}%`);
  t.true(testData.score >= 80, 'API compatibility should be at least 80%');
});
```

---

## Performance Testing Patterns

### 1. Algorithmic Performance Pattern

**✅ Performance Comparison Testing:**
```javascript
test('algorithm performance comparison', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  const result = await runSandboxed(`
    const performanceTests = {
      arrayOperations: {},
      stringOperations: {},
      objectOperations: {}
    };
    
    const testData = new Array(1000).fill(0).map((_, i) => ({
      id: i,
      name: 'item_' + i,
      value: Math.random()
    }));
    
    // Array operation performance comparison
    const arrayStart = Date.now();
    
    // Method 1: Traditional for loop
    const start1 = Date.now();
    const filtered1 = [];
    for (let i = 0; i < testData.length; i++) {
      if (testData[i].value > 0.5) {
        filtered1.push(testData[i]);
      }
    }
    const method1Time = Date.now() - start1;
    
    // Method 2: Array.filter
    const start2 = Date.now();
    const filtered2 = testData.filter(item => item.value > 0.5);
    const method2Time = Date.now() - start2;
    
    // Method 3: Optimized filter with early exit
    const start3 = Date.now();
    const filtered3 = [];
    for (const item of testData) {
      if (item.value > 0.5) {
        filtered3.push(item);
      }
      if (filtered3.length >= 100) break; // Early exit for large datasets
    }
    const method3Time = Date.now() - start3;
    
    performanceTests.arrayOperations = {
      traditionalLoop: { time: method1Time, resultCount: filtered1.length },
      arrayFilter: { time: method2Time, resultCount: filtered2.length },
      optimizedFilter: { time: method3Time, resultCount: filtered3.length },
      fastest: method1Time <= method2Time && method1Time <= method3Time ? 'traditional' :
               method2Time <= method3Time ? 'filter' : 'optimized'
    };
    
    // String operation performance
    const strings = testData.map(item => item.name);
    
    // Method 1: String concatenation
    const strStart1 = Date.now();
    let combined1 = '';
    for (const str of strings) {
      combined1 += str + ',';
    }
    const strMethod1Time = Date.now() - strStart1;
    
    // Method 2: Array.join
    const strStart2 = Date.now();
    const combined2 = strings.join(',');
    const strMethod2Time = Date.now() - strStart2;
    
    performanceTests.stringOperations = {
      concatenation: { time: strMethod1Time, length: combined1.length },
      arrayJoin: { time: strMethod2Time, length: combined2.length },
      fastest: strMethod1Time <= strMethod2Time ? 'concatenation' : 'arrayJoin'
    };
    
    // Object operation performance
    const objStart = Date.now();
    
    // Method 1: Object creation with Object.assign
    const objStart1 = Date.now();
    const objects1 = testData.map(item => Object.assign({}, item, { processed: true }));
    const objMethod1Time = Date.now() - objStart1;
    
    // Method 2: Spread operator
    const objStart2 = Date.now();
    const objects2 = testData.map(item => ({ ...item, processed: true }));
    const objMethod2Time = Date.now() - objStart2;
    
    performanceTests.objectOperations = {
      objectAssign: { time: objMethod1Time, count: objects1.length },
      spreadOperator: { time: objMethod2Time, count: objects2.length },
      fastest: objMethod1Time <= objMethod2Time ? 'objectAssign' : 'spreadOperator'
    };
    
    return performanceTests;
  `);
  
  const testData = (result && 'data' in result) ? result.data : result;
  
  // Validate that all methods produced correct results
  t.true(testData.arrayOperations.traditionalLoop.resultCount > 0);
  t.true(testData.arrayOperations.arrayFilter.resultCount > 0);
  t.is(testData.arrayOperations.traditionalLoop.resultCount, 
       testData.arrayOperations.arrayFilter.resultCount);
  
  // Log performance insights
  console.log('Array Operations Performance:');
  console.log(`  Traditional Loop: ${testData.arrayOperations.traditionalLoop.time}ms`);
  console.log(`  Array.filter: ${testData.arrayOperations.arrayFilter.time}ms`);
  console.log(`  Optimized Filter: ${testData.arrayOperations.optimizedFilter.time}ms`);
  console.log(`  Fastest: ${testData.arrayOperations.fastest}`);
  
  console.log('String Operations Performance:');
  console.log(`  Concatenation: ${testData.stringOperations.concatenation.time}ms`);
  console.log(`  Array.join: ${testData.stringOperations.arrayJoin.time}ms`);
  console.log(`  Fastest: ${testData.stringOperations.fastest}`);
  
  console.log('Object Operations Performance:');
  console.log(`  Object.assign: ${testData.objectOperations.objectAssign.time}ms`);
  console.log(`  Spread operator: ${testData.objectOperations.spreadOperator.time}ms`);
  console.log(`  Fastest: ${testData.objectOperations.fastest}`);
  
  // Performance should be reasonable (under 50ms for these operations)
  t.true(testData.arrayOperations.traditionalLoop.time < 50);
  t.true(testData.stringOperations.arrayJoin.time < 50);
  t.true(testData.objectOperations.spreadOperator.time < 50);
});
```

### 2. Memory Efficiency Pattern

**✅ Memory Usage Optimization:**
```javascript
test('memory efficiency validation', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  const result = await runSandboxed(`
    const memoryEfficiencyTests = {
      memoryLeakPrevention: {},
      efficientDataStructures: {},
      garbageCollectionFriendly: {}
    };
    
    // Memory leak prevention test
    const leakStart = Date.now();
    let memoryLeakTest = {
      cleanupRequired: [],
      properCleanup: []
    };
    
    // Create data that needs cleanup
    for (let i = 0; i < 100; i++) {
      const data = {
        id: i,
        largeArray: new Array(1000).fill('data'),
        references: []
      };
      
      // Simulate circular reference (potential memory leak)
      data.references.push(data);
      memoryLeakTest.cleanupRequired.push(data);
    }
    
    // Proper cleanup
    memoryLeakTest.cleanupRequired.forEach(item => {
      item.references = []; // Break circular references
      item.largeArray = null; // Clear large data
    });
    memoryLeakTest.cleanupRequired = []; // Clear references
    
    memoryEfficiencyTests.memoryLeakPrevention = {
      duration: Date.now() - leakStart,
      cleanupPerformed: true
    };
    
    // Efficient data structures test
    const dataStructureStart = Date.now();
    
    // Inefficient: Array for frequent lookups
    const inefficientArray = [];
    for (let i = 0; i < 1000; i++) {
      inefficientArray.push({ id: i, value: 'item_' + i });
    }
    
    const inefficientLookupStart = Date.now();
    const found1 = inefficientArray.find(item => item.id === 500);
    const inefficientLookupTime = Date.now() - inefficientLookupStart;
    
    // Efficient: Object/Map for frequent lookups
    const efficientMap = {};
    for (let i = 0; i < 1000; i++) {
      efficientMap[i] = { id: i, value: 'item_' + i };
    }
    
    const efficientLookupStart = Date.now();
    const found2 = efficientMap[500];
    const efficientLookupTime = Date.now() - efficientLookupStart;
    
    memoryEfficiencyTests.efficientDataStructures = {
      duration: Date.now() - dataStructureStart,
      inefficientLookup: inefficientLookupTime,
      efficientLookup: efficientLookupTime,
      speedImprovement: inefficientLookupTime > 0 ? 
        Math.round((inefficientLookupTime / Math.max(efficientLookupTime, 0.001)) * 100) / 100 : 'N/A'
    };
    
    // Garbage collection friendly patterns
    const gcStart = Date.now();
    
    // Use patterns that help garbage collection
    const processInChunks = (data, chunkSize = 100) => {
      const results = [];
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        const processed = chunk.map(item => ({ ...item, processed: true }));
        results.push(...processed);
        // Allow garbage collection of chunk
      }
      return results;
    };
    
    const largeDataset = new Array(1000).fill(0).map((_, i) => ({ id: i, data: 'item' }));
    const processedData = processInChunks(largeDataset, 50);
    
    memoryEfficiencyTests.garbageCollectionFriendly = {
      duration: Date.now() - gcStart,
      inputSize: largeDataset.length,
      outputSize: processedData.length,
      chunkedProcessing: true
    };
    
    return memoryEfficiencyTests;
  `);
  
  const testData = (result && 'data' in result) ? result.data : result;
  
  // Validate memory leak prevention
  t.true(testData.memoryLeakPrevention.cleanupPerformed);
  t.true(testData.memoryLeakPrevention.duration < 100); // Should be fast
  
  // Validate efficient data structures
  console.log(`Data Structure Efficiency:`);
  console.log(`  Array lookup (inefficient): ${testData.efficientDataStructures.inefficientLookup}ms`);
  console.log(`  Object lookup (efficient): ${testData.efficientDataStructures.efficientLookup}ms`);
  console.log(`  Speed improvement: ${testData.efficientDataStructures.speedImprovement}x`);
  
  // Efficient lookup should be faster (or at least not slower)
  t.true(testData.efficientDataStructures.efficientLookup <= testData.efficientDataStructures.inefficientLookup);
  
  // Validate garbage collection friendly patterns
  t.true(testData.garbageCollectionFriendly.chunkedProcessing);
  t.is(testData.garbageCollectionFriendly.inputSize, testData.garbageCollectionFriendly.outputSize);
  t.true(testData.garbageCollectionFriendly.duration < 100);
});
```

---

## Error Handling Patterns

### 1. Graceful Degradation Pattern

**✅ Robust Error Handling:**
```javascript
test('graceful degradation handling', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  const result = await runSandboxed(`
    const errorHandlingTests = {
      constraintErrors: {},
      dataValidationErrors: {},
      recoveryMechanisms: {}
    };
    
    // Constraint error handling
    const constraintErrorTest = () => {
      const results = {
        memoryIntensive: { success: false, fallback: false },
        computeIntensive: { success: false, fallback: false },
        apiUnavailable: { success: false, fallback: false }
      };
      
      // Memory intensive operation with fallback
      try {
        const largeArray = new Array(1000000).fill('data'); // May fail
        results.memoryIntensive.success = true;
      } catch (e) {
        // Fallback to smaller operation
        try {
          const smallArray = new Array(1000).fill('data');
          results.memoryIntensive.fallback = true;
        } catch (fallbackError) {
          results.memoryIntensive.error = fallbackError.message;
        }
      }
      
      // Compute intensive operation with timeout simulation
      try {
        const start = Date.now();
        let result = 0;
        for (let i = 0; i < 100000; i++) {
          result += Math.sqrt(i);
          // Simulate timeout check
          if (Date.now() - start > 50) {
            throw new Error('Operation timeout');
          }
        }
        results.computeIntensive.success = true;
      } catch (e) {
        // Fallback to simpler computation
        let result = 0;
        for (let i = 0; i < 1000; i++) {
          result += Math.sqrt(i);
        }
        results.computeIntensive.fallback = true;
      }
      
      // API unavailable with fallback
      try {
        if (typeof localStorage === 'undefined') {
          throw new Error('localStorage not available');
        }
        results.apiUnavailable.success = true;
      } catch (e) {
        // Fallback to memory storage
        const memoryStorage = {};
        memoryStorage.setItem = (key, value) => { memoryStorage[key] = value; };
        memoryStorage.getItem = (key) => memoryStorage[key];
        results.apiUnavailable.fallback = true;
        results.apiUnavailable.fallbackType = 'memory';
      }
      
      return results;
    };
    
    errorHandlingTests.constraintErrors = constraintErrorTest();
    
    // Data validation with error recovery
    const dataValidationTest = () => {
      const testData = [
        { id: 1, name: 'Valid Item', value: 100 },
        { id: 'invalid', name: 'Invalid ID', value: 200 }, // Invalid ID type
        { id: 2, name: null, value: 300 }, // Invalid name
        { id: 3, name: 'Valid Item 2', value: 'invalid' }, // Invalid value
        null, // Null item
        { id: 4, name: 'Valid Item 3', value: 400 }
      ];
      
      const validationResults = {
        totalItems: testData.length,
        validItems: [],
        invalidItems: [],
        errors: []
      };
      
      testData.forEach((item, index) => {
        try {
          // Validation logic
          if (!item) {
            throw new Error(\`Item at index \${index} is null/undefined\`);
          }
          if (typeof item.id !== 'number') {
            throw new Error(\`Item at index \${index} has invalid ID type\`);
          }
          if (typeof item.name !== 'string' || !item.name) {
            throw new Error(\`Item at index \${index} has invalid name\`);
          }
          if (typeof item.value !== 'number') {
            throw new Error(\`Item at index \${index} has invalid value type\`);
          }
          
          validationResults.validItems.push(item);
        } catch (error) {
          validationResults.invalidItems.push({ index, item, error: error.message });
          validationResults.errors.push(error.message);
        }
      });
      
      return validationResults;
    };
    
    errorHandlingTests.dataValidationErrors = dataValidationTest();
    
    // Recovery mechanisms
    const recoveryTest = () => {
      const recoveryResults = {
        retryMechanism: { attempts: 0, success: false },
        circuitBreaker: { state: 'closed', failures: 0 },
        bulkheadPattern: { partitions: [], isolated: true }
      };
      
      // Retry mechanism
      const maxRetries = 3;
      let attempt = 0;
      
      while (attempt < maxRetries) {
        attempt++;
        try {
          // Simulate operation that might fail
          if (Math.random() > 0.3) { // 70% chance of success
            recoveryResults.retryMechanism.success = true;
            break;
          } else {
            throw new Error('Random failure');
          }
        } catch (e) {
          if (attempt === maxRetries) {
            recoveryResults.retryMechanism.finalError = e.message;
          }
        }
      }
      recoveryResults.retryMechanism.attempts = attempt;
      
      // Simple circuit breaker pattern
      const simulateServiceCall = () => {
        const failureRate = 0.6; // 60% failure rate
        return Math.random() > failureRate;
      };
      
      const maxFailures = 3;
      for (let i = 0; i < 5; i++) {
        if (recoveryResults.circuitBreaker.state === 'open') {
          break; // Circuit is open, stop calling
        }
        
        if (simulateServiceCall()) {
          recoveryResults.circuitBreaker.failures = 0; // Reset on success
        } else {
          recoveryResults.circuitBreaker.failures++;
          if (recoveryResults.circuitBreaker.failures >= maxFailures) {
            recoveryResults.circuitBreaker.state = 'open';
          }
        }
      }
      
      // Bulkhead pattern - isolate operations
      const operations = ['critical', 'normal', 'background'];
      operations.forEach(op => {
        try {
          // Simulate isolated operation
          const result = { operation: op, status: 'success', data: op + '_data' };
          recoveryResults.bulkheadPattern.partitions.push(result);
        } catch (e) {
          recoveryResults.bulkheadPattern.partitions.push({
            operation: op,
            status: 'failed',
            error: e.message
          });
          recoveryResults.bulkheadPattern.isolated = false;
        }
      });
      
      return recoveryResults;
    };
    
    errorHandlingTests.recoveryMechanisms = recoveryTest();
    
    return errorHandlingTests;
  `);
  
  const testData = (result && 'data' in result) ? result.data : result;
  
  // Validate constraint error handling
  const constraintErrors = testData.constraintErrors;
  t.true(constraintErrors.memoryIntensive.success || constraintErrors.memoryIntensive.fallback,
    'Memory intensive operation should succeed or fallback gracefully');
  t.true(constraintErrors.computeIntensive.success || constraintErrors.computeIntensive.fallback,
    'Compute intensive operation should succeed or fallback gracefully');
  t.true(constraintErrors.apiUnavailable.success || constraintErrors.apiUnavailable.fallback,
    'API unavailable should succeed or fallback gracefully');
  
  // Validate data validation
  const dataValidation = testData.dataValidationErrors;
  t.true(dataValidation.validItems.length > 0, 'Should have some valid items');
  t.true(dataValidation.invalidItems.length > 0, 'Should detect invalid items');
  t.is(dataValidation.validItems.length + dataValidation.invalidItems.length, 
       dataValidation.totalItems, 'All items should be processed');
  
  console.log(\`Data validation: \${dataValidation.validItems.length} valid, \${dataValidation.invalidItems.length} invalid\`);
  
  // Validate recovery mechanisms
  const recovery = testData.recoveryMechanisms;
  t.true(recovery.retryMechanism.attempts > 0, 'Retry mechanism should make attempts');
  t.true(['closed', 'open'].includes(recovery.circuitBreaker.state), 'Circuit breaker should have valid state');
  t.true(recovery.bulkheadPattern.partitions.length > 0, 'Bulkhead pattern should process operations');
  
  console.log(\`Recovery: \${recovery.retryMechanism.attempts} retries, circuit breaker \${recovery.circuitBreaker.state}\`);
});
```

---

## Integration Patterns

### 1. CLI Integration Pattern

**✅ Command Line Tool Integration:**
```javascript
// test/cli-integration.test.js
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import test from 'ava';

test('cli validation integration', (t) => {
  // Create a test plugin file
  const testPluginCode = \`
    // Test plugin code
    const processNodes = (nodes) => {
      return nodes.map(node => ({
        ...node,
        processed: true,
        timestamp: Date.now()
      }));
    };
    
    // Simulate small memory allocation
    const data = new Array(1000).fill('test');
    const result = processNodes([
      { id: '1', name: 'Rectangle' },
      { id: '2', name: 'Circle' }
    ]);
    
    console.log('Processed', result.length, 'nodes');
  \`;
  
  const testFilePath = './test-plugin-temp.js';
  writeFileSync(testFilePath, testPluginCode);
  
  try {
    // Test CLI validation
    const validationOutput = execSync(
      \`node ./packages/quickjs-test-framework/src/cli/index.ts validate \${testFilePath} --output json\`,
      { encoding: 'utf8' }
    );
    
    const validationResult = JSON.parse(validationOutput);
    
    // Validate CLI output structure
    t.true(validationResult.hasOwnProperty('filePath'));
    t.true(validationResult.hasOwnProperty('memoryCompliant'));
    t.true(validationResult.hasOwnProperty('overallPass'));
    t.is(validationResult.filePath, testFilePath);
    
    // Test CLI benchmark
    const benchmarkOutput = execSync(
      \`node ./packages/quickjs-test-framework/src/cli/index.ts benchmark \${testFilePath} --output json\`,
      { encoding: 'utf8' }
    );
    
    const benchmarkResult = JSON.parse(benchmarkOutput);
    
    // Validate benchmark output structure
    t.true(benchmarkResult.hasOwnProperty('overallScore'));
    t.true(benchmarkResult.hasOwnProperty('categories'));
    t.true(typeof benchmarkResult.overallScore === 'number');
    
    // Test CLI constraints
    const constraintsOutput = execSync(
      \`node ./packages/quickjs-test-framework/src/cli/index.ts constraints \${testFilePath} --memory --output json\`,
      { encoding: 'utf8' }
    );
    
    const constraintsResult = JSON.parse(constraintsOutput);
    
    // Validate constraints output structure
    t.true(constraintsResult.hasOwnProperty('checkedConstraints'));
    t.true(constraintsResult.checkedConstraints.memory);
    t.false(constraintsResult.checkedConstraints.uiBlocking); // Only memory was requested
    
  } finally {
    // Cleanup
    try {
      execSync(\`rm \${testFilePath}\`);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
});
```

### 2. CI/CD Integration Pattern

**✅ Continuous Integration Setup:**
```yaml
# .github/workflows/figma-plugin-validation.yml
name: Figma Plugin Validation

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  validate-plugin:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run standard tests
      run: npm test
    
    - name: Validate plugin constraints
      run: |
        npx quickfig validate ./src/plugin.ts --output json > validation-report.json
        cat validation-report.json
    
    - name: Performance benchmark
      run: |
        npx quickfig benchmark ./src/plugin.ts --output json > benchmark-report.json
        cat benchmark-report.json
    
    - name: Memory constraints check
      run: |
        npx quickfig constraints ./src/plugin.ts --memory --output json > memory-report.json
        cat memory-report.json
    
    - name: UI blocking constraints check
      run: |
        npx quickfig constraints ./src/plugin.ts --ui-blocking --output json > ui-report.json
        cat ui-report.json
    
    - name: Upload validation reports
      uses: actions/upload-artifact@v3
      with:
        name: figma-validation-reports
        path: |
          validation-report.json
          benchmark-report.json
          memory-report.json
          ui-report.json
    
    - name: Check validation results
      run: |
        node -e "
          const validation = JSON.parse(require('fs').readFileSync('validation-report.json', 'utf8'));
          const benchmark = JSON.parse(require('fs').readFileSync('benchmark-report.json', 'utf8'));
          
          console.log('Validation passed:', validation.overallPass);
          console.log('Performance score:', benchmark.overallScore);
          
          if (!validation.overallPass) {
            console.error('Validation failed!');
            process.exit(1);
          }
          
          if (benchmark.overallScore < 60) {
            console.error('Performance score too low!');
            process.exit(1);
          }
          
          console.log('All checks passed!');
        "
```

---

## Anti-Patterns to Avoid

### ❌ Common Mistakes and Solutions

#### 1. Function Context Capture
```javascript
// ❌ Wrong: Captures test context
test('bad pattern', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  const externalData = { value: 42 };
  
  const result = await runSandboxed(() => {
    return externalData.value; // This won't work!
  });
});

// ✅ Correct: Self-contained string
test('good pattern', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  const result = await runSandboxed(\`
    const data = { value: 42 };
    return data.value;
  \`);
});
```

#### 2. Blocking Operations
```javascript
// ❌ Wrong: Synchronous blocking operation
const result = await runSandboxed(\`
  for (let i = 0; i < 1000000; i++) {
    // Heavy computation that blocks UI
    Math.sqrt(i) * Math.sin(i) * Math.cos(i);
  }
\`);

// ✅ Correct: Chunked processing
const result = await runSandboxed(\`
  const processInChunks = (total, chunkSize = 1000) => {
    let result = 0;
    let processed = 0;
    
    while (processed < total) {
      const chunkEnd = Math.min(processed + chunkSize, total);
      for (let i = processed; i < chunkEnd; i++) {
        result += Math.sqrt(i);
      }
      processed = chunkEnd;
      
      // In real plugin, use setTimeout here for yielding
      if (processed % 10000 === 0) {
        // Yield point
      }
    }
    return result;
  };
  
  return processInChunks(100000);
\`);
```

#### 3. Memory Leaks
```javascript
// ❌ Wrong: Creates memory leaks
const result = await runSandboxed(\`
  const data = [];
  const circularRef = { items: data };
  data.push(circularRef); // Circular reference
  
  // Never cleaned up
  return data.length;
\`);

// ✅ Correct: Proper cleanup
const result = await runSandboxed(\`
  let data = [];
  const items = [1, 2, 3, 4, 5];
  
  try {
    data = items.map(item => ({ value: item }));
    return data.length;
  } finally {
    // Cleanup
    data = null;
  }
\`);
```

#### 4. Inefficient API Usage
```javascript
// ❌ Wrong: Inefficient repeated operations
const result = await runSandboxed(\`
  const nodes = Array.from({length: 1000}, (_, i) => ({id: i, name: 'node' + i}));
  const filtered = [];
  
  // Inefficient: Multiple array iterations
  for (const node of nodes) {
    if (nodes.find(n => n.id === node.id)) { // Unnecessary lookup
      filtered.push(node);
    }
  }
  
  return filtered.length;
\`);

// ✅ Correct: Efficient single pass
const result = await runSandboxed(\`
  const nodes = Array.from({length: 1000}, (_, i) => ({id: i, name: 'node' + i}));
  
  // Efficient: Single iteration with Map for O(1) lookups
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  const filtered = nodes.filter(node => nodeMap.has(node.id));
  
  return filtered.length;
\`);
```

---

## Advanced Techniques

### 1. Performance Profiling Integration

```javascript
test('advanced performance profiling', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  const result = await runSandboxed(\`
    // Built-in performance profiler
    class PerformanceProfiler {
      constructor() {
        this.metrics = {};
        this.start = Date.now();
      }
      
      mark(label) {
        this.metrics[label] = Date.now() - this.start;
      }
      
      measure(startLabel, endLabel) {
        return this.metrics[endLabel] - this.metrics[startLabel];
      }
      
      getReport() {
        return {
          totalTime: Date.now() - this.start,
          metrics: this.metrics,
          performance: this.analyzePerformance()
        };
      }
      
      analyzePerformance() {
        const times = Object.values(this.metrics);
        return {
          fastest: Math.min(...times),
          slowest: Math.max(...times),
          average: times.reduce((a, b) => a + b, 0) / times.length
        };
      }
    }
    
    const profiler = new PerformanceProfiler();
    
    // Profile different operations
    profiler.mark('data-generation-start');
    const data = Array.from({length: 5000}, (_, i) => ({
      id: i,
      value: Math.random(),
      computed: false
    }));
    profiler.mark('data-generation-end');
    
    profiler.mark('processing-start');
    const processed = data.map(item => ({
      ...item,
      computed: true,
      result: Math.sqrt(item.value) * 100
    }));
    profiler.mark('processing-end');
    
    profiler.mark('filtering-start');
    const filtered = processed.filter(item => item.result > 50);
    profiler.mark('filtering-end');
    
    profiler.mark('aggregation-start');
    const aggregated = {
      count: filtered.length,
      average: filtered.reduce((sum, item) => sum + item.result, 0) / filtered.length,
      max: Math.max(...filtered.map(item => item.result)),
      min: Math.min(...filtered.map(item => item.result))
    };
    profiler.mark('aggregation-end');
    
    return {
      data: aggregated,
      performance: profiler.getReport(),
      operationTimes: {
        dataGeneration: profiler.measure('data-generation-start', 'data-generation-end'),
        processing: profiler.measure('processing-start', 'processing-end'),
        filtering: profiler.measure('filtering-start', 'filtering-end'),
        aggregation: profiler.measure('aggregation-start', 'aggregation-end')
      }
    };
  \`);
  
  const testData = (result && 'data' in result) ? result.data : result;
  
  // Validate results
  t.true(testData.data.count > 0);
  t.true(testData.performance.totalTime > 0);
  
  // Log performance insights
  console.log('Performance Profile:');
  console.log(\`  Total time: \${testData.performance.totalTime}ms\`);
  console.log(\`  Data generation: \${testData.operationTimes.dataGeneration}ms\`);
  console.log(\`  Processing: \${testData.operationTimes.processing}ms\`);
  console.log(\`  Filtering: \${testData.operationTimes.filtering}ms\`);
  console.log(\`  Aggregation: \${testData.operationTimes.aggregation}ms\`);
  
  // Performance thresholds
  t.true(testData.performance.totalTime < 100, 'Total time should be under 100ms');
  t.true(testData.operationTimes.processing < 50, 'Processing should be under 50ms');
});
```

### 2. Dynamic Test Generation

```javascript
// Generate tests for different data sizes
[100, 1000, 5000].forEach(dataSize => {
  test(\`performance scaling with \${dataSize} items\`, async (t) => {
    const { runSandboxed } = await createFigmaTestEnvironment();
    
    const result = await runSandboxed(\`
      const dataSize = \${dataSize};
      const start = Date.now();
      
      // Generate test data
      const data = Array.from({length: dataSize}, (_, i) => ({
        id: i,
        value: Math.random(),
        category: i % 10
      }));
      
      // Perform operations
      const processed = data
        .filter(item => item.value > 0.5)
        .map(item => ({ ...item, doubled: item.value * 2 }))
        .reduce((acc, item) => {
          if (!acc[item.category]) acc[item.category] = [];
          acc[item.category].push(item);
          return acc;
        }, {});
      
      const duration = Date.now() - start;
      
      return {
        dataSize,
        duration,
        resultCount: Object.values(processed).flat().length,
        categoriesCount: Object.keys(processed).length
      };
    \`);
    
    const testData = (result && 'data' in result) ? result.data : result;
    
    // Validate scaling characteristics
    t.is(testData.dataSize, dataSize);
    t.true(testData.duration > 0);
    t.true(testData.resultCount <= dataSize);
    
    // Log scaling information
    console.log(\`\${dataSize} items: \${testData.duration}ms, \${testData.resultCount} results\`);
    
    // Performance should scale reasonably
    const timePerItem = testData.duration / dataSize;
    t.true(timePerItem < 0.1, \`Time per item (\${timePerItem.toFixed(4)}ms) should be under 0.1ms\`);
  });
});
```

---

## Summary

This guide provides comprehensive patterns for effective testing with QuickFig:

- **Core Patterns**: String-based execution, environment simulation, data validation
- **Constraint Testing**: Memory, UI blocking, and API compatibility validation
- **Performance Patterns**: Algorithm comparison, memory efficiency, profiling
- **Error Handling**: Graceful degradation, validation, recovery mechanisms
- **Integration**: CLI tools, CI/CD pipelines, automation
- **Anti-Patterns**: Common mistakes and their solutions
- **Advanced Techniques**: Performance profiling, dynamic test generation

Following these patterns will help you create robust, performant, and maintainable tests for your Figma plugins while ensuring they meet all constraint requirements.

For more examples and advanced patterns, check the [migration guide](./MIGRATION_GUIDE.md) and explore the framework's CLI tools for comprehensive validation and benchmarking.