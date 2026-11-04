/* eslint-disable ts/no-unnecessary-condition -- Runtime assertions check optional diagnostics and YAML nodes. */
/* eslint-disable no-template-curly-in-string -- Compose interpolation is literal fixture data. */

import assert from 'assert/strict';
import { test } from 'node:test';
import { isMap, parseDocument } from 'yaml';
import { analyze, fix } from '..';

const rules = (text: string) => analyze(text, 'docker-compose');
const fixed = (text: string): string => {
  const result = fix(text, 'docker-compose');
  assert.equal(fix(result, 'docker-compose'), result);

  return result;
};

void test('service and external fragment examples apply service order and preserve build context', () => {
  const input = `x-static-files: &static-files
  command: copy
  image: draw-house_static-files
  networks: [draw-house]
  container_name: draw-house_static-files
  volumes: [./prod-build:/volume:rw]
services:
  static-files:
    <<: *static-files
    build: &static-files-build
      context: .
      dockerfile: Dockerfile
      target: static-files
      args: {DEPLOY_ENV: '\${DEPLOY_ENV:?}'}
      no_cache: "true"
    profiles: [prod]
  mongo: &mongo
    command: run
    image: mongo:8
  mongo-dev:
    <<: *mongo
    command: dev
    profiles: [dev]
`;
  assert.equal(rules(input).filter(e => e.rule === 'docker-compose/key-order').length, 4);
  assert.equal(rules(input).filter(e => e.rule === 'docker-compose/pinned-image').length, 0);
  const output = fixed(input);
  assert.equal(rules(output).length, 0);
  assert.ok(output.includes('&static-files-build'));
  assert.ok(output.includes('no_cache: true'));
  assert.ok(output.includes("DEPLOY_ENV: '${DEPLOY_ENV:?}'"));
  const fragment = parseDocument(output).get('x-static-files', true);
  assert.ok(isMap(fragment));
  assert.deepEqual(fragment.items.map(e => String(e.key)), ['networks', 'image', 'container_name', 'volumes', 'command']);
});

void test('merge stays in its original slot and unsafe alias ordering is report-only', () => {
  for(const keys of [
    ['<<: *base', 'command: hi', 'image: node:22'],
    ['command: hi', '<<: *base', 'image: node:22'],
    ['command: hi', 'image: node:22', '<<: *base'],
  ]) {
    const input = `x-base: &base {restart: always}\nservices:\n  app:\n    ${keys.join('\n    ')}\n`;
    const mapping = parseDocument(fixed(input)).getIn(['services', 'app'], true);
    assert.ok(isMap(mapping));
    assert.equal(mapping.items.findIndex(e => String(e.key) === '<<'), keys.indexOf('<<: *base'));
  }
  const input = 'services:\n  app:\n    command: &value hi\n    x-base: &base {restart: always}\n    <<: *base\n    image: *value\n';
  assert.equal(fixed(input), input);
  assert.ok(rules(input).some(e => e.rule === 'docker-compose/key-order' && !e.edit));
});

void test('chained merge lists respect shallow overrides and effective build exemptions', () => {
  const input = `x-first: &first {image: nginx, ports: [80:80]}
x-second: &second {image: redis:8, build: ., ports: [90:90]}
x-chain: &chain {<<: [*first, *second]}
services:
  built: {<<: *chain, ports: [127.0.0.1:81:81/tcp]}
  pulled: {<<: *first}
  alias: *first
`;
  const images = rules(input).filter(e => e.rule === 'docker-compose/pinned-image');
  assert.equal(images.length, 1);
  assert.equal(input.slice(images[0]?.start, images[0]?.end), 'x');
  assert.equal(rules(input).filter(e => e.rule === 'docker-compose/explicit-port-host').length, 1);
  const output = fixed(input);
  assert.ok(output.includes('ports: [90:90]'));
  assert.ok(output.includes('ports: [127.0.0.1:80:80/tcp]'));
  const document: unknown = parseDocument(output, { merge: true }).toJS({ mapAsMap: true });
  assert.ok(document instanceof Map);
  const services: unknown = document.get('services');
  assert.ok(services instanceof Map);
  const built: unknown = services.get('built');
  assert.ok(built instanceof Map);
  assert.equal(built.get('image'), 'nginx');
  assert.equal(built.get('build'), '.');
});

void test('aliased long entries inherit explicit values and add only missing properties', () => {
  const input = `x-defaults: &defaults {host_ip: 0.0.0.0, protocol: udp}
x-port: &port {<<: *defaults, target: 80}
x-volume: &volume {type: volume, target: /data}
x-mounts: &mounts [*volume]
services:
  one: {ports: [*port], volumes: *mounts}
  two: {ports: [*port], volumes: *mounts}
`;
  assert.deepEqual(rules(input).map(e => e.rule), ['docker-compose/explicit-volume-mode']);
  const output = fixed(input);
  assert.ok(output.includes('x-volume: &volume {read_only: true, type: volume, target: /data}'));
  assert.ok(output.includes('x-port: &port {<<: *defaults, target: 80}'));
  assert.equal(rules(output).length, 0);
});

void test('quotes follow nested build aliases and all effective consumer contexts', () => {
  const compatible = 'x-build: &build {no_cache: "true", args: {COUNT: "12"}}\nx-expose: &expose ["3000"]\nservices:\n  app: {build: *build, expose: *expose}\n  other: {build: *build, expose: *expose}\n';
  const output = fixed(compatible);
  assert.ok(output.includes('no_cache: true'));
  assert.ok(output.includes('COUNT: 12'));
  assert.ok(output.includes('&expose [3000]'));
  const incompatible = 'x-expose: &expose ["3000"]\nservices:\n  app: {expose: *expose, command: *expose}\n';
  assert.equal(fixed(incompatible), incompatible);
  const unused = 'x-unused: &unused {command: hi, image: nginx, ports: [80:80], expose: ["3000"]}\nservices: {}\n';
  assert.equal(fixed(unused), unused);
  assert.equal(rules(unused).length, 0);
});

void test('shared value fixes are withheld for incompatible consumers', () => {
  const input = 'x-port: &port 80:80\nservices:\n  app:\n    ports: [*port]\n    command: [*port]\n';
  assert.equal(fixed(input), input);
  assert.equal(rules(input).length, 2);
  assert.ok(rules(input).every(e => e.edit === undefined));
});

void test('suppression belongs to the shared definition', () => {
  const input = 'x-ports: &ports\n  # config-lint-disable-next-line docker-compose/explicit-port-protocol\n  - 127.0.0.1:80:80\nservices:\n  one: {ports: *ports}\n  two: {ports: *ports}\n';
  assert.deepEqual(rules(input), []);
  assert.equal(fixed(input), input);
});

void test('cycles and unresolved aliases do not crash or suppress independent diagnostics', () => {
  for(const broken of ['x-cycle: &cycle {<<: *cycle}\n', 'x-cycle: &cycle {<<: *missing}\n']) {
    const input = `${broken}services:\n  broken: {<<: *cycle}\n  valid: {image: nginx, ports: [80:80]}\n`;
    assert.doesNotThrow(() => fixed(input));
    assert.ok(rules(input).some(e => e.rule === 'docker-compose/pinned-image'));
    assert.ok(rules(input).some(e => e.rule === 'docker-compose/explicit-port-host'));
  }
});

void test('quoted merge-like keys remain ordinary properties', () => {
  const input = 'x-base: &base {image: nginx, ports: [80:80]}\nservices:\n  app:\n    "<<": *base\n';
  assert.equal(rules(input).filter(e => e.rule !== 'docker-compose/no-unnecessary-quotes').length, 0);
  assert.equal(fixed(input), input);
});

void test('alias traversal limits withhold edits without throwing', () => {
  const definitions = ['x-base: &base {ports: [80:80]}'];
  for(let i = 0; i < 110; i++) {
    definitions.push(`x-level-${i}: &level-${i} {<<: *${i === 0 ? 'base' : `level-${i - 1}`}}`);
  }
  const input = `${definitions.join('\n')}\nservices:\n  deep: {<<: *level-109}\n  ordinary: {image: nginx}\n`;
  assert.doesNotThrow(() => rules(input));
  assert.ok(rules(input).some(e => e.rule === 'docker-compose/pinned-image'));
  assert.equal(fixed(input), input);
});

void test('environment variable names beginning with x- still count as actual consumers', () => {
  const input = 'x-value: &value "true"\nservices:\n  app:\n    init: *value\n    environment: {x-flag: *value}\n';
  assert.equal(fixed(input), input);
});

void test('an anchor used as an extension mapping key prevents incompatible shared edits', () => {
  const input = 'x-storage: {&port "3000": ignored}\nservices:\n  app: {expose: [*port], ports: [*port]}\n';
  assert.equal(fixed(input), input);
  assert.ok(rules(input).some(e => e.rule === 'docker-compose/explicit-port-host'));
  assert.ok(rules(input).every(e => e.edit === undefined));
});
