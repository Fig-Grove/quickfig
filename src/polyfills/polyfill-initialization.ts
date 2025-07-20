/**
 * Polyfill Initialization and Orchestration
 * 
 * Handles the complex initialization sequence for performance system integration,
 * constraint-aware polyfills, and performance enhancements.
 */

import { debugLog, debugWarn } from './debug-utils.js';
import { 
  enhancePolyfillsWithPerformanceIntegration, 
  initializePolyfillMemoryTracking, 
  initializePolyfillAnalyticsCollection 
} from './polyfill-enhancements.js';

/**
 * Initialize Performance-Integrated Polyfills System
 * Sets up the performance-integrated polyfill system with performance system integration
 */
export async function initializePerformanceIntegratedPolyfillsSystem(performanceOptimizer: any): Promise<void> {
  try {
    // Import the performance-integrated polyfills system
    const { performanceIntegratedPolyfills } = await import('./performance-integrated-polyfills.js');
    
    // Integrate with performance optimizer
    performanceIntegratedPolyfills.integrateWithPerformanceSystem(performanceOptimizer);
    
    // Set up global reference for polyfill operations
    (globalThis as any).__performanceIntegratedPolyfills = performanceIntegratedPolyfills;
    
    // Enhance existing polyfills with performance integration
    enhancePolyfillsWithPerformanceIntegration();
    
    debugLog('Performance-Integrated Polyfills initialized successfully');
  } catch (error) {
    debugWarn('Performance-Integrated Polyfills initialization failed:', error);
  }
}

/**
 * Initialize Budget Manager
 * Sets up the polyfill budget manager with performance system integration
 */
export async function initializeBudgetManager(performanceOptimizer: any): Promise<void> {
  try {
    // Import the budget manager
    const { polyfillBudgetManager } = await import('./polyfill-budget-manager.js');
    
    // Integrate with performance optimizer
    polyfillBudgetManager.integrateWithPerformanceSystem(performanceOptimizer);
    
    // Set up global reference for budget operations
    (globalThis as any).__polyfillBudgetManager = polyfillBudgetManager;
    
    debugLog('Polyfill Budget Manager initialized successfully');
  } catch (error) {
    debugWarn('Polyfill Budget Manager initialization failed:', error);
  }
}

/**
 * Initialize Memory Tracker
 * Sets up the polyfill memory tracker with performance system integration
 */
export async function initializeMemoryTracker(_performanceOptimizer: any): Promise<void> {
  try {
    // Parallel import optimization
    const [
      { polyfillMemoryTracker },
      { MemoryBudgetTracker }
    ] = await Promise.all([
      import('./polyfill-memory-tracker.js'),
      import('../defensive/memory-budget-tracker.js')
    ]);
    
    const memoryBudgetTracker = new MemoryBudgetTracker();
    
    // Integrate with memory budget tracker
    polyfillMemoryTracker.integrateWithPerformanceSystem(memoryBudgetTracker);
    
    // Set up global reference for memory tracking operations
    (globalThis as any).__polyfillMemoryTracker = polyfillMemoryTracker;
    
    // Initialize memory tracking for existing polyfills
    initializePolyfillMemoryTracking();
    
    debugLog('Polyfill Memory Tracker initialized successfully');
  } catch (error) {
    debugWarn('Polyfill Memory Tracker initialization failed:', error);
  }
}

/**
 * Initialize Analytics Integrator
 * Sets up the polyfill analytics integrator with complete performance system integration
 */
export async function initializeAnalyticsIntegrator(performanceOptimizer: any): Promise<void> {
  try {
    // Import the analytics integrator
    const { polyfillAnalyticsIntegrator } = await import('./polyfill-analytics-integrator.js');
    
    // Get all the integrated systems
    const performanceIntegratedPolyfills = (globalThis as any).__performanceIntegratedPolyfills;
    const budgetManager = (globalThis as any).__polyfillBudgetManager;
    const memoryTracker = (globalThis as any).__polyfillMemoryTracker;
    const diagnosticEngine = (globalThis as any).__polyfillDiagnosticEngine;
    
    // Integrate with all performance systems
    if (performanceIntegratedPolyfills && budgetManager && memoryTracker && diagnosticEngine) {
      polyfillAnalyticsIntegrator.integrateWithPerformanceSystem(
        performanceOptimizer,
        performanceIntegratedPolyfills,
        budgetManager,
        memoryTracker,
        diagnosticEngine
      );
    }
    
    // Set up global reference for analytics operations
    (globalThis as any).__polyfillAnalyticsIntegrator = polyfillAnalyticsIntegrator;
    
    // Initialize analytics collection for existing polyfills
    initializePolyfillAnalyticsCollection();
    
    debugLog('Polyfill Analytics Integrator initialized successfully');
    debugLog('🎉 Performance-Integrated Architecture COMPLETE!');
  } catch (error) {
    debugWarn('Polyfill Analytics Integrator initialization failed:', error);
  }
}

/**
 * Initialize constraint-aware features asynchronously
 * Main orchestration function for the entire polyfill system
 */
export function initializeConstraintAwarePolyfills(): void {
  try {
    // Try to initialize advanced constraint detector with performance system integration
    import('./figma-constraint-detector.js').then(({ advancedConstraintDetector }) => {
      (globalThis as any).__figmaConstraintDetector = advancedConstraintDetector;
      
      // Initialize performance system integration if available
      try {
        import('../performance/figma-performance-optimizer.js').then(({ FigmaPerformanceOptimizer }) => {
          const performanceOptimizer = new FigmaPerformanceOptimizer();
          
          // Parallel initialization for better performance
          Promise.all([
            initializePerformanceIntegratedPolyfillsSystem(performanceOptimizer),
            initializeBudgetManager(performanceOptimizer),
            initializeMemoryTracker(performanceOptimizer),
            initializeAnalyticsIntegrator(performanceOptimizer)
          ]).then(() => {
            debugLog('All performance system integrations initialized successfully');
          }).catch((error) => {
            debugWarn('Some performance system integrations failed:', error);
          });
        }).catch(() => {
          // Performance system not available, continue with basic advanced constraints
        });
      } catch (error) {
        // Performance optimizer integration failed, continue with advanced constraints only
      }
    }).catch(() => {
      // Advanced constraint detector not available, try basic constraint detector
      import('./figma-constraint-detector.js').then(({ figmaConstraintDetector }) => {
        (globalThis as any).__figmaConstraintDetector = figmaConstraintDetector;
      }).catch(() => {
        // Constraint detector not available - polyfills will work without it
      });
    });
  } catch (error) {
    // Fallback to basic polyfills
    debugWarn('Constraint-aware polyfill initialization failed:', error);
  }
}

/**
 * Reset polyfill application tracking (for testing only)
 */
export function resetPolyfillTracking(): void {
  // This is handled by the main environment-polyfills module
  // Kept here for compatibility
}

/**
 * Testing utility functions
 */
export function resetPolyfillsForTesting(): void {
  if (process.env.NODE_ENV === 'test') {
    // Clean up potentially contaminated global state from test mocks
    const globalsToReset = ['performance', 'TextEncoder', 'TextDecoder', 'Buffer', 'Set', 'Map', 'Blob', 'URL', 'Worker'];
    
    globalsToReset.forEach(globalName => {
      const globalObj = (globalThis as any)[globalName];
      if (globalObj && (globalObj.__polyfilled || shouldResetForTesting(globalObj, globalName))) {
        delete (globalThis as any)[globalName];
      }
    });
    
    // Also clean up constraint detector reference that might be contaminated
    delete (globalThis as any).__figmaConstraintDetector;
    
    // Signal that polyfills need re-application
    (globalThis as any).__polyfillsNeedReapplication = true;
  }
}

/**
 * Check if a global object should be reset during testing
 */
function shouldResetForTesting(globalObj: any, globalName: string): boolean {
  if (process.env.NODE_ENV !== 'test') return false;
  
  // Detect common test mock patterns
  if (globalName === 'TextEncoder' && globalObj.prototype?.encode) {
    try {
      const testResult = new globalObj().encode('');
      if (Array.isArray(testResult) || (testResult instanceof Uint8Array && testResult.length === 6)) {
        return true;
      }
    } catch (e) {
      return true;
    }
  }
  
  if (globalName === 'Buffer' && globalObj.byteLength) {
    try {
      const testResult = globalObj.byteLength('test');
      if (testResult === 999 || testResult === 0) {
        return true;
      }
    } catch (e) {
      return true;
    }
  }
  
  if (globalName === 'performance' && globalObj.now) {
    try {
      const testResult = globalObj.now();
      if (testResult === 42) {
        return true;
      }
    } catch (e) {
      return true;
    }
  }
  
  return false;
}