/* eslint-disable ts/no-unnecessary-condition -- Runtime assertions verify fix outputs. */

import assert from 'assert/strict';
import { test } from 'node:test';
import { parseDocument } from 'yaml';
import { fix } from '..';
import { scalarPaths } from '../../utils/docker-compose/quotes';
import { quoteIssues } from './no-unnecessary-quotes';

void test('no-unnecessary-quotes in isolation', () => {
  const text = 'services:\n  app: &app\n    expose: ["3003"]\n';
  assert.equal(quoteIssues(text, parseDocument(text), new Set())[0]?.edit?.replacement, '3003');
});

void test('merge inheritance preserves quote fixes at the definition', () => {
  for(const inheritance of [
    '    <<: *scanner\n',
    '    <<: [*scanner, {image: node}]\n',
    '    <<: {<<: *scanner}\n',
    '    <<: *scanner\n    expose: [4000]\n',
  ]) {
    const text = `services:\n  scanner: &scanner\n    expose: ["3003"] # port\n  dev:\n${inheritance}`;
    const issues = quoteIssues(text, parseDocument(text), new Set());
    assert.equal(issues.length, 1);
    assert.equal(issues[0]?.start, text.indexOf('"3003"'));
    const expected = text.replace('"3003"', '3003');
    assert.equal(fix(text, 'docker-compose'), expected);
    assert.equal(fix(expected, 'docker-compose'), expected);
  }
});
void test('merge usage respects overrides and source precedence', () => {
  const text = 'services:\n  scanner: &scanner {expose: ["3003"]}\n  dev:\n    <<: [{expose: [4000]}, *scanner]\n';
  const document = parseDocument(text);
  const paths = scalarPaths(document);
  const scalar = document.getIn(['services', 'scanner', 'expose', 0], true);
  assert.deepEqual([...paths.entries()].find(([node]) => node === scalar)?.[1], [['services', 'scanner', 'expose', 0]]);
});
void test('unsafe alias contexts and invalid merges retain numeric quotes', () => {
  for(const extra of [
    '  dev:\n    <<: *scanner\n    command: [*port]\n',
    '  dev:\n    <<: 42\n',
    '  dev: &dev\n    <<: *dev\n',
    '  dev:\n    <<: *missing\n',
  ]) {
    const text = `services:\n  scanner: &scanner\n    expose: [&port "3003"]\n${extra}`;
    assert.equal(quoteIssues(text, parseDocument(text), new Set()).length, 0);
  }
});
