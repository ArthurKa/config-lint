/* eslint-disable ts/no-unnecessary-condition -- Runtime assertions verify analyzer results. */

import assert from 'assert/strict';
import { test } from 'node:test';
import { analyze, fix } from '../../rules';
import { apply } from '../text';

const rule = 'docker-compose/pinned-image';
const source = 'services:\n  app:\n    image: redis\n';
void test('suppresses next-line and region reports without applying fixes', () => {
  for(const text of [source.replace('    image:', `    # config-lint-disable-next-line ${rule}\n    image:`), `# config-lint-disable ${rule}\n${source}`]) {
    assert.equal(analyze(text, 'docker-compose').length, 0);
    assert.equal(fix(text, 'docker-compose'), text);
  }
});
void test('insertion suggestions suppress their report', () => {
  const issue = analyze(source, 'docker-compose').find(e => e.rule === rule);
  assert.equal(issue?.suggestions?.length, 2);
  for(const suggestion of issue?.suggestions ?? []) {
    const result = suggestion.edits.reduce(apply, source);
    assert.equal(analyze(result, 'docker-compose').length, 0);
  }
});
void test('cleanup remains manual and unknown names do not suppress reports', () => {
  const text = `# config-lint-disable missing\n${source}`;
  const issues = analyze(text, 'docker-compose');
  assert.ok(issues.some(e => e.rule === rule));
  const unknown = issues.find(e => e.rule === 'directive/unknown-rule');
  assert.ok(unknown);
  assert.equal(unknown.edit, undefined);
  assert.equal(unknown.suggestions?.[0]?.edits.reduce(apply, text), source);
});
void test('enable restores reports and quoted directive text is ignored', () => {
  const text = `# config-lint-disable ${rule}\n# config-lint-enable ${rule}\n${source}`;
  assert.ok(analyze(text, 'docker-compose').some(e => e.rule === rule));
  assert.equal(analyze('services:\n  app:\n    image: "# config-lint-disable"\n', 'docker-compose').some(e => e.rule.startsWith('directive/')), false);
});
