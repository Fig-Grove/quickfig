// Basic Plugin Validation Example
// Shows how to validate a simple Figma plugin for QuickJS constraints

import test from 'ava';
import { avaAdapter } from '@fig-grove/quickfig/adapters/ava';

const { quickjs } = avaAdapter(test);

// Example plugin code to test
const simplePluginCode = `
// Simple plugin that stores user preferences
const userPreferences = {
  theme: 'dark',
  autoSave: true,
  recentFiles: ['design1.fig', 'design2.fig'],
  settings: {
    gridSize: 8,
    snapToGrid: true,
    showRulers: false
  }
};

// Store preferences in Figma
figma.root.setPluginData('preferences', JSON.stringify(userPreferences));

// Notify user
figma.notify('Preferences saved!');

// Close plugin
figma.closePlugin();
`;

quickjs('Simple plugin should pass all constraint checks', async (t, ctx) => {
  // Create test harness with standard settings
  const harness = await ctx.createHarness({
    verboseLogging: true,
    timeout: 5000
  });
  
  // Validate the plugin code
  const result = await ctx.validateConstraints(simplePluginCode);
  
  // Assert all constraints are met
  ctx.assertMemoryCompliant(result);
  ctx.assertUIBlockingCompliant(result);
  
  // Should have no violations for this simple plugin
  t.is(result.violations.length, 0);
  t.true(result.apiCompatible);
  
  // Log results for debugging
  if (result.recommendations.length > 0) {
    t.log('Optimization recommendations:', result.recommendations);
  }
});

// Example of testing a plugin that might violate constraints
const memoryIntensivePluginCode = `
// Plugin that processes large amounts of data
const largeDataset = [];

// Generate large dataset (could exceed memory limits)
for (let i = 0; i < 100000; i++) {
  largeDataset.push({
    id: i,
    data: new Array(1000).fill('x').join(''), // 1KB per item
    timestamp: Date.now(),
    metadata: {
      processed: false,
      priority: Math.random(),
      tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5']
    }
  });
}

// Process all data at once (could block UI)
const processedData = largeDataset.map(item => ({
  ...item,
  processed: true,
  hash: btoa(item.data) // Base64 encoding
}));

// Store everything (could exceed storage limits)
figma.root.setPluginData('processedData', JSON.stringify(processedData));

figma.notify(\`Processed \${processedData.length} items\`);
figma.closePlugin();
`;

quickjs('Memory intensive plugin should be flagged for optimization', async (t, ctx) => {
  const harness = await ctx.createHarness({
    verboseLogging: true,
    memoryLimit: 8 * 1024 * 1024 // 8MB limit
  });
  
  const result = await ctx.validateConstraints(memoryIntensivePluginCode);
  
  // This plugin will likely violate memory constraints
  if (!result.memoryCompliant) {
    t.log('Expected memory violations found:', result.violations.filter(v => v.type === 'memory'));
    t.true(result.recommendations.length > 0, 'Should provide optimization recommendations');
  }
  
  // UI blocking is also likely
  if (!result.uiBlockingCompliant) {
    t.log('Expected UI blocking violations found:', result.violations.filter(v => v.type === 'ui-blocking'));
  }
  
  // The test passes if violations are properly detected
  t.true(result.violations.length > 0, 'Should detect constraint violations in memory-intensive plugin');
});

// Example of testing API compatibility
const apiCompatibilityPluginCode = `
// Plugin that uses various JavaScript APIs
try {
  // These should work in QuickJS
  const encoder = new TextEncoder();
  const encoded = encoder.encode('Hello, Figma!');
  
  const decoder = new TextDecoder();
  const decoded = decoder.decode(encoded);
  
  // Performance timing
  const start = performance.now();
  
  // JSON operations
  const data = { message: decoded, timestamp: Date.now() };
  const serialized = JSON.stringify(data);
  const parsed = JSON.parse(serialized);
  
  const end = performance.now();
  
  console.log(\`Operations took \${end - start}ms\`);
  
  // This might not be available in QuickJS
  if (typeof setTimeout !== 'undefined') {
    setTimeout(() => {
      figma.notify('Delayed notification');
    }, 1000);
  } else {
    figma.notify('setTimeout not available in QuickJS');
  }
  
} catch (error) {
  console.error('API compatibility issue:', error);
  figma.notify('Some APIs are not available');
}

figma.closePlugin();
`;

quickjs('API compatibility should be validated', async (t, ctx) => {
  const harness = await ctx.createHarness({
    verboseLogging: true
  });
  
  const result = await ctx.validateConstraints(apiCompatibilityPluginCode);
  
  // Should detect setTimeout usage as incompatible
  const apiViolations = result.violations.filter(v => v.type === 'api-compatibility');
  
  if (apiViolations.length > 0) {
    t.log('API compatibility issues detected:', apiViolations.map(v => v.message));
  }
  
  // TextEncoder, TextDecoder, performance.now should be compatible (with polyfills)
  t.true(result.recommendations.some(rec => rec.includes('polyfill') || rec.includes('alternative')));
});