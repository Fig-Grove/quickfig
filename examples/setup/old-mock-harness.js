/**
 * OLD-STYLE Mock Harness (Problematic Implementation)
 * 
 * This is an example of problematic testing patterns that the 
 * QuickFig replaces. DO NOT USE IN PRODUCTION.
 * 
 * Issues demonstrated:
 * - Function serialization problems
 * - No real constraint validation  
 * - Mock environment doesn't reflect actual QuickJS limitations
 * - Context capture causing unpredictable behavior
 */

export function mockFigmaEnvironment() {
  // ❌ PROBLEM: Mock environment that doesn't reflect real QuickJS constraints
  const mockFigma = {
    currentPage: {
      selection: [
        { id: 'mock-node-1', type: 'RECTANGLE' },
        { id: 'mock-node-2', type: 'TEXT' }
      ]
    },
    createRectangle: () => ({ id: 'mock-rect', type: 'RECTANGLE' }),
    notify: (message) => console.log(`Mock notification: ${message}`)
  };

  return {
    // ❌ PROBLEM: Function-based execution that captures test context
    mockRunSandboxed: (fn) => {
      // This doesn't actually sandbox anything and captures the surrounding context
      global.figma = mockFigma;
      
      try {
        // ❌ PROBLEM: Direct function execution - doesn't test serialization
        const result = fn();
        return result;
      } catch (error) {
        console.error('Mock execution failed:', error);
        return null;
      } finally {
        delete global.figma;
      }
    },
    
    // ❌ PROBLEM: No constraint validation
    mockValidateConstraints: () => ({
      memoryCompliant: true, // Always passes - doesn't test real constraints
      uiBlockingCompliant: true,
      violations: []
    })
  };
}

// ❌ PROBLEM: No actual QuickJS environment simulation
// This mock completely bypasses the actual runtime constraints that 
// Figma plugins will face in production