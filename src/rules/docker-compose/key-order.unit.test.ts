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
  const issue = orderIssue(text, node)[0];
  assert.ok(issue);
  assert.equal(issue.rule, 'docker-compose/key-order');
  assert.equal(issue.end - issue.start, 1);
  assert.equal(text.slice(issue.start, issue.end), 'c');
  assert.ok(issue.edit);
});
