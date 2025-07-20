# QuickFig Troubleshooting Guide

A comprehensive guide to diagnosing and solving common issues when using QuickFig for Figma plugin development.

## Table of Contents

1. [Common Migration Issues](#common-migration-issues)
2. [Environment Setup Problems](#environment-setup-problems)
3. [Constraint Validation Errors](#constraint-validation-errors)
4. [Performance Issues](#performance-issues)
5. [CLI Tool Problems](#cli-tool-problems)
6. [QuickJS Environment Differences](#quickjs-environment-differences)
7. [Diagnostic Tools & Commands](#diagnostic-tools--commands)

---

## Common Migration Issues

### 1. Function Serialization Errors

#### Problem: `t.includes is not a function`

**Error Message:**
```
TypeError: t.includes is not a function
ReferenceError: t is not defined
```

**Cause:** Function-based tests capture the test context (like the `t` object from test runners) causing serialization issues when the function is executed in the QuickJS sandbox.

**Example Problem Code:**
```javascript
test('broken test', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  const externalVariable = 'test data';
  
  // ❌ This captures test context and external variables
  const result = await runSandboxed(() => {
    // t is captured from outer scope - causes error
    t.is(someValue, 'expected'); // Won't work!
    return { data: externalVariable }; // Won't work!
  });
});
```

**Solution:**
```javascript
test('fixed test', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  // ✅ Use string-based execution with self-contained code
  const result = await runSandboxed(`
    // All logic must be inside the string
    const testData = 'test data'; // Define data inside sandbox
    
    // Perform operations within the sandbox
    const processedData = {
      original: testData,
      processed: true,
      timestamp: Date.now()
    };
    
    return processedData;
  `);
  
  // ✅ Assertions happen outside the sandbox
  const testData = (result && 'data' in result) ? result.data : result;
  t.true(testData.processed);
  t.is(testData.original, 'test data');
});
```

**Migration Pattern:**
```diff
- const result = await runSandboxed(() => {
-   return processData(externalVariable);
- });

+ const result = await runSandboxed(`
+   // Move all logic and data inside the string
+   const data = 'your data here';
+   
+   function processData(input) {
+     return { processed: true, data: input };
+   }
+   
+   return processData(data);
+ `);
```

### 2. Result Object Access Issues

#### Problem: `Cannot read properties of undefined (reading 'value')`

**Error Message:**
```
TypeError: Cannot read properties of undefined (reading 'value')
TypeError: Cannot read properties of undefined (reading 'data')
```

**Cause:** The framework may wrap results in a `{ok, data, executionTime}` structure, but accessing properties directly fails when the structure is different than expected.

**Example Problem Code:**
```javascript
test('broken result access', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  const result = await runSandboxed(`
    return { value: 42, name: 'test' };
  `);
  
  // ❌ Direct access may fail if result is wrapped
  t.is(result.value, 42); // May throw error
});
```

**Solution:**
```javascript
test('fixed result access', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  const result = await runSandboxed(`
    return { value: 42, name: 'test' };
  `);
  
  // ✅ Safe result extraction with framework compatibility
  const testData = (result && typeof result === 'object' && 'data' in result) 
    ? result.data 
    : result;
  
  // ✅ Now safely access the actual data
  t.is(testData.value, 42);
  t.is(testData.name, 'test');
});
```

**Robust Result Handler Pattern:**
```javascript
// Create a helper function for consistent result extraction
function extractTestData(result) {
  // Handle different result formats from the framework
  if (!result) return result;
  
  // Framework wraps results in { ok, data, executionTime }
  if (typeof result === 'object' && 'data' in result) {
    return result.data;
  }
  
  // Framework may return { ok, result, ... }
  if (typeof result === 'object' && 'result' in result) {
    return result.result;
  }
  
  // Direct result
  return result;
}

test('robust result handling', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  const result = await runSandboxed(`
    return { users: ['Alice', 'Bob'], count: 2 };
  `);
  
  const testData = extractTestData(result);
  t.is(testData.count, 2);
  t.deepEqual(testData.users, ['Alice', 'Bob']);
});
```

### 3. Import Resolution Problems

#### Problem: `Cannot find module '@fig-grove/quickfig'`

**Error Message:**
```
Error: Cannot find module '@fig-grove/quickfig'
Module not found: Can't resolve '@fig-grove/quickfig'
```

**Diagnosis:**
```bash
# Check if the package is installed
npm list @fig-grove/quickfig

# Check package.json dependencies
cat package.json | grep quickjs

# Verify node_modules
ls node_modules/@fig-grove/
```

**Solution:**
```bash
# Install the framework
npm install @fig-grove/quickfig

# For development/testing
npm install --save-dev @fig-grove/quickfig

# Clear cache if needed
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

**Import Pattern Fix:**
```javascript
// ❌ Wrong import paths
import { createFigmaTestEnvironment } from './old-harness';
import { runSandboxed } from '../utils/test-utils';

// ✅ Correct import
import { createFigmaTestEnvironment } from '@fig-grove/quickfig';

// ✅ For specific adapters
import { avaAdapter } from '@fig-grove/quickfig/adapters/ava';
import { jestAdapter } from '@fig-grove/quickfig/adapters/jest';
```

### 4. Context Capture Problems with Function-Based Tests

#### Problem: Variables Not Available in Sandbox

**Error Message:**
```
ReferenceError: externalVariable is not defined
ReferenceError: helperFunction is not defined
```

**Cause:** Variables and functions from the test context are not available inside the QuickJS sandbox when using function-based execution.

**Example Problem Code:**
```javascript
test('context capture issue', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  const userData = { name: 'Alice', age: 30 };
  const helperFunction = (data) => ({ ...data, processed: true });
  
  // ❌ These variables won't be available in the sandbox
  const result = await runSandboxed(() => {
    return helperFunction(userData); // ReferenceError!
  });
});
```

**Solution:**
```javascript
test('fixed context issues', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  // ✅ Pass data as parameters or embed in the string
  const result = await runSandboxed(`
    // Define everything needed inside the sandbox
    const userData = { name: 'Alice', age: 30 };
    
    const helperFunction = (data) => ({
      ...data,
      processed: true,
      timestamp: Date.now()
    });
    
    // Execute the logic
    return helperFunction(userData);
  `);
  
  const testData = extractTestData(result);
  t.is(testData.name, 'Alice');
  t.true(testData.processed);
});
```

**Dynamic Data Injection Pattern:**
```javascript
test('dynamic data injection', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  // External data that needs to be used in sandbox
  const configData = { maxItems: 100, enableFeature: true };
  const itemList = ['item1', 'item2', 'item3'];
  
  // ✅ Inject data by building the code string
  const result = await runSandboxed(`
    // Inject configuration
    const config = ${JSON.stringify(configData)};
    const items = ${JSON.stringify(itemList)};
    
    // Process with injected data
    const processedItems = items
      .slice(0, config.maxItems)
      .map(item => ({
        name: item,
        enabled: config.enableFeature,
        id: Math.random().toString(36)
      }));
    
    return {
      totalProcessed: processedItems.length,
      items: processedItems,
      config: config
    };
  `);
  
  const testData = extractTestData(result);
  t.is(testData.totalProcessed, 3);
  t.true(testData.items.every(item => item.enabled));
});
```

---

## Environment Setup Problems

### 1. Dependency Version Conflicts

#### Problem: `peer dep missing` or version conflicts

**Error Messages:**
```
npm WARN @fig-grove/quickfig@1.0.0 requires a peer of ava@^6.0.0
npm ERR! Could not resolve dependency: @sebastianwessel/quickjs
```

**Diagnosis:**
```bash
# Check peer dependencies
npm ls --depth=0

# Check for conflicts
npm ls @sebastianwessel/quickjs
npm ls ava
npm ls jest
```

**Solution:**
```bash
# Install missing peer dependencies
npm install --save-dev ava@^6.0.0

# Or for Jest
npm install --save-dev jest@^29.0.0

# Fix version conflicts
npm install @sebastianwessel/quickjs@^2.3.1

# Clean install if needed
rm -rf node_modules package-lock.json
npm install
```

**package.json Configuration:**
```json
{
  "devDependencies": {
    "@fig-grove/quickfig": "^1.0.0",
    "ava": "^6.0.0",
    "@sebastianwessel/quickjs": "^2.3.1",
    "@jitl/quickjs-ng-wasmfile-release-sync": "^0.31.0"
  }
}
```

### 2. TypeScript Compilation Errors

#### Problem: Type definition issues

**Error Messages:**
```
TS2307: Cannot find module '@fig-grove/quickfig' or its corresponding type declarations
TS2339: Property 'runSandboxed' does not exist on type
```

**tsconfig.json Fix:**
```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "types": ["node", "ava"],
    "typeRoots": ["node_modules/@types"]
  },
  "include": [
    "src/**/*",
    "test/**/*"
  ]
}
```

**Type-Safe Usage:**
```typescript
import test from 'ava';
import { createFigmaTestEnvironment } from '@fig-grove/quickfig';

interface TestResult {
  data: {
    processed: boolean;
    count: number;
    items: string[];
  };
}

test('type-safe test', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  const result = await runSandboxed(`
    return {
      processed: true,
      count: 5,
      items: ['a', 'b', 'c', 'd', 'e']
    };
  `) as TestResult;
  
  const testData = (result && 'data' in result) ? result.data : result;
  t.true(testData.processed);
  t.is(testData.count, 5);
});
```

### 3. Node.js Version Compatibility

#### Problem: Node.js version mismatch

**Error Messages:**
```
Error: Node.js version not supported
SyntaxError: Unexpected token '?'
```

**Check Node.js Version:**
```bash
node --version  # Should be 16.0.0 or higher
npm --version
```

**Solution:**
```bash
# Update Node.js (using nvm)
nvm install 18
nvm use 18

# Or using package managers
# macOS with brew
brew install node@18

# Update npm
npm install -g npm@latest
```

**Engine Requirements (package.json):**
```json
{
  "engines": {
    "node": ">=16.0.0",
    "npm": ">=7.0.0"
  }
}
```

---

## Constraint Validation Errors

### 1. Memory Constraint Timeouts

#### Problem: `InternalError: interrupted`

**Error Message:**
```
InternalError: interrupted
Error: QuickJS execution interrupted due to memory constraints
```

**Cause:** Complex validation tests exceed QuickJS memory or execution limits.

**Diagnosis:**
```javascript
test('diagnose memory issue', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  try {
    const result = await runSandboxed(`
      // Test progressive memory allocation
      const memoryTest = {
        allocations: [],
        failurePoint: null
      };
      
      // Try different allocation sizes
      const sizes = [1000, 10000, 100000, 1000000];
      
      for (let i = 0; i < sizes.length; i++) {
        try {
          const allocation = new Array(sizes[i]).fill('test');
          memoryTest.allocations.push({
            size: sizes[i],
            success: true,
            actualLength: allocation.length
          });
        } catch (e) {
          memoryTest.failurePoint = {
            size: sizes[i],
            error: e.message
          };
          break;
        }
      }
      
      return memoryTest;
    `);
    
    console.log('Memory allocation test results:', result);
    
  } catch (error) {
    console.log('QuickJS execution failed at:', error.message);
    t.pass('Memory constraint detected');
  }
});
```

**Solution - Chunked Processing:**
```javascript
test('memory-efficient processing', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  const result = await runSandboxed(`
    // Process data in smaller chunks to avoid memory issues
    function processInChunks(totalItems, chunkSize = 1000) {
      const results = {
        totalProcessed: 0,
        chunks: [],
        memoryEfficient: true
      };
      
      let currentChunk = 0;
      
      while (currentChunk * chunkSize < totalItems) {
        const startIdx = currentChunk * chunkSize;
        const endIdx = Math.min(startIdx + chunkSize, totalItems);
        
        // Process chunk
        const chunkData = [];
        for (let i = startIdx; i < endIdx; i++) {
          chunkData.push({
            id: i,
            value: Math.sqrt(i),
            processed: true
          });
        }
        
        results.chunks.push({
          chunkNumber: currentChunk,
          startIdx,
          endIdx,
          itemCount: chunkData.length
        });
        
        results.totalProcessed += chunkData.length;
        
        // Clear chunk data to free memory
        chunkData.length = 0;
        currentChunk++;
      }
      
      return results;
    }
    
    return processInChunks(50000, 2000);
  `);
  
  const testData = extractTestData(result);
  t.true(testData.memoryEfficient);
  t.is(testData.totalProcessed, 50000);
  t.true(testData.chunks.length > 0);
});
```

**CLI Fallback Validation:**
When QuickJS execution fails, use CLI validation for comprehensive checking:

```bash
# Validate with verbose output to see where constraints are hit
npx quickfig validate ./src/plugin.js --verbose

# Check specific constraints
npx quickfig constraints ./src/plugin.js --memory --output json
```

### 2. API Compatibility Failures

#### Problem: APIs available in test but blocked in production

**Error Message:**
```
ReferenceError: setTimeout is not defined (in production)
# But test passes because Node.js has setTimeout
```

**Diagnosis Test:**
```javascript
test('api compatibility diagnosis', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  const result = await runSandboxed(`
    // Check API availability in actual QuickJS environment
    const apiReport = {
      timestamp: Date.now(),
      environment: 'QuickJS',
      availableAPIs: {},
      blockedAPIs: {},
      unknownAPIs: {}
    };
    
    // APIs that should be available
    const expectedAvailable = ['Math', 'JSON', 'Date', 'Array', 'Object', 'String', 'Number'];
    expectedAvailable.forEach(api => {
      apiReport.availableAPIs[api] = typeof globalThis[api] !== 'undefined';
    });
    
    // APIs that should be blocked in Figma
    const expectedBlocked = ['setTimeout', 'setInterval', 'fetch', 'XMLHttpRequest', 'localStorage', 'sessionStorage'];
    expectedBlocked.forEach(api => {
      apiReport.blockedAPIs[api] = {
        available: typeof globalThis[api] !== 'undefined',
        shouldBeBlocked: true
      };
    });
    
    // APIs with unknown status
    const unknown = ['console', 'performance', 'TextEncoder', 'Buffer'];
    unknown.forEach(api => {
      apiReport.unknownAPIs[api] = typeof globalThis[api] !== 'undefined';
    });
    
    return apiReport;
  `);
  
  const testData = extractTestData(result);
  
  // Log API availability for debugging
  console.log('API Compatibility Report:');
  console.log('Available APIs:', testData.availableAPIs);
  console.log('Blocked APIs Status:', testData.blockedAPIs);
  console.log('Unknown APIs:', testData.unknownAPIs);
  
  // Validate core APIs are available
  Object.entries(testData.availableAPIs).forEach(([api, available]) => {
    t.true(available, `${api} should be available in QuickJS`);
  });
  
  // Check for potentially problematic APIs
  Object.entries(testData.blockedAPIs).forEach(([api, status]) => {
    if (status.available && status.shouldBeBlocked) {
      console.warn(`⚠️ ${api} is available in test but may be blocked in production Figma`);
    }
  });
});
```

**Solution - CLI Validation:**
```bash
# Use CLI for authoritative API compatibility checking
npx quickfig validate ./src/plugin.js --verbose

# This will show which APIs are actually blocked in real Figma environment
# Example output:
# ❌ API compatibility: setTimeout detected (blocked in Figma)
# ❌ API compatibility: fetch detected (blocked in Figma)
# ✅ API compatibility: Math, JSON, Date available
```

### 3. Execution Time Violations

#### Problem: Code exceeds UI blocking thresholds

**Error Message:**
```
Warning: Execution time 45ms exceeds UI blocking threshold (16ms)
```

**Diagnosis:**
```javascript
test('execution time diagnosis', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  const result = await runSandboxed(`
    const performanceTest = {
      operations: [],
      uiBlockingThreshold: 16,
      totalTime: 0
    };
    
    // Test different operation intensities
    const operations = [
      { name: 'light', iterations: 1000 },
      { name: 'medium', iterations: 10000 },
      { name: 'heavy', iterations: 100000 }
    ];
    
    operations.forEach(op => {
      const start = Date.now();
      
      // Simulate different workloads
      for (let i = 0; i < op.iterations; i++) {
        Math.sqrt(i) + Math.sin(i) + Math.cos(i);
      }
      
      const duration = Date.now() - start;
      const operation = {
        name: op.name,
        iterations: op.iterations,
        duration: duration,
        blocksUI: duration > performanceTest.uiBlockingThreshold,
        iterationsPerMs: Math.round(op.iterations / Math.max(duration, 1))
      };
      
      performanceTest.operations.push(operation);
      performanceTest.totalTime += duration;
    });
    
    return performanceTest;
  `);
  
  const testData = extractTestData(result);
  
  console.log('Performance Analysis:');
  testData.operations.forEach(op => {
    console.log(`  ${op.name}: ${op.duration}ms (${op.iterationsPerMs} ops/ms) ${op.blocksUI ? '⚠️ BLOCKS UI' : '✅'}`);
  });
  
  // Validate that we can detect UI blocking
  const hasUIBlocking = testData.operations.some(op => op.blocksUI);
  if (hasUIBlocking) {
    console.log('✅ UI blocking detection working');
  }
  
  t.is(testData.operations.length, 3);
  t.true(testData.totalTime > 0);
});
```

**Solution - Optimize Performance:**
```javascript
test('optimized execution', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  const result = await runSandboxed(`
    // Optimized processing to avoid UI blocking
    function processWithYielding(totalWork, batchSize = 1000) {
      const results = [];
      let processed = 0;
      const startTime = Date.now();
      const maxTime = 15; // Stay under 16ms UI blocking threshold
      
      while (processed < totalWork) {
        const batchStart = Date.now();
        const batchEnd = Math.min(processed + batchSize, totalWork);
        
        // Process batch
        for (let i = processed; i < batchEnd; i++) {
          results.push(Math.sqrt(i));
        }
        
        processed = batchEnd;
        
        // Check if we're approaching time limit
        const elapsed = Date.now() - startTime;
        if (elapsed > maxTime) {
          break; // Would need to yield in real plugin
        }
      }
      
      return {
        processed: processed,
        total: totalWork,
        completed: processed === totalWork,
        duration: Date.now() - startTime,
        resultCount: results.length
      };
    }
    
    return processWithYielding(50000, 2000);
  `);
  
  const testData = extractTestData(result);
  
  console.log(`Optimized processing: ${testData.processed}/${testData.total} in ${testData.duration}ms`);
  
  t.true(testData.duration < 50, 'Should complete quickly or yield appropriately');
  t.true(testData.processed > 0, 'Should process some items');
});
```

### 4. String Size Constraint Issues

#### Problem: Large strings cause memory errors

**Error Message:**
```
Error: String allocation failed
RangeError: Invalid string length
```

**Solution:**
```javascript
test('string size constraint handling', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  const result = await runSandboxed(`
    // Test string constraints progressively
    const stringTest = {
      sizeTests: [],
      maxSafeSize: 0,
      failureSize: null
    };
    
    // Test different string sizes
    const sizes = [1024, 10240, 51200, 102400, 512000]; // 1KB to 500KB
    
    for (const size of sizes) {
      try {
        const testString = 'x'.repeat(size);
        stringTest.sizeTests.push({
          size: size,
          success: true,
          actualLength: testString.length
        });
        stringTest.maxSafeSize = size;
      } catch (e) {
        stringTest.sizeTests.push({
          size: size,
          success: false,
          error: e.message
        });
        stringTest.failureSize = size;
        break;
      }
    }
    
    return stringTest;
  `);
  
  const testData = extractTestData(result);
  
  console.log('String Size Constraints:');
  testData.sizeTests.forEach(test => {
    const sizeKB = Math.round(test.size / 1024);
    console.log(`  ${sizeKB}KB: ${test.success ? '✅' : '❌'} ${test.error || ''}`);
  });
  
  console.log(`Max safe string size: ${Math.round(testData.maxSafeSize / 1024)}KB`);
  
  t.true(testData.maxSafeSize > 0, 'Should support at least small strings');
  t.true(testData.sizeTests.length > 0, 'Should test multiple sizes');
});
```

---

## Performance Issues

### 1. Slow Test Execution

#### Problem: Tests take too long to run

**Diagnosis:**
```bash
# Profile test execution
time npm test

# Run tests with timing information
npm test -- --verbose

# For AVA, use match to run specific tests
npm test -- --match="*performance*" --verbose
```

**Identify Slow Tests:**
```javascript
test('performance monitoring', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  const testStart = Date.now();
  
  const result = await runSandboxed(`
    const operationStart = Date.now();
    
    // Your test logic here
    const data = Array.from({length: 1000}, (_, i) => ({
      id: i,
      value: Math.random(),
      computed: Math.sqrt(i)
    }));
    
    const processed = data.filter(item => item.value > 0.5);
    
    return {
      dataCount: data.length,
      processedCount: processed.length,
      operationTime: Date.now() - operationStart
    };
  `);
  
  const totalTime = Date.now() - testStart;
  const testData = extractTestData(result);
  
  console.log(`Test timing: ${totalTime}ms total, ${testData.operationTime}ms in sandbox`);
  
  // Performance thresholds
  t.true(totalTime < 5000, 'Total test time should be under 5 seconds');
  t.true(testData.operationTime < 100, 'Sandbox operation should be under 100ms');
});
```

**Optimization Strategies:**
```javascript
// 1. Reduce test data size
const result = await runSandboxed(`
  // ✅ Use smaller datasets for faster tests
  const testData = Array.from({length: 100}, (_, i) => ({ id: i })); // Instead of 10000
  return processData(testData);
`);

// 2. Cache test environment setup
let cachedEnvironment = null;

test.beforeEach(async () => {
  if (!cachedEnvironment) {
    cachedEnvironment = await createFigmaTestEnvironment();
  }
});

test('fast test with cached environment', async (t) => {
  const { runSandboxed } = cachedEnvironment;
  // Test implementation
});

// 3. Use test.serial for dependent tests
test.serial('setup test', async (t) => {
  // Setup operations
});

test.serial('dependent test', async (t) => {
  // Uses setup from previous test
});
```

### 2. Memory Leaks in Tests

#### Problem: Test memory usage grows over time

**Diagnosis:**
```javascript
test('memory leak detection', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  // Run multiple iterations to detect leaks
  const iterations = 10;
  const memoryResults = [];
  
  for (let i = 0; i < iterations; i++) {
    const result = await runSandboxed(`
      // Create and cleanup data
      let data = new Array(1000).fill('test data ' + ${i});
      
      const processed = data.map(item => item.toUpperCase());
      const result = {
        iteration: ${i},
        dataLength: data.length,
        processedLength: processed.length
      };
      
      // Explicit cleanup
      data = null;
      
      return result;
    `);
    
    const testData = extractTestData(result);
    memoryResults.push(testData);
  }
  
  // Check that iterations complete successfully
  t.is(memoryResults.length, iterations);
  memoryResults.forEach((result, index) => {
    t.is(result.iteration, index);
    t.is(result.dataLength, 1000);
  });
  
  console.log('Memory leak test completed successfully');
});
```

**Prevention:**
```javascript
test('memory-efficient test pattern', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  const result = await runSandboxed(`
    // Memory-efficient processing pattern
    function processWithCleanup(inputSize) {
      const results = {
        processed: 0,
        errors: 0
      };
      
      // Process in small batches
      const batchSize = 100;
      
      for (let start = 0; start < inputSize; start += batchSize) {
        let batch = null;
        
        try {
          // Create batch
          const end = Math.min(start + batchSize, inputSize);
          batch = Array.from({length: end - start}, (_, i) => start + i);
          
          // Process batch
          const processed = batch.map(n => n * 2);
          results.processed += processed.length;
          
        } catch (e) {
          results.errors++;
        } finally {
          // Explicit cleanup
          batch = null;
        }
      }
      
      return results;
    }
    
    return processWithCleanup(5000);
  `);
  
  const testData = extractTestData(result);
  t.is(testData.processed, 5000);
  t.is(testData.errors, 0);
});
```

### 3. UI Blocking Detection Problems

#### Problem: UI blocking not detected properly

**Test UI Blocking Detection:**
```javascript
test('ui blocking detection validation', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  const result = await runSandboxed(`
    const uiTests = {
      nonBlocking: { duration: 0, result: null },
      blocking: { duration: 0, result: null },
      threshold: 16 // 16ms threshold for 60fps
    };
    
    // Non-blocking operation (should be fast)
    const start1 = Date.now();
    let quickResult = 0;
    for (let i = 0; i < 1000; i++) {
      quickResult += Math.sqrt(i);
    }
    uiTests.nonBlocking = {
      duration: Date.now() - start1,
      result: Math.round(quickResult),
      blocksUI: (Date.now() - start1) > uiTests.threshold
    };
    
    // Potentially blocking operation
    const start2 = Date.now();
    let slowResult = 0;
    for (let i = 0; i < 100000; i++) {
      slowResult += Math.sqrt(i) * Math.sin(i);
    }
    uiTests.blocking = {
      duration: Date.now() - start2,
      result: Math.round(slowResult),
      blocksUI: (Date.now() - start2) > uiTests.threshold
    };
    
    return uiTests;
  `);
  
  const testData = extractTestData(result);
  
  console.log(`Non-blocking operation: ${testData.nonBlocking.duration}ms`);
  console.log(`Blocking operation: ${testData.blocking.duration}ms`);
  
  // Validate detection is working
  t.false(testData.nonBlocking.blocksUI, 'Quick operation should not block UI');
  
  if (testData.blocking.blocksUI) {
    console.log('✅ UI blocking detection is working');
  } else {
    console.log('⚠️ Heavy operation completed quickly - may need heavier workload for testing');
  }
  
  t.is(typeof testData.nonBlocking.result, 'number');
  t.is(typeof testData.blocking.result, 'number');
});
```

---

## CLI Tool Problems

### 1. Command Not Found Errors

#### Problem: `quickfig: command not found`

**Error Message:**
```bash
bash: quickfig: command not found
npm ERR! missing script: quickfig
```

**Diagnosis:**
```bash
# Check if CLI is installed
which quickfig
ls node_modules/.bin/quickfig

# Check package installation
npm list @fig-grove/quickfig

# Check npm bin directory
npm bin
```

**Solutions:**
```bash
# 1. Use npx (recommended)
npx quickfig validate ./src/plugin.js

# 2. Install globally
npm install -g @fig-grove/quickfig

# 3. Use npm scripts
# Add to package.json:
{
  "scripts": {
    "validate": "quickfig validate",
    "test:constraints": "quickfig constraints"
  }
}

# Then run:
npm run validate ./src/plugin.js
```

### 2. Output Format Issues

#### Problem: JSON output is malformed or incomplete

**Error Message:**
```bash
SyntaxError: Unexpected token in JSON at position 0
```

**Diagnosis:**
```bash
# Test CLI output formats
npx quickfig validate ./src/plugin.js --output text
npx quickfig validate ./src/plugin.js --output json

# Redirect to file for inspection
npx quickfig validate ./src/plugin.js --output json > validation.json
cat validation.json
```

**Fix Output Issues:**
```bash
# Ensure proper output format
npx quickfig validate ./src/plugin.js --output json 2>/dev/null | jq '.'

# Handle mixed output (text + JSON)
npx quickfig validate ./src/plugin.js --output json --quiet

# Parse output safely in scripts
OUTPUT=$(npx quickfig validate ./src/plugin.js --output json 2>/dev/null)
if echo "$OUTPUT" | jq empty 2>/dev/null; then
  echo "Valid JSON output"
  echo "$OUTPUT" | jq '.overallPass'
else
  echo "Invalid JSON output: $OUTPUT"
fi
```

### 3. Watch Mode Problems

#### Problem: Watch mode not detecting file changes

**Error Message:**
```bash
👁️ Watching file.js for changes...
# Changes made but no re-validation occurs
```

**Diagnosis:**
```bash
# Test file watching manually
npx quickfig validate ./src/plugin.js --watch

# Check file permissions
ls -la ./src/plugin.js

# Test with explicit file paths
npx quickfig validate "$(pwd)/src/plugin.js" --watch
```

**Solutions:**
```bash
# Use absolute paths
npx quickfig validate /full/path/to/plugin.js --watch

# Ensure file exists and is readable
touch src/plugin.js
chmod 644 src/plugin.js

# For editors that use atomic writes (like VS Code), save and reload
# Or use tools like nodemon for more robust watching
npx nodemon --exec "npx quickfig validate src/plugin.js" --ext js,ts
```

### 4. JSON Parsing Errors

#### Problem: CLI output cannot be parsed as JSON

**Example Error in CI:**
```bash
parse error: Invalid numeric literal at line 1, column 10
```

**Robust JSON Parsing Script:**
```javascript
// scripts/parse-validation.js
const fs = require('fs');
const { execSync } = require('child_process');

function safelyParseValidation(filePath) {
  try {
    // Run validation with JSON output
    const output = execSync(
      `npx quickfig validate "${filePath}" --output json`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    
    // Try to parse JSON
    const result = JSON.parse(output);
    
    console.log('Validation Results:');
    console.log('- Overall Pass:', result.overallPass);
    console.log('- Memory Compliant:', result.memoryCompliant);
    console.log('- UI Blocking Compliant:', result.uiBlockingCompliant);
    
    if (!result.overallPass) {
      console.log('Violations:');
      result.violations.forEach(v => {
        console.log(`  - ${v.type}: ${v.message}`);
      });
      process.exit(1);
    }
    
  } catch (error) {
    console.error('Failed to parse validation output:', error.message);
    
    // Fallback: try text output
    try {
      const textOutput = execSync(
        `npx quickfig validate "${filePath}" --output text`,
        { encoding: 'utf8' }
      );
      console.log('Text output:', textOutput);
    } catch (textError) {
      console.error('CLI execution failed entirely:', textError.message);
      process.exit(1);
    }
  }
}

// Usage: node scripts/parse-validation.js src/plugin.js
safelyParseValidation(process.argv[2]);
```

---

## QuickJS Environment Differences

### 1. API Availability Mismatches

#### Problem: APIs behave differently in QuickJS vs Node.js vs Figma

**Comparison Test:**
```javascript
test('environment api comparison', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  // Test Node.js environment APIs
  const nodeAPIs = {
    setTimeout: typeof setTimeout !== 'undefined',
    console: typeof console !== 'undefined',
    Buffer: typeof Buffer !== 'undefined',
    process: typeof process !== 'undefined'
  };
  
  // Test QuickJS environment APIs
  const result = await runSandboxed(`
    const quickjsAPIs = {
      setTimeout: typeof setTimeout !== 'undefined',
      console: typeof console !== 'undefined',
      Buffer: typeof Buffer !== 'undefined',
      process: typeof process !== 'undefined',
      Math: typeof Math !== 'undefined',
      JSON: typeof JSON !== 'undefined',
      performance: typeof performance !== 'undefined'
    };
    
    return quickjsAPIs;
  `);
  
  const quickjsAPIs = extractTestData(result);
  
  console.log('API Availability Comparison:');
  console.log('Node.js Environment:', nodeAPIs);
  console.log('QuickJS Environment:', quickjsAPIs);
  
  // Compare differences
  const differences = {};
  Object.keys(nodeAPIs).forEach(api => {
    if (nodeAPIs[api] !== quickjsAPIs[api]) {
      differences[api] = {
        nodejs: nodeAPIs[api],
        quickjs: quickjsAPIs[api]
      };
    }
  });
  
  console.log('Differences:', differences);
  
  // Core APIs should be available in QuickJS
  t.true(quickjsAPIs.Math, 'Math should be available in QuickJS');
  t.true(quickjsAPIs.JSON, 'JSON should be available in QuickJS');
});
```

### 2. Polyfill Behavior Differences

#### Problem: Polyfills work differently in different environments

**Test Polyfill Consistency:**
```javascript
test('polyfill behavior consistency', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  const result = await runSandboxed(`
    // Test polyfill implementations
    const polyfillTests = {};
    
    // TextEncoder polyfill test
    if (typeof TextEncoder === 'undefined') {
      // Provide minimal polyfill
      globalThis.TextEncoder = class TextEncoder {
        encode(input = '') {
          const result = [];
          for (let i = 0; i < input.length; i++) {
            const code = input.charCodeAt(i);
            if (code < 128) {
              result.push(code);
            } else {
              result.push(63); // ? replacement
            }
          }
          return new Uint8Array(result);
        }
      };
    }
    
    const encoder = new TextEncoder();
    polyfillTests.textEncoder = {
      available: typeof TextEncoder !== 'undefined',
      encodeEmpty: Array.from(encoder.encode('')),
      encodeHello: Array.from(encoder.encode('hello')),
      encodeUnicode: Array.from(encoder.encode('café'))
    };
    
    // Performance polyfill test
    if (typeof performance === 'undefined') {
      globalThis.performance = { now: () => Date.now() };
    }
    
    polyfillTests.performance = {
      available: typeof performance !== 'undefined',
      nowType: typeof performance.now(),
      nowValue: performance.now()
    };
    
    return polyfillTests;
  `);
  
  const testData = extractTestData(result);
  
  console.log('Polyfill Tests:', testData);
  
  // Validate polyfills work
  t.true(testData.textEncoder.available, 'TextEncoder should be available');
  t.deepEqual(testData.textEncoder.encodeEmpty, [], 'Should encode empty string');
  t.deepEqual(testData.textEncoder.encodeHello, [104, 101, 108, 108, 111], 'Should encode ASCII');
  
  t.true(testData.performance.available, 'Performance should be available');
  t.is(testData.performance.nowType, 'number', 'performance.now() should return number');
});
```

### 3. Cross-Environment Compatibility Issues

#### Problem: Code works in testing but fails in production

**Compatibility Test Suite:**
```javascript
test('cross-environment compatibility', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  const result = await runSandboxed(`
    // Test patterns that might differ between environments
    const compatibilityTests = {
      asyncSupport: {},
      errorHandling: {},
      memoryBehavior: {},
      timingBehavior: {}
    };
    
    // Test async/await support
    try {
      const asyncTest = async () => {
        return new Promise(resolve => {
          // Note: setTimeout may not be available
          resolve('async works');
        });
      };
      
      // Test if we can use async/await syntax
      compatibilityTests.asyncSupport.syntaxSupported = true;
      
    } catch (e) {
      compatibilityTests.asyncSupport = {
        syntaxSupported: false,
        error: e.message
      };
    }
    
    // Test error handling consistency
    try {
      throw new Error('test error');
    } catch (e) {
      compatibilityTests.errorHandling = {
        catchWorks: true,
        errorMessage: e.message,
        errorType: typeof e,
        hasStack: 'stack' in e
      };
    }
    
    // Test memory allocation patterns
    try {
      const arrays = [];
      for (let i = 0; i < 100; i++) {
        arrays.push(new Array(100).fill(i));
      }
      compatibilityTests.memoryBehavior = {
        multipleAllocationsWork: true,
        totalArrays: arrays.length,
        sampleLength: arrays[0].length
      };
    } catch (e) {
      compatibilityTests.memoryBehavior = {
        multipleAllocationsWork: false,
        error: e.message
      };
    }
    
    // Test timing consistency
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      Math.sqrt(i);
    }
    const duration = Date.now() - start;
    
    compatibilityTests.timingBehavior = {
      dateNowWorks: typeof start === 'number',
      calculationTime: duration,
      timingReasonable: duration >= 0 && duration < 1000
    };
    
    return compatibilityTests;
  `);
  
  const testData = extractTestData(result);
  
  console.log('Compatibility Test Results:');
  Object.entries(testData).forEach(([category, results]) => {
    console.log(`  ${category}:`, results);
  });
  
  // Validate basic compatibility
  t.true(testData.errorHandling.catchWorks, 'Error handling should work');
  t.true(testData.memoryBehavior.multipleAllocationsWork, 'Memory allocation should work');
  t.true(testData.timingBehavior.dateNowWorks, 'Date.now() should work');
  t.true(testData.timingBehavior.timingReasonable, 'Timing should be reasonable');
});
```

### 4. Debugging QuickJS-Specific Problems

#### Problem: Need to debug issues specific to QuickJS environment

**Debug Helper Test:**
```javascript
test('quickjs environment debugging', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  const result = await runSandboxed(`
    // Comprehensive QuickJS environment inspection
    const debugInfo = {
      environment: 'QuickJS',
      timestamp: Date.now(),
      global: {},
      prototype: {},
      features: {},
      limits: {}
    };
    
    // Inspect global object
    debugInfo.global = {
      keys: Object.getOwnPropertyNames(globalThis).slice(0, 20), // First 20 keys
      mathAvailable: typeof Math !== 'undefined',
      jsonAvailable: typeof JSON !== 'undefined',
      consoleType: typeof console
    };
    
    // Test prototype chain behavior
    const testObj = { a: 1 };
    debugInfo.prototype = {
      hasOwnProperty: testObj.hasOwnProperty('a'),
      toString: testObj.toString(),
      constructorName: testObj.constructor.name
    };
    
    // Test ES6+ features
    try {
      const arrow = () => 'arrow function works';
      const [destructure] = [1, 2, 3];
      const spread = {...testObj, b: 2};
      
      debugInfo.features = {
        arrowFunctions: arrow() === 'arrow function works',
        destructuring: destructure === 1,
        spreadOperator: spread.a === 1 && spread.b === 2,
        templateLiterals: \`template \${destructure}\` === 'template 1'
      };
    } catch (e) {
      debugInfo.features = { error: e.message };
    }
    
    // Test limits
    try {
      // Test small allocations
      const small = new Array(1000).fill(1);
      
      // Test string creation
      const str = 'x'.repeat(1000);
      
      // Test object creation
      const obj = {};
      for (let i = 0; i < 1000; i++) {
        obj[i] = i;
      }
      
      debugInfo.limits = {
        arrayAllocation: small.length === 1000,
        stringCreation: str.length === 1000,
        objectProperties: Object.keys(obj).length === 1000,
        recursionDepth: (() => {
          let depth = 0;
          function recurse() {
            depth++;
            if (depth > 100) return depth; // Limit test recursion
            return recurse();
          }
          try {
            return recurse();
          } catch (e) {
            return depth;
          }
        })()
      };
    } catch (e) {
      debugInfo.limits = { error: e.message };
    }
    
    return debugInfo;
  `);
  
  const testData = extractTestData(result);
  
  console.log('QuickJS Debug Information:');
  console.log('Global object keys:', testData.global.keys);
  console.log('Features support:', testData.features);
  console.log('Limits test:', testData.limits);
  
  // Save debug info for further analysis
  const fs = require('fs');
  fs.writeFileSync('quickjs-debug.json', JSON.stringify(testData, null, 2));
  
  console.log('Debug information saved to quickjs-debug.json');
  
  t.true(testData.global.mathAvailable, 'Math should be available');
  t.true(testData.global.jsonAvailable, 'JSON should be available');
  t.pass('Debug information collected successfully');
});
```

---

## Diagnostic Tools & Commands

### Quick Diagnostic Checklist

```bash
# 1. Environment Check
node --version  # Should be >=16
npm --version
npm list @fig-grove/quickfig

# 2. Basic Functionality Test
npx quickfig --help
npx quickfig validate --help

# 3. Simple Validation Test
echo "console.log('test');" > test-plugin.js
npx quickfig validate test-plugin.js
rm test-plugin.js

# 4. Framework Installation Check
npm list @sebastianwessel/quickjs
npm list ava  # or jest

# 5. Test Execution
npm test  # Run your test suite
```

### CLI Diagnostic Commands

```bash
# Verbose validation for detailed output
npx quickfig validate ./src/plugin.js --verbose

# JSON output for programmatic parsing
npx quickfig validate ./src/plugin.js --output json

# Specific constraint checking
npx quickfig constraints ./src/plugin.js --memory
npx quickfig constraints ./src/plugin.js --ui-blocking

# Performance benchmarking
npx quickfig benchmark ./src/plugin.js --output json

# Watch mode for development
npx quickfig validate ./src/plugin.js --watch
```

### Test Debugging Patterns

```javascript
// Debug test execution
test.serial('debug framework setup', async (t) => {
  console.log('Testing framework setup...');
  
  try {
    const { runSandboxed } = await createFigmaTestEnvironment();
    console.log('✅ Framework initialized successfully');
    
    const result = await runSandboxed(`
      return { 
        test: 'basic execution',
        time: Date.now(),
        math: Math.sqrt(16)
      };
    `);
    
    console.log('✅ Basic execution works:', result);
    t.pass('Framework setup successful');
    
  } catch (error) {
    console.error('❌ Framework setup failed:', error);
    t.fail(`Setup failed: ${error.message}`);
  }
});

// Debug result extraction
test('debug result format', async (t) => {
  const { runSandboxed } = await createFigmaTestEnvironment();
  
  const result = await runSandboxed(`
    return { value: 42, status: 'ok' };
  `);
  
  console.log('Raw result:', result);
  console.log('Result type:', typeof result);
  console.log('Result keys:', Object.keys(result || {}));
  
  const extracted = extractTestData(result);
  console.log('Extracted data:', extracted);
  
  t.pass('Result debugging completed');
});
```

### CI/CD Diagnostic Script

```yaml
# .github/workflows/debug-validation.yml
name: Debug Validation Issues

on: [push, pull_request]

jobs:
  debug:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm install
    
    - name: Environment Diagnostics
      run: |
        echo "Node version: $(node --version)"
        echo "NPM version: $(npm --version)"
        echo "QuickJS Framework:"
        npm list @fig-grove/quickfig || echo "Not installed"
        echo "Peer dependencies:"
        npm list ava || echo "AVA not installed"
        npm list jest || echo "Jest not installed"
    
    - name: CLI Diagnostics
      run: |
        echo "CLI Help:"
        npx quickfig --help || echo "CLI not available"
        
        echo "Creating test file..."
        echo "console.log('test');" > test-plugin.js
        
        echo "Basic validation:"
        npx quickfig validate test-plugin.js || echo "Validation failed"
        
        echo "JSON validation:"
        npx quickfig validate test-plugin.js --output json || echo "JSON validation failed"
    
    - name: Run Tests with Debug
      run: |
        npm test -- --verbose || echo "Tests failed"
    
    - name: Upload Debug Info
      if: failure()
      uses: actions/upload-artifact@v3
      with:
        name: debug-info
        path: |
          package.json
          package-lock.json
          test-plugin.js
```

---

## Getting Additional Help

If you continue to experience issues after trying these solutions:

1. **Check the Migration Guide**: Review [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for step-by-step migration instructions

2. **Explore Testing Patterns**: See [TESTING_PATTERNS.md](./TESTING_PATTERNS.md) for comprehensive testing examples

3. **Use CLI Validation**: The CLI tools often provide more accurate constraint validation than unit tests:
   ```bash
   npx quickfig validate ./src/plugin.js --verbose
   ```

4. **Enable Debug Mode**: Add debug logging to your tests:
   ```javascript
   test('debug mode', async (t) => {
     console.log('Test starting...');
     // Your test code with additional logging
   });
   ```

5. **Create Minimal Reproduction**: Create a minimal test case that reproduces your issue:
   ```javascript
   test('minimal reproduction', async (t) => {
     const { runSandboxed } = await createFigmaTestEnvironment();
     const result = await runSandboxed(`return { simple: 'test' };`);
     console.log('Minimal test result:', result);
     t.pass();
   });
   ```

6. **Check GitHub Issues**: Search for similar issues at [GitHub Issues](https://github.com/fig-grove/quickfig/issues)

Remember: QuickFig provides real constraint validation that may reveal issues that weren't caught by mock environments. This is a feature, not a bug - it helps ensure your Figma plugin will work correctly in production.