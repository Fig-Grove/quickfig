/**
 * BEFORE: Old-style plugin test using mock environment
 * Issues: Mock environment, function serialization, no real constraints
 */

import test from 'ava';
import { mockFigmaEnvironment } from '../setup/old-mock-harness';

test('basic plugin functionality - OLD STYLE', async (t) => {
  const { mockRunSandboxed } = mockFigmaEnvironment();
  
  // Problem: Function-based execution with context capture
  const result = mockRunSandboxed(() => {
    // This captures the test context, causing serialization issues
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
  });
  
  // Problem: Direct access without considering result wrapping
  t.true(result.processed);
  t.is(typeof result.timestamp, 'number');
  t.is(result.nodeCount, 0); // Mock always returns 0
  
  // Problem: No real constraint validation
  // This test passes but doesn't validate real Figma constraints
});

test('memory allocation test - OLD STYLE', async (t) => {
  const { mockRunSandboxed } = mockFigmaEnvironment();
  
  // Problem: Mock environment doesn't test real memory constraints
  const result = mockRunSandboxed(() => {
    // This might fail in real QuickJS but passes in mock
    const largeArray = new Array(1000000).fill('test data');
    return { 
      success: true,
      arraySize: largeArray.length 
    };
  });
  
  // Problem: False confidence - mock passes but real QuickJS might fail
  t.true(result.success);
  t.is(result.arraySize, 1000000);
});

test('API availability test - OLD STYLE', async (t) => {
  const { mockRunSandboxed } = mockFigmaEnvironment();
  
  // Problem: Node.js environment has different APIs than QuickJS/Figma
  const hasTimeout = typeof setTimeout !== 'undefined';
  const hasFetch = typeof fetch !== 'undefined';
  
  // Problem: These assertions may be wrong for real Figma environment
  t.true(hasTimeout); // True in Node.js, but should be false in Figma
  t.false(hasFetch);  // False in Node.js, but actual Figma behavior unknown
});