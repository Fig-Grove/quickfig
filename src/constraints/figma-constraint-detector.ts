/**
 * Figma Constraint Detector - Advanced Implementation
 *
 * Centralized constraint management for Figma's QuickJS environment.
 * Provides unified constraint detection, validation, and enforcement
 * across all QuickFig components.
 */

// Removed unused import - FigmaRuntimeConstraints not needed in this module

import { PolyfillBudgetManager } from "./polyfill-budget-manager.js";

/**
 * Figma environment constraint categories
 */
export interface FigmaEnvironmentConstraints {
  /** Memory constraints */
  memory: {
    maxPerOperation: number;
    warningThreshold: number;
    allocationLimit: number;
  };

  /** Execution time constraints */
  execution: {
    hardTimeout: number;
    uiBlockingThreshold: number;
    operationBudget: number;
  };

  /** API availability constraints */
  apis: {
    available: readonly string[];
    blocked: readonly string[];
    restricted: readonly string[];
  };

  /** Stack and recursion constraints */
  stack: {
    maxDepth: number;
    warningDepth: number;
  };

  /** String and data size constraints */
  data: {
    maxStringSize: number;
    maxChunkSize: number;
    warningSize: number;
  };
}

/**
 * Constraint violation details
 */
export interface ConstraintViolation {
  type: "memory" | "execution" | "api" | "stack" | "data";
  severity: "error" | "warning" | "info";
  message: string;
  details: {
    requested?: number;
    limit?: number;
    current?: number;
    api?: string;
    fallback?: string | undefined;
    estimated?: number;
    threshold?: number;
    budget?: number;
  };
  remediation: string;
  timestamp?: number; // For violation history tracking
}

/**
 * Constraint check result
 */
export interface ConstraintCheckResult {
  allowed: boolean;
  violations: ConstraintViolation[];
  fallbackStrategy?: string | undefined;
  estimatedImpact?: {
    memoryUsage: number;
    executionTime: number;
  };
}

/**
 * Default Figma environment constraints based on real QuickJS validation
 * Updated based on comprehensive real QuickJS testing results
 */
export const DEFAULT_FIGMA_CONSTRAINTS: FigmaEnvironmentConstraints = {
  memory: {
    maxPerOperation: 8 * 1024 * 1024, // 8MB validated against real QuickJS
    warningThreshold: 6 * 1024 * 1024, // 6MB warning threshold
    allocationLimit: 500 * 1024, // 500KB per allocation (conservative)
  },

  execution: {
    hardTimeout: 5000, // 5 second Figma limit
    uiBlockingThreshold: 16, // 60fps target (validated in real QuickJS)
    operationBudget: 8, // 8ms per micro-operation
  },

  apis: {
    available: [
      // Core JavaScript APIs (validated available in real QuickJS)
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
      "figma",
      // Timer APIs (real QuickJS validation: AVAILABLE - updated from blocked)
      "setTimeout",
      "setInterval",
      "clearTimeout",
      "clearInterval",
      // Network APIs (real QuickJS validation: AVAILABLE - updated from blocked)
      "fetch",
      "XMLHttpRequest",
      // Function evaluation (real QuickJS validation: AVAILABLE - updated from blocked)
      "eval",
      "Function",
    ],
    blocked: [
      // Web Workers (real QuickJS validation: BLOCKED - confirmed)
      "Worker",
      "SharedWorker",
      "ServiceWorker",
      // WebAssembly (assumed blocked, needs validation)
      "WebAssembly",
      // Modern compression APIs (assumed blocked)
      "CompressionStream",
      "DecompressionStream",
      // Storage APIs (real QuickJS validation: BLOCKED - confirmed)
      "localStorage",
      "sessionStorage",
      "indexedDB",
      // Crypto APIs (assumed blocked, needs validation)
      "crypto",
      "SubtleCrypto",
    ],
    restricted: [
      // These may be available via polyfills (real QuickJS validation: WORKING)
      "Buffer",
      "TextEncoder",
      "TextDecoder",
      "Blob",
      "URL",
      "FileReader",
    ],
  },

  stack: {
    maxDepth: 100, // Conservative recursion limit
    warningDepth: 80, // Warning at 80% of limit
  },

  data: {
    maxStringSize: 500 * 1024, // 500KB string limit
    maxChunkSize: 85 * 1024, // 85KB chunk size for storage
    warningSize: 100 * 1024, // 100KB warning threshold
  },
};

/**
 * Figma Constraint Detector
 *
 * Central authority for detecting, validating, and enforcing
 * Figma's QuickJS runtime constraints.
 */
export class FigmaConstraintDetector {
  protected constraints: FigmaEnvironmentConstraints;
  // Performance and memory baselines for future reference
  // These will be used for baseline comparison
  // private readonly performanceBaseline: number;
  // private readonly memoryBaseline: number;
  protected violationHistory: ConstraintViolation[] = [];

  constructor(
    constraints: FigmaEnvironmentConstraints = DEFAULT_FIGMA_CONSTRAINTS,
  ) {
    this.constraints = constraints;
    // Initialize baselines
    this.measurePerformanceBaseline(); // Establish baseline
    this.estimateMemoryBaseline(); // Establish baseline
  }

  /**
   * Check if an operation would violate constraints
   */
  checkOperation(operation: {
    type: "memory" | "execution" | "api" | "data";
    size?: number;
    duration?: number;
    api?: string;
    data?: string;
  }): ConstraintCheckResult {
    const violations: ConstraintViolation[] = [];
    let fallbackStrategy: string | undefined;

    switch (operation.type) {
      case "memory":
        this.checkMemoryConstraints(operation, violations);
        break;
      case "execution":
        this.checkExecutionConstraints(operation, violations);
        break;
      case "api":
        this.checkApiConstraints(operation, violations);
        fallbackStrategy = this.suggestApiFallback(operation.api);
        break;
      case "data":
        this.checkDataConstraints(operation, violations);
        break;
    }

    const allowed = violations.every((v) => v.severity !== "error");

    return {
      allowed,
      violations,
      fallbackStrategy,
      estimatedImpact: this.estimateImpact(operation),
    };
  }

  /**
   * Check if API is available in Figma environment
   */
  isApiAvailable(api: string): boolean {
    return this.constraints.apis.available.includes(api);
  }

  /**
   * Check if API is blocked in Figma environment
   */
  isApiBlocked(api: string): boolean {
    return this.constraints.apis.blocked.includes(api);
  }

  /**
   * Check if API requires polyfill in Figma environment
   */
  isApiRestricted(api: string): boolean {
    return this.constraints.apis.restricted.includes(api);
  }

  /**
   * Get fallback strategy for blocked API
   */
  suggestApiFallback(api?: string): string | undefined {
    if (!api) return undefined;

    const fallbacks: Record<string, string> = {
      setTimeout: "Use immediate synchronous execution",
      setInterval: "Use loop with yield points for UI responsiveness",
      Worker: "Use sync operations with chunking for large data",
      eval: "Use Function constructor or pre-compiled operations",
      fetch: "Use figma.clientStorage or pre-loaded data",
      localStorage: "Use figma.clientStorage for persistence",
      crypto: "Use simple hash functions or UUID libraries",
      WebAssembly: "Use native JavaScript implementations",
      XMLHttpRequest: "Use figma.clientStorage or pre-loaded data",
    };

    return fallbacks[api];
  }

  /**
   * Get diagnostic information about constraint violations
   */
  getDiagnostics(): {
    environment: string;
    constraints: FigmaEnvironmentConstraints;
    violations: ConstraintViolation[];
    recommendations: string[];
  } {
    const recommendations = this.generateRecommendations();

    return {
      environment: this.detectEnvironmentType(),
      constraints: this.constraints,
      violations: [...this.violationHistory],
      recommendations,
    };
  }

  /**
   * Update constraint limits (for testing scenarios)
   */
  updateConstraints(updates: Partial<FigmaEnvironmentConstraints>): void {
    this.constraints = { ...this.constraints, ...updates };
  }

  /**
   * Reset violation history
   */
  resetHistory(): void {
    this.violationHistory = [];
  }

  /**
   * Get current constraint configuration
   */
  getConstraints(): FigmaEnvironmentConstraints {
    return { ...this.constraints };
  }

  /**
   * Check memory constraints
   */
  private checkMemoryConstraints(
    operation: { size?: number },
    violations: ConstraintViolation[],
  ): void {
    if (!operation.size) return;

    const timestamp = Date.now(); // Add timestamp for violation tracking

    if (operation.size > this.constraints.memory.maxPerOperation) {
      violations.push({
        type: "memory",
        severity: "error",
        message: `Operation size ${operation.size} exceeds limit ${this.constraints.memory.maxPerOperation}`,
        details: {
          requested: operation.size,
          limit: this.constraints.memory.maxPerOperation,
        },
        remediation:
          "Split operation into smaller chunks or use streaming approach",
        timestamp,
      });
    } else if (operation.size > this.constraints.memory.warningThreshold) {
      violations.push({
        type: "memory",
        severity: "warning",
        message: `Operation size approaching memory limit`,
        details: {
          requested: operation.size,
          limit: this.constraints.memory.maxPerOperation,
        },
        remediation: "Consider optimizing data size or using chunking",
        timestamp,
      });
    }

    // Track violations
    violations.forEach((v) => this.violationHistory.push(v));
  }

  /**
   * Check execution time constraints
   */
  private checkExecutionConstraints(
    operation: { duration?: number },
    violations: ConstraintViolation[],
  ): void {
    if (!operation.duration) return;

    // Fast path: avoid expensive object creation if no violations
    const hardTimeout = this.constraints.execution.hardTimeout;
    const uiThreshold = this.constraints.execution.uiBlockingThreshold;

    if (operation.duration > hardTimeout) {
      // Only create timestamp when violation occurs
      violations.push({
        type: "execution",
        severity: "error",
        message: `Execution time ${operation.duration}ms exceeds hard limit ${hardTimeout}ms`,
        details: {
          requested: operation.duration,
          limit: hardTimeout,
        },
        remediation: "Break operation into smaller chunks with yield points",
        timestamp: Date.now(),
      });
    } else if (operation.duration > uiThreshold) {
      violations.push({
        type: "execution",
        severity: "warning",
        message: `Execution time may block UI (${operation.duration}ms > ${uiThreshold}ms)`,
        details: {
          requested: operation.duration,
          limit: uiThreshold,
        },
        remediation:
          "Optimize performance or add yield points for UI responsiveness",
        timestamp: Date.now(),
      });
    }

    // Track violations
    violations.forEach((v) => this.violationHistory.push(v));
  }

  /**
   * Check API availability constraints
   */
  private checkApiConstraints(
    operation: { api?: string },
    violations: ConstraintViolation[],
  ): void {
    if (!operation.api) return;

    // Fast path: check constraints without expensive operations
    const api = operation.api;

    if (this.isApiBlocked(api)) {
      // Only create expensive objects when violation occurs
      const fallback = this.suggestApiFallback(api);
      violations.push({
        type: "api",
        severity: "error",
        message: `API ${api} is not available in Figma environment`,
        details: {
          api: api,
          fallback: fallback,
        },
        remediation: fallback || "Use alternative approach",
        timestamp: Date.now(),
      });
    } else if (this.isApiRestricted(api)) {
      violations.push({
        type: "api",
        severity: "info",
        message: `API ${api} requires polyfill in Figma environment`,
        details: {
          api: operation.api,
        },
        remediation: "Polyfill will be automatically applied",
        timestamp: Date.now(),
      });
    }

    // Track violations
    violations.forEach((v) => this.violationHistory.push(v));
  }

  /**
   * Check data size constraints
   */
  private checkDataConstraints(
    operation: { data?: string; size?: number },
    violations: ConstraintViolation[],
  ): void {
    const size = operation.size || (operation.data ? operation.data.length : 0);
    if (!size) return;

    const timestamp = Date.now(); // Add timestamp for violation tracking

    if (size > this.constraints.data.maxStringSize) {
      violations.push({
        type: "data",
        severity: "error",
        message: `Data size ${size} exceeds string limit ${this.constraints.data.maxStringSize}`,
        details: {
          requested: size,
          limit: this.constraints.data.maxStringSize,
        },
        remediation: "Split data into chunks or use streaming approach",
        timestamp,
      });
    } else if (size > this.constraints.data.warningSize) {
      violations.push({
        type: "data",
        severity: "warning",
        message: `Data size approaching limit`,
        details: {
          requested: size,
          limit: this.constraints.data.maxStringSize,
        },
        remediation: "Consider data compression or chunking",
        timestamp,
      });
    }

    // Track violations
    violations.forEach((v) => this.violationHistory.push(v));
  }

  /**
   * Estimate performance impact of operation
   */
  private estimateImpact(operation: any): {
    memoryUsage: number;
    executionTime: number;
  } {
    return {
      memoryUsage: operation.size || 0,
      executionTime: operation.duration || 1,
    };
  }

  /**
   * Measure baseline performance (for future use)
   */
  private measurePerformanceBaseline(): number {
    const start = performance.now();
    // Simple calculation to establish baseline
    for (let i = 0; i < 1000; i++) {
      Math.random(); // Establish baseline without storing result
    }
    return performance.now() - start;
  }

  /**
   * Estimate memory baseline (for future use)
   */
  private estimateMemoryBaseline(): number {
    // Rough estimate based on typical object sizes
    return 1024; // 1KB baseline
  }

  /**
   * Detect environment type
   */
  private detectEnvironmentType(): string {
    if (typeof (globalThis as any).figma !== "undefined") {
      return "figma";
    }
    if (
      typeof performance === "undefined" ||
      typeof TextEncoder === "undefined"
    ) {
      return "quickjs";
    }
    if (typeof (globalThis as any).window !== "undefined") {
      return "browser";
    }
    if (typeof process !== "undefined") {
      return "node";
    }
    return "unknown";
  }

  /**
   * Generate recommendations based on violation history
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const violationCounts = this.violationHistory.reduce(
      (acc, v) => {
        acc[v.type] = (acc[v.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    if ((violationCounts.memory || 0) > 3) {
      recommendations.push(
        "Consider implementing data chunking to reduce memory usage",
      );
    }
    if ((violationCounts.execution || 0) > 3) {
      recommendations.push(
        "Add yield points to prevent UI blocking in long operations",
      );
    }
    if ((violationCounts.api || 0) > 5) {
      recommendations.push(
        "Review API usage and implement fallback strategies",
      );
    }
    if ((violationCounts.data || 0) > 2) {
      recommendations.push("Implement data compression for large payloads");
    }

    if (recommendations.length === 0) {
      recommendations.push(
        "No constraint issues detected - good performance profile",
      );
    }

    return recommendations;
  }
}

/**
 * Advanced Constraint Integration
 * Enhanced constraint detection with predictive analysis, smart fallback orchestration,
 * and real-time monitoring capabilities.
 */

/**
 * Operation plan for predictive analysis
 */
export interface OperationPlan {
  operations: {
    type: "memory" | "execution" | "api" | "data";
    size?: number;
    duration?: number;
    api?: string;
    data?: string;
    dependencies?: string[];
  }[];
  totalEstimatedTime: number;
  totalEstimatedMemory: number;
  criticalPath: string[];
}

/**
 * Violation prediction result
 */
export interface ViolationPrediction {
  wouldViolate: boolean;
  confidence: number; // 0-1 scale
  predictedViolations: ConstraintViolation[];
  recommendations: string[];
  fallbackStrategies: string[];
  riskLevel: "low" | "medium" | "high" | "critical";
}

/**
 * Fallback chain for graceful degradation
 */
export interface FallbackChain {
  primary: FallbackStrategy;
  secondary?: FallbackStrategy;
  emergency?: FallbackStrategy;
  estimatedPerformanceImpact: number;
}

/**
 * Individual fallback strategy
 */
export interface FallbackStrategy {
  name: string;
  description: string;
  implementation: () => Promise<any> | any;
  performanceImpact: number; // 0-1 scale
  reliabilityScore: number; // 0-1 scale
  constraints: ConstraintRequirement[];
}

/**
 * Constraint requirement for fallback strategies
 */
export interface ConstraintRequirement {
  type: "memory" | "execution" | "api";
  value: number | string;
  operator: "lt" | "lte" | "gt" | "gte" | "eq" | "available";
}

/**
 * Real-time monitoring state
 */
export interface MonitoringState {
  isActive: boolean;
  lastUpdate: number;
  healthScore: number; // 0-1 scale
  constraints: FigmaEnvironmentConstraints;
  violations: ConstraintViolation[];
  systemLoad: {
    memory: number;
    cpu: number;
    operations: number;
  };
}

/**
 * Advanced Constraint Detector with enhanced features
 * Extends base FigmaConstraintDetector with predictive analysis,
 * smart fallback orchestration, and real-time monitoring
 */
export class AdvancedConstraintDetector extends FigmaConstraintDetector {
  private monitoringState: MonitoringState;
  private performanceBudgetManager: PolyfillBudgetManager | null = null; // Performance system integration
  private operationHistory: OperationPlan[] = [];
  private fallbackRegistry: Map<string, FallbackStrategy[]> = new Map();
  private predictionCache: Map<string, ViolationPrediction> = new Map();

  constructor(
    constraints: FigmaEnvironmentConstraints = DEFAULT_FIGMA_CONSTRAINTS,
  ) {
    super(constraints);

    this.monitoringState = {
      isActive: false,
      lastUpdate: Date.now(),
      healthScore: 1.0,
      constraints,
      violations: [],
      systemLoad: { memory: 0, cpu: 0, operations: 0 },
    };

    // Initialize with default budget manager for testing
    this.performanceBudgetManager = new PolyfillBudgetManager();

    this.initializeFallbackRegistry();

    // Start monitoring, but use test-friendly version in test environments
    if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
      this.startTestFriendlyMonitoring();
    } else {
      this.startRealTimeMonitoring();
    }
  }

  /**
   * Predictive Constraint Analysis
   * Pre-flight checks for complex operations with violation prediction
   */
  predictViolations(operationPlan: OperationPlan): ViolationPrediction {
    const cacheKey = this.generateCacheKey(operationPlan);

    // Check cache for recent predictions
    const cached = this.predictionCache.get(cacheKey);
    if (cached && Date.now() - cached.confidence < 5000) {
      // 5s cache
      return cached;
    }

    const prediction = this.analyzeOperationPlan(operationPlan);

    // Cache prediction with confidence-based TTL
    this.predictionCache.set(cacheKey, prediction);

    // Clean up old cache entries
    if (this.predictionCache.size > 100) {
      this.cleanupPredictionCache();
    }

    return prediction;
  }

  /**
   * Smart Fallback Orchestration
   * Multi-level fallback strategies with contextual selection
   */
  orchestrateFallbacks(constraints: ConstraintViolation[]): FallbackChain {
    const violationType = this.categorizeViolations(constraints);
    const fallbacks = this.selectOptimalFallbacks(violationType, constraints);

    return {
      primary: fallbacks.primary,
      secondary: fallbacks.secondary,
      emergency: fallbacks.emergency,
      estimatedPerformanceImpact: this.calculatePerformanceImpact(fallbacks),
    };
  }

  /**
   * Real-time Constraint Monitoring
   * Continuous health checking with dynamic constraint updates
   */
  startRealTimeMonitoring(): void {
    if (this.monitoringState.isActive) return;

    this.monitoringState.isActive = true;

    // Use setTimeout instead of setInterval for better QuickJS compatibility
    const monitoringLoop = () => {
      if (!this.monitoringState.isActive) return;

      this.updateSystemLoad();
      this.updateHealthScore();
      this.adjustDynamicThresholds();

      // Schedule next monitoring cycle (every 5 seconds)
      setTimeout(monitoringLoop, 5000);
    };

    // Start monitoring with slight delay
    setTimeout(monitoringLoop, 1000);
  }

  /**
   * Stop real-time monitoring
   */
  stopRealTimeMonitoring(): void {
    this.monitoringState.isActive = false;
  }

  /**
   * Start test-friendly monitoring (no timers)
   */
  startTestFriendlyMonitoring(): void {
    this.monitoringState.isActive = true;

    // In test mode, just perform one-time initialization
    // without starting timers that would interfere with test completion
    this.updateSystemLoad();
    this.updateHealthScore();
    this.adjustDynamicThresholds();
  }

  /**
   * Performance Budget Integration
   * Integration with performance budget system
   */
  integratePerformanceBudget(budgetManager: PolyfillBudgetManager): void {
    this.performanceBudgetManager = budgetManager;

    // Enhance constraint checking with budget awareness
    this.enhanceConstraintChecking();

    // Deep Performance Integration
    this.enableDeepPerformanceIntegration();
  }

  /**
   * Deep Performance Integration
   * Enhanced performance monitoring and optimization with performance system
   */
  private enableDeepPerformanceIntegration(): void {
    if (!this.performanceBudgetManager) return;

    // Set up real-time performance monitoring
    this.setupRealTimePerformanceMonitoring();

    // Configure adaptive constraint thresholds
    this.configureAdaptiveConstraints();

    // Enable predictive constraint analysis
    this.enablePredictiveConstraintAnalysis();
  }

  /**
   * Real-time Performance Monitoring
   * Continuous performance monitoring with performance system integration
   */
  private setupRealTimePerformanceMonitoring(): void {
    if (!this.performanceBudgetManager) return;

    // Skip timer-based monitoring in test environments
    if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
      // In test mode, just perform one-time setup without timers
      this.performTestFriendlyPerformanceMonitoring();
      return;
    }

    // Monitor budget usage in real-time
    const monitorBudget = () => {
      if (!this.monitoringState.isActive || !this.performanceBudgetManager)
        return;

      const budgetState = this.performanceBudgetManager.getCurrentBudgetState();
      const remainingBudget = budgetState?.currentBudget || 16;

      // Adjust UI blocking threshold based on remaining budget
      if (remainingBudget < 5) {
        this.constraints.execution.uiBlockingThreshold = Math.max(
          remainingBudget * 0.8,
          1,
        );
      } else {
        this.constraints.execution.uiBlockingThreshold = Math.min(
          remainingBudget * 0.6,
          16,
        );
      }

      // Update health score based on budget compliance
      const budgetCompliance = remainingBudget / 16;
      this.monitoringState.healthScore =
        (this.monitoringState.healthScore + budgetCompliance) / 2;

      // Schedule next monitoring cycle
      setTimeout(monitorBudget, 1000); // Check every second
    };

    // Start monitoring
    setTimeout(monitorBudget, 100);
  }

  private performTestFriendlyPerformanceMonitoring(): void {
    if (!this.performanceBudgetManager) return;

    // Perform one-time budget state check without timers
    const budgetState = this.performanceBudgetManager.getCurrentBudgetState();
    const remainingBudget = budgetState?.currentBudget || 16;

    // Set up thresholds based on current budget
    if (remainingBudget < 5) {
      this.constraints.execution.uiBlockingThreshold = Math.max(
        remainingBudget * 0.8,
        1,
      );
    } else {
      this.constraints.execution.uiBlockingThreshold = Math.min(
        remainingBudget * 0.6,
        16,
      );
    }

    // Update health score based on budget compliance
    const budgetCompliance = remainingBudget / 16;
    this.monitoringState.healthScore =
      (this.monitoringState.healthScore + budgetCompliance) / 2;
  }

  /**
   * Adaptive Constraint Configuration
   * Dynamic constraint adjustment based on performance data
   */
  private configureAdaptiveConstraints(): void {
    if (!this.performanceBudgetManager) return;

    // Set up adaptive memory constraints
    this.setupAdaptiveMemoryConstraints();

    // Set up adaptive execution constraints
    this.setupAdaptiveExecutionConstraints();

    // Set up adaptive data constraints
    this.setupAdaptiveDataConstraints();
  }

  /**
   * Adaptive Memory Constraints
   * Dynamic memory constraint adjustment based on memory budget
   */
  private setupAdaptiveMemoryConstraints(): void {
    const adjustMemoryConstraints = () => {
      if (!this.performanceBudgetManager) return;

      const budgetState = this.performanceBudgetManager.getCurrentBudgetState();
      const memoryState = {
        available: budgetState.currentBudget,
        pressure: budgetState.utilizationRate,
      };
      const pressureValue = memoryState?.pressure || "low";

      // Convert pressure to string for consistent handling
      let memoryPressure: string;
      if (typeof pressureValue === "number") {
        if (pressureValue > 0.8) memoryPressure = "critical";
        else if (pressureValue > 0.6) memoryPressure = "high";
        else if (pressureValue > 0.4) memoryPressure = "medium";
        else memoryPressure = "low";
      } else {
        memoryPressure = pressureValue;
      }

      // Adjust memory constraints based on pressure
      switch (memoryPressure) {
        case "critical":
          this.constraints.memory.maxPerOperation = 2 * 1024 * 1024; // 2MB
          this.constraints.memory.warningThreshold = 1 * 1024 * 1024; // 1MB
          break;
        case "high":
          this.constraints.memory.maxPerOperation = 4 * 1024 * 1024; // 4MB
          this.constraints.memory.warningThreshold = 3 * 1024 * 1024; // 3MB
          break;
        case "medium":
          this.constraints.memory.maxPerOperation = 6 * 1024 * 1024; // 6MB
          this.constraints.memory.warningThreshold = 5 * 1024 * 1024; // 5MB
          break;
        default:
          this.constraints.memory.maxPerOperation = 8 * 1024 * 1024; // 8MB
          this.constraints.memory.warningThreshold = 6 * 1024 * 1024; // 6MB
      }
    };

    // Don't start timers in test environment
    if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
      return;
    }

    // Adjust constraints every 5 seconds
    setInterval(adjustMemoryConstraints, 5000);
  }

  /**
   * Adaptive Execution Constraints
   * Dynamic execution constraint adjustment based on performance budget
   */
  private setupAdaptiveExecutionConstraints(): void {
    const adjustExecutionConstraints = () => {
      if (!this.performanceBudgetManager) return;

      const performanceMetrics =
        this.performanceBudgetManager.getPerformanceAnalytics();
      // Use averageFrameTime as a proxy for latency since averageLatency doesn't exist
      const averageLatency = performanceMetrics?.averageFrameTime || 5;

      // Adjust execution constraints based on average latency
      if (averageLatency > 10) {
        this.constraints.execution.uiBlockingThreshold = Math.max(
          averageLatency * 0.5,
          2,
        );
        this.constraints.execution.operationBudget = Math.max(
          averageLatency * 0.3,
          1,
        );
      } else {
        this.constraints.execution.uiBlockingThreshold = 16;
        this.constraints.execution.operationBudget = 8;
      }
    };

    // Don't start timers in test environment
    if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
      return;
    }

    // Adjust constraints every 3 seconds
    setInterval(adjustExecutionConstraints, 3000);
  }

  /**
   * Adaptive Data Constraints
   * Dynamic data constraint adjustment based on quota usage
   */
  private setupAdaptiveDataConstraints(): void {
    const adjustDataConstraints = () => {
      if (!this.performanceBudgetManager) return;

      const budgetState = this.performanceBudgetManager.getCurrentBudgetState();
      const quotaState = {
        available: budgetState.currentBudget,
        used: budgetState.totalBudget - budgetState.currentBudget,
      };
      const quotaUtilization =
        quotaState.available > 0
          ? quotaState.used / (quotaState.used + quotaState.available)
          : 0;

      // Adjust data constraints based on quota utilization
      if (quotaUtilization > 0.8) {
        this.constraints.data.maxStringSize = 250 * 1024; // 250KB
        this.constraints.data.maxChunkSize = 40 * 1024; // 40KB
        this.constraints.data.warningSize = 50 * 1024; // 50KB
      } else if (quotaUtilization > 0.6) {
        this.constraints.data.maxStringSize = 400 * 1024; // 400KB
        this.constraints.data.maxChunkSize = 70 * 1024; // 70KB
        this.constraints.data.warningSize = 80 * 1024; // 80KB
      } else {
        this.constraints.data.maxStringSize = 500 * 1024; // 500KB
        this.constraints.data.maxChunkSize = 85 * 1024; // 85KB
        this.constraints.data.warningSize = 100 * 1024; // 100KB
      }
    };

    // Don't start timers in test environment
    if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
      return;
    }

    // Adjust constraints every 10 seconds
    setInterval(adjustDataConstraints, 10000);
  }

  /**
   * Predictive Constraint Analysis
   * Predictive analysis of constraint violations using performance data
   */
  private enablePredictiveConstraintAnalysis(): void {
    if (!this.performanceBudgetManager) return;

    // Set up predictive analysis
    this.setupPredictiveAnalysis();

    // Set up proactive constraint adjustments
    this.setupProactiveConstraintAdjustments();
  }

  /**
   * Predictive Analysis Setup
   * Machine learning-inspired predictive analysis of constraint violations
   */
  private setupPredictiveAnalysis(): void {
    const performPredictiveAnalysis = () => {
      if (!this.performanceBudgetManager) return;

      // Analyze historical performance data - fallback implementation
      const currentMetrics =
        this.performanceBudgetManager.getPerformanceAnalytics();
      const trends = this.analyzePerformanceTrends([currentMetrics]);

      // Predict future constraint violations
      const predictions = this.predictConstraintViolations(trends);

      // Update monitoring state with predictions (add to any type to avoid errors)
      (this.monitoringState as any).predictions = predictions;

      // Adjust constraints proactively (inline implementation)
      this.adjustConstraintsBasedOnPredictions(predictions);
    };

    // Don't start timers in test environment
    if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
      return;
    }

    // Perform predictive analysis every 30 seconds
    setInterval(performPredictiveAnalysis, 30000);
  }

  /**
   * Performance Trend Analysis
   * Analyze performance trends to predict future constraint violations
   */
  private analyzePerformanceTrends(historicalData: any[]): any {
    if (!historicalData || historicalData.length < 3) {
      return {
        memoryTrend: "stable",
        executionTrend: "stable",
        dataTrend: "stable",
      };
    }

    // Calculate trends for memory usage
    const memoryUsages = historicalData.map((d) => d.memoryUsage || 0);
    const memoryTrend = this.calculateTrend(memoryUsages);

    // Calculate trends for execution time
    const executionTimes = historicalData.map((d) => d.executionTime || 0);
    const executionTrend = this.calculateTrend(executionTimes);

    // Calculate trends for data size
    const dataSizes = historicalData.map((d) => d.dataSize || 0);
    const dataTrend = this.calculateTrend(dataSizes);

    return {
      memoryTrend:
        memoryTrend > 0.1
          ? "increasing"
          : memoryTrend < -0.1
            ? "decreasing"
            : "stable",
      executionTrend:
        executionTrend > 0.1
          ? "increasing"
          : executionTrend < -0.1
            ? "decreasing"
            : "stable",
      dataTrend:
        dataTrend > 0.1
          ? "increasing"
          : dataTrend < -0.1
            ? "decreasing"
            : "stable",
    };
  }

  /**
   * Trend Calculation
   * Simple linear trend calculation for performance metrics
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + i * val, 0);
    const sumXX = values.reduce((sum, _, i) => sum + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope || 0;
  }

  /**
   * Constraint Violation Prediction
   * Predict future constraint violations based on performance trends
   */
  private predictConstraintViolations(trends: any): any {
    const predictions = {
      memoryViolationRisk: "low",
      executionViolationRisk: "low",
      dataViolationRisk: "low",
      overallRisk: "low",
    };

    // Predict memory violations
    if (trends.memoryTrend === "increasing") {
      predictions.memoryViolationRisk = "high";
    } else if (trends.memoryTrend === "stable") {
      predictions.memoryViolationRisk = "medium";
    }

    // Predict execution violations
    if (trends.executionTrend === "increasing") {
      predictions.executionViolationRisk = "high";
    } else if (trends.executionTrend === "stable") {
      predictions.executionViolationRisk = "medium";
    }

    // Predict data violations
    if (trends.dataTrend === "increasing") {
      predictions.dataViolationRisk = "high";
    } else if (trends.dataTrend === "stable") {
      predictions.dataViolationRisk = "medium";
    }

    // Calculate overall risk
    const riskLevels = [
      predictions.memoryViolationRisk,
      predictions.executionViolationRisk,
      predictions.dataViolationRisk,
    ];

    if (riskLevels.includes("high")) {
      predictions.overallRisk = "high";
    } else if (riskLevels.includes("medium")) {
      predictions.overallRisk = "medium";
    }

    return predictions;
  }

  /**
   * Proactive Constraint Adjustments
   * Proactively adjust constraints based on violation predictions
   */
  private setupProactiveConstraintAdjustments(): void {
    const adjustConstraintsProactively = () => {
      const predictions = (this.monitoringState as any).predictions;
      if (!predictions) return;

      // Adjust constraints based on predictions
      if (predictions.memoryViolationRisk === "high") {
        this.constraints.memory.warningThreshold *= 0.8;
        this.constraints.memory.maxPerOperation *= 0.9;
      }

      if (predictions.executionViolationRisk === "high") {
        this.constraints.execution.uiBlockingThreshold *= 0.7;
        this.constraints.execution.operationBudget *= 0.8;
      }

      if (predictions.dataViolationRisk === "high") {
        this.constraints.data.warningSize *= 0.8;
        this.constraints.data.maxChunkSize *= 0.9;
      }
    };

    // Don't start timers in test environment
    if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
      return;
    }

    // Adjust constraints every 60 seconds
    setInterval(adjustConstraintsProactively, 60000);
  }

  /**
   * Enhanced Monitoring State
   * Get enhanced monitoring state with performance system integration
   */
  getEnhancedMonitoringState(): MonitoringState & {
    enhancedIntegration: boolean;
    budgetState: any;
    memoryState: any;
    quotaState: any;
    predictions: any;
  } {
    const baseState = this.getMonitoringState();

    return {
      ...baseState,
      enhancedIntegration: !!this.performanceBudgetManager,
      budgetState:
        this.performanceBudgetManager?.getCurrentBudgetState() || null,
      memoryState: null, // getMemoryState method doesn't exist
      quotaState: null, // getQuotaState method doesn't exist
      predictions: (this.monitoringState as any).predictions || null,
    };
  }

  /**
   * Get current monitoring state for diagnostics
   */
  getMonitoringState(): MonitoringState {
    return { ...this.monitoringState };
  }

  /**
   * Get prediction analytics for optimization insights
   */
  getPredictionAnalytics(): {
    cacheHitRate: number;
    averageConfidence: number;
    mostCommonViolations: string[];
    fallbackSuccess: number;
  } {
    const totalPredictions = this.operationHistory.length;
    const cacheSize = this.predictionCache.size;

    return {
      cacheHitRate: totalPredictions > 0 ? cacheSize / totalPredictions : 0,
      averageConfidence: this.calculateAverageConfidence(),
      mostCommonViolations: this.getMostCommonViolations(),
      fallbackSuccess: this.calculateFallbackSuccessRate(),
    };
  }

  // Private implementation methods

  private analyzeOperationPlan(plan: OperationPlan): ViolationPrediction {
    const violations: ConstraintViolation[] = [];
    let confidence = 0.8; // Base confidence

    // Analyze each operation in the plan
    for (const operation of plan.operations) {
      const result = this.checkOperation(operation);
      violations.push(...result.violations);

      // Adjust confidence based on operation complexity
      if (operation.dependencies && operation.dependencies.length > 0) {
        confidence *= 0.9; // Reduce confidence for complex operations
      }
    }

    // Analyze cumulative effects
    const cumulativeViolations = this.analyzeCumulativeEffects(plan);
    violations.push(...cumulativeViolations);

    // Determine risk level
    const riskLevel = this.calculateRiskLevel(violations, plan);

    // Generate recommendations
    const recommendations = this.generatePredictiveRecommendations(
      violations,
      plan,
    );

    // Suggest fallback strategies
    const fallbackStrategies = this.suggestFallbackStrategies(violations);

    return {
      wouldViolate: violations.some((v) => v.severity === "error"),
      confidence,
      predictedViolations: violations,
      recommendations,
      fallbackStrategies,
      riskLevel,
    };
  }

  private analyzeCumulativeEffects(plan: OperationPlan): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    // Check total memory usage
    if (
      plan.totalEstimatedMemory >
      this.constraints.memory.maxPerOperation * 0.8
    ) {
      violations.push({
        type: "memory",
        severity: "warning",
        message: `Cumulative memory usage (${plan.totalEstimatedMemory}) may approach limits`,
        details: {
          estimated: plan.totalEstimatedMemory,
          threshold: this.constraints.memory.maxPerOperation,
        },
        remediation:
          "Consider breaking operations into smaller chunks or using streaming",
      });
    }

    // Check total execution time
    if (
      plan.totalEstimatedTime > this.constraints.execution.uiBlockingThreshold
    ) {
      violations.push({
        type: "execution",
        severity: "warning",
        message: `Cumulative execution time (${plan.totalEstimatedTime}ms) may block UI`,
        details: {
          estimated: plan.totalEstimatedTime,
          threshold: this.constraints.execution.uiBlockingThreshold,
        },
        remediation: "Add yield points or defer non-critical operations",
      });
    }

    return violations;
  }

  private calculateRiskLevel(
    violations: ConstraintViolation[],
    plan: OperationPlan,
  ): "low" | "medium" | "high" | "critical" {
    const errorCount = violations.filter((v) => v.severity === "error").length;
    const warningCount = violations.filter(
      (v) => v.severity === "warning",
    ).length;

    if (
      errorCount > 2 ||
      plan.totalEstimatedTime > this.constraints.execution.hardTimeout
    ) {
      return "critical";
    }
    if (errorCount > 0 || warningCount > 3) {
      return "high";
    }
    if (warningCount > 1) {
      return "medium";
    }
    return "low";
  }

  private generatePredictiveRecommendations(
    violations: ConstraintViolation[],
    plan: OperationPlan,
  ): string[] {
    const recommendations: string[] = [];

    if (violations.some((v) => v.type === "memory")) {
      recommendations.push(
        "Consider implementing chunked processing to reduce memory pressure",
      );
    }

    if (violations.some((v) => v.type === "execution")) {
      recommendations.push("Add yield points to prevent UI blocking");
    }

    if (plan.operations.length > 5) {
      recommendations.push("Consider parallelizing independent operations");
    }

    if (plan.criticalPath.length > 3) {
      recommendations.push(
        "Optimize critical path operations for better performance",
      );
    }

    return recommendations;
  }

  private suggestFallbackStrategies(
    violations: ConstraintViolation[],
  ): string[] {
    const strategies: string[] = [];

    for (const violation of violations) {
      const fallbacks = this.fallbackRegistry.get(violation.type);
      if (fallbacks && fallbacks.length > 0) {
        strategies.push(...fallbacks.map((f) => f.name));
      }
    }

    return [...new Set(strategies)]; // Remove duplicates
  }

  private categorizeViolations(constraints: ConstraintViolation[]): string {
    const types = constraints.map((c) => c.type);
    const majorityType = this.getMajorityType(types);
    return majorityType || "general";
  }

  private getMajorityType(types: string[]): string {
    const counts = types.reduce(
      (acc, type) => {
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return (
      Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0] || "general"
    );
  }

  private selectOptimalFallbacks(
    violationType: string,
    constraints: ConstraintViolation[],
  ): {
    primary: FallbackStrategy;
    secondary?: FallbackStrategy;
    emergency?: FallbackStrategy;
  } {
    const availableFallbacks = this.fallbackRegistry.get(violationType) || [];

    // Filter fallbacks based on constraint severity
    const hasCriticalViolations = constraints.some(
      (c) => c.severity === "error",
    );
    const hasHighDataUsage = constraints.some(
      (c) => c.type === "data" && (c.details as any)?.size > 100000,
    );

    // Sort by reliability and performance, considering constraint context
    const sortedFallbacks = availableFallbacks.sort((a, b) => {
      let scoreA = a.reliabilityScore * 0.7 + (1 - a.performanceImpact) * 0.3;
      let scoreB = b.reliabilityScore * 0.7 + (1 - b.performanceImpact) * 0.3;

      // Prioritize low-impact fallbacks for critical violations
      if (hasCriticalViolations) {
        scoreA += a.performanceImpact < 0.3 ? 0.2 : 0;
        scoreB += b.performanceImpact < 0.3 ? 0.2 : 0;
      }

      // Prioritize memory-efficient fallbacks for high data usage
      if (hasHighDataUsage) {
        // Prefer fallbacks with lower performance impact for memory-heavy operations
        scoreA += a.performanceImpact < 0.4 ? 0.15 : 0;
        scoreB += b.performanceImpact < 0.4 ? 0.15 : 0;
      }

      return scoreB - scoreA;
    });

    return {
      primary: sortedFallbacks[0] || this.getDefaultFallback(),
      secondary: sortedFallbacks[1],
      emergency: sortedFallbacks[2] || this.getEmergencyFallback(),
    };
  }

  private calculatePerformanceImpact(fallbacks: any): number {
    const primary = fallbacks.primary?.performanceImpact || 0;
    const secondary = fallbacks.secondary?.performanceImpact || 0;
    const emergency = fallbacks.emergency?.performanceImpact || 0;

    // Weighted average (primary is most likely to be used)
    return primary * 0.7 + secondary * 0.2 + emergency * 0.1;
  }

  private updateSystemLoad(): void {
    const now = Date.now();

    // Estimate memory usage based on recent operations
    const recentOperations = this.operationHistory.filter(
      (op) => now - op.totalEstimatedTime < 30000, // Last 30 seconds
    );

    this.monitoringState.systemLoad = {
      memory: Math.min(
        recentOperations.reduce((sum, op) => sum + op.totalEstimatedMemory, 0) /
          this.constraints.memory.maxPerOperation,
        1,
      ),
      cpu: Math.min(recentOperations.length / 10, 1), // Simple heuristic
      operations: recentOperations.length,
    };

    this.monitoringState.lastUpdate = now;
  }

  private updateHealthScore(): void {
    const load = this.monitoringState.systemLoad;
    const recentViolations = this.violationHistory.filter(
      (v) => v.timestamp && Date.now() - v.timestamp < 60000, // Last minute
    ).length;

    // Calculate health score (0-1, where 1 is perfect health)
    const memoryHealth = 1 - load.memory;
    const cpuHealth = 1 - load.cpu;
    const violationHealth = Math.max(0, 1 - recentViolations / 10);

    this.monitoringState.healthScore =
      (memoryHealth + cpuHealth + violationHealth) / 3;
  }

  private adjustDynamicThresholds(): void {
    const load = this.monitoringState.systemLoad;

    // Adjust memory thresholds based on current load
    if (load.memory > 0.8) {
      this.constraints.memory.warningThreshold *= 0.9; // More conservative
    } else if (load.memory < 0.3) {
      this.constraints.memory.warningThreshold *= 1.05; // Less conservative
    }

    // Adjust execution thresholds based on performance budget
    if (this.performanceBudgetManager) {
      const budgetState = this.performanceBudgetManager.getCurrentBudgetState();
      const remainingBudget = budgetState.currentBudget;
      if (remainingBudget < 5) {
        this.constraints.execution.uiBlockingThreshold = Math.min(
          remainingBudget,
          2,
        );
      }
    }
  }

  private enhanceConstraintChecking(): void {
    if (!this.performanceBudgetManager) return;

    // Override checkOperation to include budget awareness
    const originalCheckOperation = this.checkOperation.bind(this);

    this.checkOperation = (operation: any) => {
      const result = originalCheckOperation(operation);

      // Add budget-specific violations with null checks
      if (this.performanceBudgetManager) {
        const budgetState =
          this.performanceBudgetManager.getCurrentBudgetState();
        if (budgetState.utilizationRate > 0.8) {
          // shouldYield equivalent
          result.violations.push({
            type: "execution",
            severity: "warning",
            message: "Operation may exceed UI budget constraints",
            details: { budget: budgetState.currentBudget }, // getRemainingBudget equivalent
            remediation: "Consider deferring operation to next frame",
          });
        }
      }

      return result;
    };
  }

  private initializeFallbackRegistry(): void {
    // Memory fallbacks
    this.fallbackRegistry.set("memory", [
      {
        name: "chunked-processing",
        description: "Break operation into smaller memory chunks",
        implementation: () => Promise.resolve("chunked"),
        performanceImpact: 0.2,
        reliabilityScore: 0.9,
        constraints: [{ type: "memory", value: 1024 * 1024, operator: "lt" }],
      },
      {
        name: "streaming-approach",
        description:
          "Use streaming to process data without loading all into memory",
        implementation: () => Promise.resolve("streaming"),
        performanceImpact: 0.3,
        reliabilityScore: 0.85,
        constraints: [{ type: "memory", value: 512 * 1024, operator: "lt" }],
      },
    ]);

    // Execution fallbacks
    this.fallbackRegistry.set("execution", [
      {
        name: "yielding-execution",
        description: "Add yield points to prevent UI blocking",
        implementation: () => Promise.resolve("yielding"),
        performanceImpact: 0.1,
        reliabilityScore: 0.95,
        constraints: [{ type: "execution", value: 16, operator: "lt" }],
      },
      {
        name: "deferred-execution",
        description: "Defer non-critical operations to next frame",
        implementation: () => Promise.resolve("deferred"),
        performanceImpact: 0.05,
        reliabilityScore: 0.9,
        constraints: [],
      },
    ]);

    // API fallbacks
    this.fallbackRegistry.set("api", [
      {
        name: "sync-alternative",
        description: "Use synchronous alternative for blocked async API",
        implementation: () => "sync",
        performanceImpact: 0.4,
        reliabilityScore: 0.8,
        constraints: [{ type: "api", value: "Worker", operator: "available" }],
      },
    ]);
  }

  private getDefaultFallback(): FallbackStrategy {
    return {
      name: "no-operation",
      description: "Skip operation gracefully",
      implementation: () => null,
      performanceImpact: 0,
      reliabilityScore: 1,
      constraints: [],
    };
  }

  private getEmergencyFallback(): FallbackStrategy {
    return {
      name: "emergency-abort",
      description: "Abort operation to prevent system failure",
      implementation: () => {
        throw new Error("Operation aborted due to constraint violations");
      },
      performanceImpact: 0,
      reliabilityScore: 1,
      constraints: [],
    };
  }

  private generateCacheKey(plan: OperationPlan): string {
    return JSON.stringify({
      ops: plan.operations.length,
      time: plan.totalEstimatedTime,
      memory: plan.totalEstimatedMemory,
      types: plan.operations.map((o) => o.type).sort(),
    });
  }

  private cleanupPredictionCache(): void {
    const now = Date.now();
    for (const [key, prediction] of this.predictionCache.entries()) {
      if (now - prediction.confidence > 30000) {
        // 30s TTL
        this.predictionCache.delete(key);
      }
    }
  }

  private calculateAverageConfidence(): number {
    const predictions = Array.from(this.predictionCache.values());
    if (predictions.length === 0) return 0;

    return (
      predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length
    );
  }

  private getMostCommonViolations(): string[] {
    const violationCounts: Record<string, number> = {};

    for (const violation of this.violationHistory) {
      violationCounts[violation.type] =
        (violationCounts[violation.type] || 0) + 1;
    }

    return Object.entries(violationCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type]) => type);
  }

  private calculateFallbackSuccessRate(): number {
    // This would be tracked in a real implementation
    // For now, return a reasonable estimate
    return 0.85;
  }

  /**
   * Adjust constraints based on predictions
   */
  private adjustConstraintsBasedOnPredictions(predictions: any): void {
    if (!predictions || predictions.length === 0) return;

    // Simple implementation for constraint adjustment based on predictions
    for (const prediction of predictions) {
      if (prediction.type === "memory" && prediction.severity === "high") {
        this.constraints.memory.maxPerOperation *= 0.8; // Reduce memory limit by 20%
      }
      if (prediction.type === "execution" && prediction.severity === "high") {
        this.constraints.execution.uiBlockingThreshold *= 0.9; // Reduce UI blocking threshold by 10%
      }
    }
  }
}

/**
 * Global instance for easy access throughout the application
 */
export const advancedConstraintDetector = new AdvancedConstraintDetector();

/**
 * Export for use in polyfills and other constraint-aware components
 */
export { AdvancedConstraintDetector as FigmaAdvancedConstraintDetector };

/**
 * Global instance for centralized constraint management
 */
export const figmaConstraintDetector = new AdvancedConstraintDetector();

/**
 * Convenience function for quick constraint checks
 */
export function checkFigmaConstraints(operation: {
  type: "memory" | "execution" | "api" | "data";
  size?: number;
  duration?: number;
  api?: string;
  data?: string;
}): ConstraintCheckResult {
  return figmaConstraintDetector.checkOperation(operation);
}

/**
 * Check if we're running in Figma environment
 */
export function isFigmaEnvironment(): boolean {
  return typeof (globalThis as any).figma !== "undefined";
}

/**
 * Get constraint-aware error message for blocked APIs
 */
export function getConstraintAwareErrorMessage(api: string): string {
  const result = figmaConstraintDetector.checkOperation({ type: "api", api });

  if (result.violations.length > 0) {
    const violation = result.violations[0];
    if (violation) {
      return `${violation.message}. ${violation.remediation}`;
    }
  }

  return `API ${api} usage needs review for Figma compatibility`;
}
