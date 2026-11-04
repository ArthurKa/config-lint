/* eslint-disable ts/no-unnecessary-condition -- Runtime assertions verify fixed output and report-only behavior. */

import assert from 'assert/strict';
import { test } from 'node:test';
import { analyze, fix } from '..';

const images = (text: string) => analyze(text, 'docker-compose').filter(e => e.rule === 'docker-compose/pinned-image');

void test('image warnings highlight tags or their missing location without quotes', () => {
  for(const quote of ['', "'", '"']) {
    for(const [value, expected] of [['nginx', 'x'], ['nginx:latest', 'latest'], ['nginx:', ':'], ['localhost:5000/nginx', 'x']] as const) {
      const text = `services:\n  app:\n    image: ${quote}${value}${quote}\n`;
      if(quote === '' && value.endsWith(':')) {
        continue;
      }
      const issue = images(text)[0];
      assert.ok(issue, text);
      assert.equal(text.slice(issue.start, issue.end), expected);
    }
  }
  for(const quote of ["'", '"']) {
    const text = `services:\n  app:\n    image: ${quote}${quote}\n`;
    const issue = images(text)[0];
    assert.ok(issue);
    assert.equal(issue.start, text.indexOf(quote) + 1);
    assert.equal(issue.end, issue.start);
  }
});

void test('image pinning checks pulled services and exempts locally built services', () => {
  const text = 'services:\n  landing-page:\n    build: {context: ., dockerfile: Dockerfile, target: landing-page}\n    image: draw-house_landing-page\n  nginx-certbot:\n    image: jonasal/nginx-certbot\n  pinned:\n    image: jonasal/nginx-certbot:5.2.0-alpine\n';
  const result = images(text);
  assert.equal(result.length, 1);
  assert.equal(text.slice(result[0]?.start, result[0]?.end), 't');
});

void test('report-only warnings persist after unrelated fixes without changing image values', () => {
  const text = 'services:\n  app:\n    image: nginx:latest\n    volumes: [./data:/data]\n';
  const result = fix(text, 'docker-compose');
  assert.equal(result, text.replace('./data:/data', './data:/data:ro'));
  assert.equal(images(result).length, 1);
  assert.equal(images(result)[0]?.edit, undefined);
  assert.equal(fix(result, 'docker-compose'), result);
});

void test('shared images report once and merged local images are checked while tags stay skipped', () => {
  const text = 'services:\n  app: &app\n    image: &image nginx\n  alias: *app\n  image-alias:\n    image: *image\n  merged:\n    <<: *app\n    image: nginx\n  tagged: !custom\n    image: nginx\n';
  assert.equal(images(text).length, 2);
  assert.equal(fix(text, 'docker-compose'), text);
  assert.equal(images('services: {app: {image: nginx}}').length, 1);
});
