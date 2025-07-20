/**
 * Constraint Test Setup Infrastructure
 * 
 * Provides the missing setup infrastructure that other tests depend on.
 * Re-exports the main ConstraintTestRunner functionality for test compatibility.
 */

// Re-export the main constraint testing functionality
export { 
  ConstraintTestRunner, 
  testWithConstraints, 
  runTDDWorkflow,
  type ConstraintTestConfig,
  type ConstraintTestResult
} from '../../dist/index.cjs';

/**
 * Test environment configuration for constraint-aware testing
 */
export const DEFAULT_CONSTRAINT_CONFIG: ConstraintTestConfig = {
  memoryLimit: 8 * 1024 * 1024, // 8MB
  executionLimit: 5000, // 5s
  uiBlockingThreshold: 16, // 16ms
  enableRealTimeValidation: true,
  logViolations: true,
  enablePerformanceRegression: true,
  performanceBaseline: 20, // 20ms baseline
  autoAdjustThresholds: false,
  trackHistoricalPerformance: true
};

/**
 * Enhanced test configuration for stricter constraint validation
 */
export const STRICT_CONSTRAINT_CONFIG: ConstraintTestConfig = {
  memoryLimit: 1 * 1024 * 1024, // 1MB (strict)
  executionLimit: 1000, // 1s (strict)
  uiBlockingThreshold: 8, // 8ms (stricter than 16ms)
  enableRealTimeValidation: true,
  logViolations: true,
  enablePerformanceRegression: true,
  performanceBaseline: 10, // 10ms baseline (strict)
  autoAdjustThresholds: false,
  trackHistoricalPerformance: true
};

/**
 * Relaxed test configuration for development/debugging
 */
export const RELAXED_CONSTRAINT_CONFIG: ConstraintTestConfig = {
  memoryLimit: 50 * 1024 * 1024, // 50MB (relaxed)
  executionLimit: 10000, // 10s (relaxed)
  uiBlockingThreshold: 100, // 100ms (very relaxed)
  enableRealTimeValidation: true,
  logViolations: false, // Reduced logging for debugging
  enablePerformanceRegression: false,
  performanceBaseline: 100, // 100ms baseline (relaxed)
  autoAdjustThresholds: true,
  trackHistoricalPerformance: true
};

/**
 * Helper function to create a constraint test runner with common configuration
 */
export function createConstraintTestRunner(config?: Partial<ConstraintTestConfig>): ConstraintTestRunner {
  const finalConfig = { ...DEFAULT_CONSTRAINT_CONFIG, ...config };
  return new ConstraintTestRunner(finalConfig);
}

/**
 * Helper function for running a quick constraint test with default configuration
 */
export async function quickConstraintTest(
  testFunction: () => any,
  testName: string = 'Quick Test'
): Promise<ConstraintTestResult> {
  const runner = createConstraintTestRunner();
  return runner.runConstraintAwareTest(testFunction, testName);
}

/**
 * Helper function for running a strict constraint test
 */
export async function strictConstraintTest(
  testFunction: () => any,
  testName: string = 'Strict Test'
): Promise<ConstraintTestResult> {
  const runner = createConstraintTestRunner(STRICT_CONSTRAINT_CONFIG);
  return runner.runConstraintAwareTest(testFunction, testName);
}

/**
 * Helper function for running a relaxed constraint test (for debugging)
 */
export async function relaxedConstraintTest(
  testFunction: () => any,
  testName: string = 'Relaxed Test'
): Promise<ConstraintTestResult> {
  const runner = createConstraintTestRunner(RELAXED_CONSTRAINT_CONFIG);
  return runner.runConstraintAwareTest(testFunction, testName);
}

/**
 * Validate that a test result meets specific criteria
 */
export function validateConstraintTestResult(
  result: ConstraintTestResult,
  criteria: {
    expectSuccess?: boolean;
    maxExecutionTime?: number;
    maxViolations?: number;
    allowedViolationTypes?: string[];
    maxMemoryUsage?: number;
  }
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  if (criteria.expectSuccess !== undefined && result.success !== criteria.expectSuccess) {
    violations.push(`Expected success: ${criteria.expectSuccess}, got: ${result.success}`);
  }

  if (criteria.maxExecutionTime && result.performance.executionTime > criteria.maxExecutionTime) {
    violations.push(`Execution time ${result.performance.executionTime}ms exceeds limit ${criteria.maxExecutionTime}ms`);
  }

  if (criteria.maxViolations !== undefined && result.violations.length > criteria.maxViolations) {
    violations.push(`Violations count ${result.violations.length} exceeds limit ${criteria.maxViolations}`);
  }

  if (criteria.allowedViolationTypes) {
    const disallowedViolations = result.violations.filter(v => 
      !criteria.allowedViolationTypes!.includes(v.type)
    );
    if (disallowedViolations.length > 0) {
      violations.push(`Disallowed violation types: ${disallowedViolations.map(v => v.type).join(', ')}`);
    }
  }

  if (criteria.maxMemoryUsage && result.performance.memoryUsage && 
      result.performance.memoryUsage > criteria.maxMemoryUsage) {
    violations.push(`Memory usage ${result.performance.memoryUsage} exceeds limit ${criteria.maxMemoryUsage}`);
  }

  return {
    valid: violations.length === 0,
    violations
  };
}

/**
 * Common test patterns for constraint validation
 */
export const TEST_PATTERNS = {
  /**
   * Test pattern for validating UI blocking behavior
   */
  uiBlockingTest: (duration: number) => () => {
    const start = performance.now();
    while (performance.now() - start < duration) {
      // Force execution time
    }
    return { blocked: true, duration };
  },

  /**
   * Test pattern for validating memory allocation
   */
  memoryAllocationTest: (size: number) => () => {
    const data = Array(size).fill('test-data-item');
    return { allocated: true, size: data.length };
  },

  /**
   * Test pattern for validating API constraints
   */
  apiConstraintTest: (apiName: string) => () => {
    try {
      // Test various APIs that should be blocked
      switch (apiName) {
        case 'Worker':
          new (globalThis as any).Worker('test-worker.js');
          return { api: apiName, blocked: false };
        case 'setTimeout':
          (globalThis as any).setTimeout(() => {}, 100);
          return { api: apiName, blocked: false };
        case 'fetch':
          (globalThis as any).fetch('http://example.com');
          return { api: apiName, blocked: false };
        default:
          return { api: apiName, blocked: 'unknown' };
      }
    } catch (error) {
      return { 
        api: apiName, 
        blocked: true, 
        error: error instanceof Error ? error.message : 'Unknown' 
      };
    }
  },

  /**
   * Test pattern for validating polyfill functionality
   */
  polyfillTest: (polyfillName: string) => () => {
    const results: Record<string, any> = {};
    
    switch (polyfillName) {
      case 'TextEncoder':
        results.available = typeof TextEncoder !== 'undefined';
        if (results.available) {
          const encoder = new TextEncoder();
          results.works = encoder.encode('test').length > 0;
        }
        break;
      case 'Buffer':
        results.available = typeof (globalThis as any).Buffer !== 'undefined';
        if (results.available) {
          results.works = (globalThis as any).Buffer.byteLength('test') > 0;
        }
        break;
      case 'performance':
        results.available = typeof performance !== 'undefined';
        if (results.available) {
          results.works = typeof performance.now() === 'number';
        }
        break;
    }
    
    return { polyfill: polyfillName, ...results };
  }
};

/**
 * Test suite builder for common constraint testing scenarios
 */
export class ConstraintTestSuiteBuilder {
  private tests: Array<{ name: string; test: () => any; constraints?: ConstraintTestConfig }> = [];

  addUIBlockingTest(name: string, duration: number, config?: ConstraintTestConfig): this {
    this.tests.push({
      name: `${name} (UI blocking: ${duration}ms)`,
      test: TEST_PATTERNS.uiBlockingTest(duration),
      constraints: config
    });
    return this;
  }

  addMemoryTest(name: string, size: number, config?: ConstraintTestConfig): this {
    this.tests.push({
      name: `${name} (Memory: ${size} items)`,
      test: TEST_PATTERNS.memoryAllocationTest(size),
      constraints: config
    });
    return this;
  }

  addAPITest(name: string, apiName: string, config?: ConstraintTestConfig): this {
    this.tests.push({
      name: `${name} (API: ${apiName})`,
      test: TEST_PATTERNS.apiConstraintTest(apiName),
      constraints: config
    });
    return this;
  }

  addPolyfillTest(name: string, polyfillName: string, config?: ConstraintTestConfig): this {
    this.tests.push({
      name: `${name} (Polyfill: ${polyfillName})`,
      test: TEST_PATTERNS.polyfillTest(polyfillName),
      constraints: config
    });
    return this;
  }

  addCustomTest(name: string, testFunction: () => any, config?: ConstraintTestConfig): this {
    this.tests.push({
      name,
      test: testFunction,
      constraints: config
    });
    return this;
  }

  build(): Array<{ name: string; test: () => any; constraints?: ConstraintTestConfig }> {
    return [...this.tests];
  }

  async run(): Promise<{ passed: number; failed: number; violations: number; results: ConstraintTestResult[] }> {
    return runTDDWorkflow(this.tests);
  }
}

/**
 * Convenience function to create a new test suite builder
 */
export function createTestSuite(): ConstraintTestSuiteBuilder {
  return new ConstraintTestSuiteBuilder();
}