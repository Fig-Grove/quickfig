/**
 * Helper to ensure polyfills are properly isolated in tests
 */

export function saveGlobalState() {
  return {
    performance: (globalThis as any).performance,
    TextEncoder: (globalThis as any).TextEncoder,
    TextDecoder: (globalThis as any).TextDecoder,
    Buffer: (globalThis as any).Buffer,
    Set: (globalThis as any).Set,
    Map: (globalThis as any).Map,
  };
}

export function restoreGlobalState(state: ReturnType<typeof saveGlobalState>) {
  (globalThis as any).performance = state.performance;
  (globalThis as any).TextEncoder = state.TextEncoder;
  (globalThis as any).TextDecoder = state.TextDecoder;
  (globalThis as any).Buffer = state.Buffer;
  (globalThis as any).Set = state.Set;
  (globalThis as any).Map = state.Map;
}

export function clearPolyfills() {
  delete (globalThis as any).performance;
  delete (globalThis as any).TextEncoder;
  delete (globalThis as any).TextDecoder;
  delete (globalThis as any).Buffer;
  // Don't delete Set/Map as they're standard JS
}

/**
 * Force polyfill re-application by setting re-application flag
 */
export function forcePolyfillReapplication() {
  // Set the re-application flag
  (globalThis as any).__polyfillsNeedReapplication = true;
}

export async function withIsolatedPolyfills<T>(
  fn: () => T | Promise<T>
): Promise<T> {
  const savedState = saveGlobalState();
  try {
    // Clear existing polyfills
    clearPolyfills();

    // Re-import polyfills fresh
    const { applyEnvironmentPolyfills } = await import('../../../src/utils/environment-polyfills.ts');
    
    // Force re-application of polyfills
    forcePolyfillReapplication();
    
    // Apply polyfills
    applyEnvironmentPolyfills();

    // Run the test
    return await fn();
  } finally {
    // Restore original state
    restoreGlobalState(savedState);
  }
}
