import assert from 'assert/strict';
import { test } from 'node:test';
import { invalidVolume } from './invalid-volume';

void test('invalid-volume in isolation', () => {
  assert.deepEqual(invalidVolume(['./app', '/app'], '/app', ['./app', '/app'], false), []);
  assert.equal(invalidVolume(['app'], 'app', ['app'], false)[0]?.rule, 'docker-compose/invalid-volume');
});
