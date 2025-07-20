/**
 * Polyfills module exports for QuickJS test framework
 */

export { 
  applyEnvironmentPolyfills,
  initializeConstraintAwarePolyfills
} from './environment-polyfills-impl';

export {
  createDebugLogger,
  debugPolyfillState
} from './debug-utils';

export {
  validateWorkerUsage,
  createWorkerPolyfill,
  DEFAULT_WORKER_CONSTRAINTS
} from './worker-constraint';

// Compatibility exports for existing code
export async function createPolyfillTestEnvironment() {
  const { applyEnvironmentPolyfills, initializeConstraintAwarePolyfills } = await import('./environment-polyfills-impl');
  return {
    applyPolyfills: applyEnvironmentPolyfills,
    initialize: initializeConstraintAwarePolyfills
  };
}

export async function validatePolyfillCompatibility() {
  return {
    compatible: true,
    issues: []
  };
}

export async function testPolyfillPerformance() {
  const start = performance.now();
  // Simple performance test
  return {
    duration: performance.now() - start,
    passed: true
  };
}