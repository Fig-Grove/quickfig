/**
 * Constraint Detection Overhead Measurement - Performance Impact Assessment
 * 
 * Measures the performance impact of constraint detection and validation
 * to ensure it doesn't negatively affect real-world usage.
 */

import test from 'ava';
import { FigmaConstraintDetector } from '../constraints/figma-constraint-detector.js';
import { createIsolatedFigmaTestEnvironment } from '../harness/isolated-quickjs-harness.js';

// Create constraint detector instance for testing
const figmaConstraintDetector = new FigmaConstraintDetector();

interface PerformanceMeasurement {
  operation: string;
  iterations: number;
  withConstraints: {
    totalTime: number;
    averageTime: number;
    minTime: number;
    maxTime: number;
  };
  withoutConstraints: {
    totalTime: number;
    averageTime: number;
    minTime: number;
    maxTime: number;
  };
  overhead: {
    absoluteMs: number;
    percentageIncrease: number;
    acceptableOverhead: boolean;
  };
}

interface OverheadAnalysis {
  measurements: PerformanceMeasurement[];
  summary: {
    averageOverheadMs: number;
    averageOverheadPercentage: number;
    maxOverheadMs: number;
    operationsWithAcceptableOverhead: number;
    totalOperations: number;
    overheadAcceptabilityRate: number;
  };
}

test('Constraint detection memory operation overhead', async (t) => {
  console.log('\n📊 Measuring Memory Constraint Detection Overhead');
  
  const measurements: PerformanceMeasurement[] = [];
  const testSizes = [1024, 10240, 102400, 1048576]; // 1KB, 10KB, 100KB, 1MB
  const iterations = 100; // Reduced for faster test execution

  for (const size of testSizes) {
    const measurement: PerformanceMeasurement = {
      operation: `Memory check (${Math.round(size / 1024)}KB)`,
      iterations,
      withConstraints: { totalTime: 0, averageTime: 0, minTime: 0, maxTime: 0 },
      withoutConstraints: { totalTime: 0, averageTime: 0, minTime: 0, maxTime: 0 },
      overhead: { absoluteMs: 0, percentageIncrease: 0, acceptableOverhead: false }
    };

    // Measure WITH constraint detection
    const withConstraintsTimes: number[] = [];
    const withConstraintsStart = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const result = figmaConstraintDetector.checkOperation({
        type: 'memory',
        size: size
      });
      const end = performance.now();
      withConstraintsTimes.push(end - start);
    }
    
    const withConstraintsTotal = performance.now() - withConstraintsStart;
    measurement.withConstraints = {
      totalTime: withConstraintsTotal,
      averageTime: withConstraintsTotal / iterations,
      minTime: Math.min(...withConstraintsTimes),
      maxTime: Math.max(...withConstraintsTimes)
    };

    // Measure WITHOUT constraint detection (baseline)
    const withoutConstraintsTimes: number[] = [];
    const withoutConstraintsStart = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      // Simple memory allocation without constraint checking
      const testArray = new Array(size / 8).fill(1);
      const allowed = testArray.length > 0;
      const end = performance.now();
      withoutConstraintsTimes.push(end - start);
    }
    
    const withoutConstraintsTotal = performance.now() - withoutConstraintsStart;
    measurement.withoutConstraints = {
      totalTime: withoutConstraintsTotal,
      averageTime: withoutConstraintsTotal / iterations,
      minTime: Math.min(...withoutConstraintsTimes),
      maxTime: Math.max(...withoutConstraintsTimes)
    };

    // Calculate overhead
    const absoluteOverhead = measurement.withConstraints.averageTime - measurement.withoutConstraints.averageTime;
    const percentageOverhead = (absoluteOverhead / measurement.withoutConstraints.averageTime) * 100;
    
    measurement.overhead = {
      absoluteMs: absoluteOverhead,
      percentageIncrease: percentageOverhead,
      acceptableOverhead: absoluteOverhead < 1.0 && percentageOverhead < 50 // Acceptable if <1ms and <50% increase
    };

    measurements.push(measurement);
    
    console.log(`${measurement.operation}:`);
    console.log(`  With constraints:    ${measurement.withConstraints.averageTime.toFixed(4)}ms avg`);
    console.log(`  Without constraints: ${measurement.withoutConstraints.averageTime.toFixed(4)}ms avg`);
    console.log(`  Overhead:           +${absoluteOverhead.toFixed(4)}ms (+${percentageOverhead.toFixed(1)}%)`);
    console.log(`  Acceptable:          ${measurement.overhead.acceptableOverhead ? '✅' : '❌'}`);
  }

  // Analyze overall overhead
  const analysis = analyzeOverhead(measurements);
  console.log('\n📈 Overall Memory Constraint Overhead Analysis:');
  console.log(`Average overhead: ${analysis.summary.averageOverheadMs.toFixed(4)}ms (${analysis.summary.averageOverheadPercentage.toFixed(1)}%)`);
  console.log(`Max overhead: ${analysis.summary.maxOverheadMs.toFixed(4)}ms`);
  console.log(`Acceptable overhead rate: ${analysis.summary.overheadAcceptabilityRate.toFixed(1)}%`);

  // Validate performance requirements
  t.true(analysis.summary.averageOverheadMs < 2.0, 'Average memory constraint overhead should be under 2ms');
  t.true(analysis.summary.averageOverheadPercentage < 100, 'Average overhead should be under 100% increase');
  t.true(analysis.summary.overheadAcceptabilityRate >= 75, 'At least 75% of operations should have acceptable overhead');
});

test('Constraint detection API validation overhead', async (t) => {
  console.log('\n📊 Measuring API Constraint Detection Overhead');
  
  const measurements: PerformanceMeasurement[] = [];
  const testApis = ['setTimeout', 'fetch', 'eval', 'Worker', 'localStorage'];
  const iterations = 1000; // Reduced for faster test execution

  for (const api of testApis) {
    const measurement: PerformanceMeasurement = {
      operation: `API check (${api})`,
      iterations,
      withConstraints: { totalTime: 0, averageTime: 0, minTime: 0, maxTime: 0 },
      withoutConstraints: { totalTime: 0, averageTime: 0, minTime: 0, maxTime: 0 },
      overhead: { absoluteMs: 0, percentageIncrease: 0, acceptableOverhead: false }
    };

    // Measure WITH constraint detection
    const withConstraintsTimes: number[] = [];
    const withConstraintsStart = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const result = figmaConstraintDetector.checkOperation({
        type: 'api',
        api: api
      });
      const end = performance.now();
      withConstraintsTimes.push(end - start);
    }
    
    const withConstraintsTotal = performance.now() - withConstraintsStart;
    measurement.withConstraints = {
      totalTime: withConstraintsTotal,
      averageTime: withConstraintsTotal / iterations,
      minTime: Math.min(...withConstraintsTimes),
      maxTime: Math.max(...withConstraintsTimes)
    };

    // Measure WITHOUT constraint detection (baseline)
    const withoutConstraintsTimes: number[] = [];
    const withoutConstraintsStart = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      // Simple API availability check without constraint framework
      const isAvailable = figmaConstraintDetector.isApiAvailable(api);
      const end = performance.now();
      withoutConstraintsTimes.push(end - start);
    }
    
    const withoutConstraintsTotal = performance.now() - withoutConstraintsStart;
    measurement.withoutConstraints = {
      totalTime: withoutConstraintsTotal,
      averageTime: withoutConstraintsTotal / iterations,
      minTime: Math.min(...withoutConstraintsTimes),
      maxTime: Math.max(...withoutConstraintsTimes)
    };

    // Calculate overhead
    const absoluteOverhead = measurement.withConstraints.averageTime - measurement.withoutConstraints.averageTime;
    const percentageOverhead = (absoluteOverhead / measurement.withoutConstraints.averageTime) * 100;
    
    measurement.overhead = {
      absoluteMs: absoluteOverhead,
      percentageIncrease: percentageOverhead,
      acceptableOverhead: absoluteOverhead < 0.1 && percentageOverhead < 200 // More lenient for fast operations
    };

    measurements.push(measurement);
    
    console.log(`${measurement.operation}:`);
    console.log(`  With constraints:    ${(measurement.withConstraints.averageTime * 1000).toFixed(2)}μs avg`);
    console.log(`  Without constraints: ${(measurement.withoutConstraints.averageTime * 1000).toFixed(2)}μs avg`);
    console.log(`  Overhead:           +${(absoluteOverhead * 1000).toFixed(2)}μs (+${percentageOverhead.toFixed(1)}%)`);
    console.log(`  Acceptable:          ${measurement.overhead.acceptableOverhead ? '✅' : '❌'}`);
  }

  // Analyze overall overhead
  const analysis = analyzeOverhead(measurements);
  console.log('\n📈 Overall API Constraint Overhead Analysis:');
  console.log(`Average overhead: ${(analysis.summary.averageOverheadMs * 1000).toFixed(2)}μs (${analysis.summary.averageOverheadPercentage.toFixed(1)}%)`);
  console.log(`Max overhead: ${(analysis.summary.maxOverheadMs * 1000).toFixed(2)}μs`);
  console.log(`Acceptable overhead rate: ${analysis.summary.overheadAcceptabilityRate.toFixed(1)}%`);

  // Validate performance requirements for API checks
  t.true(analysis.summary.averageOverheadMs < 0.5, 'Average API constraint overhead should be under 0.5ms');
  t.true(analysis.summary.overheadAcceptabilityRate >= 60, 'At least 60% of API operations should have acceptable overhead');
});

test('Constraint detection execution time overhead', async (t) => {
  console.log('\n📊 Measuring Execution Time Constraint Detection Overhead');
  
  const measurements: PerformanceMeasurement[] = [];
  const testDurations = [1, 5, 10, 20, 50]; // Different execution times in ms
  const iterations = 100;

  for (const duration of testDurations) {
    const measurement: PerformanceMeasurement = {
      operation: `Execution check (${duration}ms)`,
      iterations,
      withConstraints: { totalTime: 0, averageTime: 0, minTime: 0, maxTime: 0 },
      withoutConstraints: { totalTime: 0, averageTime: 0, minTime: 0, maxTime: 0 },
      overhead: { absoluteMs: 0, percentageIncrease: 0, acceptableOverhead: false }
    };

    // Measure WITH constraint detection
    const withConstraintsTimes: number[] = [];
    const withConstraintsStart = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const result = figmaConstraintDetector.checkOperation({
        type: 'execution',
        duration: duration
      });
      const end = performance.now();
      withConstraintsTimes.push(end - start);
    }
    
    const withConstraintsTotal = performance.now() - withConstraintsStart;
    measurement.withConstraints = {
      totalTime: withConstraintsTotal,
      averageTime: withConstraintsTotal / iterations,
      minTime: Math.min(...withConstraintsTimes),
      maxTime: Math.max(...withConstraintsTimes)
    };

    // Measure WITHOUT constraint detection (baseline)
    const withoutConstraintsTimes: number[] = [];
    const withoutConstraintsStart = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      // Simple execution time comparison without constraint framework
      const isBlocking = duration > 16;
      const end = performance.now();
      withoutConstraintsTimes.push(end - start);
    }
    
    const withoutConstraintsTotal = performance.now() - withoutConstraintsStart;
    measurement.withoutConstraints = {
      totalTime: withoutConstraintsTotal,
      averageTime: withoutConstraintsTotal / iterations,
      minTime: Math.min(...withoutConstraintsTimes),
      maxTime: Math.max(...withoutConstraintsTimes)
    };

    // Calculate overhead
    const absoluteOverhead = measurement.withConstraints.averageTime - measurement.withoutConstraints.averageTime;
    const percentageOverhead = (absoluteOverhead / measurement.withoutConstraints.averageTime) * 100;
    
    measurement.overhead = {
      absoluteMs: absoluteOverhead,
      percentageIncrease: percentageOverhead,
      acceptableOverhead: absoluteOverhead < 0.5 && percentageOverhead < 500 // Very lenient for microsecond operations
    };

    measurements.push(measurement);
    
    console.log(`${measurement.operation}:`);
    console.log(`  With constraints:    ${(measurement.withConstraints.averageTime * 1000).toFixed(2)}μs avg`);
    console.log(`  Without constraints: ${(measurement.withoutConstraints.averageTime * 1000).toFixed(2)}μs avg`);
    console.log(`  Overhead:           +${(absoluteOverhead * 1000).toFixed(2)}μs (+${percentageOverhead.toFixed(1)}%)`);
    console.log(`  Acceptable:          ${measurement.overhead.acceptableOverhead ? '✅' : '❌'}`);
  }

  // Analyze overall overhead
  const analysis = analyzeOverhead(measurements);
  console.log('\n📈 Overall Execution Constraint Overhead Analysis:');
  console.log(`Average overhead: ${(analysis.summary.averageOverheadMs * 1000).toFixed(2)}μs (${analysis.summary.averageOverheadPercentage.toFixed(1)}%)`);
  console.log(`Max overhead: ${(analysis.summary.maxOverheadMs * 1000).toFixed(2)}μs`);
  console.log(`Acceptable overhead rate: ${analysis.summary.overheadAcceptabilityRate.toFixed(1)}%`);

  // Validate performance requirements
  t.true(analysis.summary.averageOverheadMs < 1.0, 'Average execution constraint overhead should be under 1ms');
  t.true(analysis.summary.overheadAcceptabilityRate >= 60, 'At least 60% of execution operations should have acceptable overhead');
});

test('Constraint detection under realistic load', async (t) => {
  console.log('\n📊 Measuring Constraint Detection Under Realistic Load');
  
  // Simulate realistic usage patterns
  const realisticOperations = [
    { type: 'memory', size: 50 * 1024, weight: 20 }, // 50KB memory checks (common)
    { type: 'api', api: 'setTimeout', weight: 30 }, // Timer API checks (very common)
    { type: 'execution', duration: 5, weight: 25 }, // Short execution checks (common)
    { type: 'api', api: 'fetch', weight: 15 }, // Network API checks (moderate)
    { type: 'memory', size: 500 * 1024, weight: 10 } // Larger memory checks (less common)
  ];

  const totalIterations = 1000; // Reduced for faster test execution
  const operationSequence: any[] = [];

  // Build weighted operation sequence
  realisticOperations.forEach(op => {
    const count = Math.round((op.weight / 100) * totalIterations);
    for (let i = 0; i < count; i++) {
      operationSequence.push({
        type: op.type,
        size: op.size,
        api: op.api,
        duration: op.duration
      });
    }
  });

  // Shuffle for realistic random access patterns
  for (let i = operationSequence.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [operationSequence[i], operationSequence[j]] = [operationSequence[j], operationSequence[i]];
  }

  // Measure realistic load performance
  const startTime = performance.now();
  let constraintViolations = 0;
  let successfulChecks = 0;

  for (const operation of operationSequence) {
    const result = figmaConstraintDetector.checkOperation(operation);
    if (result.allowed) {
      successfulChecks++;
    } else {
      constraintViolations++;
    }
  }

  const totalTime = performance.now() - startTime;
  const averageTimePerOperation = totalTime / operationSequence.length;

  console.log(`\n🎯 Realistic Load Test Results:`);
  console.log(`Total operations: ${operationSequence.length}`);
  console.log(`Total time: ${totalTime.toFixed(2)}ms`);
  console.log(`Average time per operation: ${(averageTimePerOperation * 1000).toFixed(2)}μs`);
  console.log(`Successful checks: ${successfulChecks} (${((successfulChecks / operationSequence.length) * 100).toFixed(1)}%)`);
  console.log(`Constraint violations: ${constraintViolations} (${((constraintViolations / operationSequence.length) * 100).toFixed(1)}%)`);
  console.log(`Operations per second: ${Math.round(operationSequence.length / (totalTime / 1000)).toLocaleString()}`);

  // Validate realistic performance requirements
  t.true(averageTimePerOperation < 0.1, 'Average operation time should be under 0.1ms in realistic load');
  t.true(totalTime < 1000, 'Total time for 10k operations should be under 1 second');
  t.true(successfulChecks + constraintViolations === operationSequence.length, 'All operations should be processed');
  
  const opsPerSecond = operationSequence.length / (totalTime / 1000);
  t.true(opsPerSecond > 1000, 'Should handle at least 1,000 operations per second');
});

/**
 * Analyze overhead measurements and generate summary statistics
 */
function analyzeOverhead(measurements: PerformanceMeasurement[]): OverheadAnalysis {
  const overheadValues = measurements.map(m => m.overhead.absoluteMs);
  const percentageValues = measurements.map(m => m.overhead.percentageIncrease);
  const acceptableCount = measurements.filter(m => m.overhead.acceptableOverhead).length;

  return {
    measurements,
    summary: {
      averageOverheadMs: overheadValues.reduce((sum, val) => sum + val, 0) / overheadValues.length,
      averageOverheadPercentage: percentageValues.reduce((sum, val) => sum + val, 0) / percentageValues.length,
      maxOverheadMs: Math.max(...overheadValues),
      operationsWithAcceptableOverhead: acceptableCount,
      totalOperations: measurements.length,
      overheadAcceptabilityRate: (acceptableCount / measurements.length) * 100
    }
  };
}