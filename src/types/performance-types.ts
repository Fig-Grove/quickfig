// Stub type definitions for performance-related types
// These are simplified versions of the original QuickFig types

export interface FigmaPerformanceOptimizer {
  // Placeholder for performance optimizer interface
  optimize?: (operation: any) => any;
}

export interface PolyfillOperation {
  name: string;
  type: 'sync' | 'async';
  priority: 'high' | 'medium' | 'low';
  estimatedTime?: number;
  memoryImpact?: number;
}