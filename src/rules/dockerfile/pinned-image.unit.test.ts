/* eslint-disable ts/no-unnecessary-condition -- Runtime assertions verify report-only behavior. */
/* eslint-disable no-template-curly-in-string -- Docker variables are literal test data. */

import assert from 'assert/strict';
import { test } from 'node:test';
import { pinnedImages } from './pinned-image';

void test('external images use Compose pinning semantics and accurate ranges', () => {
  for(const [value, expected] of [['nginx', 'x'], ['nginx:latest', 'latest'], ['nginx:', ':'], ['localhost:5000/nginx', 'x'], ['ghcr.io/org/app', 'p'], ['nginx@sha256:', 'sha256:'], ['nginx@:abc', ':abc'], ['nginx@', '@']] as const) {
    const text = `FROM --platform=linux/amd64 ${value} AS build\n`;
    const result = pinnedImages(text);
    assert.equal(result.length, 1, value);
    const issue = result[0];
    assert.ok(issue);
    assert.equal(issue.rule, 'dockerfile/pinned-image');
    assert.equal(text.slice(issue.start, issue.end), expected);
    assert.equal(issue.edit, undefined);
  }
  for(const value of ['node:22', 'nginx:stable', 'nginx:alpine', 'nginx:LATEST', 'localhost:5000/app:1', 'app@sha256:abc', 'app:latest@sha256:abc', 'scratch', '$BASE', 'node:${VERSION}']) {
    assert.deepEqual(pinnedImages(`FROM ${value}\n`), [], value);
  }
});
void test('only earlier stages are exempt, including stages with unpinned or variable bases', () => {
  const text = 'FROM later\nFROM node AS build\nFROM build AS later\nFROM $BASE AS variable\nFROM variable\nFROM scratch AS empty\nFROM empty\n';
  assert.deepEqual(pinnedImages(text).map(e => text.slice(e.start, e.end)), ['r', 'e']);
});
void test('Dockerfile syntax excludes comments, heredocs, and continued RUN bodies', () => {
  const text = '# FROM ignored\nRUN <<EOF\nFROM ignored\n# config-lint-disable\nEOF\nRUN echo hello \\\n FROM ignored\nfRoM \\\n --platform=$BUILDPLATFORM \\\n nginx AS build\n';
  const result = pinnedImages(text);
  assert.equal(result.length, 1);
  assert.equal(text.slice(result[0]?.start, result[0]?.end), 'x');
  const windows = '# escape=`\r\nFROM `\r\n nginx\r\n';
  const issue = pinnedImages(windows)[0];
  assert.ok(issue);
  assert.equal(windows.slice(issue.start, issue.end), 'x');
  for(const incomplete of ['', 'FROM', 'FROM --platform=linux/amd64']) {
    assert.deepEqual(pinnedImages(incomplete), []);
  }
});
