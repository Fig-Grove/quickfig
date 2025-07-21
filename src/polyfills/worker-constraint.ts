/**
 * Worker constraint utilities for QuickJS environment
 */

export interface WorkerConstraints {
  maxWorkers: number;
  maxMessageSize: number;
  timeoutMs: number;
}

export const DEFAULT_WORKER_CONSTRAINTS: WorkerConstraints = {
  maxWorkers: 0, // No workers allowed in QuickJS
  maxMessageSize: 0,
  timeoutMs: 0,
};

export function validateWorkerUsage(): {
  allowed: boolean;
  message: string;
} {
  return {
    allowed: false,
    message: "Web Workers are not supported in QuickJS environment",
  };
}

export function createWorkerPolyfill() {
  return class MockWorker {
    constructor() {
      throw new Error("Web Workers are not supported in QuickJS environment");
    }
  };
}

export function initializeWorkerConstraint() {
  // Initialize worker constraint checking
  if (typeof globalThis !== "undefined") {
    (globalThis as any).Worker = createWorkerPolyfill();
  }
}
