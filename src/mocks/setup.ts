import { JSDOM } from 'jsdom';
import 'global-jsdom/register';
import sinon from 'sinon';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Add __dirname polyfill for ESM compatibility
if (typeof globalThis.__dirname === 'undefined') {
  globalThis.__dirname = dirname(fileURLToPath(import.meta.url));
}

// Set up DOM environment for Figma plugin simulation
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'https://www.figma.com',
  pretendToBeVisual: true,
  resources: 'usable',
});

// Mock Figma's global API using Sinon
global.figma = {
  currentPage: {
    selection: [],
    findOne: sinon.stub(),
    findAll: sinon.stub(),
  },
  // Add other Figma API mocks as needed
} as any;

// Mock BaseNode interface for testing
export const createMockNode = () => {
  const pluginData = new Map<string, string>();

  return {
    setPluginData: sinon.fake((key: string, value: string) => {
      if (value === '') {
        pluginData.delete(key);
      } else {
        pluginData.set(key, value);
      }
    }),
    getPluginData: sinon.fake((key: string) => {
      return pluginData.get(key) || '';
    }),
    getPluginDataKeys: sinon.fake(() => {
      return Array.from(pluginData.keys());
    }),
  };
};

// Cleanup helper for test isolation
export const resetAllMocks = () => {
  sinon.restore();
  // Reset global figma mocks
  if (global.figma?.currentPage?.findOne) {
    (global.figma.currentPage.findOne as sinon.SinonStub).reset();
  }
  if (global.figma?.currentPage?.findAll) {
    (global.figma.currentPage.findAll as sinon.SinonStub).reset();
  }
};
