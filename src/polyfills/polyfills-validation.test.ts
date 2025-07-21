/**
 * Polyfills Validation Test
 *
 * Simple test to validate that our polyfills work correctly
 * for the main QuickFig use cases.
 */

import test from "ava";

// Test that polyfills are working by importing the main QuickFig library
test("QuickFig library should work with polyfills", async (t) => {
  // Import QuickFig which should automatically include polyfills
  const framework = await import("../../index.js"); // Import from source during dev

  // Verify all required APIs are available
  t.true(typeof performance !== "undefined");
  t.true(typeof performance.now === "function");
  t.true(typeof TextEncoder !== "undefined");
  t.true(typeof (globalThis as any).Buffer !== "undefined");

  // Test that QuickFig can be instantiated (requires polyfills to work)
  const mockNode = {
    data: new Map<string, string>(),
    setPluginData(key: string, value: string) {
      this.data.set(key, value);
    },
    getPluginData(key: string): string {
      return this.data.get(key) || "";
    },
    getPluginDataKeys(): string[] {
      return Array.from(this.data.keys());
    },
  };

  t.notThrows(() => {
    const pluginData = new PluginData(mockNode);
    t.truthy(pluginData);
  });
});

test("polyfills should handle UTF-8 size calculations correctly", async (t) => {
  await import("../../../dist/index.cjs");

  const Buffer = (globalThis as any).Buffer;
  const encoder = new TextEncoder();

  // Test cases that QuickFig commonly handles
  const testCases = [
    { name: "ASCII", input: "hello world", expectedSize: 11 },
    { name: "Unicode emoji", input: "🚀", expectedSize: 4 },
    { name: "Mixed content", input: "Hello 🌍", expectedSize: 10 }, // "Hello " (6) + "🌍" (4)
    { name: "Empty string", input: "", expectedSize: 0 },
    {
      name: "JSON data",
      input: JSON.stringify({ name: "test", emoji: "🚀" }),
      expectedSize: 30,
    },
  ];

  for (const testCase of testCases) {
    const bufferSize = Buffer.byteLength(testCase.input, "utf8");
    const encoderSize = encoder.encode(testCase.input).length;

    // Both methods should agree
    t.is(
      bufferSize,
      encoderSize,
      `${testCase.name}: Buffer and TextEncoder should agree`,
    );

    // Size should match expected for known cases
    if (testCase.expectedSize !== undefined) {
      t.is(
        bufferSize,
        testCase.expectedSize,
        `${testCase.name}: should have expected size`,
      );
    }
  }
});

test("polyfills should support performance timing", async (t) => {
  await import("../../../dist/index.cjs");

  const start = performance.now();

  // Simulate some work
  const data = JSON.stringify({
    items: Array.from({ length: 100 }, (_, i) => i),
  });
  const Buffer = (globalThis as any).Buffer;
  const size = Buffer.byteLength(data, "utf8");

  const end = performance.now();

  t.is(typeof start, "number");
  t.is(typeof end, "number");
  t.true(end >= start);
  t.true(size > 0);

  // Timing should be reasonable (less than 10ms for this simple operation)
  const duration = end - start;
  t.true(duration < 10);
});

test("polyfills should handle QuickFig boundary size calculations", async (t) => {
  await import("../../../dist/index.cjs");

  const Buffer = (globalThis as any).Buffer;

  // Test boundary sizes that QuickFig cares about
  const directLimit = 95 * 1024; // 95KB
  const chunkLimit = 100 * 1024; // 100KB

  // Small data - should be under direct limit
  const smallData = "x".repeat(1000); // 1KB
  t.true(Buffer.byteLength(smallData) < directLimit);

  // Medium data - between direct and chunk limits
  const mediumData = "x".repeat(96 * 1024); // 96KB
  const mediumSize = Buffer.byteLength(mediumData);
  t.true(mediumSize > directLimit);
  t.true(mediumSize < chunkLimit);

  // Large data - over chunk limit
  const largeData = "x".repeat(101 * 1024); // 101KB
  t.true(Buffer.byteLength(largeData) > chunkLimit);
});

test("polyfills should work with real QuickFig operations", async (t) => {
  const framework = await import("../../index.js"); // Import from source during dev

  const mockNode = {
    data: new Map<string, string>(),
    setPluginData(key: string, value: string) {
      this.data.set(key, value);
    },
    getPluginData(key: string): string {
      return this.data.get(key) || "";
    },
    getPluginDataKeys(): string[] {
      return Array.from(this.data.keys());
    },
  };

  const pluginData = new PluginData(mockNode);

  // Test basic operations that require polyfills
  const testData = {
    name: "Test User",
    emoji: "🚀",
    items: ["🍎", "🍌", "🍊"],
    timestamp: new Date().toISOString(),
  };

  t.notThrows(() => {
    // This operation requires both performance.now() and Buffer.byteLength()
    pluginData.setPluginData("user-data", testData);
  });

  const retrieved = pluginData.getPluginData("user-data");
  t.deepEqual(retrieved, testData);

  const keys = pluginData.getPluginDataKeys();
  t.true(keys.includes("user-data"));
});
