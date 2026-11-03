/* eslint-disable ts/no-unnecessary-condition -- Runtime assertions intentionally check values even when their types agree. */

import assert from 'assert/strict';
import { test } from 'node:test';
import { isMap, parseDocument } from 'yaml';
import { analyze, fix } from '..';

void test('package sorting preserves whitespace, unknown order, scripts and nested values', () => {
  const input = '{\r\n\t"license": "MIT",\r\n\t"customZ": 1,\r\n\t"name": "demo",\r\n\t"customA": 2,\r\n\t"scripts": {"z":"z","a":"a"},\r\n\t"dependencies": {"z":"1", "A":"2", "a":"3"},\r\n\t"exports": {"z":1,"a":2}\r\n}';
  const result = fix(input, 'package-json');
  const object = parseDocument(result).contents;
  assert.ok(isMap(object));
  const dependencyMap = object.get('dependencies', true);
  const scripts = object.get('scripts', true);
  assert.ok(isMap(dependencyMap));
  assert.ok(isMap(scripts));
  assert.deepEqual(object.items.map(e => String(e.key)), ['name', 'scripts', 'dependencies', 'exports', 'customZ', 'customA', 'license']);
  assert.deepEqual(dependencyMap.items.map(e => String(e.key)), ['A', 'a', 'z']);
  assert.deepEqual(scripts.items.map(e => String(e.key)), ['z', 'a']);
  assert.ok(result.includes('\r\n\t'));
  assert.equal(fix(result, 'package-json'), result);
});
void test('all selected dependency maps, invalid types, strict JSON and nested duplicates', () => {
  for(const name of ['dependencies', 'devDependencies', 'peerDependencies', 'peerDependenciesMeta', 'optionalDependencies']) {
    assert.equal(fix(`{"${name}":{"z":{},"a":{}}}`, 'package-json'), `{"${name}":{"a":{},"z":{}}}`);
  }
  for(const input of ['{"dependencies":[]}', '{"dependencies":null}']) {
    assert.equal(fix(input, 'package-json'), input);
  }
  for(const input of ['{"a":1,}', '{/*comment*/}', '{"exports":{"a":1,"a":2}}']) {
    assert.ok(analyze(input, 'package-json').every(e => e.edit === undefined));
    assert.equal(fix(input, 'package-json'), input);
  }
});
void test('dependency warning starts at the first affected key, not the first key', () => {
  const input = JSON.stringify({
    devDependencies: {
      '@arthurka/eslint': '4.9.0',
      '@arthurka/ts-reset': '1.13.0',
      '@next/eslint-plugin-next': '16.2.6',
      '@total-typescript/ts-reset': '0.5.1',
      '@types/semver': '7.7.1',
      '@tsconfig/strictest': '2.0.8',
      'dotenv-cli': '7.4.2',
    },
  }, null, 2);
  const issues = analyze(input, 'package-json');
  assert.deepEqual(issues.map(e => input.slice(e.start, e.end)), ['"@types/semver"']);
  assert.equal(issues[0]?.start, input.indexOf('"@types/semver"'));
});
void test('top-level ordering points at type before devDependencies', () => {
  const input = JSON.stringify({ name: 'repo', version: '1.0.0', private: true, scripts: {}, dependencies: {}, type: 'module', devDependencies: {}, workspaces: ['apps/*'] }, null, 2);
  const issues = analyze(input, 'package-json');
  assert.deepEqual(issues.map(e => input.slice(e.start, e.end)), ['"type"']);
  const edit = issues[0]?.edit;
  assert.ok(edit);
  assert.equal(input.slice(0, edit.start) + edit.replacement + input.slice(edit.end), fix(input, 'package-json'));
});
void test('multiple ordering mistakes retain one report at the first affected key', () => {
  const input = '{"dependencies":{"a":"1","c":"1","b":"1","d":"1","f":"1","e":"1","g":"1"}}';
  const issues = analyze(input, 'package-json');
  assert.deepEqual(issues.map(e => input.slice(e.start, e.end)), ['"c"']);
  for(const issue of issues) {
    const { edit } = issue;
    assert.ok(edit);
    assert.equal(analyze(input.slice(0, edit.start) + edit.replacement + input.slice(edit.end), 'package-json').length, 0);
  }
});
