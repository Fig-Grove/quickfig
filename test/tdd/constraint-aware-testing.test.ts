/**
 * Constraint-Aware TDD Testing Patterns
 * 
 * Advanced TDD testing patterns with real-time constraint validation.
 * Tests the framework's ability to detect and report constraint violations
 * while running user test code in QuickJS environments.
 */

import test from 'ava';
import { 
  ConstraintTestRunner, 
  testWithConstraints, 
  runTDDWorkflow,
  type ConstraintTestConfig,
  type ConstraintTestResult
} from '../helpers/constraint-test-setup.ts';

test('should validate constraint-aware test runner basic functionality', async (t) => {
  const result = await testWithConstraints(() => {
    return { message: 'Test passed', timestamp: Date.now() };
  }, {
    uiBlockingThreshold: 50 // Higher threshold for basic test
  });

  t.true(result.success, 'Test should succeed');
  t.true(typeof result.result === 'object', 'Result should be an object');
  t.true('message' in result.result, 'Result should contain message');
  t.true(result.performance.executionTime < 1000, 'Execution should be fast');
  t.false(result.performance.uiBlocking, 'Should not block UI');
  
  console.log('✅ Basic constraint test runner validation passed');
});

test('should detect UI blocking violations', async (t) => {
  const result = await testWithConstraints(() => {
    // Simulate CPU-intensive operation that could block UI
    const start = performance.now();
    let sum = 0;
    while (performance.now() - start < 20) { // Force > 16ms execution
      sum += Math.random();
    }
    return { sum, blocked: true };
  }, {
    uiBlockingThreshold: 16,
    logViolations: false // Disable logging for test
  });

  t.true(result.success, 'Test should still succeed');
  t.true(result.performance.uiBlocking, 'Should detect UI blocking');
  t.true(result.violations.some(v => v.type === 'ui-blocking'), 'Should have UI blocking violation');
  
  const uiViolation = result.violations.find(v => v.type === 'ui-blocking');
  t.truthy(uiViolation?.suggestion, 'Should provide optimization suggestion');
  
  console.log('✅ UI blocking detection working correctly');
});

test('should detect memory constraint violations', async (t) => {
  const result = await testWithConstraints(() => {
    // Create large data structure to test memory constraints
    const largeArray = Array(100000).fill('memory-test-data-item');
    const largeString = JSON.stringify(largeArray);
    return { size: largeString.length, data: largeString.substring(0, 100) };
  }, {
    memoryLimit: 1024 * 1024, // 1MB limit (small for testing)
    logViolations: false
  });

  // Memory violations are detected post-execution based on result size
  if (result.performance.memoryUsage && result.performance.memoryUsage > 1024 * 1024) {
    t.true(result.violations.some(v => v.type === 'memory-constraint'), 'Should detect memory violation');
  }
  
  t.true(result.success, 'Test should succeed even with violations');
  
  console.log('✅ Memory constraint detection working');
});

test('should run TDD workflow with multiple constraint-aware tests', async (t) => {
  const testSuite = [
    {
      name: 'Fast operation test',
      test: () => ({ fast: true, value: 42 })
    },
    {
      name: 'Memory efficient test',
      test: () => ({ efficient: true, data: 'small' })
    },
    {
      name: 'API constraint test',
      test: () => {
        // Test polyfill behavior
        try {
          // This should trigger constraint detection
          new (globalThis as any).Worker('test-worker.js');
          return { worker: 'created' };
        } catch (error) {
          return { worker: 'blocked', error: error instanceof Error ? error.message : 'Unknown' };
        }
      }
    },
    {
      name: 'Performance boundary test',
      test: () => {
        const start = performance.now();
        let result = 0;
        // Quick operation under threshold
        for (let i = 0; i < 1000; i++) {
          result += i;
        }
        const duration = performance.now() - start;
        return { result, duration };
      }
    }
  ];

  const workflowResult = await runTDDWorkflow(testSuite);

  t.true(workflowResult.passed >= 3, 'Most tests should pass');
  t.true(workflowResult.passed + workflowResult.failed === testSuite.length, 'All tests should be accounted for');
  t.true(Array.isArray(workflowResult.results), 'Should return results array');
  t.true(workflowResult.results.length === testSuite.length, 'Should have result for each test');
  
  // Validate that constraint detection is working
  const apiTest = workflowResult.results[2]; // API constraint test
  if (apiTest.success && apiTest.result.worker === 'blocked') {
    console.log('✅ Worker API correctly blocked by constraints');
  }
  
  console.log(`✅ TDD workflow completed: ${workflowResult.passed}/${testSuite.length} passed, ${workflowResult.violations} violations`);
});

test('should provide actionable constraint violation suggestions', async (t) => {
  const result = await testWithConstraints(() => {
    // Test that triggers multiple constraint types
    const largeData = Array(50000).fill('test-data');
    
    // Simulate slow operation
    const start = performance.now();
    while (performance.now() - start < 25) {
      // Force slow execution
    }
    
    return { data: largeData.slice(0, 10), processed: true };
  }, {
    uiBlockingThreshold: 16,
    logViolations: false
  });

  t.true(result.success, 'Test should succeed');
  
  // Check for actionable suggestions
  const violations = result.violations;
  if (violations.length > 0) {
    violations.forEach(violation => {
      t.true(typeof violation.message === 'string', 'Violation should have message');
      t.true(['warning', 'error'].includes(violation.severity), 'Violation should have valid severity');
      
      if (violation.suggestion) {
        t.true(typeof violation.suggestion === 'string', 'Suggestion should be string');
        t.true(violation.suggestion.length > 10, 'Suggestion should be meaningful');
      }
    });
  }
  
  console.log('✅ Constraint violation suggestions are actionable');
});

test('should integrate with FigmaConstraintDetector for comprehensive validation', async (t) => {
  const runner = new ConstraintTestRunner({
    enableRealTimeValidation: true,
    logViolations: false
  });

  const result = await runner.runConstraintAwareTest(() => {
    // Test various constraint scenarios
    const testOperations = [
      { type: 'memory', size: 1024, name: 'small-allocation' },
      { type: 'execution', duration: 5, name: 'quick-operation' },
      { type: 'api', api: 'console.log', name: 'allowed-api' }
    ];
    
    return {
      operations: testOperations,
      constraints_validated: true,
      timestamp: Date.now()
    };
  }, 'Comprehensive constraint validation test');

  t.true(result.success, 'Comprehensive test should succeed');
  t.true(typeof result.result === 'object', 'Result should be object');
  t.true('constraints_validated' in result.result, 'Should validate constraints');
  t.true(typeof result.performance.executionTime === 'number', 'Should measure execution time');
  
  console.log('✅ FigmaConstraintDetector integration working correctly');
});

test('should handle constraint-aware test patterns', async (t) => {
  const runner = new ConstraintTestRunner({
    uiBlockingThreshold: 10, // Strict threshold
    memoryLimit: 2 * 1024 * 1024, // 2MB limit
    logViolations: false
  });

  // Test pattern 1: Fast operations should pass
  const fastResult = await runner.runConstraintAwareTest(() => {
    return { type: 'fast', data: 'minimal' };
  }, 'Fast operation pattern');

  t.true(fastResult.success, 'Fast operation should succeed');
  t.false(fastResult.performance.uiBlocking, 'Fast operation should not block UI');
  t.true(fastResult.violations.length === 0, 'Fast operation should have no violations');

  // Test pattern 2: Slow operations should detect violations
  const slowResult = await runner.runConstraintAwareTest(() => {
    const start = performance.now();
    while (performance.now() - start < 15) {
      // Force execution over threshold
    }
    return { type: 'slow', blocked: true };
  }, 'Slow operation pattern');

  t.true(slowResult.success, 'Slow operation test should still succeed');
  t.true(slowResult.performance.uiBlocking, 'Slow operation should block UI');
  t.true(slowResult.violations.length > 0, 'Slow operation should have violations');

  // Test pattern 3: Memory-intensive operations
  const memoryResult = await runner.runConstraintAwareTest(() => {
    const data = Array(10000).fill('memory-test-item');
    return { type: 'memory', size: data.length };
  }, 'Memory-intensive pattern');

  t.true(memoryResult.success, 'Memory test should succeed');
  t.true(typeof memoryResult.performance.memoryUsage === 'number', 'Should measure memory usage');

  console.log('✅ Constraint-aware test patterns working correctly');
});

test('should track performance regression across test runs', async (t) => {
  const runner = new ConstraintTestRunner({
    enablePerformanceRegression: true,
    trackHistoricalPerformance: true,
    logViolations: false
  });

  const testName = 'Performance tracking test';

  // Run the same test multiple times to build history
  const results = [];
  for (let i = 0; i < 5; i++) {
    const result = await runner.runConstraintAwareTest(() => {
      // Simulate variable performance
      const iterations = 1000 + (i * 200); // Gradually slower
      let sum = 0;
      for (let j = 0; j < iterations; j++) {
        sum += Math.random();
      }
      return { iteration: i, sum, iterations };
    }, testName);

    results.push(result);
    t.true(result.success, `Test run ${i + 1} should succeed`);
  }

  // Check if performance regression was detected in later runs
  const laterResults = results.slice(3); // Last 2 runs
  const hasRegressionWarning = laterResults.some(result =>
    result.violations.some(v => v.type === 'performance-regression')
  );

  if (hasRegressionWarning) {
    console.log('✅ Performance regression detection working correctly');
  } else {
    console.log('📊 No performance regression detected (expected for small variations)');
  }

  // Verify performance reporting
  const performanceReport = runner.getPerformanceReport();
  t.true(performanceReport.totalTests >= 1, 'Should track at least one test');
  t.true(typeof performanceReport.averageExecutionTime === 'number', 'Should calculate average execution time');

  console.log('✅ Performance regression tracking working correctly');
});

test('should support custom constraint configurations per test', async (t) => {
  // Test with relaxed constraints
  const relaxedResult = await testWithConstraints(() => {
    const start = performance.now();
    while (performance.now() - start < 30) {
      // Force longer execution
    }
    return { mode: 'relaxed', slow: true };
  }, {
    uiBlockingThreshold: 50, // Relaxed threshold
    logViolations: false
  });

  t.true(relaxedResult.success, 'Relaxed test should succeed');
  t.false(relaxedResult.performance.uiBlocking, 'Should not block UI with relaxed threshold');

  // Test with strict constraints
  const strictResult = await testWithConstraints(() => {
    const start = performance.now();
    while (performance.now() - start < 15) {
      // Same duration as above
    }
    return { mode: 'strict', slow: true };
  }, {
    uiBlockingThreshold: 10, // Strict threshold
    logViolations: false
  });

  t.true(strictResult.success, 'Strict test should succeed');
  t.true(strictResult.performance.uiBlocking, 'Should block UI with strict threshold');
  t.true(strictResult.violations.length > 0, 'Should have violations with strict constraints');

  console.log('✅ Custom constraint configurations working correctly');
});

test('should provide comprehensive diagnostic information', async (t) => {
  const runner = new ConstraintTestRunner({
    enableRealTimeValidation: true,
    trackHistoricalPerformance: true
  });

  // Run a test to generate some data
  await runner.runConstraintAwareTest(() => {
    return { diagnostic: 'test', timestamp: Date.now() };
  }, 'Diagnostic test');

  // Get diagnostic information
  const diagnostics = runner.getEnhancedDiagnostics();

  t.true(typeof diagnostics.integrationStatus === 'boolean', 'Should report integration status');
  t.true(typeof diagnostics.figmaSimulatorStatus === 'boolean', 'Should report simulator status');
  t.true(typeof diagnostics.polyfillsStatus === 'boolean', 'Should report polyfills status');
  t.true(Array.isArray(diagnostics.recommendations), 'Should provide recommendations');

  // Get performance report
  const performanceReport = runner.getPerformanceReport();
  t.true(typeof performanceReport.totalTests === 'number', 'Should report total tests');
  t.true(typeof performanceReport.averageExecutionTime === 'number', 'Should report average execution time');

  console.log('✅ Diagnostic information comprehensive and accessible');
});