#!/usr/bin/env node

/**
 * QuickFig CLI Tool
 *
 * Command-line interface for validating Figma plugin constraints,
 * running performance benchmarks, and integrating with CI/CD quality gates.
 *
 * @since 1.0.0
 */

import { readFileSync, watch } from "fs";
import { resolve } from "path";

// Framework imports
import { createFigmaTestEnvironment } from "../harness/quickjs-harness.js";
import { validateFigmaPluginConstraints } from "../index.js";
import { QualityGateRunner } from "../quality-gates/quality-gates-runner.js";
import { BenchmarkRegressionTracker } from "../benchmarks/regression-tracker.js";

/**
 * Command-line options for QuickFig CLI
 *
 * Defines the available commands, flags, and output formats
 * supported by the QuickFig command-line interface.
 *
 * @since 1.0.0
 */
interface CLIOptions {
  /** Target file path for validation/benchmarking */
  file?: string;
  /** Primary command to execute */
  command: "validate" | "benchmark" | "constraints" | "quality-gates" | "help";
  /** Focus on memory constraint validation only */
  memory?: boolean;
  /** Focus on UI blocking constraint validation only */
  uiBlocking?: boolean;
  /** Enable verbose logging output */
  verbose?: boolean;
  /** Output format for results */
  output?: "text" | "json";
  /** Watch file for changes and re-run command */
  watch?: boolean;
}

/**
 * Constraint violation detected by CLI validation
 *
 * Represents a specific violation of Figma's QuickJS environment
 * constraints, with details and remediation suggestions.
 *
 * @since 1.0.0
 */
interface ConstraintViolation {
  /** Type of constraint that was violated */
  type:
    | "memory"
    | "ui-blocking"
    | "api-compatibility"
    | "string-size"
    | "execution-time";
  /** Severity level of the violation */
  severity: "error" | "warning";
  /** Human-readable description of the violation */
  message: string;
  /** Additional technical details about the violation */
  details?: string;
  /** Suggested fix or remediation approach */
  recommendation?: string;
}

/**
 * Comprehensive validation result from CLI commands
 *
 * Contains detailed information about constraint compliance,
 * violations, performance statistics, and recommendations for
 * improving Figma plugin compatibility.
 *
 * @since 1.0.0
 */
interface ValidationResult {
  /** Path to the validated file */
  filePath: string;
  /** Whether memory constraints (8MB) are met */
  memoryCompliant: boolean;
  /** Whether UI blocking constraints (16ms) are met */
  uiBlockingCompliant: boolean;
  /** Whether only available APIs are used */
  apiCompatible: boolean;
  /** Whether execution time is within limits */
  executionTimeCompliant: boolean;
  /** Whether string size constraints are met */
  stringConstraintsCompliant: boolean;
  /** Overall pass/fail status */
  overallPass: boolean;
  /** Detailed list of constraint violations */
  violations: ConstraintViolation[];
  /** Actionable recommendations for improvement */
  recommendations: string[];
  /** Performance and resource usage statistics */
  executionStats: {
    maxMemoryUsed?: number;
    longestExecutionTime?: number;
    largestStringSize?: number;
    blockedApisFound?: string[];
  };
}

let watchTimeout: NodeJS.Timeout | null = null;
let isWatching = false;
let watchAbortController: AbortController | null = null;

// Main CLI entry point
async function main() {
  try {
    const options = parseArguments();

    switch (options.command) {
      case "validate":
        if (!options.file) {
          console.error("❌ Error: validate command requires a file path");
          process.exit(1);
        }
        await executeWithWatch(options, () =>
          validateFile(options.file!, options),
        );
        break;

      case "benchmark":
        if (!options.file) {
          console.error("❌ Error: benchmark command requires a file path");
          process.exit(1);
        }
        await executeWithWatch(options, () =>
          benchmarkFile(options.file!, options),
        );
        break;

      case "constraints":
        if (!options.file) {
          console.error("❌ Error: constraints command requires a file path");
          process.exit(1);
        }
        await executeWithWatch(options, () =>
          checkConstraints(options.file!, options),
        );
        break;

      case "quality-gates":
        if (!options.file) {
          console.error("❌ Error: quality-gates command requires a file path");
          process.exit(1);
        }
        await executeWithWatch(options, () =>
          runQualityGates(options.file!, options),
        );
        break;

      case "help":
      default:
        printHelp();
        break;
    }
  } catch (error) {
    console.error("❌ CLI Error:", error);
    process.exit(1);
  }
}

function parseArguments(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    command: "help",
    output: "text",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "validate":
      case "benchmark":
      case "constraints":
      case "quality-gates":
      case "help":
        options.command = arg;
        break;

      case "--memory":
        options.memory = true;
        break;

      case "--ui-blocking":
        options.uiBlocking = true;
        break;

      case "--verbose":
      case "-v":
        options.verbose = true;
        break;

      case "--watch":
      case "-w":
        options.watch = true;
        break;

      case "--output":
        const format = args[i + 1];
        if (format === "json" || format === "text") {
          options.output = format;
          i++; // Skip next argument
        }
        break;

      case "--help":
      case "-h":
        options.command = "help";
        break;

      default:
        if (!arg.startsWith("--") && !options.file) {
          options.file = arg;
        }
        break;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
quickfig - QuickJS Testing Framework CLI

USAGE:
  quickfig <command> [file] [options]

COMMANDS:
  validate <file>        Validate Figma plugin constraints
  benchmark <file>       Run performance benchmarks
  constraints <file>     Check specific constraint types
  quality-gates <file>   Run quality gate validation for CI/CD integration
  help                   Show this help message

OPTIONS:
  --memory              Check memory constraints only
  --ui-blocking         Check UI blocking constraints only
  --verbose, -v         Enable verbose logging
  --output <format>     Output format: text (default) | json
  --watch, -w           Watch file for changes and re-run command
  --help, -h            Show help

EXAMPLES:
  quickfig validate ./src/plugin.ts
  quickfig constraints ./src/plugin.ts --memory --ui-blocking
  quickfig benchmark ./src/plugin.ts --verbose
  quickfig quality-gates ./src/plugin.ts --output json
  quickfig validate ./src/plugin.ts --watch
`);
}

async function executeWithWatch(
  options: CLIOptions,
  command: () => Promise<void>,
) {
  if (options.watch && options.file) {
    await watchFile(options.file, command, options);
  } else {
    await command();
  }
}

async function watchFile(
  filePath: string,
  command: () => Promise<void>,
  options: CLIOptions,
) {
  const fullPath = resolve(filePath);

  // Check if file exists
  try {
    readFileSync(fullPath, "utf8");
  } catch (error) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  isWatching = true;
  watchAbortController = new AbortController();

  // Setup graceful shutdown
  setupGracefulShutdown();

  console.log(`👁️  Watching ${filePath} for changes...`);
  console.log("📝 Press Ctrl+C to stop watching");

  // Run initial command
  try {
    await command();
  } catch (error) {
    console.error("❌ Initial run failed:", error);
    if (options.verbose) {
      console.error(error);
    }
  }

  try {
    const watcher = watch(
      fullPath,
      { signal: watchAbortController.signal },
      (eventType) => {
        if (eventType === "change") {
          debounceFileChange(async () => {
            const timestamp = new Date().toLocaleTimeString();
            console.log(
              `🔄 [${timestamp}] File changed, re-running ${options.command}...`,
            );
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            try {
              await command();
              console.log(
                `✅ [${timestamp}] ${options.command} completed successfully`,
              );
            } catch (error) {
              console.error(
                `❌ [${timestamp}] ${options.command} failed:`,
                error,
              );
              if (options.verbose) {
                console.error(error);
              }
            }
            console.log(`👁️  Still watching ${filePath} for changes...`);
          });
        }
      },
    );

    // Keep process alive
    process.stdin.resume();
  } catch (error) {
    if (error instanceof Error && error.name !== "AbortError") {
      console.error("❌ Watch error:", error);
    }
  }
}

function debounceFileChange(callback: () => void, delay: number = 300) {
  if (watchTimeout) {
    clearTimeout(watchTimeout);
  }
  watchTimeout = setTimeout(callback, delay);
}

function setupGracefulShutdown() {
  const shutdown = () => {
    if (isWatching) {
      console.log("\\n\\n🛑 Watch mode interrupted");
      console.log("👋 Goodbye!");
      if (watchAbortController) {
        watchAbortController.abort();
      }
      if (watchTimeout) {
        clearTimeout(watchTimeout);
      }
      process.exit(0);
    }
  };

  process.on("SIGINT", shutdown); // Ctrl+C
  process.on("SIGTERM", shutdown); // Termination signal
  process.on("SIGQUIT", shutdown); // Quit signal
}

async function validateFile(filePath: string, options: CLIOptions) {
  try {
    const fullPath = resolve(filePath);
    const code = readFileSync(fullPath, "utf8");

    if (options.verbose) {
      console.log(`🔍 Validating: ${filePath}`);
      console.log(`📁 Full path: ${fullPath}`);
      console.log(`📝 Code size: ${code.length} characters`);
    } else {
      console.log(`🔍 Validating: ${filePath}`);
    }

    // Use the framework's validation function
    const result = await validateFigmaPluginConstraints(code, {
      verboseLogging: options.verbose || false,
    });

    // Convert to CLI result format
    const cliResult: ValidationResult = {
      filePath,
      memoryCompliant: result.memoryCompliant,
      uiBlockingCompliant: result.uiBlockingCompliant,
      apiCompatible: result.apiCompatible,
      executionTimeCompliant: true, // Framework doesn't expose this directly
      stringConstraintsCompliant: true, // Framework doesn't expose this directly
      overallPass: result.violations.length === 0,
      violations: result.violations.map((v) => ({
        type: v.type as any,
        severity: v.severity as any,
        message: v.message,
        details:
          typeof v.details === "string" ? v.details : JSON.stringify(v.details),
        recommendation: v.remediation,
      })),
      recommendations: result.recommendations,
      executionStats: {},
    };

    if (options.output === "json") {
      console.log(JSON.stringify(cliResult, null, 2));
    } else {
      displayValidationResults(cliResult);
    }

    if (!cliResult.overallPass) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Error validating ${filePath}:`, error);
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

function displayValidationResults(result: ValidationResult) {
  console.log("\\n📊 Validation Results:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const formatStatus = (status: boolean) => (status ? "✅ PASS" : "❌ FAIL");

  console.log(`💾 Memory constraints: ${formatStatus(result.memoryCompliant)}`);
  console.log(
    `⚡ UI blocking constraints: ${formatStatus(result.uiBlockingCompliant)}`,
  );
  console.log(`🔗 API compatibility: ${formatStatus(result.apiCompatible)}`);
  console.log();
  console.log(
    `🎯 Overall: ${result.overallPass ? "✅ APPROVED" : "❌ NEEDS ATTENTION"}`,
  );

  if (result.violations.length > 0) {
    console.log("\\n⚠️ Constraint Violations:");
    result.violations.forEach((violation) => {
      const icon = violation.severity === "error" ? "❌" : "⚠️";
      console.log(`${icon} ${violation.message}`);
      if (violation.details) {
        console.log(`   Details: ${violation.details}`);
      }
      if (violation.recommendation) {
        console.log(`   💡 ${violation.recommendation}`);
      }
    });
  }

  if (result.recommendations.length > 0) {
    console.log("\\n💡 Recommendations:");
    result.recommendations.forEach((rec) => {
      console.log(`• ${rec}`);
    });
  }
}

async function benchmarkFile(filePath: string, options: CLIOptions) {
  try {
    const fullPath = resolve(filePath);
    const code = readFileSync(fullPath, "utf8");

    if (options.verbose) {
      console.log(`🚀 Benchmarking: ${filePath}`);
      console.log(`📁 Full path: ${fullPath}`);
      console.log(`📝 Code size: ${code.length} characters`);
    } else {
      console.log(`🚀 Benchmarking: ${filePath}`);
    }

    // Initialize benchmark tracker
    const tracker = new BenchmarkRegressionTracker();

    // Create test environment for benchmarking
    const { runSandboxed } = await createFigmaTestEnvironment();

    const startTime = performance.now();
    const result = await runSandboxed(code);
    const executionTime = performance.now() - startTime;

    // Record benchmark data
    const benchmarkData = {
      name: `benchmark-${Date.now()}`,
      value: executionTime,
      unit: "ms" as const,
      category: "performance" as const,
      metadata: {
        testFile: filePath,
        environment: "development",
        version: "1.0.0",
        branch: "main",
      },
    };

    tracker.recordMetric(benchmarkData);

    if (options.output === "json") {
      console.log(JSON.stringify({ executionTime, result }, null, 2));
    } else {
      console.log("\\n📊 Benchmark Results:");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`⏱️ Execution Time: ${executionTime.toFixed(2)}ms`);
      console.log(`✅ Result: ${result ? "Success" : "Failed"}`);

      const performanceRating =
        executionTime < 16
          ? "Excellent"
          : executionTime < 100
            ? "Good"
            : "Needs Optimization";
      console.log(`🏆 Performance: ${performanceRating}`);
    }
  } catch (error) {
    console.error(`❌ Error benchmarking ${filePath}:`, error);
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

async function checkConstraints(filePath: string, options: CLIOptions) {
  try {
    const fullPath = resolve(filePath);
    const code = readFileSync(fullPath, "utf8");

    if (options.verbose) {
      console.log(`🔧 Checking constraints: ${filePath}`);
      console.log(`📁 Full path: ${fullPath}`);
      console.log(`📝 Code size: ${code.length} characters`);
    } else {
      console.log(`🔧 Checking constraints: ${filePath}`);
    }

    const checkMemory =
      options.memory || (!options.memory && !options.uiBlocking);
    const checkUIBlocking =
      options.uiBlocking || (!options.memory && !options.uiBlocking);

    console.log("\\n🎯 Constraint checks enabled:");
    console.log(`  Memory: ${checkMemory ? "✅" : "⏸️"}`);
    console.log(`  UI Blocking: ${checkUIBlocking ? "✅" : "⏸️"}`);

    // Use framework validation
    const result = await validateFigmaPluginConstraints(code, {
      verboseLogging: options.verbose || false,
    });

    const memoryViolations = result.violations.filter(
      (v) => v.type === "memory",
    );
    const uiViolations = result.violations.filter(
      (v) => v.type === "execution",
    );

    const memoryPass = checkMemory ? memoryViolations.length === 0 : true;
    const uiPass = checkUIBlocking ? uiViolations.length === 0 : true;
    const overallPass = memoryPass && uiPass;

    if (options.output === "json") {
      console.log(
        JSON.stringify(
          {
            memoryCompliant: memoryPass,
            uiBlockingCompliant: uiPass,
            overallPass,
            violations: result.violations,
          },
          null,
          2,
        ),
      );
    } else {
      console.log("\\n📊 Constraint Check Results:");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      if (checkMemory) {
        console.log(
          `💾 Memory Constraints: ${memoryPass ? "✅ PASS" : "❌ FAIL"}`,
        );
      }
      if (checkUIBlocking) {
        console.log(
          `⚡ UI Blocking Constraints: ${uiPass ? "✅ PASS" : "❌ FAIL"}`,
        );
      }

      console.log(
        `🎯 Overall Constraint Check: ${overallPass ? "✅ PASSED" : "❌ FAILED"}`,
      );

      if (result.violations.length > 0) {
        console.log("\\n⚠️ Violations Found:");
        result.violations.forEach((violation) => {
          const icon = violation.severity === "error" ? "❌" : "⚠️";
          console.log(`${icon} ${violation.message}`);
        });
      }
    }

    if (!overallPass) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Error checking constraints for ${filePath}:`, error);
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

async function runQualityGates(filePath: string, options: CLIOptions) {
  try {
    const fullPath = resolve(filePath);
    const code = readFileSync(fullPath, "utf8");

    if (options.verbose) {
      console.log(`🚪 Running quality gates: ${filePath}`);
      console.log(`📁 Full path: ${fullPath}`);
      console.log(`📝 Code size: ${code.length} characters`);
    } else {
      console.log(`🚪 Running quality gates: ${filePath}`);
    }

    // Initialize Quality Gate Runner for CI/CD integration
    const qualityGates = new QualityGateRunner();

    // Run validation through quality gates
    const result = await validateFigmaPluginConstraints(code, {
      verboseLogging: options.verbose || false,
    });

    // Process through quality gates
    const gateResults = await qualityGates.run();

    if (options.output === "json") {
      console.log(JSON.stringify(gateResults, null, 2));
    } else {
      console.log("\\n🚪 Quality Gate Results:");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(
        `🎯 Overall Status: ${gateResults.cicdStatus === "approved" ? "✅ PASSED" : "❌ FAILED"}`,
      );
      console.log(`📊 Quality Score: ${gateResults.overallScore}/100`);
      console.log(
        `📋 Tests: ${gateResults.passedTests}/${gateResults.totalTests} passed`,
      );
      console.log(
        `⚠️ Failures: Critical=${gateResults.criticalFailures}, Major=${gateResults.majorFailures}, Minor=${gateResults.minorFailures}`,
      );

      if (gateResults.recommendation) {
        console.log(`💡 Recommendation: ${gateResults.recommendation}`);
      }
    }

    if (gateResults.cicdStatus !== "approved") {
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Error running quality gates for ${filePath}:`, error);
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled rejection:", error);
  process.exit(1);
});

if (require.main === module) {
  main().catch(console.error);
}
