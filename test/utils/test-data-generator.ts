export function generateTestData() {
  return {
    // Small data (<95KB) - should use direct storage
    small: {
      key: 'small-data',
      value: JSON.stringify({ items: Array(100).fill('small-item') }),
      expectedMethod: 'direct',
    },

    // Medium data (95-100KB) - should use chunking
    medium: {
      key: 'medium-data',
      value: JSON.stringify({
        items: Array(2000).fill('medium-item-with-longer-content'),
      }),
      expectedMethod: 'chunked',
    },

    // Large data (>100KB) - should use compression + chunking
    large: {
      key: 'large-data',
      value: JSON.stringify({
        items: Array(5000).fill(
          'large-item-with-extensive-content-for-compression-testing'
        ),
        metadata: { created: new Date().toISOString(), version: '1.0.0' },
      }),
      expectedMethod: 'compressed_chunked',
    },

    // Critical data (approaching 100KB limit) - boundary testing
    boundary: {
      key: 'boundary-data',
      value: 'x'.repeat(99 * 1024), // 99KB exactly
      expectedMethod: 'chunked',
    },
  };
}
