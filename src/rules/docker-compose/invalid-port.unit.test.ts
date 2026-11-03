import assert from 'assert/strict';
import { test } from 'node:test';
import { invalidPort } from './invalid-port';

void test('invalid-port in isolation', () => {
  assert.deepEqual(invalidPort({ targetRange: [80, 80], hostRange: [80, 80], rest: [], published: '80', target: '80' }), []);
  assert.equal(invalidPort({ targetRange: undefined, hostRange: [80, 80], rest: [], published: '80', target: 'bad' })[0]?.rule, 'docker-compose/invalid-port');
});
