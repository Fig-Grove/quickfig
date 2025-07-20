/**
 * Quota Testing Helpers - Mock utilities for quota management testing
 */

import type { BaseNode } from '../../src/core/plugin-data.js';

// Global state for tracking all mock nodes
const globalMockState = new Set<MockNode>();

export interface MockNode extends BaseNode {
  _mockData: Map<string, string>;
  _nodeId: string;
}

/**
 * Create a mock Figma node for testing quota operations
 */
export function createMockNode(nodeId: string = 'mock-node'): MockNode {
  const mockData = new Map<string, string>();

  const node: MockNode = {
    _mockData: mockData,
    _nodeId: nodeId,

    setPluginData(key: string, value: string): void {
      if (value === '') {
        mockData.delete(key);
      } else {
        mockData.set(key, value);
      }
    },

    getPluginData(key: string): string {
      return mockData.get(key) || '';
    },

    getPluginDataKeys(): string[] {
      return Array.from(mockData.keys());
    },
  };

  // Track in global state
  globalMockState.add(node);
  return node;
}

/**
 * Create a set of mock nodes with predefined data
 */
export function createMockNodeSet(nodeIds: string[]): MockNode[] {
  return nodeIds.map((id) => createMockNode(id));
}

/**
 * Create a large set of mock nodes with varied data sizes for performance testing
 */
export function createLargeNodeSet(count: number): MockNode[] {
  const nodes: MockNode[] = [];

  for (let i = 0; i < count; i++) {
    const node = createMockNode(`node-${i}`);

    // Add varied data sizes to each node
    const smallData = 'x'.repeat(1024); // 1KB
    const mediumData = 'y'.repeat(50 * 1024); // 50KB
    const largeData = JSON.stringify({
      id: i,
      data: 'z'.repeat(10 * 1024), // 10KB of data
      metadata: { created: Date.now(), version: '1.0' },
    });

    node.setPluginData('small', smallData);
    node.setPluginData('medium', mediumData);
    node.setPluginData('large', largeData);

    // Add some QuickFig internal keys to simulate chunked/compressed data
    node.setPluginData('__fj_chunk_0_test', 'chunk data');
    node.setPluginData('__fj_meta_test', '{"chunks":2,"size":12345}');

    nodes.push(node);
  }

  return nodes;
}

/**
 * Create a mock node with specific storage usage
 */
export function createMockNodeWithUsage(
  nodeId: string,
  targetSizeBytes: number
): MockNode {
  const node = createMockNode(nodeId);

  // Calculate how much data to add to reach target size
  let currentSize = 0;
  let counter = 0;

  while (currentSize < targetSizeBytes) {
    const key = `data_${counter}`;
    const remainingSize = targetSizeBytes - currentSize;
    const chunkSize = Math.min(remainingSize - key.length, 10 * 1024); // Max 10KB chunks

    if (chunkSize <= 0) break;

    const value = 'x'.repeat(chunkSize);
    node.setPluginData(key, value);

    currentSize += Buffer.byteLength(key + value, 'utf8');
    counter++;
  }

  return node;
}

/**
 * Calculate total storage usage for a set of mock nodes
 */
export function calculateMockNodeSetUsage(nodes: MockNode[]): number {
  let totalSize = 0;

  for (const node of nodes) {
    const keys = node.getPluginDataKeys();
    for (const key of keys) {
      const value = node.getPluginData(key);
      totalSize += Buffer.byteLength(key + value, 'utf8');
    }
  }

  return totalSize;
}

/**
 * Reset all mock nodes to empty state
 */
export function resetMockNodes(nodes?: MockNode[]): void {
  if (!nodes) {
    // Reset all tracked mock nodes
    for (const node of globalMockState) {
      const keys = Array.from(node._mockData.keys());
      for (const key of keys) {
        node.setPluginData(key, '');
      }
    }
    return;
  }

  for (const node of nodes) {
    const keys = Array.from(node._mockData.keys());
    for (const key of keys) {
      node.setPluginData(key, '');
    }
  }
}

/**
 * Mock quota usage scenarios for testing
 */
export const QUOTA_TEST_SCENARIOS = {
  EMPTY: { totalUsed: 0, description: 'Empty storage' },
  LOW_USAGE: { totalUsed: 1024 * 1024, description: '1MB used (20%)' }, // 1MB
  MEDIUM_USAGE: {
    totalUsed: 2.5 * 1024 * 1024,
    description: '2.5MB used (50%)',
  }, // 2.5MB
  HIGH_USAGE: { totalUsed: 4 * 1024 * 1024, description: '4MB used (80%)' }, // 4MB
  CRITICAL_USAGE: {
    totalUsed: 4.8 * 1024 * 1024,
    description: '4.8MB used (96%)',
  }, // 4.8MB
  NEAR_FULL: {
    totalUsed: 5 * 1024 * 1024 - 1024,
    description: '5MB-1KB used (99.98%)',
  }, // Almost full
} as const;
