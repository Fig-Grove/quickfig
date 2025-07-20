// Core Figma API interfaces that QuickFig must maintain compatibility with

/**
 * Base interface matching Figma's node plugin data API
 * Must maintain exact signature compatibility
 */
/* eslint-disable no-unused-vars -- Figma API compatibility interface */
export interface BaseNode {
  /**
   * Sets plugin data for this node
   * @param key - The key to store data under
   * @param value - The value to store (empty string deletes the key)
   */
  setPluginData(_key: string, _value: string): void;

  /**
   * Gets plugin data for this node
   * @param key - The key to retrieve data for
   * @returns The stored value or empty string if not found
   */
  getPluginData(_key: string): string;

  /**
   * Gets all plugin data keys for this node
   * @returns Array of all keys that have plugin data
   */
  getPluginDataKeys(): string[];
}
/* eslint-enable no-unused-vars */

/**
 * Enhanced node interface that QuickFig implements
 * Must be 100% compatible with BaseNode
 */
export interface QuickFigNode extends BaseNode {
  // No additional methods - maintains exact compatibility
}

/**
 * Global Figma API interface for plugin environment
 */
export interface FigmaAPI {
  readonly currentPage: PageNode;
  readonly root: DocumentNode;
}

/**
 * Basic node types from Figma API
 */
export interface DocumentNode extends BaseNode {
  readonly type: 'DOCUMENT';
}

export interface PageNode extends BaseNode {
  readonly type: 'PAGE';
  readonly children: readonly SceneNode[];
}

export interface SceneNode extends BaseNode {
  readonly type: string;
}

/**
 * Plugin data constraints from Figma
 */
export const FIGMA_CONSTRAINTS = {
  /**
   * Maximum size per setPluginData call (key + value combined)
   */
  MAX_ENTRY_SIZE: 100 * 1024, // 100KB

  /**
   * Maximum total plugin data storage
   */
  MAX_TOTAL_SIZE: 5 * 1024 * 1024, // 5MB

  /**
   * UTF-8 encoding used for size calculations
   */
  ENCODING: 'utf-8' as const,
} as const;
