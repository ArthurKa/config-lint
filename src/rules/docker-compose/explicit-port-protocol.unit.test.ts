import assert from 'assert/strict';
import { test } from 'node:test';
import { portProtocol } from './explicit-port-protocol';

void test('explicit-port-protocol in isolation', () => {
  assert.deepEqual(portProtocol('3000:3000', 'udp'), []);
  assert.equal(portProtocol('3000:3000', undefined)[0]?.fixed, '3000:3000/tcp');
});
