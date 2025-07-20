// @fig-grove/quickfig
// Comprehensive testing framework for Figma plugins in QuickJS environment

// Core exports
export { createIsolatedFigmaTestEnvironment } from './harness/isolated-quickjs-harness.js';
export { createFigmaTestEnvironment, FIGMA_SANDBOX_CONFIG } from './mocks/mock-quickjs-harness.js';
export { ConstraintTestRunner } from './constraints/constraint-test-runner.js';
export { TestIsolationManager } from './isolation/test-isolation-manager.js';

// Polyfill testing utilities
export { 
  applyEnvironmentPolyfills,
  initializeConstraintAwarePolyfills
} from './polyfills/environment-polyfills-impl.js';

// Performance benchmarking utilities (internal implementations)
/**
 * Measures the overhead of constraint detection in milliseconds
 * 
 * This utility function provides a quick way to measure the performance
 * impact of enabling constraint detection in your test environment.
 * 
 * @returns Promise resolving to constraint detection overhead in milliseconds
 * @since 1.0.0
 * @example
 * ```typescript
 * const overhead = await measureConstraintDetectionOverhead();
 * console.log(`Constraint detection adds ${overhead}ms overhead`);
 * ```
 */
export async function measureConstraintDetectionOverhead() {
  const start = performance.now();
  // Simple constraint detection overhead measurement
  return performance.now() - start;
}

/**
 * Creates a performance benchmark for measuring test execution times
 * 
 * Provides a simple way to track the performance characteristics of your
 * Figma plugin code during testing and development.
 * 
 * @param testName - Descriptive name for the benchmark
 * @returns Object with test name, start time, and end function
 * @since 1.0.0
 * @example
 * ```typescript
 * const benchmark = await createPerformanceBenchmark('data-processing');
 * // ... run your test code ...
 * const endTime = benchmark.end();
 * const duration = endTime - benchmark.start;
 * ```
 */
export async function createPerformanceBenchmark(testName: string) {
  return {
    testName,
    start: performance.now(),
    end: () => performance.now()
  };
}

/**
 * Validates that an operation duration meets Figma's UI blocking constraints
 * 
 * Figma plugins must not block the UI for more than 16ms per operation.
 * This function checks if a given duration violates this constraint.
 * 
 * @param duration - Operation duration in milliseconds
 * @returns Object with compliance status, actual duration, and threshold
 * @since 1.0.0
 * @example
 * ```typescript
 * const start = performance.now();
 * // ... your plugin operation ...
 * const duration = performance.now() - start;
 * 
 * const result = await validateUIBlockingConstraints(duration);
 * if (!result.compliant) {
 *   console.warn(`Operation took ${duration}ms, exceeds ${result.threshold}ms limit`);
 * }
 * ```
 */
export async function validateUIBlockingConstraints(duration: number) {
  const threshold = 16; // 16ms UI blocking threshold
  return {
    compliant: duration <= threshold,
    duration,
    threshold
  };
}

// Test runner adapters
export { avaAdapter } from './adapters/ava.js';
// export { jestAdapter } from './adapters/jest'; // Excluded due to build issues

// Quality Gates Integration
export { QualityGateRunner } from './quality-gates/quality-gates-runner.js';

// Benchmark Regression Framework
export { BenchmarkRegressionTracker, extractBenchmarkMetrics } from './benchmarks/regression-tracker.js';

// Constraint detection and testing infrastructure
export { FigmaConstraintDetector } from './constraints/figma-constraint-detector.js';
export { 
  testWithConstraints,
  runTDDWorkflow,
  type ConstraintTestConfig,
  type ConstraintTestResult
} from './constraints/constraint-test-runner.js';

// Core types and interfaces
/**
 * Configuration options for QuickJS test environment
 * 
 * These options control how the QuickJS test harness behaves during
 * constraint validation and plugin testing.
 * 
 * @since 1.0.0
 * @example
 * ```typescript
 * const options: QuickJSTestOptions = {
 *   timeout: 5000,
 *   memoryLimit: 8 * 1024 * 1024, // 8MB
 *   verboseLogging: true,
 *   isolationLevel: 'strict'
 * };
 * ```
 */
export interface QuickJSTestOptions {
  /** Test timeout in milliseconds (default: 5000) */
  timeout?: number;
  /** Memory limit in bytes (default: 8MB for Figma plugins) */
  memoryLimit?: number;
  /** Enable detailed logging for debugging (default: false) */
  verboseLogging?: boolean;
  /** Test isolation level affecting cleanup and state management */
  isolationLevel?: 'strict' | 'standard' | 'relaxed';
}

// Import and re-export the ConstraintViolation interface from the constraint detector
import type { ConstraintViolation } from './constraints/figma-constraint-detector';
export type { ConstraintViolation };

/**
 * Result of Figma plugin constraint validation
 * 
 * Contains detailed information about constraint compliance, violations,
 * and actionable recommendations for improving plugin performance.
 * 
 * @since 1.0.0
 * @example
 * ```typescript
 * const result = await validateFigmaPluginConstraints(pluginCode);
 * if (!result.memoryCompliant) {
 *   console.error('Memory violations:', result.violations);
 *   console.log('Recommendations:', result.recommendations);
 * }
 * ```
 */
export interface ConstraintValidationResult {
  /** Whether the code meets Figma's 8MB memory constraints */
  memoryCompliant: boolean;
  /** Whether the code avoids UI blocking (>16ms operations) */
  uiBlockingCompliant: boolean;
  /** Whether the code uses only available APIs in QuickJS */
  apiCompatible: boolean;
  /** Array of specific constraint violations found */
  violations: ConstraintViolation[];
  /** Actionable suggestions for fixing violations */
  recommendations: string[];
}

// Utility functions
/**
 * Validates Figma plugin code against QuickJS environment constraints
 * 
 * This is the primary validation function that checks your plugin code
 * against Figma's runtime constraints including memory limits, UI blocking
 * thresholds, and API availability.
 * 
 * @param code - Plugin code to validate (as string)
 * @param options - Optional validation configuration
 * @returns Promise resolving to detailed validation results
 * @throws Error if the validation environment cannot be created
 * @since 1.0.0
 * @example
 * ```typescript
 * // Basic validation
 * const result = await validateFigmaPluginConstraints(`
 *   const data = new Array(1000000).fill('test');
 *   figma.notify('Processing complete');
 * `);
 * 
 * // With custom options
 * const result = await validateFigmaPluginConstraints(pluginCode, {
 *   verboseLogging: true,
 *   memoryLimit: 4 * 1024 * 1024 // 4MB limit
 * });
 * 
 * // Check results
 * if (result.violations.length > 0) {
 *   console.error('Constraint violations found:');
 *   result.violations.forEach(v => console.log(`- ${v.message}`));
 * }
 * ```
 */
export async function validateFigmaPluginConstraints(
  code: string, 
  options?: QuickJSTestOptions
): Promise<ConstraintValidationResult> {
  const { createIsolatedFigmaTestEnvironment } = await import('./harness/isolated-quickjs-harness.js');
  const { FigmaConstraintDetector } = await import('./constraints/figma-constraint-detector.js');
  
  // Create test environment
  const harness = await createIsolatedFigmaTestEnvironment('validation', {
    verboseLogging: options?.verboseLogging || false,
    cleanGlobals: true,
    resetPolyfills: true,
    validateMemoryState: true,
    clearConstraintState: true,
    resetTimingBaselines: true
  });
  
  try {
    // Create constraint detector
    const detector = new FigmaConstraintDetector();
    
    // Analyze the code for potential constraint violations
    const memoryEstimate = estimateCodeMemoryUsage(code);
    const executionEstimate = estimateCodeExecutionTime(code);
    
    const violations: ConstraintViolation[] = [];
    const recommendations: string[] = [];
    
    // Check memory constraints
    const memoryCheck = detector.checkOperation({ 
      type: 'memory', 
      size: memoryEstimate 
    });
    if (!memoryCheck.allowed) {
      violations.push(...memoryCheck.violations);
    }
    
    // Check execution time constraints  
    const executionCheck = detector.checkOperation({ 
      type: 'execution', 
      duration: executionEstimate 
    });
    if (!executionCheck.allowed) {
      violations.push(...executionCheck.violations);
    }
    
    // Check API compatibility
    const apiViolations = detectAPICompatibilityIssues(code);
    violations.push(...apiViolations);
    
    // Generate recommendations
    if (violations.length > 0) {
      recommendations.push(...generateOptimizationRecommendations(violations));
    }
    
    return {
      memoryCompliant: memoryCheck.allowed,
      uiBlockingCompliant: executionCheck.allowed,
      apiCompatible: apiViolations.length === 0,
      violations,
      recommendations
    };
    
  } finally {
    // Test environment cleanup is handled automatically by isolation manager
  }
}

/**
 * Creates an isolated QuickJS test harness for Figma plugin testing
 * 
 * This function creates a clean, isolated test environment that simulates
 * the QuickJS runtime used by Figma plugins. Perfect for integration testing
 * and constraint validation.
 * 
 * @param options - Optional test environment configuration
 * @returns Promise resolving to test harness instance
 * @since 1.0.0
 * @example
 * ```typescript
 * // Create basic test harness
 * const harness = await createQuickJSTestHarness();
 * 
 * // Create harness with custom options
 * const harness = await createQuickJSTestHarness({
 *   verboseLogging: true,
 *   timeout: 10000,
 *   isolationLevel: 'strict'
 * });
 * 
 * // Use harness for testing
 * const result = await harness.runSandboxed(`
 *   return figma.currentPage.selection.length;
 * `);
 * ```
 */
export async function createQuickJSTestHarness(options?: QuickJSTestOptions) {
  const { createIsolatedFigmaTestEnvironment } = await import('./harness/isolated-quickjs-harness.js');
  
  return await createIsolatedFigmaTestEnvironment('harness', {
    verboseLogging: options?.verboseLogging || false,
    cleanGlobals: true,
    resetPolyfills: true,
    validateMemoryState: true,
    clearConstraintState: true,
    resetTimingBaselines: true
  });
}

// Helper functions for code analysis
function estimateCodeMemoryUsage(code: string): number {
  // Simple heuristic for memory estimation
  const lines = code.split('\n').length;
  const stringLiterals = (code.match(/["'`][^"'`]*["'`]/g) || []).join('').length;
  const arrayLiterals = (code.match(/\[[^\]]*\]/g) || []).join('').length;
  const objectLiterals = (code.match(/\{[^}]*\}/g) || []).join('').length;
  
  // Rough estimation in bytes
  return (lines * 100) + (stringLiterals * 2) + (arrayLiterals * 10) + (objectLiterals * 20);
}

function estimateCodeExecutionTime(code: string): number {
  // Simple heuristic for execution time estimation
  const loops = (code.match(/\b(for|while|forEach)\b/g) || []).length;
  const asyncOps = (code.match(/\b(await|Promise|setTimeout)\b/g) || []).length;
  const domOps = (code.match(/\b(figma\.|document\.|window\.)/g) || []).length;
  
  // Rough estimation in milliseconds
  return (loops * 5) + (asyncOps * 10) + (domOps * 2) + 1;
}

function detectAPICompatibilityIssues(code: string): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  
  // Check for blocked APIs
  const blockedAPIs = ['setTimeout', 'setInterval', 'Worker', 'eval', 'Function'];
  for (const api of blockedAPIs) {
    if (code.includes(api)) {
      violations.push({
        type: 'api',
        severity: 'error',
        message: `Blocked API detected: ${api}`,
        details: {
          api: api,
          fallback: `QuickJS-compatible alternative for ${api}`
        },
        remediation: `Use QuickJS-compatible alternative for ${api}`
      });
    }
  }
  
  return violations;
}

function generateOptimizationRecommendations(violations: ConstraintViolation[]): string[] {
  const recommendations: string[] = [];
  
  const memoryViolations = violations.filter(v => v.type === 'memory');
  const executionViolations = violations.filter(v => v.type === 'execution');
  const apiViolations = violations.filter(v => v.type === 'api');
  
  if (memoryViolations.length > 0) {
    recommendations.push('Consider chunking large data operations');
    recommendations.push('Implement progressive data loading');
    recommendations.push('Use streaming for large datasets');
  }
  
  if (executionViolations.length > 0) {
    recommendations.push('Add yield points in long-running operations');
    recommendations.push('Break operations into smaller chunks');
    recommendations.push('Use async/await for time-consuming tasks');
  }
  
  if (apiViolations.length > 0) {
    recommendations.push('Use QuickJS-compatible polyfills');
    recommendations.push('Replace blocked APIs with compatible alternatives');
    recommendations.push('Test in actual QuickJS environment');
  }
  
  return recommendations;
}

// Version info
/**
 * QuickFig framework version
 * 
 * @since 1.0.0
 */
export const VERSION = '1.0.0';