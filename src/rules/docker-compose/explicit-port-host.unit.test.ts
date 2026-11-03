import assert from 'assert/strict';
import { test } from 'node:test';
import { portHost } from './explicit-port-host';

void test('explicit-port-host in isolation', () => {
  assert.deepEqual(portHost('127.0.0.1', '3000', '3000', 'tcp'), []);
  assert.equal(portHost('', '3000', '3000', 'tcp')[0]?.fixed, '127.0.0.1:3000:3000/tcp');
});
