import assert from 'assert/strict';
import { test } from 'node:test';
import { isMap, parseDocument } from 'yaml';
import { orderIssue } from './key-order';

void test('key-order in isolation', () => {
  const text = 'services:\n  app:\n    command: hi\n    image: node\n';
  const node = parseDocument(text).getIn(['services', 'app'], true);
  if(!isMap(node)) {
    throw new Error('Expected mapping');
  }
  assert.equal(orderIssue(text, node)[0]?.rule, 'docker-compose/key-order');
});
