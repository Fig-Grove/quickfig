/**
 * Comprehensive TypeScript Types for Polyfill System
 *
 * Provides complete type safety and runtime type checking for the entire
 * polyfill architecture with comprehensive error handling support.
 */

/**
 * Base polyfill operation context
 */
export interface PolyfillOperationContext {
  api: string;
  operation: string;
  dataSize: number;
  timestamp: number;
  userAgent: string;
  attemptCount: number;
  sessionId: string;
  codeLocation?: {
    function: string;
    line?: number;
    column?: number;
  };
}

/**
 * Polyfill operation definition
 */
export interface PolyfillOperation {
  api: string;
  method: string;
  dataSize: number;
  estimatedDuration: number;
  priority: "low" | "medium" | "high" | "critical";
  context: PolyfillOperationContext;
  memoryRequired?: number;
}

/**
 * Constraint check result
 */
export interface ConstraintCheckResult {
  allowed: boolean;
  violations: ConstraintViolation[];
  recommendations: string[];
  fallbackSuggested?: string;
}

/**
 * Enhanced constraint violation with detailed context
 */
export interface ConstraintViolation {
  type: "memory" | "performance" | "api" | "security" | "size" | "timeout";
  severity: "low" | "medium" | "high" | "critical";
  polyfill: string;
  operation?: string;
  details: {
    limit?: number;
    actual?: number;
    threshold?: number;
    message: string;
    context?: any;
  };
  suggestedAction: string;
  remediationSteps: string[];
  errorCode: string;
}

/**
 * Polyfill diagnostic information
 */
export interface PolyfillDiagnosticInfo {
  message: string;
  errorCode: string;
  api: string;
  operation: string;
  severity: "info" | "warning" | "error" | "critical";
  context: PolyfillOperationContext;
  stackTrace?: string;
  remediationSteps: string[];
  fallbackOptions: string[];
  performanceImpact: "none" | "low" | "medium" | "high";
  memoryImpact: number; // bytes
}

/**
 * Memory metrics with detailed tracking
 */
export interface MemoryMetrics {
  currentUsage: number;
  peakUsage: number;
  pressure: "low" | "medium" | "high" | "critical";
  availableMemory: number;
  fragmentationLevel: number;
  gcPressure: number;
  poolUtilization: Map<string, number>;
}

/**
 * Performance metrics with comprehensive tracking
 */
export interface PerformanceMetrics {
  executionTime: number;
  memoryPeak: number;
  budgetCompliance: boolean;
  optimizationLevel: "none" | "basic" | "standard" | "advanced" | "maximum";
  yieldCount: number;
  cacheHitRate: number;
  throttlingActive: boolean;
  deferredOperations: number;
}

/**
 * Polyfill configuration with complete type safety
 */
export interface PolyfillConfiguration {
  name: string;
  version: string;
  enabled: boolean;
  constraints: {
    maxMemory: number;
    maxExecutionTime: number;
    maxDataSize: number;
    requiredAPIs: string[];
    optionalAPIs: string[];
    securityLevel: "strict" | "moderate" | "relaxed";
  };
  fallbacks: PolyfillFallbackConfig[];
  lifecycle: {
    loadCondition: () => boolean;
    activationTrigger: "immediate" | "lazy" | "demand" | "conditional";
    degradationThreshold: number;
    retryPolicy: RetryPolicy;
  };
  diagnostics: {
    enableTracking: boolean;
    logLevel: "debug" | "info" | "warn" | "error";
    collectMetrics: boolean;
  };
}

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: "linear" | "exponential" | "fixed";
  initialDelay: number;
  maxDelay: number;
  jitter: boolean;
}

/**
 * Fallback configuration with enhanced options
 */
export interface PolyfillFallbackConfig {
  name: string;
  description: string;
  condition: (violation: ConstraintViolation) => boolean;
  implementation: () => Promise<any> | any;
  performanceImpact: number; // 0-1 scale
  memoryImpact: number; // bytes
  reliabilityScore: number; // 0-1 scale
  supportedOperations: string[];
}

/**
 * Error boundary configuration
 */
export interface ErrorBoundaryConfig {
  catchAll: boolean;
  logErrors: boolean;
  notifyUser: boolean;
  fallbackStrategy: "graceful" | "fail-fast" | "retry" | "degrade";
  maxRecoveryAttempts: number;
  recoveryTimeout: number;
}

/**
 * System health status with detailed metrics
 */
export interface SystemHealthStatus {
  overall: "excellent" | "good" | "warning" | "critical" | "failure";
  memory: MemoryMetrics;
  performance: PerformanceMetrics;
  polyfills: Map<string, PolyfillHealthStatus>;
  recommendations: HealthRecommendation[];
  alerts: SystemAlert[];
  uptime: number;
  lastHealthCheck: number;
}

/**
 * Individual polyfill health status
 */
export interface PolyfillHealthStatus {
  name: string;
  state:
    | "unloaded"
    | "loading"
    | "active"
    | "optimizing"
    | "degraded"
    | "failed"
    | "disabled";
  metrics: PolyfillRuntimeMetrics;
  errors: PolyfillErrorInfo[];
  warnings: PolyfillWarning[];
  lastUsed: number;
  usageCount: number;
  successRate: number;
}

/**
 * Runtime metrics for individual polyfills
 */
export interface PolyfillRuntimeMetrics {
  memoryUsage: number;
  executionTime: number;
  callCount: number;
  errorCount: number;
  warningCount: number;
  lastUsed: number;
  averagePerformance: number;
  constraintViolations: ConstraintViolation[];
  operationBreakdown: Map<string, OperationMetrics>;
}

/**
 * Operation-specific metrics
 */
export interface OperationMetrics {
  callCount: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  errorRate: number;
  lastCall: number;
}

/**
 * Polyfill error with enhanced context
 */
export interface PolyfillErrorInfo {
  code: string;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  timestamp: number;
  context: PolyfillOperationContext;
  stackTrace?: string;
  recovery: {
    attempted: boolean;
    successful: boolean;
    strategy: string;
    duration: number;
  };
}

/**
 * Polyfill warning
 */
export interface PolyfillWarning {
  code: string;
  message: string;
  timestamp: number;
  context: PolyfillOperationContext;
  dismissed: boolean;
  severity: "info" | "warning";
}

/**
 * Health recommendation
 */
export interface HealthRecommendation {
  id: string;
  type: "performance" | "memory" | "configuration" | "security";
  priority: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  actionSteps: string[];
  estimatedImpact: "low" | "medium" | "high";
  implementationCost: "low" | "medium" | "high";
}

/**
 * System alert
 */
export interface SystemAlert {
  id: string;
  type: "error" | "warning" | "info";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  timestamp: number;
  acknowledged: boolean;
  source: string;
  details: any;
}

/**
 * Type guard functions for runtime type checking
 */
export class PolyfillTypeGuards {
  static isPolyfillOperation(obj: any): obj is PolyfillOperation {
    return (
      obj &&
      typeof obj.api === "string" &&
      typeof obj.method === "string" &&
      typeof obj.dataSize === "number" &&
      typeof obj.estimatedDuration === "number" &&
      ["low", "medium", "high", "critical"].includes(obj.priority) &&
      this.isPolyfillOperationContext(obj.context)
    );
  }

  static isPolyfillOperationContext(obj: any): obj is PolyfillOperationContext {
    return (
      obj &&
      typeof obj.api === "string" &&
      typeof obj.operation === "string" &&
      typeof obj.dataSize === "number" &&
      typeof obj.timestamp === "number" &&
      typeof obj.userAgent === "string" &&
      typeof obj.attemptCount === "number" &&
      typeof obj.sessionId === "string"
    );
  }

  static isConstraintViolation(obj: any): obj is ConstraintViolation {
    return (
      obj &&
      ["memory", "performance", "api", "security", "size", "timeout"].includes(
        obj.type,
      ) &&
      ["low", "medium", "high", "critical"].includes(obj.severity) &&
      typeof obj.polyfill === "string" &&
      obj.details &&
      typeof obj.details.message === "string" &&
      typeof obj.suggestedAction === "string" &&
      Array.isArray(obj.remediationSteps) &&
      typeof obj.errorCode === "string"
    );
  }

  static isMemoryMetrics(obj: any): obj is MemoryMetrics {
    return (
      obj &&
      typeof obj.currentUsage === "number" &&
      typeof obj.peakUsage === "number" &&
      ["low", "medium", "high", "critical"].includes(obj.pressure) &&
      typeof obj.availableMemory === "number" &&
      typeof obj.fragmentationLevel === "number" &&
      typeof obj.gcPressure === "number" &&
      obj.poolUtilization instanceof Map
    );
  }

  static isPerformanceMetrics(obj: any): obj is PerformanceMetrics {
    return (
      obj &&
      typeof obj.executionTime === "number" &&
      typeof obj.memoryPeak === "number" &&
      typeof obj.budgetCompliance === "boolean" &&
      ["none", "basic", "standard", "advanced", "maximum"].includes(
        obj.optimizationLevel,
      ) &&
      typeof obj.yieldCount === "number" &&
      typeof obj.cacheHitRate === "number" &&
      typeof obj.throttlingActive === "boolean" &&
      typeof obj.deferredOperations === "number"
    );
  }
}

/**
 * Enhanced error types for comprehensive error handling
 */
export class PolyfillError extends Error {
  public readonly code: string;
  public readonly api: string;
  public readonly operation: string;
  public readonly context: PolyfillOperationContext;
  public readonly severity: "low" | "medium" | "high" | "critical";
  public readonly remediationSteps: string[];
  public readonly fallbackOptions: string[];

  constructor(
    code: string,
    message: string,
    api: string,
    operation: string,
    context: PolyfillOperationContext,
    severity: "low" | "medium" | "high" | "critical" = "medium",
    remediationSteps: string[] = [],
    fallbackOptions: string[] = [],
  ) {
    super(message);
    this.name = "PolyfillError";
    this.code = code;
    this.api = api;
    this.operation = operation;
    this.context = context;
    this.severity = severity;
    this.remediationSteps = remediationSteps;
    this.fallbackOptions = fallbackOptions;
  }
}

/**
 * Constraint violation error
 */
export class ConstraintViolationError extends PolyfillError {
  public readonly violation: ConstraintViolation;

  constructor(
    violation: ConstraintViolation,
    context: PolyfillOperationContext,
  ) {
    super(
      violation.errorCode,
      violation.details.message,
      violation.polyfill,
      violation.operation || "unknown",
      context,
      violation.severity,
      violation.remediationSteps,
      [],
    );
    this.name = "ConstraintViolationError";
    this.violation = violation;
  }
}

/**
 * Memory exhaustion error
 */
export class MemoryExhaustionError extends PolyfillError {
  public readonly requestedMemory: number;
  public readonly availableMemory: number;

  constructor(
    requestedMemory: number,
    availableMemory: number,
    api: string,
    operation: string,
    context: PolyfillOperationContext,
  ) {
    super(
      "MEM_EXHAUSTED",
      `Memory exhaustion: requested ${requestedMemory} bytes, only ${availableMemory} available`,
      api,
      operation,
      context,
      "critical",
      [
        "Reduce data size for this operation",
        "Wait for memory to be freed by other operations",
        "Use a streaming or chunked approach",
        "Enable memory compression if available",
      ],
      ["minimal-implementation", "deferred-processing", "chunked-processing"],
    );
    this.name = "MemoryExhaustionError";
    this.requestedMemory = requestedMemory;
    this.availableMemory = availableMemory;
  }
}

/**
 * Performance timeout error
 */
export class PerformanceTimeoutError extends PolyfillError {
  public readonly executionTime: number;
  public readonly timeoutLimit: number;

  constructor(
    executionTime: number,
    timeoutLimit: number,
    api: string,
    operation: string,
    context: PolyfillOperationContext,
  ) {
    super(
      "PERF_TIMEOUT",
      `Performance timeout: operation took ${executionTime}ms, limit is ${timeoutLimit}ms`,
      api,
      operation,
      context,
      "high",
      [
        "Reduce data size for this operation",
        "Use asynchronous processing with yields",
        "Enable performance optimization features",
        "Consider using a faster fallback implementation",
      ],
      ["async-processing", "chunked-processing", "fast-fallback"],
    );
    this.name = "PerformanceTimeoutError";
    this.executionTime = executionTime;
    this.timeoutLimit = timeoutLimit;
  }
}

/**
 * Export all types for external consumption
 */
export type {
  PolyfillOperationContext,
  PolyfillOperation,
  ConstraintCheckResult,
  PolyfillDiagnosticInfo,
  MemoryMetrics,
  PerformanceMetrics,
  PolyfillConfiguration,
  RetryPolicy,
  PolyfillFallbackConfig,
  ErrorBoundaryConfig,
  SystemHealthStatus,
  PolyfillHealthStatus,
  PolyfillRuntimeMetrics,
  OperationMetrics,
  HealthRecommendation,
  SystemAlert,
  PolyfillWarning,
};
