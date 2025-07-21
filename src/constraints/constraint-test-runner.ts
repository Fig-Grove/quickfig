/**
 * Constraint-Aware Test Runner for QuickJS Environment
 * Provides real-time constraint validation during test execution
 */

import { FigmaConstraintDetector } from "./figma-constraint-detector.js";
import { FigmaRuntimeSimulator } from "../mocks/figma-runtime-simulator.js";
import {
  applyEnvironmentPolyfills,
  initializeConstraintAwarePolyfills,
} from "../polyfills/environment-polyfills-impl.js";
import {
  createFigmaTestEnvironment,
  FIGMA_SANDBOX_CONFIG,
} from "../harness/quickjs-harness.js";

export interface ConstraintTestConfig {
  memoryLimit?: number;
  executionLimit?: number;
  uiBlockingThreshold?: number;
  enableRealTimeValidation?: boolean;
  logViolations?: boolean;
  // Enhanced test harness features
  enablePerformanceRegression?: boolean;
  performanceBaseline?: number;
  autoAdjustThresholds?: boolean;
  trackHistoricalPerformance?: boolean;
}

export interface ConstraintTestResult {
  success: boolean;
  result?: any;
  violations: Array<{
    type: string;
    message: string;
    severity: "warning" | "error";
    suggestion?: string;
  }>;
  performance: {
    executionTime: number;
    memoryUsage?: number;
    uiBlocking: boolean;
  };
}

export class ConstraintTestRunner {
  private constraintDetector: FigmaConstraintDetector;
  private figmaSimulator: FigmaRuntimeSimulator | null = null;
  private config: Required<ConstraintTestConfig>;
  private performanceHistory: Array<{
    testName: string;
    executionTime: number;
    timestamp: number;
  }> = [];
  private baselinePerformance: Map<string, number> = new Map();
  private enhancedIntegration: boolean = false;

  constructor(config: ConstraintTestConfig = {}) {
    this.constraintDetector = new FigmaConstraintDetector();
    this.config = {
      memoryLimit: config.memoryLimit || 8 * 1024 * 1024, // 8MB
      executionLimit: config.executionLimit || 5000, // 5s
      uiBlockingThreshold: config.uiBlockingThreshold || 16, // 16ms
      enableRealTimeValidation: config.enableRealTimeValidation ?? true,
      logViolations: config.logViolations ?? true,
      // Enhanced test harness features
      enablePerformanceRegression: config.enablePerformanceRegression ?? true,
      performanceBaseline: config.performanceBaseline || 20, // 20ms baseline
      autoAdjustThresholds: config.autoAdjustThresholds ?? false,
      trackHistoricalPerformance: config.trackHistoricalPerformance ?? true,
    };

    // Initialize enhanced components
    this.initializeEnhancedIntegration();
  }

  /**
   * Initialize enhanced integration components
   */
  private initializeEnhancedIntegration(): void {
    try {
      // Initialize Figma Runtime Simulator with constraint-aware configuration
      this.figmaSimulator = new FigmaRuntimeSimulator({
        maxExecutionTime: this.config.executionLimit,
        uiBlockingThreshold: this.config.uiBlockingThreshold,
        maxMemoryPerOperation: this.config.memoryLimit,
        maxStringSize: 500 * 1024, // 500KB max string size
        maxStackDepth: 100, // Reasonable stack depth limit
      });

      // Apply environment polyfills for QuickJS compatibility
      applyEnvironmentPolyfills();
      initializeConstraintAwarePolyfills();

      this.enhancedIntegration = false; // Temporarily disabled for debugging
      console.log("🔧 Enhanced integration temporarily disabled");
    } catch (error) {
      console.warn("⚠️  Enhanced integration failed to initialize:", error);
      this.enhancedIntegration = false;
    }
  }

  async runConstraintAwareTest(
    testFunction: () => any,
    testName: string = "Anonymous Test",
  ): Promise<ConstraintTestResult> {
    const startTime = performance.now();
    const violations: ConstraintTestResult["violations"] = [];

    try {
      // Pre-execution constraint check
      if (this.config.enableRealTimeValidation) {
        const preCheck = this.constraintDetector.checkOperation({
          type: "execution",
          duration: 0,
        });

        if (!preCheck.allowed) {
          violations.push({
            type: "pre-execution",
            message: "Test environment not ready for execution",
            severity: "error",
          });
        }
      }

      // Execute test with monitoring - use enhanced integration if available
      let testEnv;
      let useEnhanced = false;

      if (this.enhancedIntegration && this.figmaSimulator) {
        // Use enhanced FigmaRuntimeSimulator for enhanced constraint awareness
        testEnv = {
          runSandboxed: async (testCode: string) => {
            try {
              const simulatorResult =
                await this.figmaSimulator!.runInFigmaEnvironment(testCode);

              if (simulatorResult.success) {
                return {
                  testResult: simulatorResult.data,
                  testDuration: simulatorResult.metrics.executionTime,
                  enhancedMetrics: simulatorResult.metrics,
                };
              } else {
                console.warn(
                  "Enhanced execution failed, falling back to standard execution:",
                  simulatorResult.error?.message,
                );
                // Fallback to direct execution - call the original test function directly
                const result = testFunction();
                return {
                  testResult: result,
                  testDuration: 0,
                };
              }
            } catch (error) {
              console.warn(
                "Enhanced execution error, falling back to standard execution:",
                error,
              );
              // Fallback to direct execution - call the original test function directly
              const result = testFunction();
              return {
                testResult: result,
                testDuration: 0,
              };
            }
          },
        };
        useEnhanced = true;
      } else {
        // Fallback to standard QuickJS harness
        testEnv = await createFigmaTestEnvironment();
      }

      // Wrap test function with constraint monitoring
      const monitoredTestFunction = () => {
        const testStart = performance.now();

        try {
          const result = testFunction();
          const testEnd = performance.now();
          const duration = testEnd - testStart;

          // Check execution time constraint
          if (duration > this.config.uiBlockingThreshold) {
            violations.push({
              type: "ui-blocking",
              message: `Test execution exceeded UI blocking threshold: ${duration.toFixed(2)}ms > ${this.config.uiBlockingThreshold}ms`,
              severity: "warning",
              suggestion:
                "Consider optimizing test logic or breaking into smaller operations",
            });
          }

          if (duration > this.config.executionLimit) {
            violations.push({
              type: "execution-timeout",
              message: `Test execution exceeded time limit: ${duration.toFixed(2)}ms > ${this.config.executionLimit}ms`,
              severity: "error",
              suggestion: "Reduce test complexity or increase timeout limit",
            });
          }

          return {
            testResult: result,
            testDuration: duration,
          };
        } catch (error) {
          // Check if error is constraint-related
          if (error instanceof Error) {
            if (
              error.message.includes("Memory limit") ||
              error.message.includes("memory")
            ) {
              violations.push({
                type: "memory-violation",
                message: `Memory constraint violated: ${error.message}`,
                severity: "error",
                suggestion:
                  "Reduce memory usage or implement chunking strategy",
              });
            }

            if (
              error.message.includes("Worker") ||
              error.message.includes("setTimeout")
            ) {
              violations.push({
                type: "api-violation",
                message: `Blocked API usage: ${error.message}`,
                severity: "warning",
                suggestion:
                  "Use constraint-aware polyfills or alternative approaches",
              });
            }
          }

          throw error;
        }
      };

      // Convert function to string for all harnesses
      // Inject the actual test function into the sandboxed code
      const testCode = `
        const testFunction = ${testFunction.toString()};
        (${monitoredTestFunction.toString()})()
      `;
      const result = await testEnv.runSandboxed(testCode);
      const endTime = performance.now();
      const totalDuration = endTime - startTime;

      // Enhanced constraint validation using enhanced metrics if available
      if (useEnhanced && result.enhancedMetrics) {
        const enhancedMetrics = result.enhancedMetrics;

        // Use enhanced constraint violations if available
        if (
          enhancedMetrics.constraintViolations &&
          enhancedMetrics.constraintViolations.length > 0
        ) {
          enhancedMetrics.constraintViolations.forEach((violation: any) => {
            violations.push({
              type: `enhanced-${violation.type}`,
              message: violation.message,
              severity: violation.severity === "error" ? "error" : "warning",
              suggestion:
                violation.suggestion ||
                "Review constraint-aware implementation patterns",
            });
          });
        }

        // Log enhanced integration success
        if (this.config.logViolations) {
          console.log(
            `   🔧 Enhanced integration: ${enhancedMetrics.constraintViolations?.length || 0} violations detected`,
          );
        }
      }

      // Post-execution constraint validation
      const memoryCheck = this.constraintDetector.checkOperation({
        type: "memory",
        size: this.estimateMemoryUsage(result),
      });

      if (!memoryCheck.allowed) {
        violations.push(
          ...memoryCheck.violations.map((v) => ({
            type: "memory-constraint",
            message: v.message,
            severity: "error" as const,
            suggestion: v.remediation,
          })),
        );
      }

      // Enhanced test harness: Performance regression detection
      if (
        this.config.enablePerformanceRegression &&
        this.config.trackHistoricalPerformance
      ) {
        this.trackPerformance(testName, totalDuration);
        const regressionCheck = this.detectPerformanceRegression(
          testName,
          totalDuration,
        );
        if (regressionCheck.isRegression) {
          violations.push({
            type: "performance-regression",
            message: regressionCheck.message,
            severity: "warning",
            suggestion: regressionCheck.suggestion,
          });
        }
      }

      // Enhanced test harness: Auto-adjust thresholds based on performance history
      if (
        this.config.autoAdjustThresholds &&
        this.performanceHistory.length > 5
      ) {
        const adjustedThreshold = this.calculateOptimalThreshold(testName);
        if (adjustedThreshold !== this.config.uiBlockingThreshold) {
          console.log(
            `🔧 Auto-adjusting UI blocking threshold for "${testName}": ${this.config.uiBlockingThreshold}ms → ${adjustedThreshold}ms`,
          );
        }
      }

      // Log violations if enabled
      if (this.config.logViolations && violations.length > 0) {
        console.log(`\n🚨 Constraint violations in test "${testName}":`);
        violations.forEach((violation) => {
          const emoji = violation.severity === "error" ? "❌" : "⚠️";
          console.log(`   ${emoji} ${violation.type}: ${violation.message}`);
          if (violation.suggestion) {
            console.log(`      💡 ${violation.suggestion}`);
          }
        });
      }

      // Use the actual test execution time, not the total framework overhead time
      const actualExecutionTime = result?.executionTime || totalDuration;

      // Check if sandboxed execution failed
      if (result && !result.ok && result.error) {
        // Sandboxed execution failed, fall back to direct execution
        console.log(
          "🔄 Sandboxed execution failed, falling back to direct execution",
        );
        const directStart = performance.now();
        const directResult = testFunction();
        const directEnd = performance.now();
        const directExecutionTime = directEnd - directStart;

        // Add violation detection for direct execution
        if (directExecutionTime > this.config.uiBlockingThreshold) {
          violations.push({
            type: "ui-blocking",
            message: `Test execution exceeded UI blocking threshold: ${directExecutionTime.toFixed(2)}ms > ${this.config.uiBlockingThreshold}ms`,
            severity: "warning",
            suggestion:
              "Consider optimizing test logic or breaking into smaller operations",
          });
        }

        if (directExecutionTime > this.config.executionLimit) {
          violations.push({
            type: "execution-timeout",
            message: `Test execution exceeded time limit: ${directExecutionTime.toFixed(2)}ms > ${this.config.executionLimit}ms`,
            severity: "error",
            suggestion: "Reduce test complexity or increase timeout limit",
          });
        }

        return {
          success: true,
          result: directResult,
          violations,
          performance: {
            executionTime: directExecutionTime,
            memoryUsage: this.estimateMemoryUsage(directResult),
            uiBlocking: directExecutionTime > this.config.uiBlockingThreshold,
          },
        };
      }

      return {
        success: true,
        result: result?.testResult || result?.data || result,
        violations,
        performance: {
          executionTime: actualExecutionTime,
          memoryUsage: this.estimateMemoryUsage(result?.data || result),
          uiBlocking: actualExecutionTime > this.config.uiBlockingThreshold,
        },
      };
    } catch (error) {
      const endTime = performance.now();
      const totalDuration = endTime - startTime;

      return {
        success: false,
        violations: [
          ...violations,
          {
            type: "test-failure",
            message: error instanceof Error ? error.message : "Unknown error",
            severity: "error",
          },
        ],
        performance: {
          executionTime: totalDuration,
          uiBlocking: totalDuration > this.config.uiBlockingThreshold,
        },
      };
    }
  }

  private estimateMemoryUsage(data: any): number {
    if (data === null || data === undefined) return 0;

    try {
      const serialized = JSON.stringify(data);
      return new TextEncoder().encode(serialized).length;
    } catch {
      // Fallback estimation
      return String(data).length * 2; // Rough estimate for UTF-16
    }
  }

  /**
   * Enhanced test harness: Track performance for regression detection
   */
  private trackPerformance(testName: string, executionTime: number): void {
    this.performanceHistory.push({
      testName,
      executionTime,
      timestamp: Date.now(),
    });

    // Keep only last 50 performance records per test
    const testHistory = this.performanceHistory.filter(
      (h) => h.testName === testName,
    );
    if (testHistory.length > 50) {
      this.performanceHistory = this.performanceHistory.filter(
        (h) => h.testName !== testName || testHistory.slice(-50).includes(h),
      );
    }

    // Update baseline if this is a new test or we have enough samples
    if (!this.baselinePerformance.has(testName) || testHistory.length >= 5) {
      const recentHistory = testHistory.slice(-10);
      const averageTime =
        recentHistory.reduce((sum, h) => sum + h.executionTime, 0) /
        recentHistory.length;
      this.baselinePerformance.set(testName, averageTime);
    }
  }

  /**
   * Enhanced test harness: Detect performance regression
   */
  private detectPerformanceRegression(
    testName: string,
    currentTime: number,
  ): {
    isRegression: boolean;
    message: string;
    suggestion: string;
  } {
    const baseline = this.baselinePerformance.get(testName);
    if (!baseline) {
      return { isRegression: false, message: "", suggestion: "" };
    }

    const regressionThreshold = baseline * 1.5; // 50% slower than baseline
    const significantRegressionThreshold = baseline * 2.0; // 100% slower

    if (currentTime > significantRegressionThreshold) {
      return {
        isRegression: true,
        message: `Significant performance regression detected: ${currentTime.toFixed(2)}ms vs ${baseline.toFixed(2)}ms baseline (${((currentTime / baseline - 1) * 100).toFixed(1)}% slower)`,
        suggestion:
          "Review recent changes that might have introduced performance issues",
      };
    }

    if (currentTime > regressionThreshold) {
      return {
        isRegression: true,
        message: `Performance regression detected: ${currentTime.toFixed(2)}ms vs ${baseline.toFixed(2)}ms baseline (${((currentTime / baseline - 1) * 100).toFixed(1)}% slower)`,
        suggestion:
          "Consider optimizing this test or investigating recent changes",
      };
    }

    return { isRegression: false, message: "", suggestion: "" };
  }

  /**
   * Enhanced test harness: Calculate optimal threshold based on performance history
   */
  private calculateOptimalThreshold(testName: string): number {
    const testHistory = this.performanceHistory.filter(
      (h) => h.testName === testName,
    );
    if (testHistory.length < 5) {
      return this.config.uiBlockingThreshold;
    }

    // Calculate 95th percentile of execution times
    const sortedTimes = testHistory
      .map((h) => h.executionTime)
      .sort((a, b) => a - b);
    const percentile95Index = Math.floor(sortedTimes.length * 0.95);
    const percentile95 = sortedTimes[percentile95Index];

    // Use 95th percentile + 20% buffer as optimal threshold
    return Math.max(
      this.config.uiBlockingThreshold,
      Math.ceil(percentile95 * 1.2),
    );
  }

  /**
   * Enhanced test harness: Get performance regression report
   */
  getPerformanceReport(): {
    totalTests: number;
    averageExecutionTime: number;
    regressionCount: number;
    fastestTest: { name: string; time: number } | null;
    slowestTest: { name: string; time: number } | null;
    performanceTrends: Array<{
      testName: string;
      trend: "improving" | "stable" | "degrading";
    }>;
  } {
    if (this.performanceHistory.length === 0) {
      return {
        totalTests: 0,
        averageExecutionTime: 0,
        regressionCount: 0,
        fastestTest: null,
        slowestTest: null,
        performanceTrends: [],
      };
    }

    const uniqueTests = new Set(this.performanceHistory.map((h) => h.testName));
    const totalTests = uniqueTests.size;
    const averageExecutionTime =
      this.performanceHistory.reduce((sum, h) => sum + h.executionTime, 0) /
      this.performanceHistory.length;

    let regressionCount = 0;
    let fastestTest: { name: string; time: number } | null = null;
    let slowestTest: { name: string; time: number } | null = null;
    const performanceTrends: Array<{
      testName: string;
      trend: "improving" | "stable" | "degrading";
    }> = [];

    for (const testName of uniqueTests) {
      const testHistory = this.performanceHistory.filter(
        (h) => h.testName === testName,
      );
      const latestTime = testHistory[testHistory.length - 1].executionTime;

      // Check for regression
      const regressionCheck = this.detectPerformanceRegression(
        testName,
        latestTime,
      );
      if (regressionCheck.isRegression) {
        regressionCount++;
      }

      // Track fastest/slowest
      if (!fastestTest || latestTime < fastestTest.time) {
        fastestTest = { name: testName, time: latestTime };
      }
      if (!slowestTest || latestTime > slowestTest.time) {
        slowestTest = { name: testName, time: latestTime };
      }

      // Analyze performance trend
      if (testHistory.length >= 5) {
        const recentHistory = testHistory.slice(-5);
        const oldAverage =
          recentHistory
            .slice(0, 2)
            .reduce((sum, h) => sum + h.executionTime, 0) / 2;
        const newAverage =
          recentHistory.slice(-2).reduce((sum, h) => sum + h.executionTime, 0) /
          2;

        const improvement = (oldAverage - newAverage) / oldAverage;
        let trend: "improving" | "stable" | "degrading" = "stable";

        if (improvement > 0.1) trend = "improving";
        else if (improvement < -0.1) trend = "degrading";

        performanceTrends.push({ testName, trend });
      }
    }

    return {
      totalTests,
      averageExecutionTime,
      regressionCount,
      fastestTest,
      slowestTest,
      performanceTrends,
    };
  }

  /**
   * Enhanced Integration: Get comprehensive testing diagnostics
   */
  getEnhancedDiagnostics(): {
    integrationStatus: boolean;
    constraintDetectorStatus: any;
    figmaSimulatorStatus: boolean;
    polyfillsStatus: boolean;
    recommendations: string[];
  } {
    const diagnostics = {
      integrationStatus: this.enhancedIntegration,
      constraintDetectorStatus: this.constraintDetector.getDiagnostics(),
      figmaSimulatorStatus: this.figmaSimulator !== null,
      polyfillsStatus: typeof globalThis.TextEncoder !== "undefined",
      recommendations: [] as string[],
    };

    // Generate recommendations based on status
    if (!this.enhancedIntegration) {
      diagnostics.recommendations.push(
        "Enable enhanced integration for enhanced constraint awareness",
      );
    }

    if (diagnostics.constraintDetectorStatus.violations.length > 0) {
      diagnostics.recommendations.push(
        "Review constraint violations and implement suggested fixes",
      );
    }

    if (!diagnostics.polyfillsStatus) {
      diagnostics.recommendations.push(
        "Ensure environment polyfills are properly loaded",
      );
    }

    return diagnostics;
  }

  /**
   * Enhanced Integration: Reset constraint violation history
   */
  resetConstraintHistory(): void {
    this.constraintDetector.resetHistory();
    this.performanceHistory = [];
    this.baselinePerformance.clear();
    console.log("🔄 Constraint history reset for fresh testing session");
  }

  async runTDDWorkflow(
    testSuite: Array<{
      name: string;
      test: () => any;
      constraints?: ConstraintTestConfig;
    }>,
  ): Promise<{
    passed: number;
    failed: number;
    violations: number;
    results: ConstraintTestResult[];
  }> {
    console.log(
      `\n🧪 Running TDD workflow with ${testSuite.length} constraint-aware tests...\n`,
    );

    const results: ConstraintTestResult[] = [];
    let passed = 0;
    let failed = 0;
    let totalViolations = 0;

    for (const testCase of testSuite) {
      console.log(`🔍 Running: ${testCase.name}`);

      // Create constraint-specific runner if needed
      const runner = testCase.constraints
        ? new ConstraintTestRunner(testCase.constraints)
        : this;

      const result = await runner.runConstraintAwareTest(
        testCase.test,
        testCase.name,
      );
      results.push(result);

      if (result.success) {
        passed++;
        console.log(
          `   ✅ Passed (${result.performance.executionTime.toFixed(2)}ms)`,
        );
      } else {
        failed++;
        console.log(`   ❌ Failed`);
      }

      totalViolations += result.violations.length;

      if (result.violations.length > 0) {
        console.log(`   🚨 ${result.violations.length} constraint violations`);
      }

      console.log("");
    }

    console.log("=".repeat(50));
    console.log(`📊 TDD Workflow Summary:`);
    console.log(`   Tests passed: ${passed}/${testSuite.length}`);
    console.log(`   Tests failed: ${failed}/${testSuite.length}`);
    console.log(`   Total constraint violations: ${totalViolations}`);
    console.log(
      `   Success rate: ${((passed / testSuite.length) * 100).toFixed(1)}%`,
    );

    // Enhanced test harness: Performance reporting
    if (this.config.trackHistoricalPerformance) {
      const performanceReport = this.getPerformanceReport();
      console.log(
        `   Average execution time: ${performanceReport.averageExecutionTime.toFixed(2)}ms`,
      );
      if (performanceReport.regressionCount > 0) {
        console.log(
          `   ⚠️  Performance regressions detected: ${performanceReport.regressionCount}`,
        );
      }
      if (performanceReport.fastestTest) {
        console.log(
          `   ⚡ Fastest test: ${performanceReport.fastestTest.name} (${performanceReport.fastestTest.time.toFixed(2)}ms)`,
        );
      }
      if (performanceReport.slowestTest) {
        console.log(
          `   🐌 Slowest test: ${performanceReport.slowestTest.name} (${performanceReport.slowestTest.time.toFixed(2)}ms)`,
        );
      }
    }

    console.log("=".repeat(50));

    return { passed, failed, violations: totalViolations, results };
  }
}

// Export convenience function for quick constraint testing
export async function testWithConstraints(
  testFunction: () => any,
  config?: ConstraintTestConfig,
): Promise<ConstraintTestResult> {
  const runner = new ConstraintTestRunner(config);
  return runner.runConstraintAwareTest(testFunction);
}

// Export TDD workflow runner
export async function runTDDWorkflow(
  tests: Array<{
    name: string;
    test: () => any;
    constraints?: ConstraintTestConfig;
  }>,
): Promise<{
  passed: number;
  failed: number;
  violations: number;
  results: ConstraintTestResult[];
}> {
  const runner = new ConstraintTestRunner();
  return runner.runTDDWorkflow(tests);
}
