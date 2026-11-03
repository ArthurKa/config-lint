import assert from 'assert/strict';
import { test } from 'node:test';
import { parseTree } from 'jsonc-parser';
import { topLevelOrder } from './top-level-order';

void test('top-level-order in isolation', () => {
  const text = '{"version":"1","name":"app"}';
  const node = parseTree(text);
  if(!node) {
    throw new Error('Expected JSON');
  }
  assert.equal(topLevelOrder(text, node)[0]?.rule, 'package-json/top-level-order');
});
