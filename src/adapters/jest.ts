/**
 * Jest Test Runner Adapter for QuickFig
 * 
 * Provides seamless integration between Jest test runner and QuickFig's
 * constraint validation system, including custom matchers for Figma plugin testing.
 * 
 * @since 1.0.0
 */

import { createIsolatedFigmaTestEnvironment } from '../harness/isolated-quickjs-harness';
import type { QuickJSTestOptions, ConstraintValidationResult } from '../index';

/**
 * Custom Jest matchers for QuickJS constraint testing
 * 
 * Extends Jest's expect API with specialized matchers for validating
 * Figma plugin constraints in a natural, expressive way.
 * 
 * @since 1.0.0
 */
export interface JestQuickJSMatchers {
  /** Assert that validation result meets memory constraints */
  toBeMemoryCompliant(): void;
  /** Assert that validation result meets UI blocking constraints */
  toBeUIBlockingCompliant(): void;
  /** Assert that validation result has no constraint violations */
  toHaveNoConstraintViolations(): void;
}

declare global {
  namespace jest {
    interface Matchers<R> extends JestQuickJSMatchers {}
  }
}

/**
 * Creates Jest test adapter for QuickJS constraint testing
 * 
 * This adapter integrates QuickFig's constraint validation system with Jest,
 * providing custom matchers and test suite creation for Figma plugin testing.
 * 
 * @returns Object with createQuickJSTestSuite method and extended Jest matchers
 * @since 1.0.0
 * @example
 * ```typescript
 * import { jestAdapter } from '@fig-grove/quickfig/adapters/jest';
 * 
 * const { createQuickJSTestSuite } = jestAdapter();
 * 
 * const suite = createQuickJSTestSuite('My Plugin Tests', {
 *   memoryLimit: 8 * 1024 * 1024, // 8MB
 *   verboseLogging: true
 * });
 * 
 * suite.test('plugin respects constraints', async (harness) => {
 *   const result = await suite.validateConstraints(pluginCode);
 *   
 *   expect(result).toBeMemoryCompliant();
 *   expect(result).toBeUIBlockingCompliant();
 *   expect(result).toHaveNoConstraintViolations();
 * });
 * ```
 */
export function jestAdapter() {
  // Extend Jest matchers
  expect.extend({
    toBeMemoryCompliant(received: ConstraintValidationResult) {
      const pass = received.memoryCompliant;
      const violations = received.violations.filter(v => v.type === 'memory');
      
      return {
        message: () => pass 
          ? `Expected constraints to be violated, but memory constraints were compliant`
          : `Expected memory constraints to be compliant, but found violations: ${violations.map(v => v.message).join(', ')}`,
        pass
      };
    },
    
    toBeUIBlockingCompliant(received: ConstraintValidationResult) {
      const pass = received.uiBlockingCompliant;
      const violations = received.violations.filter(v => v.type === 'ui-blocking');
      
      return {
        message: () => pass 
          ? `Expected constraints to be violated, but UI blocking constraints were compliant`
          : `Expected UI blocking constraints to be compliant, but found violations: ${violations.map(v => v.message).join(', ')}`,
        pass
      };
    },
    
    toHaveNoConstraintViolations(received: ConstraintValidationResult) {
      const pass = received.violations.length === 0;
      
      return {
        message: () => pass 
          ? `Expected constraint violations, but none were found`
          : `Expected no constraint violations, but found: ${received.violations.map(v => `${v.type}: ${v.message}`).join(', ')}`,
        pass
      };
    }
  });

  return {
    /**
     * Creates a QuickJS test suite with automatic harness management
     * 
     * Sets up a Jest describe block with beforeEach/afterEach hooks for
     * harness lifecycle management and provides constraint validation methods.
     * 
     * @param suiteName - Name for the Jest describe block
     * @param options - Optional QuickJS test environment configuration
     * @returns Test suite object with test and validateConstraints methods
     * @since 1.0.0
     */
    createQuickJSTestSuite: (suiteName: string, options?: QuickJSTestOptions) => {
      describe(suiteName, () => {
        let harness: any;
        
        beforeEach(async () => {
          harness = await createIsolatedFigmaTestEnvironment(suiteName, options || {});
        });
        
        afterEach(async () => {
          if (harness && harness.cleanup) {
            await harness.cleanup();
          }
        });
        
        return {
          test: (testName: string, testFn: (harness: any) => Promise<void>) => {
            it(testName, async () => {
              await testFn(harness);
            });
          },
          
          validateConstraints: async (code: string): Promise<ConstraintValidationResult> => {
            // Implementation will use the extracted harness
            throw new Error('Not implemented yet');
          }
        };
      });
    }
  };
}

// Example usage:
/*
import { jestAdapter } from '@fig-grove/quickfig/adapters/jest';

const { createQuickJSTestSuite } = jestAdapter();

const suite = createQuickJSTestSuite('My Plugin Tests', {
  verboseLogging: true,
  memoryLimit: 8 * 1024 * 1024 // 8MB
});

suite.test('should respect memory constraints', async (harness) => {
  const result = await suite.validateConstraints(myPluginCode);
  
  expect(result).toBeMemoryCompliant();
  expect(result).toBeUIBlockingCompliant();
  expect(result).toHaveNoConstraintViolations();
});
*/