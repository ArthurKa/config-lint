import assert from 'assert/strict';
import { test } from 'node:test';
import { parseTree } from 'jsonc-parser';
import { sortDependencyKeys } from './sort-dependency-keys';

void test('sort-dependency-keys in isolation', () => {
  const text = '{"z":"1","a":"1"}';
  const node = parseTree(text);
  if(!node) {
    throw new Error('Expected JSON');
  }
  assert.equal(sortDependencyKeys(text, node)[0]?.rule, 'package-json/sort-dependency-keys');
});
