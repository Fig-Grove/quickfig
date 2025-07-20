import test from 'ava';
import { createFigmaTestEnvironment } from '../../dist/index.cjs';

test('simple simulator test', async (t) => {
  const testEnv = await createFigmaTestEnvironment();
  
  // Test very simple code
  const result = await testEnv.runSandboxed('42');
  
  console.log('Result:', JSON.stringify(result, null, 2));
  
  if (!result.ok && result.error) {
    console.log('Error details:', result.error);
  }
  
  t.true(result.ok, 'Simple expression should work');
  t.is(result.data, 42, 'Should return 42');
});

test('simple console test', async (t) => {
  const testEnv = await createFigmaTestEnvironment();
  
  const result = await testEnv.runSandboxed('typeof console');
  
  console.log('Console type result:', JSON.stringify(result, null, 2));
  
  t.true(result.ok, 'Console type check should work');
  t.is(result.data, 'object', 'Console should be available');
});