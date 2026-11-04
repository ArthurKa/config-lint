/* eslint-disable ts/no-unnecessary-condition -- Runtime assertions verify report-only behavior. */

import assert from 'assert/strict';
import { test } from 'node:test';
import { analyze, fix } from '..';
import { apply } from '../../utils/text';

const issues = (text: string) => analyze(text, 'dockerfile');
void test('pin warnings are report only and suppressions preserve Docker parser directives', () => {
  for(const eol of ['\n', '\r\n']) {
    const text = ['# syntax=docker/dockerfile:1', '# escape=`', 'FROM `', ' nginx', ''].join(eol);
    const result = issues(text);
    assert.equal(result.length, 1);
    assert.equal(fix(text, 'dockerfile'), text);
    const suggestions = result[0]?.suggestions;
    assert.equal(suggestions?.length, 2);
    for(const suggestion of suggestions ?? []) {
      const edit = suggestion.edits[0];
      assert.ok(edit);
      const next = apply(text, edit);
      assert.ok(next.startsWith(`# syntax=docker/dockerfile:1${eol}# escape=\`${eol}`));
      assert.deepEqual(issues(next), []);
    }
  }
});
void test('disable, enable, next-line, and directive diagnostics', () => {
  assert.deepEqual(issues('# config-lint-disable-next-line dockerfile/pinned-image -- intentional\nFROM \\\n nginx\n'), []);
  assert.deepEqual(issues('# config-lint-disable\nFROM nginx\n'), []);
  const text = '# config-lint-disable dockerfile/pinned-image\nFROM nginx\n# config-lint-enable dockerfile/pinned-image\nFROM redis\n';
  const result = issues(text);
  assert.equal(result.length, 1);
  assert.equal(text.slice(result[0]?.start, result[0]?.end), 's');
  for(const [comment, rule] of [
    ['config-lint-disable dockerfile/pinned-image', 'directive/unused'],
    ['config-lint-disable docker-compose/pinned-image', 'directive/unknown-rule'],
    ['config-lint-bogus', 'directive/invalid'],
  ] as const) {
    const source = `# ${comment}\nFROM node:22\n`;
    const diagnostic = issues(source)[0];
    assert.equal(diagnostic?.rule, rule);
    const edit = diagnostic?.suggestions?.[0]?.edits[0];
    assert.ok(edit);
    assert.deepEqual(issues(apply(source, edit)), []);
  }
});
void test('heredoc comments cannot suppress real FROM warnings', () => {
  const text = 'FROM node:22\nRUN <<EOF\n# config-lint-disable\nFROM ignored\nEOF\nFROM nginx\n';
  assert.deepEqual(issues(text).map(e => e.rule), ['dockerfile/pinned-image']);
});
