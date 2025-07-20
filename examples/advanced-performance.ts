// Advanced Performance Testing Example
// Shows how to test performance characteristics and regression detection

import test from 'ava';
import { avaAdapter, createPerformanceBenchmark, measureConstraintDetectionOverhead } from '@fig-grove/quickfig';

const { quickjs } = avaAdapter(test);

// Example plugin with performance-critical operations
const performanceCriticalPluginCode = `
// Plugin that processes design system components
async function processDesignSystem() {
  const components = figma.root.findAll(node => node.type === 'COMPONENT');
  const processedComponents = [];
  
  // Performance-critical loop
  for (let i = 0; i < components.length; i++) {
    const component = components[i];
    
    // Extract component properties
    const properties = {
      id: component.id,
      name: component.name,
      width: component.width,
      height: component.height,
      fills: component.fills,
      strokes: component.strokes,
      effects: component.effects,
      // Deep clone to avoid references
      children: JSON.parse(JSON.stringify(component.children))
    };
    
    // Complex processing
    const analyzed = analyzeComponent(properties);
    processedComponents.push(analyzed);
    
    // Yield control periodically to prevent UI blocking
    if (i % 100 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  return processedComponents;
}

function analyzeComponent(component) {
  // Simulate complex analysis
  const analysis = {
    complexity: calculateComplexity(component),
    accessibility: checkAccessibility(component),
    designTokens: extractDesignTokens(component),
    performance: estimateRenderCost(component)
  };
  
  return {
    ...component,
    analysis
  };
}

function calculateComplexity(component) {
  // Complex calculation that could be expensive
  let complexity = 0;
  
  // Analyze fills
  if (component.fills) {
    complexity += component.fills.length * 2;
  }
  
  // Analyze effects
  if (component.effects) {
    complexity += component.effects.length * 3;
  }
  
  // Analyze children recursively
  if (component.children) {
    for (const child of component.children) {
      complexity += calculateComplexity(child);
    }
  }
  
  return complexity;
}

// Main execution
processDesignSystem().then(results => {
  figma.root.setPluginData('designSystemAnalysis', JSON.stringify(results));
  figma.notify(\`Analyzed \${results.length} components\`);
  figma.closePlugin();
});
`;

quickjs('Performance critical plugin should meet timing constraints', async (t, ctx) => {
  const harness = await ctx.createHarness({
    verboseLogging: true,
    timeout: 10000, // Extended timeout for performance testing
    memoryLimit: 8 * 1024 * 1024
  });
  
  // Measure execution time
  const startTime = performance.now();
  const result = await ctx.validateConstraints(performanceCriticalPluginCode);
  const executionTime = performance.now() - startTime;
  
  t.log(`Plugin validation took ${executionTime.toFixed(2)}ms`);
  
  // Should not block UI for more than 16ms continuously
  ctx.assertUIBlockingCompliant(result);
  
  // Should handle memory efficiently
  ctx.assertMemoryCompliant(result);
  
  // Performance should be reasonable
  t.true(executionTime < 5000, 'Validation should complete within 5 seconds');
});

// Test constraint detection overhead
quickjs('Constraint detection overhead should be minimal', async (t, ctx) => {
  const measurements = await measureConstraintDetectionOverhead({
    iterations: 1000,
    operationType: 'memory',
    dataSize: 1024 // 1KB operations
  });
  
  t.log(`Average overhead: ${measurements.averageOverhead.toFixed(4)}ms`);
  t.log(`Throughput: ${measurements.operationsPerSecond.toFixed(0)} ops/sec`);
  
  // Should achieve target performance (8.7M ops/sec minimum)
  t.true(measurements.operationsPerSecond > 8700000, 'Should exceed 8.7M operations per second');
  t.true(measurements.averageOverhead < 0.0001, 'Overhead should be sub-millisecond');
});

// Test memory pressure simulation
const memoryPressurePluginCode = `
// Plugin that gradually increases memory usage
function simulateMemoryPressure() {
  const data = [];
  let iteration = 0;
  
  function addMoreData() {
    // Add 100KB of data each iteration
    const chunk = new Array(25000).fill('data'); // ~100KB
    data.push(chunk);
    iteration++;
    
    console.log(\`Iteration \${iteration}: \${data.length * 100}KB allocated\`);
    
    // Continue until we approach memory limit
    if (data.length < 75) { // Stop before 7.5MB to leave room for other operations
      setTimeout(addMoreData, 10);
    } else {
      // Process all data
      const processed = data.flat().map(item => item.toUpperCase());
      figma.root.setPluginData('processedData', JSON.stringify(processed.slice(0, 1000)));
      figma.notify('Memory pressure test completed');
      figma.closePlugin();
    }
  }
  
  addMoreData();
}

simulateMemoryPressure();
`;

quickjs('Memory pressure should trigger appropriate warnings', async (t, ctx) => {
  const harness = await ctx.createHarness({
    verboseLogging: true,
    memoryLimit: 8 * 1024 * 1024,
    timeout: 15000 // Extended timeout for memory pressure test
  });
  
  const result = await ctx.validateConstraints(memoryPressurePluginCode);
  
  // Should detect memory pressure
  const memoryViolations = result.violations.filter(v => v.type === 'memory');
  
  if (memoryViolations.length > 0) {
    t.log('Memory pressure detected:', memoryViolations.map(v => v.message));
    t.true(result.recommendations.some(rec => 
      rec.includes('chunk') || rec.includes('stream') || rec.includes('pagination')
    ), 'Should recommend chunking or streaming strategies');
  }
  
  // Plugin should either pass memory constraints or provide helpful recommendations
  t.true(result.memoryCompliant || result.recommendations.length > 0);
});

// Performance regression detection
quickjs('Performance should not regress compared to baseline', async (t, ctx) => {
  const benchmark = createPerformanceBenchmark({
    name: 'design-system-processing',
    baseline: {
      executionTime: 500, // 500ms baseline
      memoryUsage: 2 * 1024 * 1024, // 2MB baseline
      operations: 1000
    },
    thresholds: {
      executionTime: 1.2, // 20% regression threshold
      memoryUsage: 1.5,   // 50% memory regression threshold
      operations: 0.9     // 10% operations regression threshold
    }
  });
  
  const harness = await ctx.createHarness({ verboseLogging: false });
  
  const startTime = performance.now();
  const result = await ctx.validateConstraints(performanceCriticalPluginCode);
  const endTime = performance.now();
  
  const currentMetrics = {
    executionTime: endTime - startTime,
    memoryUsage: 1.5 * 1024 * 1024, // Estimated based on validation
    operations: 500 // Estimated operations count
  };
  
  const regression = benchmark.detect(currentMetrics);
  
  t.log('Performance metrics:', currentMetrics);
  
  if (regression.hasRegression) {
    t.log('Performance regression detected:', regression.details);
    t.fail(`Performance regression in: ${regression.details.map(d => d.metric).join(', ')}`);
  } else {
    t.log('Performance within acceptable thresholds');
    t.pass();
  }
});

// Test polyfill performance impact
quickjs('Polyfill performance should be acceptable', async (t, ctx) => {
  const polyfillTestCode = `
    // Test various polyfilled APIs
    const iterations = 10000;
    
    // TextEncoder performance
    const encoder = new TextEncoder();
    const startEncode = performance.now();
    for (let i = 0; i < iterations; i++) {
      encoder.encode('test string ' + i);
    }
    const encodeTime = performance.now() - startEncode;
    
    // Buffer performance
    const startBuffer = performance.now();
    for (let i = 0; i < iterations; i++) {
      Buffer.byteLength('test string ' + i, 'utf8');
    }
    const bufferTime = performance.now() - startBuffer;
    
    // Performance.now() calls
    const startPerf = performance.now();
    for (let i = 0; i < iterations; i++) {
      performance.now();
    }
    const perfTime = performance.now() - startPerf;
    
    console.log(\`TextEncoder: \${encodeTime.toFixed(2)}ms for \${iterations} operations\`);
    console.log(\`Buffer: \${bufferTime.toFixed(2)}ms for \${iterations} operations\`);
    console.log(\`Performance.now: \${perfTime.toFixed(2)}ms for \${iterations} operations\`);
    
    figma.notify('Polyfill performance test completed');
    figma.closePlugin();
  `;
  
  const harness = await ctx.createHarness({ verboseLogging: true });
  const result = await ctx.validateConstraints(polyfillTestCode);
  
  // Polyfills should not cause constraint violations
  ctx.assertMemoryCompliant(result);
  ctx.assertUIBlockingCompliant(result);
  
  // Should be API compatible with polyfills
  t.true(result.apiCompatible, 'Polyfilled APIs should be compatible');
  
  // Performance should be reasonable
  const performanceWarnings = result.violations.filter(v => 
    v.message.includes('performance') || v.message.includes('slow')
  );
  
  if (performanceWarnings.length > 0) {
    t.log('Performance warnings:', performanceWarnings.map(w => w.message));
  }
  
  t.true(performanceWarnings.length === 0, 'Polyfills should not cause performance warnings');
});