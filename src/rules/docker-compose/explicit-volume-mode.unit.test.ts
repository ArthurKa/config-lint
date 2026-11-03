import assert from 'assert/strict';
import { test } from 'node:test';
import { volumeMode } from './explicit-volume-mode';

void test('explicit-volume-mode in isolation', () => {
  assert.deepEqual(volumeMode('./app:/app:rw', true, ['rw']), []);
  assert.equal(volumeMode('./app:/app', false, [])[0]?.fixed, './app:/app:ro');
});
