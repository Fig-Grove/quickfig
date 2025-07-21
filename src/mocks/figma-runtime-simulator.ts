/**
 * Figma Runtime Simulator - Core Implementation
 *
 * Simulates Figma's QuickJS environment constraints for behavioral compliance testing.
 * Provides comprehensive constraint checking and polyfill validation.
 */

/**
 * Figma runtime constraints based on behavioral analysis
 */
export interface FigmaRuntimeConstraints {
  /** Hard execution limit - Figma kills operations after this */
  maxExecutionTime: number;

  /** UI blocking threshold - operations should complete faster than this */
  uiBlockingThreshold: number;

  /** Conservative memory limit per operation */
  maxMemoryPerOperation: number;

  /** Maximum string size (estimated from Figma constraints) */
  maxStringSize: number;

  /** Maximum stack depth for recursion */
  maxStackDepth: number;
}

/**
 * Default Figma runtime constraints
 */
export const FIGMA_RUNTIME_CONSTRAINTS: FigmaRuntimeConstraints = {
  maxExecutionTime: 5000, // 5 second hard limit
  uiBlockingThreshold: 16, // 16ms for 60fps
  maxMemoryPerOperation: 8 * 1024 * 1024, // 8MB conservative
  maxStringSize: 500 * 1024, // 500KB estimated
  maxStackDepth: 100, // Conservative recursion limit
};

/**
 * APIs that are blocked in Figma's QuickJS environment
 */
export const BLOCKED_APIS = [
  "setTimeout",
  "setInterval",
  "clearTimeout",
  "clearInterval",
  "Worker",
  "SharedWorker",
  "ServiceWorker",
  "eval",
  "Function",
  "WebAssembly",
  "XMLHttpRequest",
  "fetch",
  "CompressionStream",
  "DecompressionStream",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "crypto",
  "SubtleCrypto",
] as const;

/**
 * APIs that are available in Figma's QuickJS environment
 */
export const AVAILABLE_APIS = [
  "console",
  "performance",
  "Date",
  "Math",
  "JSON",
  "Object",
  "Array",
  "String",
  "Number",
  "Boolean",
  "RegExp",
  "Error",
  "Promise",
  "Set",
  "Map",
  "WeakSet",
  "WeakMap",
] as const;

/**
 * Result of running code in Figma runtime simulator
 */
export interface FigmaRuntimeResult<T = any> {
  /** Whether execution succeeded */
  success: boolean;

  /** Result data if successful */
  data?: T;

  /** Error information if failed */
  error?: {
    type: "timeout" | "memory" | "api_blocked" | "execution" | "constraint";
    message: string;
    details?: any;
  };

  /** Performance metrics */
  metrics: {
    executionTime: number;
    memoryUsage: number;
    uiBlocking: boolean;
    constraintViolations: string[];
  };
}

/**
 * Memory tracking for constraint enforcement
 */
class MemoryTracker {
  private allocated: number = 0;
  private peak: number = 0;
  private limit: number;

  constructor(limit: number) {
    this.limit = limit;
  }

  allocate(size: number): boolean {
    if (this.allocated + size > this.limit) {
      return false; // Allocation would exceed limit
    }
    this.allocated += size;
    this.peak = Math.max(this.peak, this.allocated);
    return true;
  }

  deallocate(size: number): void {
    this.allocated = Math.max(0, this.allocated - size);
  }

  getUsage(): { current: number; peak: number; limit: number } {
    return {
      current: this.allocated,
      peak: this.peak,
      limit: this.limit,
    };
  }

  reset(): void {
    this.allocated = 0;
    this.peak = 0;
  }
}

/**
 * Figma Runtime Simulator
 * Implements behavioral constraints based on Figma's actual QuickJS environment
 */
export class FigmaRuntimeSimulator {
  private constraints: FigmaRuntimeConstraints;
  private memoryTracker: MemoryTracker;

  constructor(
    constraints: FigmaRuntimeConstraints = FIGMA_RUNTIME_CONSTRAINTS,
  ) {
    this.constraints = constraints;
    this.memoryTracker = new MemoryTracker(constraints.maxMemoryPerOperation);
  }

  /**
   * Run code in simulated Figma environment
   */
  async runInFigmaEnvironment<T = any>(
    code: string,
    context: Record<string, any> = {},
  ): Promise<FigmaRuntimeResult<T>> {
    const startTime = performance.now();
    const constraintViolations: string[] = [];

    // Reset memory tracker for this execution
    this.memoryTracker.reset();

    try {
      // Pre-execution constraint checks
      await this.validatePreExecutionConstraints(code, constraintViolations);

      // Create constrained execution environment
      const constrainedEnvironment = this.createConstrainedEnvironment(context);

      // Execute with timeout and memory monitoring
      const result = await this.executeWithConstraints(
        code,
        constrainedEnvironment,
        constraintViolations,
      );

      const executionTime = performance.now() - startTime;
      const memoryUsage = this.memoryTracker.getUsage();

      // Post-execution constraint validation
      this.validatePostExecutionConstraints(
        executionTime,
        constraintViolations,
      );

      return {
        success: true,
        data: result as T,
        metrics: {
          executionTime,
          memoryUsage: memoryUsage.peak,
          uiBlocking: executionTime > this.constraints.uiBlockingThreshold,
          constraintViolations,
        },
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      const memoryUsage = this.memoryTracker.getUsage();

      return {
        success: false,
        error: this.categorizeError(error),
        metrics: {
          executionTime,
          memoryUsage: memoryUsage.peak,
          uiBlocking: executionTime > this.constraints.uiBlockingThreshold,
          constraintViolations,
        },
      };
    }
  }

  /**
   * Validate constraints before execution
   */
  private async validatePreExecutionConstraints(
    code: string,
    violations: string[],
  ): Promise<void> {
    // Check code size against memory constraints
    const codeSize = new TextEncoder().encode(code).length;
    if (codeSize > this.constraints.maxStringSize) {
      violations.push(
        `Code size ${codeSize} exceeds max string size ${this.constraints.maxStringSize}`,
      );
      throw new Error("Code size exceeds memory limit");
    }

    // Check for blocked APIs
    for (const blockedApi of BLOCKED_APIS) {
      if (code.includes(blockedApi)) {
        violations.push(`Code attempts to use blocked API: ${blockedApi}`);
      }
    }

    // Memory allocation for code
    if (!this.memoryTracker.allocate(codeSize)) {
      throw new Error("Code size exceeds memory limit");
    }
  }

  /**
   * Create execution environment with Figma constraints
   */
  private createConstrainedEnvironment(
    context: Record<string, any>,
  ): Record<string, any> {
    const environment: Record<string, any> = {
      // Mock Figma global object
      figma: {
        currentPage: { name: "Test Page" },
        root: { type: "DOCUMENT" },
        // Add minimal Figma API simulation
      },

      // Available APIs (limited subset)
      console: {
        // eslint-disable-next-line no-console
        log: (...args: any[]) => console.log("[Figma]:", ...args),
        // eslint-disable-next-line no-console
        error: (...args: any[]) => console.error("[Figma Error]:", ...args),
        // eslint-disable-next-line no-console
        warn: (...args: any[]) => console.warn("[Figma Warning]:", ...args),
      },

      // Performance API (limited)
      performance: {
        now: () => performance.now(),
      },

      // Standard JavaScript objects (constrained)
      Date,
      Math,
      JSON,
      Object,
      Array,
      String,
      Number,
      Boolean,
      RegExp,
      Error,

      // Sync-only Promise implementation
      Promise: this.createSyncPromise(),

      // Collections
      Set,
      Map,
      WeakSet,
      WeakMap,

      // User context
      ...context,
    };

    // Block dangerous APIs by setting to undefined
    for (const blockedApi of BLOCKED_APIS) {
      environment[blockedApi] = undefined;
    }

    return environment;
  }

  /**
   * Create sync-only Promise implementation for Figma environment
   */
  private createSyncPromise() {
    return class SyncPromise<T> {
      private _value: T | undefined;
      private _rejected: boolean = false;
      private _error: any;
      private _resolved: boolean = false;

      constructor(
        executor: (
          resolve: (value: T) => void,
          reject: (reason: any) => void,
        ) => void,
      ) {
        try {
          executor(
            (value: T) => {
              this._value = value;
              this._resolved = true;
            },
            (reason: any) => {
              this._rejected = true;
              this._error = reason;
            },
          );
        } catch (error) {
          this._rejected = true;
          this._error = error;
        }
      }

      then<TResult1 = T, TResult2 = never>(
        onfulfilled?: ((value: T) => TResult1) | null,
        onrejected?: ((reason: any) => TResult2) | null,
      ): SyncPromise<TResult1 | TResult2> {
        return new SyncPromise<TResult1 | TResult2>((resolve, reject) => {
          if (this._rejected) {
            if (onrejected) {
              try {
                resolve(onrejected(this._error) as TResult1 | TResult2);
              } catch (error) {
                reject(error);
              }
            } else {
              reject(this._error);
            }
          } else if (this._resolved) {
            if (onfulfilled) {
              try {
                resolve(onfulfilled(this._value!) as TResult1 | TResult2);
              } catch (error) {
                reject(error);
              }
            } else {
              resolve(this._value as TResult1 | TResult2);
            }
          }
        });
      }

      catch<TResult = never>(
        onrejected?: ((reason: any) => TResult) | null,
      ): SyncPromise<T | TResult> {
        return this.then(null, onrejected);
      }

      static resolve<T>(value: T): SyncPromise<T> {
        return new SyncPromise<T>((resolve) => resolve(value));
      }

      static reject<T = never>(reason: any): SyncPromise<T> {
        return new SyncPromise<T>((_, reject) => reject(reason));
      }
    };
  }

  /**
   * Execute code with runtime constraints
   */
  private async executeWithConstraints<T>(
    code: string,
    environment: Record<string, any>,
    _violations: string[],
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      // Set up timeout enforcement
      const timeoutId = setTimeout(() => {
        reject(
          new Error(
            `Execution timeout: exceeded ${this.constraints.maxExecutionTime}ms`,
          ),
        );
      }, this.constraints.maxExecutionTime);

      try {
        // Create function with constrained environment
        const keys = Object.keys(environment);
        const values = Object.values(environment);

        // Wrap code to ensure it returns a value
        const wrappedCode = `
          try {
            return (${code});
          } catch (error) {
            throw error;
          }
        `;

        const func = new Function(...keys, wrappedCode);

        // Execute
        const result = func(...values) as T;

        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Validate constraints after execution
   */
  private validatePostExecutionConstraints(
    executionTime: number,
    violations: string[],
  ): void {
    if (executionTime > this.constraints.uiBlockingThreshold) {
      violations.push(
        `Execution time ${executionTime}ms exceeds UI blocking threshold ${this.constraints.uiBlockingThreshold}ms`,
      );
    }

    const memoryUsage = this.memoryTracker.getUsage();
    if (memoryUsage.peak > this.constraints.maxMemoryPerOperation * 0.8) {
      violations.push(
        `Memory usage ${memoryUsage.peak} approaching limit ${this.constraints.maxMemoryPerOperation}`,
      );
    }
  }

  /**
   * Categorize execution errors
   */
  private categorizeError(error: any): {
    type: "timeout" | "memory" | "api_blocked" | "execution" | "constraint";
    message: string;
    details?: any;
  } {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("timeout") || message.includes("Execution timeout")) {
      return {
        type: "timeout",
        message,
        details: { limit: this.constraints.maxExecutionTime },
      };
    }

    if (
      message.includes("memory") ||
      message.includes("exceeds memory limit")
    ) {
      return {
        type: "memory",
        message,
        details: { limit: this.constraints.maxMemoryPerOperation },
      };
    }

    if (
      message.includes("blocked API") ||
      BLOCKED_APIS.some((api) => message.includes(api))
    ) {
      return { type: "api_blocked", message };
    }

    if (message.includes("Stack overflow") || message.includes("stack")) {
      return {
        type: "constraint",
        message,
        details: { type: "stack_overflow" },
      };
    }

    return { type: "execution", message };
  }

  /**
   * Get current runtime constraints
   */
  getConstraints(): FigmaRuntimeConstraints {
    return { ...this.constraints };
  }

  /**
   * Update runtime constraints (for testing different scenarios)
   */
  updateConstraints(newConstraints: Partial<FigmaRuntimeConstraints>): void {
    this.constraints = { ...this.constraints, ...newConstraints };
    this.memoryTracker = new MemoryTracker(
      this.constraints.maxMemoryPerOperation,
    );
  }
}

/**
 * Global instance for easy access
 */
export const figmaRuntimeSimulator = new FigmaRuntimeSimulator();

/**
 * Convenience function for running code in Figma environment
 */
export async function runInFigmaEnvironment<T = any>(
  code: string,
  context?: Record<string, any>,
): Promise<FigmaRuntimeResult<T>> {
  return figmaRuntimeSimulator.runInFigmaEnvironment<T>(code, context);
}
