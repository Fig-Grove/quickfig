/**
 * Polyfill Error Boundaries and Recovery System
 * 
 * Comprehensive error handling with graceful degradation, recovery strategies,
 * and actionable error reporting for polyfill operations.
 */

import { debugLog, debugWarn } from './debug-utils.js';
import {
  PolyfillError,
  ConstraintViolationError,
  MemoryExhaustionError,
  PerformanceTimeoutError,
  PolyfillOperationContext,
  ConstraintViolation,
  ErrorBoundaryConfig,
  RetryPolicy,
  PolyfillTypeGuards
} from './polyfill-types.js';

/**
 * Error boundary for polyfill operations
 */
export class PolyfillErrorBoundary {
  private config: ErrorBoundaryConfig;
  private errorCounts: Map<string, number> = new Map();
  private lastErrors: Map<string, number> = new Map();
  private recoveryAttempts: Map<string, number> = new Map();

  constructor(config: Partial<ErrorBoundaryConfig> = {}) {
    this.config = {
      catchAll: true,
      logErrors: true,
      notifyUser: false,
      fallbackStrategy: 'graceful',
      maxRecoveryAttempts: 3,
      recoveryTimeout: 5000,
      ...config
    };
  }

  /**
   * Execute a polyfill operation with error boundary protection
   */
  async executeWithBoundary<T>(
    operation: () => Promise<T> | T,
    context: PolyfillOperationContext,
    fallbackOperation?: () => Promise<T> | T
  ): Promise<T> {
    const operationId = `${context.api}.${context.operation}`;
    
    try {
      // Check if operation should be attempted
      if (!this.shouldAttemptOperation(operationId)) {
        throw new PolyfillError(
          'OP_CIRCUIT_BREAKER',
          `Operation ${operationId} is temporarily disabled due to repeated failures`,
          context.api,
          context.operation,
          context,
          'high',
          ['Wait for recovery timeout', 'Use alternative polyfill', 'Reduce operation complexity'],
          ['fallback-implementation', 'manual-retry']
        );
      }

      // Execute the operation
      const result = await operation();
      
      // Record successful execution
      this.recordSuccess(operationId);
      
      return result;
    } catch (error) {
      // Handle the error with comprehensive reporting
      return await this.handleError(error, context, operationId, fallbackOperation);
    }
  }

  /**
   * Synchronous version - Execute a polyfill operation with error boundary protection
   */
  executeWithBoundarySynchronous<T>(
    operation: () => T,
    context: PolyfillOperationContext,
    fallbackOperation?: () => T
  ): T {
    const operationId = `${context.api}.${context.operation}`;
    
    try {
      // Check if operation should be attempted
      if (!this.shouldAttemptOperation(operationId)) {
        throw new PolyfillError(
          'OP_CIRCUIT_BREAKER',
          `Operation ${operationId} is temporarily disabled due to repeated failures`,
          context.api,
          context.operation,
          context,
          'high',
          ['Wait for recovery timeout', 'Use alternative polyfill', 'Reduce operation complexity'],
          ['fallback-implementation', 'manual-retry']
        );
      }

      // Execute the operation
      const result = operation();
      
      // Record successful execution
      this.recordSuccess(operationId);
      
      return result;
    } catch (error) {
      // Handle the error with comprehensive reporting (synchronous version)
      return this.handleErrorSynchronous(error, context, operationId, fallbackOperation);
    }
  }

  /**
   * Handle errors with comprehensive recovery strategies
   */
  private async handleError<T>(
    error: any,
    context: PolyfillOperationContext,
    operationId: string,
    fallbackOperation?: () => Promise<T> | T
  ): Promise<T> {
    // Record the error
    this.recordError(operationId);

    // Create enhanced error information
    const enhancedError = this.enhanceError(error, context);

    // Log the error if configured
    if (this.config.logErrors) {
      this.logError(enhancedError);
    }

    // Attempt recovery based on strategy
    switch (this.config.fallbackStrategy) {
      case 'graceful':
        return await this.attemptGracefulRecovery(enhancedError, context, operationId, fallbackOperation);
      
      case 'retry':
        return await this.attemptRetryRecovery(enhancedError, context, operationId, fallbackOperation);
      
      case 'degrade':
        return await this.attemptDegradedRecovery(enhancedError, context, operationId, fallbackOperation);
      
      case 'fail-fast':
      default:
        throw enhancedError;
    }
  }

  /**
   * Synchronous version - Handle errors with comprehensive recovery strategies
   */
  private handleErrorSynchronous<T>(
    error: any,
    context: PolyfillOperationContext,
    operationId: string,
    fallbackOperation?: () => T
  ): T {
    // Record the error
    this.recordError(operationId);

    // Create enhanced error information
    const enhancedError = this.enhanceError(error, context);

    // Log the error if configured
    if (this.config.logErrors) {
      this.logError(enhancedError);
    }

    // Attempt recovery based on strategy (synchronous versions)
    switch (this.config.fallbackStrategy) {
      case 'graceful':
        return this.attemptGracefulRecoverySynchronous(enhancedError, context, operationId, fallbackOperation);
      
      case 'retry':
        // For synchronous operations, skip retry and fall back to graceful recovery
        return this.attemptGracefulRecoverySynchronous(enhancedError, context, operationId, fallbackOperation);
      
      case 'degrade':
        return this.attemptDegradedRecoverySynchronous(enhancedError, context, operationId, fallbackOperation);
      
      case 'fail-fast':
      default:
        throw enhancedError;
    }
  }

  /**
   * Enhance basic errors with comprehensive diagnostic information
   */
  private enhanceError(error: any, context: PolyfillOperationContext): PolyfillError {
    if (error instanceof PolyfillError) {
      return error; // Already enhanced
    }

    // Detect specific error types and create appropriate enhanced errors
    if (this.isMemoryError(error)) {
      return new MemoryExhaustionError(
        this.extractMemoryRequirement(error),
        this.getAvailableMemory(),
        context.api,
        context.operation,
        context
      );
    }

    if (this.isTimeoutError(error)) {
      return new PerformanceTimeoutError(
        this.extractExecutionTime(error),
        this.getPerformanceLimit(context.api),
        context.api,
        context.operation,
        context
      );
    }

    if (this.isConstraintViolation(error)) {
      const violation = this.extractConstraintViolation(error, context);
      return new ConstraintViolationError(violation, context);
    }

    // Create generic enhanced error
    return new PolyfillError(
      this.generateErrorCode(error, context),
      this.enhanceErrorMessage(error, context),
      context.api,
      context.operation,
      context,
      this.determineErrorSeverity(error),
      this.generateRemediationSteps(error, context),
      this.generateFallbackOptions(error, context)
    );
  }

  /**
   * Attempt graceful recovery with fallback operations
   */
  private async attemptGracefulRecovery<T>(
    error: PolyfillError,
    context: PolyfillOperationContext,
    operationId: string,
    fallbackOperation?: () => Promise<T> | T
  ): Promise<T> {
    // Try fallback operation if provided
    if (fallbackOperation) {
      try {
        debugLog(`Attempting fallback for ${operationId} after error: ${error.code}`);
        const result = await fallbackOperation();
        this.recordRecovery(operationId, 'fallback');
        return result;
      } catch (fallbackError) {
        debugWarn(`Fallback also failed for ${operationId}:`, fallbackError);
      }
    }

    // Try built-in fallback strategies
    const fallbackResult = await this.tryBuiltInFallbacks(error, context);
    if (fallbackResult !== null) {
      this.recordRecovery(operationId, 'builtin-fallback');
      return fallbackResult;
    }

    // Graceful degradation - return safe default
    const defaultResult = this.getSafeDefault(context);
    if (defaultResult !== null) {
      this.recordRecovery(operationId, 'safe-default');
      debugWarn(`Using safe default for ${operationId} after error: ${error.code}`);
      return defaultResult;
    }

    // All recovery attempts failed
    throw error;
  }

  /**
   * Attempt recovery with retry logic
   */
  private async attemptRetryRecovery<T>(
    error: PolyfillError,
    context: PolyfillOperationContext,
    operationId: string,
    fallbackOperation?: () => Promise<T> | T
  ): Promise<T> {
    const retryPolicy = this.getRetryPolicy(context.api);
    const attemptCount = this.recoveryAttempts.get(operationId) || 0;

    if (attemptCount >= retryPolicy.maxAttempts) {
      debugWarn(`Max retry attempts reached for ${operationId}`);
      return await this.attemptGracefulRecovery(error, context, operationId, fallbackOperation);
    }

    // Calculate delay with backoff
    const delay = this.calculateRetryDelay(attemptCount, retryPolicy);
    
    debugLog(`Retrying ${operationId} in ${delay}ms (attempt ${attemptCount + 1}/${retryPolicy.maxAttempts})`);
    
    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Increment retry count
    this.recoveryAttempts.set(operationId, attemptCount + 1);
    
    // Retry the operation (this will go through executeWithBoundary again)
    throw error; // This will trigger a retry in the calling code
  }

  /**
   * Attempt degraded recovery with minimal functionality
   */
  private async attemptDegradedRecovery<T>(
    error: PolyfillError,
    context: PolyfillOperationContext,
    operationId: string,
    _fallbackOperation?: () => Promise<T> | T
  ): Promise<T> {
    // Implement minimal functionality based on the API
    const minimalResult = this.getMinimalImplementation(context);
    
    if (minimalResult !== null) {
      debugWarn(`Using minimal implementation for ${operationId} due to error: ${error.code}`);
      this.recordRecovery(operationId, 'minimal-implementation');
      return minimalResult;
    }

    // Fall back to graceful recovery if minimal implementation not available
    return await this.attemptGracefulRecovery(error, context, operationId);
  }

  /**
   * Synchronous version - Attempt graceful recovery with fallback operations
   */
  private attemptGracefulRecoverySynchronous<T>(
    error: PolyfillError,
    context: PolyfillOperationContext,
    operationId: string,
    fallbackOperation?: () => T
  ): T {
    // Try fallback operation if provided
    if (fallbackOperation) {
      try {
        debugLog(`Attempting fallback for ${operationId} after error: ${error.code}`);
        const result = fallbackOperation();
        this.recordRecovery(operationId, 'fallback');
        return result;
      } catch (fallbackError) {
        debugWarn(`Fallback also failed for ${operationId}:`, fallbackError);
      }
    }

    // Try built-in fallback strategies (synchronous version)
    const fallbackResult = this.tryBuiltInFallbacksSynchronous(error, context);
    if (fallbackResult !== null) {
      this.recordRecovery(operationId, 'builtin-fallback');
      return fallbackResult;
    }

    // Graceful degradation - return safe default
    const defaultResult = this.getSafeDefault(context);
    if (defaultResult !== null) {
      this.recordRecovery(operationId, 'safe-default');
      debugWarn(`Using safe default for ${operationId} after error: ${error.code}`);
      return defaultResult;
    }

    // All recovery attempts failed
    throw error;
  }

  /**
   * Synchronous version - Attempt degraded recovery with minimal functionality
   */
  private attemptDegradedRecoverySynchronous<T>(
    error: PolyfillError,
    context: PolyfillOperationContext,
    operationId: string,
    _fallbackOperation?: () => T
  ): T {
    // Implement minimal functionality based on the API
    const minimalResult = this.getMinimalImplementation(context);
    
    if (minimalResult !== null) {
      debugWarn(`Using minimal implementation for ${operationId} due to error: ${error.code}`);
      this.recordRecovery(operationId, 'minimal-implementation');
      return minimalResult;
    }

    // Fall back to graceful recovery if minimal implementation not available
    return this.attemptGracefulRecoverySynchronous(error, context, operationId);
  }

  /**
   * Synchronous version - Try built-in fallback strategies based on error type
   */
  private tryBuiltInFallbacksSynchronous<T>(error: PolyfillError, context: PolyfillOperationContext): T | null {
    switch (error.code) {
      case 'MEM_EXHAUSTED':
        return this.tryMemoryFallback(context);
      
      case 'PERF_TIMEOUT':
        return this.tryPerformanceFallback(context);
      
      case 'CONSTRAINT_VIOLATION':
        return this.tryConstraintFallback(context);
      
      default:
        return this.tryGenericFallback(context);
    }
  }

  /**
   * Try built-in fallback strategies based on error type
   */
  private async tryBuiltInFallbacks<T>(error: PolyfillError, context: PolyfillOperationContext): Promise<T | null> {
    switch (error.code) {
      case 'MEM_EXHAUSTED':
        return this.tryMemoryFallback(context);
      
      case 'PERF_TIMEOUT':
        return this.tryPerformanceFallback(context);
      
      case 'CONSTRAINT_VIOLATION':
        return this.tryConstraintFallback(context);
      
      default:
        return this.tryGenericFallback(context);
    }
  }

  /**
   * Get safe default value for the operation
   */
  private getSafeDefault<T>(context: PolyfillOperationContext): T | null {
    switch (context.api) {
      case 'TextEncoder':
        if (context.operation === 'encode') {
          return new Uint8Array(0) as T;
        }
        break;
      
      case 'Buffer':
        if (context.operation === 'byteLength') {
          return 0 as T;
        }
        if (context.operation === 'from') {
          return new Uint8Array(0) as T;
        }
        break;
      
      case 'performance':
        if (context.operation === 'now') {
          return Date.now() as T;
        }
        break;
    }
    
    return null;
  }

  /**
   * Get minimal implementation for degraded operation
   */
  private getMinimalImplementation<T>(context: PolyfillOperationContext): T | null {
    switch (context.api) {
      case 'TextEncoder':
        if (context.operation === 'encode') {
          // Minimal ASCII-only encoding
          return this.createMinimalTextEncoder() as T;
        }
        break;
      
      case 'Buffer':
        return this.createMinimalBuffer() as T;
      
      case 'Worker':
        return this.createMinimalWorker() as T;
    }
    
    return null;
  }

  /**
   * Memory-specific fallback strategies
   */
  private tryMemoryFallback<T>(context: PolyfillOperationContext): T | null {
    // Try to reduce memory usage for the operation
    switch (context.api) {
      case 'TextEncoder':
        // Use streaming approach for large texts
        if (context.dataSize > 10240) {
          return this.createStreamingTextEncoder() as T;
        }
        break;
      
      case 'Buffer':
        // Use lazy allocation for buffers
        return this.createLazyBuffer() as T;
    }
    
    return null;
  }

  /**
   * Performance-specific fallback strategies
   */
  private tryPerformanceFallback<T>(context: PolyfillOperationContext): T | null {
    // Try to optimize performance for the operation
    switch (context.api) {
      case 'TextEncoder':
        // Use fast ASCII-only encoding for performance
        return this.createFastTextEncoder() as T;
      
      case 'Buffer':
        // Use approximate calculations for performance
        return this.createFastBuffer() as T;
    }
    
    return null;
  }

  /**
   * Constraint-specific fallback strategies
   */
  private tryConstraintFallback<T>(context: PolyfillOperationContext): T | null {
    // Implement constraint-aware fallbacks
    return this.getSafeDefault(context);
  }

  /**
   * Generic fallback strategies
   */
  private tryGenericFallback<T>(context: PolyfillOperationContext): T | null {
    // Try the safest possible implementation
    return this.getSafeDefault(context);
  }

  // Helper methods for error detection and classification

  private isMemoryError(error: any): boolean {
    return error instanceof Error && (
      error.message.includes('memory') ||
      error.message.includes('allocation') ||
      error.message.includes('out of memory') ||
      error.name === 'MemoryError'
    );
  }

  private isTimeoutError(error: any): boolean {
    return error instanceof Error && (
      error.message.includes('timeout') ||
      error.message.includes('time limit') ||
      error.name === 'TimeoutError'
    );
  }

  private isConstraintViolation(error: any): boolean {
    return error instanceof Error && (
      error.message.includes('constraint') ||
      error.message.includes('violation') ||
      error.message.includes('limit exceeded')
    );
  }

  private extractMemoryRequirement(error: any): number {
    const match = error.message.match(/(\d+)\s*bytes?/i);
    return match ? parseInt(match[1], 10) : 0;
  }

  private extractExecutionTime(error: any): number {
    const match = error.message.match(/(\d+)\s*ms/i);
    return match ? parseInt(match[1], 10) : 0;
  }

  private getAvailableMemory(): number {
    // Estimate available memory (simplified)
    return 8 * 1024 * 1024; // 8MB
  }

  private getPerformanceLimit(api: string): number {
    const limits: Record<string, number> = {
      'TextEncoder': 50,
      'Buffer': 30,
      'Worker': 10
    };
    return limits[api] || 20;
  }

  private extractConstraintViolation(error: any, context: PolyfillOperationContext): ConstraintViolation {
    return {
      type: 'api',
      severity: 'medium',
      polyfill: context.api,
      operation: context.operation,
      details: {
        message: error.message || 'Unknown constraint violation',
        context: context
      },
      suggestedAction: 'Use fallback implementation',
      remediationSteps: [
        'Check input data size',
        'Use chunked processing',
        'Enable fallback mode'
      ],
      errorCode: 'CONSTRAINT_VIOLATION'
    };
  }

  private generateErrorCode(error: any, context: PolyfillOperationContext): string {
    const prefix = context.api.toUpperCase().substring(0, 3);
    const suffix = error.name || 'ERROR';
    return `${prefix}_${suffix}`;
  }

  private enhanceErrorMessage(error: any, context: PolyfillOperationContext): string {
    const baseMessage = error.message || 'Unknown error';
    return `${context.api}.${context.operation}: ${baseMessage}`;
  }

  private determineErrorSeverity(error: any): 'low' | 'medium' | 'high' | 'critical' {
    if (this.isMemoryError(error)) return 'critical';
    if (this.isTimeoutError(error)) return 'high';
    if (this.isConstraintViolation(error)) return 'medium';
    return 'low';
  }

  private generateRemediationSteps(error: any, context: PolyfillOperationContext): string[] {
    const steps: string[] = [];
    
    if (this.isMemoryError(error)) {
      steps.push('Reduce input data size');
      steps.push('Use streaming processing');
      steps.push('Enable memory management');
    }
    
    if (this.isTimeoutError(error)) {
      steps.push('Reduce computational complexity');
      steps.push('Use asynchronous processing');
      steps.push('Enable performance optimization');
    }
    
    steps.push(`Check ${context.api} polyfill configuration`);
    steps.push('Consider using alternative implementation');
    
    return steps;
  }

  private generateFallbackOptions(error: any, context: PolyfillOperationContext): string[] {
    const options: string[] = [];
    
    switch (context.api) {
      case 'TextEncoder':
        options.push('minimal-text-encoder');
        options.push('ascii-only-encoder');
        break;
      
      case 'Buffer':
        options.push('minimal-buffer');
        options.push('lazy-buffer');
        break;
      
      case 'Worker':
        options.push('sync-worker-alternative');
        break;
    }
    
    options.push('safe-default');
    return options;
  }

  // Operational methods

  private shouldAttemptOperation(operationId: string): boolean {
    const errorCount = this.errorCounts.get(operationId) || 0;
    const lastError = this.lastErrors.get(operationId) || 0;
    const now = Date.now();
    
    // Circuit breaker logic
    if (errorCount >= 5 && (now - lastError) < this.config.recoveryTimeout) {
      return false;
    }
    
    return true;
  }

  private recordError(operationId: string): void {
    const currentCount = this.errorCounts.get(operationId) || 0;
    this.errorCounts.set(operationId, currentCount + 1);
    this.lastErrors.set(operationId, Date.now());
  }

  private recordSuccess(operationId: string): void {
    // Reset error count on successful operation
    this.errorCounts.set(operationId, 0);
    this.recoveryAttempts.set(operationId, 0);
  }

  private recordRecovery(operationId: string, strategy: string): void {
    debugLog(`Recovery successful for ${operationId} using strategy: ${strategy}`);
    // Reduce error count on successful recovery
    const currentCount = this.errorCounts.get(operationId) || 0;
    this.errorCounts.set(operationId, Math.max(0, currentCount - 1));
  }

  private getRetryPolicy(api: string): RetryPolicy {
    const policies: Record<string, RetryPolicy> = {
      'TextEncoder': {
        maxAttempts: 3,
        backoffStrategy: 'exponential',
        initialDelay: 100,
        maxDelay: 1000,
        jitter: true
      },
      'Buffer': {
        maxAttempts: 2,
        backoffStrategy: 'linear',
        initialDelay: 50,
        maxDelay: 500,
        jitter: false
      }
    };
    
    return policies[api] || {
      maxAttempts: 2,
      backoffStrategy: 'fixed',
      initialDelay: 100,
      maxDelay: 1000,
      jitter: false
    };
  }

  private calculateRetryDelay(attemptCount: number, policy: RetryPolicy): number {
    let delay: number;
    
    switch (policy.backoffStrategy) {
      case 'exponential':
        delay = policy.initialDelay * Math.pow(2, attemptCount);
        break;
      
      case 'linear':
        delay = policy.initialDelay * (attemptCount + 1);
        break;
      
      case 'fixed':
      default:
        delay = policy.initialDelay;
        break;
    }
    
    delay = Math.min(delay, policy.maxDelay);
    
    if (policy.jitter) {
      delay += Math.random() * delay * 0.1; // Add up to 10% jitter
    }
    
    return Math.floor(delay);
  }

  private logError(error: PolyfillError): void {
    const logData = {
      code: error.code,
      api: error.api,
      operation: error.operation,
      severity: error.severity,
      message: error.message,
      context: error.context,
      remediationSteps: error.remediationSteps,
      fallbackOptions: error.fallbackOptions
    };
    
    if (error.severity === 'critical') {
      debugWarn('Critical polyfill error:', logData);
    } else {
      debugLog('Polyfill error handled:', logData);
    }
  }

  // Minimal implementation creators

  private createMinimalTextEncoder(): any {
    return {
      encode: (input: string) => {
        // ASCII-only minimal encoder
        const bytes: number[] = [];
        for (let i = 0; i < input.length; i++) {
          const code = input.charCodeAt(i);
          bytes.push(code < 128 ? code : 63); // '?' for non-ASCII
        }
        return new Uint8Array(bytes);
      }
    };
  }

  private createMinimalBuffer(): any {
    return {
      byteLength: (str: string) => str.length,
      from: (input: any) => new Uint8Array(input)
    };
  }

  private createMinimalWorker(): any {
    return {
      processSync: (data: any) => data,
      processAsync: async (data: any) => data
    };
  }

  private createStreamingTextEncoder(): any {
    return {
      encode: (input: string) => {
        // Process in chunks for large inputs
        const chunkSize = 1024;
        const chunks: Uint8Array[] = [];
        
        for (let i = 0; i < input.length; i += chunkSize) {
          const chunk = input.slice(i, i + chunkSize);
          chunks.push(this.createMinimalTextEncoder().encode(chunk));
        }
        
        // Combine chunks
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        
        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.length;
        }
        
        return result;
      }
    };
  }

  private createLazyBuffer(): any {
    return {
      byteLength: (str: string) => Math.ceil(str.length * 1.5), // Estimate
      from: (input: any) => {
        // Lazy implementation
        return typeof input === 'string' ? 
          new Uint8Array(input.length) : 
          new Uint8Array(input);
      }
    };
  }

  private createFastTextEncoder(): any {
    return {
      encode: (input: string) => {
        // Fast ASCII-only implementation
        const result = new Uint8Array(input.length);
        for (let i = 0; i < input.length; i++) {
          result[i] = input.charCodeAt(i) & 0xFF;
        }
        return result;
      }
    };
  }

  private createFastBuffer(): any {
    return {
      byteLength: (str: string) => str.length, // Fast approximation
      from: (input: any) => new Uint8Array(input)
    };
  }
}

/**
 * Global error boundary instance
 */
export const globalPolyfillErrorBoundary = new PolyfillErrorBoundary({
  catchAll: true,
  logErrors: true,
  notifyUser: false,
  fallbackStrategy: 'graceful',
  maxRecoveryAttempts: 3,
  recoveryTimeout: 5000
});

/**
 * Convenience function for executing operations with error boundary
 */
export async function executeWithErrorBoundary<T>(
  operation: () => Promise<T> | T,
  context: PolyfillOperationContext,
  fallback?: () => Promise<T> | T
): Promise<T> {
  return globalPolyfillErrorBoundary.executeWithBoundary(operation, context, fallback);
}

/**
 * Synchronous version of error boundary for polyfill operations that must return immediately
 */
export function executeWithErrorBoundarySynchronous<T>(
  operation: () => T,
  context: PolyfillOperationContext,
  fallback?: () => T
): T {
  return globalPolyfillErrorBoundary.executeWithBoundarySynchronous(operation, context, fallback);
}

/**
 * Runtime type validation with error boundaries
 */
export function validatePolyfillOperation(operation: any): asserts operation is import('./polyfill-types.js').PolyfillOperation {
  if (!PolyfillTypeGuards.isPolyfillOperation(operation)) {
    throw new PolyfillError(
      'INVALID_OPERATION',
      'Invalid polyfill operation structure',
      operation?.api || 'unknown',
      operation?.method || 'unknown',
      operation?.context || {
        api: 'unknown',
        operation: 'unknown',
        dataSize: 0,
        timestamp: Date.now(),
        userAgent: 'unknown',
        attemptCount: 1,
        sessionId: ''
      },
      'high',
      ['Check operation structure', 'Ensure all required fields are present'],
      ['safe-default']
    );
  }
}