/* eslint-disable no-template-curly-in-string -- Compose variables are literal test data. */
/* eslint-disable ts/no-unnecessary-condition -- Runtime assertions verify report-only behavior. */

import assert from 'assert/strict';
import { test } from 'node:test';
import { isMap, parseDocument } from 'yaml';
import { pinnedImage } from './pinned-image';

const issues = (body: string) => {
  const document = parseDocument(body);
  assert.ok(isMap(document.contents));

  return pinnedImage(document.contents);
};

void test('pulled images require a tag or digest without providing an edit', () => {
  for(const value of ['jonasal/nginx-certbot', 'nginx:latest', 'nginx:', '', 'localhost:5000/nginx', 'localhost:5000/nginx:latest', 'nginx@sha256:', 'nginx@:abc']) {
    const text = `image: ${JSON.stringify(value)}\n`;
    const result = issues(text);
    assert.equal(result.length, 1, value);
    const issue = result[0];
    assert.ok(issue);
    assert.equal(issue.rule, 'docker-compose/pinned-image');
    assert.equal(issue.edit, undefined);
    assert.equal(text.slice(issue.start, issue.end), JSON.stringify(value));
  }
});

void test('explicit non-latest tags and digests are accepted', () => {
  const digest = `sha256:${'a'.repeat(64)}`;
  for(const value of ['jonasal/nginx-certbot:5.2.0-alpine', 'node:22', 'nginx:stable', 'nginx:alpine', 'nginx:LATEST', 'localhost:5000/nginx:1', `nginx@${digest}`, `nginx:latest@${digest}`]) {
    assert.deepEqual(issues(`image: ${value}\n`), [], value);
  }
});

void test('build declarations and unresolved image values are exempt', () => {
  for(const body of [
    'build: .\nimage: draw-house_landing-page',
    'build: {context: ., dockerfile: Dockerfile, target: landing-page}\nimage: draw-house_landing-page',
    'build: .\nimage: app:latest',
    'image: nginx:${NGINX_VERSION}',
    'image: ${IMAGE:-nginx:latest}',
    'image: $IMAGE',
    'image: !custom nginx',
    'image: *image',
    'image: 123',
    'image: null',
    'image: []',
    'command: start',
  ]) {
    assert.deepEqual(issues(body), [], body);
  }
});
