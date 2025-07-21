/**
 * AVA Test Runner Adapter for QuickFig
 *
 * Provides seamless integration between AVA test runner and QuickFig's
 * constraint validation system for Figma plugin testing.
 *
 * @since 1.0.0
 */

import type { TestFn } from "ava";
import { createIsolatedFigmaTestEnvironment } from "../harness/isolated-quickjs-harness";
import type { QuickJSTestOptions, ConstraintValidationResult } from "../index";

/**
 * Test context interface for AVA QuickJS constraint testing
 *
 * Provides specialized methods for validating Figma plugin constraints
 * within AVA test functions, including assertion helpers and harness creation.
 *
 * @since 1.0.0
 */
export interface AVAQuickJSTestContext {
  /** Validates plugin code against Figma constraints */
  validateConstraints: (code: string) => Promise<ConstraintValidationResult>;
  /** Creates isolated test harness for complex testing scenarios */
  createHarness: (options?: QuickJSTestOptions) => Promise<any>;
  /** AVA assertion helper for memory constraint compliance */
  assertMemoryCompliant: (result: ConstraintValidationResult) => void;
  /** AVA assertion helper for UI blocking constraint compliance */
  assertUIBlockingCompliant: (result: ConstraintValidationResult) => void;
}

/**
 * Creates AVA test adapter for QuickJS constraint testing
 *
 * This adapter integrates QuickFig's constraint validation system with AVA,
 * providing a clean API for testing Figma plugins against real QuickJS
 * environment constraints.
 *
 * @param test - AVA test function (import test from 'ava')
 * @returns Object with quickjs test method for constraint-aware testing
 * @since 1.0.0
 * @example
 * ```typescript
 * import test from 'ava';
 * import { avaAdapter } from '@fig-grove/quickfig/adapters/ava';
 *
 * const { quickjs } = avaAdapter(test);
 *
 * quickjs('plugin memory usage is compliant', async (t, ctx) => {
 *   const result = await ctx.validateConstraints(`
 *     const data = new Array(1000).fill('test');
 *     figma.notify('Processing...');
 *   `);
 *
 *   ctx.assertMemoryCompliant(result);
 *   ctx.assertUIBlockingCompliant(result);
 *   t.is(result.violations.length, 0);
 * });
 *
 * quickjs('complex plugin logic', async (t, ctx) => {
 *   const harness = await ctx.createHarness({
 *     verboseLogging: true,
 *     timeout: 10000
 *   });
 *
 *   const result = await harness.runSandboxed(complexPluginCode);
 *   t.truthy(result.data);
 * });
 * ```
 */
export function avaAdapter(test: TestFn) {
  return {
    quickjs: (
      name: string,
      testFn: (t: any, ctx: AVAQuickJSTestContext) => Promise<void>,
    ) => {
      test(name, async (t) => {
        const ctx: AVAQuickJSTestContext = {
          validateConstraints: async (code: string) => {
            // Implementation will use the extracted harness
            throw new Error("Not implemented yet");
          },

          createHarness: async (options?: QuickJSTestOptions) => {
            return await createIsolatedFigmaTestEnvironment(
              name,
              options || {},
            );
          },

          assertMemoryCompliant: (result: ConstraintValidationResult) => {
            t.true(
              result.memoryCompliant,
              `Memory constraints violated: ${result.violations
                .filter((v) => v.type === "memory")
                .map((v) => v.message)
                .join(", ")}`,
            );
          },

          assertUIBlockingCompliant: (result: ConstraintValidationResult) => {
            t.true(
              result.uiBlockingCompliant,
              `UI blocking constraints violated: ${result.violations
                .filter((v) => v.type === "execution")
                .map((v) => v.message)
                .join(", ")}`,
            );
          },
        };

        await testFn(t, ctx);
      });
    },
  };
}

// Example usage:
/*
import test from 'ava';
import { avaAdapter } from '@fig-grove/quickfig/adapters/ava';

const { quickjs } = avaAdapter(test);

quickjs('My plugin respects Figma constraints', async (t, ctx) => {
  const harness = await ctx.createHarness({ verboseLogging: true });
  const result = await ctx.validateConstraints(myPluginCode);
  
  ctx.assertMemoryCompliant(result);
  ctx.assertUIBlockingCompliant(result);
  
  t.is(result.violations.length, 0);
});
*/
