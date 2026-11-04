/* eslint-disable ts/no-unnecessary-condition -- Runtime assertions intentionally check values even when their types agree. */
/* eslint-disable no-template-curly-in-string -- Docker Compose interpolation fixtures are literal data. */

import assert from 'assert/strict';
import { readFile } from 'fs/promises';
import { test } from 'node:test';
import { isMap, isNode, isSeq, parseDocument } from 'yaml';
import { analyze, fix } from '..';
import { check, dockerCompose, values } from '../../utils/test-helpers';

void test('ports: static and dynamic allocation, protocol, IPv6 and ranges', () => {
  for(const [input, expected] of [
    ['3000', '127.0.0.1::3000/tcp'],
    ['"3000"', '127.0.0.1::3000/tcp'],
    ['3000:3000', '127.0.0.1:3000:3000/tcp'],
    ['"3000:3000/udp"', '127.0.0.1:3000:3000/udp'],
    ['"[::1]::3000/sctp"', '[::1]::3000/sctp'],
    ['"::1:3000:3000"', '::1:3000:3000/tcp'],
    ['"127.0.0.1::3000"', '127.0.0.1::3000/tcp'],
    ['"8000-8002:80-82"', '127.0.0.1:8000-8002:80-82/tcp'],
  ] as const) {
    const result = check(dockerCompose(`    ports:\n      - ${input}\n`));
    assert.equal(parseDocument(result).getIn(['services', 'app', 'ports', 0]), expected);
  }
});
void test('malformed port mappings never autofix', () => {
  for(const input of ['localhost:3000:3000/tcp', '99999:80', '1:80-82', '80:80/bogus']) {
    const text = dockerCompose(`    ports:\n      - ${input}\n`);
    const issues = analyze(text, 'docker-compose');
    assert.ok(issues.length > 0);
    assert.ok(issues.every(e => e.edit === undefined));
  }
});
void test('volumes: named, anonymous, Windows, extra options and explicit rw', () => {
  for(const [input, expected] of [
    ['./app:/app', './app:/app:ro'],
    ['data:/data', 'data:/data:ro'],
    ['/data', '/data:ro'],
    ['./app:/app:z', './app:/app:z,ro'],
    ['./app:/app:ro,z', './app:/app:ro,z'],
    ['./app:/app:rw', './app:/app:rw'],
    ['C:\\data:D:\\data', 'C:\\data:D:\\data:ro'],
  ] as const) {
    const result = check(dockerCompose(`    volumes:\n      - '${input}'\n`));
    assert.equal(parseDocument(result).getIn(['services', 'app', 'volumes', 0]), expected);
  }
});
void test('long block and flow forms preserve fields and comments', () => {
  for(const entry of ['{target: 80, published: "8080"}', 'target: 80 # keep\n        published: "8080"']) {
    const result = check(dockerCompose(`    ports:\n      - ${entry}\n`));
    assert.equal(parseDocument(result).getIn(['services', 'app', 'ports', 0, 'host_ip']), '127.0.0.1');
    assert.equal(parseDocument(result).getIn(['services', 'app', 'ports', 0, 'protocol']), 'tcp');
    if(entry.includes('#')) {
      assert.ok(result.includes('# keep'));
    }
  }
  const input = dockerCompose('    volumes:\n      - {type: bind, source: ./app, target: /app, read_only: false}\n');
  assert.equal(check(input), input);
  const result = check(dockerCompose('    volumes:\n      - type: volume\n        target: /data\n'));
  assert.equal(parseDocument(result).getIn(['services', 'app', 'volumes', 0, 'read_only']), true);
});
void test('invalid explicit long-form values warn without replacements', () => {
  for(const entry of ['ports:\n      - {target: 80, host_ip: invalid, protocol: wat}', 'volumes:\n      - {target: /data, read_only: "false"}']) {
    const issues = analyze(dockerCompose(`    ${entry}\n`), 'docker-compose');
    assert.ok(issues.some(e => e.edit === undefined));
  }
});
void test('Docker Compose order moves comments, preserves unknown order, CRLF and no final newline', () => {
  for(const ending of ['\n', '']) {
    const input = dockerCompose(`    # command comment\n    command: start # inline\n    zed: 1\n    # image comment\n    image: node\n    alpha: 2\n    restart: always${ending}`).replaceAll('\n', '\r\n');
    const result = check(input);
    const service = parseDocument(result).getIn(['services', 'app'], true);
    assert.ok(isMap(service));
    assert.deepEqual(service.items.map(e => String(e.key)), ['image', 'zed', 'alpha', 'restart', 'command']);
    assert.ok(result.includes('# image comment\r\n    image: node'));
    assert.ok(result.includes('# command comment\r\n    command: start # inline'));
    assert.equal(result.endsWith('\n'), ending !== '');
    assert.deepEqual(values(result), values(input));
  }
});
void test('flow Docker Compose property ordering', () => {
  const input = 'services: {app: {command: hi, custom: 1, image: node}}\n';
  assert.equal(check(input), 'services: {app: {image: node, custom: 1, command: hi}}\n');
});
void test('quote removal across Docker Compose preserves types, escaping, comments and flow context', () => {
  const input = dockerCompose('    "image": "node:22"\n    environment:\n      BOOL: "false"\n      EMPTY: ""\n      NUMBER: "0123"\n      DATE: "2026-01-01"\n      OLD_BOOL: "no"\n      SPACE: " hello "\n      COLON: "a: b"\n      COMMENT: "a # b"\n      ESCAPE: "hello\\nworld"\n      SAFE: "abc" # comment\n      FLOW: ["a,b", "abc"]\n');
  const result = check(input);
  assert.deepEqual(values(result), values(input));
  assert.ok(result.includes('image: node:22'));
  assert.ok(result.includes('SAFE: abc # comment'));
  assert.ok(result.includes('BOOL: "false"'));
  assert.ok(result.includes('OLD_BOOL: "no"'));
  assert.ok(result.includes('FLOW: ["a,b", abc]'));
});
void test('local ports in merged services report and fix without changing healthchecks', () => {
  const input = `x-mongo: &mongo
  image: mongo:8
x-mongo-healthcheck: &mongo-healthcheck
  interval: 10s
services:
  mongo-dev:
    <<: *mongo
    profiles:
      - dev
    healthcheck:
      <<: *mongo-healthcheck
      test: >
        mongosh --port 27017 --quiet --eval "
          let res;
          try {
            res = rs.status();
          } catch(e) {
            rs.initiate({
              _id: 'rs0',
              members: [{ _id: 0, host: 'localhost:27017' }],
            });
            res = rs.status();
          }

          if(res.ok !== 1) {
            exit(1);
          }
        "
    ports:
      - 127.0.0.1:27017:27017
`;
  const issues = analyze(input, 'docker-compose');
  assert.deepEqual(issues.map(e => e.rule), ['docker-compose/explicit-port-protocol', 'docker-compose/key-order']);
  assert.equal(input.slice(issues[0]?.start, issues[0]?.end), '7');
  const result = check(input);
  assert.ok(result.includes('127.0.0.1:27017:27017/tcp'));
  assert.equal(parseDocument(result).getIn(['services', 'mongo-dev', 'healthcheck', 'test']), parseDocument(input).getIn(['services', 'mongo-dev', 'healthcheck', 'test']));
  assert.deepEqual(analyze(result, 'docker-compose'), []);
});
void test('merged services validate local short and long ports and volumes', () => {
  const input = `x-base: &base
  ports: [90:90]
  volumes: [./inherited:/inherited]
services:
  app:
    <<: *base
    command: start
    image: nginx
    ports:
      - 80:80
      - {target: 81}
    volumes:
      - ./data:/data
      - {type: volume, target: /other}
  inherited:
    <<: *base
`;
  assert.deepEqual(analyze(input, 'docker-compose').map(e => e.rule).toSorted(), [
    'docker-compose/explicit-port-host',
    'docker-compose/explicit-port-host',
    'docker-compose/explicit-port-protocol',
    'docker-compose/explicit-port-protocol',
    'docker-compose/explicit-volume-mode',
    'docker-compose/explicit-volume-mode',
    'docker-compose/explicit-port-host',
    'docker-compose/explicit-port-protocol',
    'docker-compose/explicit-volume-mode',
    'docker-compose/key-order',
    'docker-compose/pinned-image',
  ].toSorted());
  const result = check(input);
  const document = parseDocument(result);
  const ports = document.getIn(['services', 'app', 'ports']);
  const volumes = document.getIn(['services', 'app', 'volumes']);
  assert.ok(isSeq(ports));
  assert.ok(isSeq(volumes));
  assert.deepEqual(ports.toJSON(), [
    '127.0.0.1:80:80/tcp',
    { protocol: 'tcp', host_ip: '127.0.0.1', target: 81 },
  ]);
  assert.deepEqual(volumes.toJSON(), [
    './data:/data:ro',
    { read_only: true, type: 'volume', target: '/other' },
  ]);
  assert.ok(result.startsWith('x-base: &base\n  ports: [127.0.0.1:90:90/tcp]\n  volumes: [./inherited:/inherited:ro]\n'));
  assert.deepEqual(analyze(result, 'docker-compose').map(e => e.rule), ['docker-compose/pinned-image']);
});
void test('alias references and inherited fields are checked while variable expressions stay skipped', () => {
  const input = 'x-ports: &ports [80:80]\nx-base: &base {image: node}\nservices:\n  app:\n    <<: *base\n    ports: *ports\n  other:\n    ports:\n      - "${PORT_MAPPING}"\n      - {target: 80, host_ip: "${HOST}"}\n    volumes:\n      - "${SOURCE}:/data"\n';
  const result = check(input);
  assert.equal(result, input.replace('[80:80]', '[127.0.0.1:80:80/tcp]'));
  assert.deepEqual(analyze(result, 'docker-compose').map(e => e.rule), ['docker-compose/pinned-image']);
});
void test('ordering cannot create forward alias references', () => {
  const input = dockerCompose('    command: &value hi\n    image: *value\n');
  assert.equal(check(input), input);
  assert.ok(analyze(input, 'docker-compose').some(e => e.rule === 'docker-compose/key-order' && e.edit === undefined));
});
void test('invalid YAML and duplicate keys produce no edits', () => {
  for(const input of ['services: [', 'services: {app: {image: one, image: two}}']) {
    assert.ok(analyze(input, 'docker-compose').every(e => e.edit === undefined));
    assert.equal(fix(input, 'docker-compose'), input);
  }
});
void test('invalid bracketed hosts and skipped variable-containing mappings', () => {
  for(const input of ['"[::1:80:80/tcp"', '"[127.0.0.1]:80:80/tcp"']) {
    const problems = analyze(dockerCompose(`    ports:\n      - ${input}\n`), 'docker-compose');
    assert.ok(problems.some(e => e.rule === 'docker-compose/explicit-port-host' && e.edit === undefined));
  }
  const input = dockerCompose('    ports:\n      - {target: 80, host_ip: "${HOST}", protocol: "tcp"}\n');
  assert.equal(check(input), input);
});
void test('numeric port quote rule and all-compliant documents stay stable', () => {
  const input = dockerCompose('    ports:\n      - "3000"\n');
  assert.ok(analyze(input, 'docker-compose').some(e => e.rule === 'docker-compose/no-unnecessary-quotes'));
  const compliant = dockerCompose('    image: node:22\n    ports:\n      - 127.0.0.1:80:80/tcp\n    volumes:\n      - ./app:/app:rw\n');
  assert.equal(fix(compliant, 'docker-compose'), compliant);
});

void test('Docker Compose ordering reports the first affected key in block and flow forms', () => {
  for(const input of [
    dockerCompose('    networks: []\n    depends_on: []\n    profiles: []\n    image: node\n    build: .\n    platform: linux/amd64\n'),
    'services: {app: {networks: [], depends_on: [], profiles: [], image: node, build: ., platform: linux/amd64}}\n',
  ]) {
    const issues = analyze(input, 'docker-compose').filter(e => e.rule === 'docker-compose/key-order');
    assert.deepEqual(issues.map(e => input.slice(e.start, e.end)), ['d']);
    assert.equal(issues[0]?.start, input.indexOf('depends_on'));
    assert.equal(analyze(check(input), 'docker-compose').length, 0);
  }
});

void test('quotes are removed for known numeric and boolean Docker Compose fields, including expose', () => {
  const input = dockerCompose('    cpus: "0.5"\n    mem_limit: "1024"\n    init: "true"\n    tty: "false"\n    expose: ["3000", "3001/udp"]\n    ports: [{target: "80", published: "8080", host_ip: 127.0.0.1, protocol: tcp}]\n    deploy:\n      replicas: "2"\n      resources:\n        limits: {cpus: "0.5", pids: "100"}\n    ulimits: {nofile: {soft: "1024", hard: "2048"}}\n    healthcheck: {disable: "true", retries: "3"}\n    volumes: [{type: bind, source: ./app, target: /app, read_only: "false"}]\n');
  const result = check(input);
  const doc = parseDocument(result);
  for(const [path, expected] of [
    [['expose', 0], 3000],
    [['ports', 0, 'target'], 80],
    [['ports', 0, 'published'], 8080],
    [['cpus'], 0.5],
    [['mem_limit'], 1024],
    [['init'], true],
    [['tty'], false],
    [['deploy', 'replicas'], 2],
    [['ulimits', 'nofile', 'soft'], 1024],
    [['healthcheck', 'disable'], true],
    [['volumes', 0, 'read_only'], false],
  ] as const) {
    assert.equal(doc.getIn(['services', 'app', ...path]), expected);
  }
  assert.equal(doc.getIn(['services', 'app', 'expose', 1]), '3001/udp');
  assert.equal(analyze(result, 'docker-compose').length, 0);
});
void test('safe numeric string maps and top-level Docker Compose options lose quotes', () => {
  const input = `${dockerCompose('    environment: {COUNT: "123", FLAG: "false", ZERO: "001"}\n    labels: {"example/count": "2"}\n    build: {context: ., args: {COUNT: "12"}, no_cache: "true"}\n')}networks:\n  default: {internal: "true", driver_opts: {mtu: "1500"}}\nvolumes:\n  data: {external: "false"}\n`;
  const result = check(input);
  const doc = parseDocument(result);
  assert.equal(doc.getIn(['services', 'app', 'environment', 'COUNT']), 123);
  assert.equal(doc.getIn(['services', 'app', 'environment', 'FLAG']), 'false');
  assert.equal(doc.getIn(['services', 'app', 'environment', 'ZERO']), '001');
  assert.equal(doc.getIn(['services', 'app', 'labels', 'example/count']), 2);
  assert.equal(doc.getIn(['services', 'app', 'build', 'no_cache']), true);
  assert.equal(doc.getIn(['networks', 'default', 'internal']), true);
  assert.equal(doc.getIn(['volumes', 'data', 'external']), false);
});
void test('unknown fields and ambiguous scalar spellings retain quotes', () => {
  const input = dockerCompose('    image: "123"\n    command: ["123", "false"]\n    cpus: "1.0"\n    mem_limit: "001024"\n    secrets: [{source: key, mode: "440"}]\n    x-custom: {expose: ["3000"], replicas: "2", tty: "true"}\n    provider: {type: custom, options: {count: "2", enabled: "true"}}\n');
  const quoteIssues = analyze(input, 'docker-compose').filter(e => e.rule === 'docker-compose/no-unnecessary-quotes');
  assert.equal(quoteIssues.length, 0);
});

void test('full anchored Redis example reports and fixes only the missing mount mode', async () => {
  const input = await readFile('src/rules/docker-compose/fixtures/redis.docker-compose.yaml', 'utf8');
  const issues = analyze(input, 'docker-compose').filter(e => e.rule === 'docker-compose/explicit-volume-mode');
  assert.equal(issues.length, 1);
  const issue = issues[0];
  assert.ok(issue?.edit);
  assert.equal(issue.start, input.indexOf('./redis-data:/data') + './redis-data:/data'.length);
  assert.equal(issue.end, issue.start);
  const quickFix = input.slice(0, issue.edit.start) + issue.edit.replacement + input.slice(issue.edit.end);
  assert.equal(quickFix, input.replace('./redis-data:/data', './redis-data:/data:ro'));
  const result = check(input);
  const before = parseDocument(input);
  const after = parseDocument(result);
  assert.equal(after.getIn(['services', 'redis', 'volumes', 0]), './healthcheck.sh:/app/healthcheck.sh:ro');
  assert.equal(after.getIn(['services', 'redis', 'volumes', 1]), './redis-data:/data:ro');
  for(const field of ['environment', 'command', 'healthcheck']) {
    const originalNode = before.getIn(['services', 'redis', field], true);
    const fixedNode = after.getIn(['services', 'redis', field], true);
    assert.ok(isNode(originalNode) && originalNode.range);
    assert.ok(isNode(fixedNode) && fixedNode.range);
    assert.equal(result.slice(fixedNode.range[0], fixedNode.range[2]), input.slice(originalNode.range[0], originalNode.range[2]));
  }
  assert.ok(result.includes('redis: &redis'));
  assert.ok(result.includes('# Warn: the default value seems to be 5s instead of interval value'));
  assert.equal(analyze(result, 'docker-compose').length, 0);
});
void test('anchored service definitions are fixed once and aliases retain their references', () => {
  const input = 'services:\n  redis: &redis\n    image: redis\n    volumes: [./redis-data:/data]\n  second: *redis\n  third: *redis\n';
  const issues = analyze(input, 'docker-compose').filter(e => e.rule === 'docker-compose/explicit-volume-mode');
  assert.equal(issues.length, 1);
  const result = check(input);
  assert.equal(result, input.replace('./redis-data:/data', './redis-data:/data:ro'));
  const value: unknown = parseDocument(result).toJS({ mapAsMap: true });
  assert.ok(value instanceof Map);
  const services = value.get('services');
  assert.ok(services instanceof Map);
  assert.deepEqual(services.get('redis'), services.get('second'));
  assert.deepEqual(services.get('redis'), services.get('third'));
});
void test('anchors on services and sequences do not suppress literal entries', () => {
  const input = 'services: &services\n  app:\n    ports: &ports\n      - 80:80\n      - "${PORT_MAPPING}"\n    volumes: &mounts\n      - ./app:/app\n      - "${MOUNT}"\n  other:\n    ports: *ports\n    volumes: *mounts\n';
  const issues = analyze(input, 'docker-compose');
  assert.equal(issues.filter(e => e.rule === 'docker-compose/explicit-volume-mode').length, 1);
  assert.equal(issues.filter(e => e.rule === 'docker-compose/explicit-port-host').length, 1);
  assert.equal(issues.filter(e => e.rule === 'docker-compose/explicit-port-protocol').length, 1);
  assert.equal(check(input), input.replace('80:80', '127.0.0.1:80:80/tcp').replace('./app:/app', './app:/app:ro'));
});
void test('short anchored scalar edits keep the anchor and inline comment', () => {
  const input = dockerCompose('    ports:\n      - &port "3000:3000" # port\n      - *port\n    volumes:\n      - &mount "./app:/app" # mount\n      - *mount\n');
  const result = check(input);
  assert.ok(result.includes('&port 127.0.0.1:3000:3000/tcp # port'));
  assert.ok(result.includes('&mount ./app:/app:ro # mount'));
  assert.ok(result.includes('- *port'));
  assert.ok(result.includes('- *mount'));
  assert.equal(analyze(result, 'docker-compose').length, 0);
});
void test('anchored long-form entries support block and flow syntax', () => {
  for(const input of [
    dockerCompose('    ports:\n      - &port\n        target: 80 # target\n      - *port\n    volumes:\n      - &mount\n        type: bind\n        source: ./app\n        target: /app\n      - *mount\n'),
    dockerCompose('    ports: [&port {target: 80}, *port]\n    volumes: [&mount {type: bind, source: ./app, target: /app}, *mount]\n'),
  ]) {
    const issues = analyze(input, 'docker-compose');
    assert.equal(issues.filter(e => e.rule === 'docker-compose/explicit-volume-mode').length, 1);
    const result = check(input);
    const doc = parseDocument(result);
    assert.ok(result.includes('&port'));
    assert.ok(result.includes('&mount'));
    assert.equal(doc.getIn(['services', 'app', 'ports', 0, 'host_ip']), '127.0.0.1');
    assert.equal(doc.getIn(['services', 'app', 'ports', 0, 'protocol']), 'tcp');
    assert.equal(doc.getIn(['services', 'app', 'volumes', 0, 'read_only']), true);
    assert.equal(analyze(result, 'docker-compose').length, 0);
  }
});
void test('anchored service ordering and type-preserving quotes are fixed safely', () => {
  for(const input of [
    'services:\n  app: &app\n    # command comment\n    command: "run"\n    # image comment\n    image: "node:22"\n  other: *app\n',
    'services: {app: &app {command: "run", image: "node:22"}, other: *app}\n',
  ]) {
    const result = check(input);
    assert.ok(result.indexOf('image: node') < result.indexOf('command: run'));
    assert.ok(result.includes('&app'));
    assert.ok(result.includes('*app'));
    assert.deepEqual(values(result), values(input));
    assert.equal(analyze(result, 'docker-compose').length, 0);
  }
  const forward = 'services:\n  app: &app\n    command: &value hi\n    image: *value\n';
  assert.equal(check(forward), forward);
  assert.ok(analyze(forward, 'docker-compose').some(e => e.rule === 'docker-compose/key-order' && e.edit === undefined));
});
void test('type-changing quote removal is withheld within shared definitions', () => {
  for(const input of [
    dockerCompose('    expose: &ports ["3000"]\n    command: *ports\n'),
    dockerCompose('    expose: [&port "3000"]\n    command: [*port]\n'),
  ]) {
    assert.equal(check(input), input);
    assert.equal(analyze(input, 'docker-compose').length, 0);
  }
  // Type-preserving quote removal still applies to the shared value itself.
  const input = dockerCompose('    image: &image "node:22"\n    command: [*image]\n');
  assert.equal(check(input), input.replace('"node:22"', 'node:22'));
});
void test('referenced templates are checked while tagged mappings stay untouched', () => {
  const input = 'x-template: &template\n  volumes: [./app:/app]\nservices:\n  app: &app\n    <<: *template\n  other: *app\n  tagged: !custom\n    volumes: [./app:/app]\n';
  assert.equal(check(input), input.replace('volumes: [./app:/app]', 'volumes: [./app:/app:ro]'));
  assert.equal(analyze(check(input), 'docker-compose').length, 0);
});

void test('numeric expose quotes are removed in anchored services and compatible aliases', () => {
  for(const input of [
    'services:\n  floor-plan-scanner: &floor-plan-scanner\n    expose:\n      - "3003"\n',
    'services:\n  app: &app\n    expose: ["3003"]\n  other: *app\n',
    dockerCompose('    expose: [&port "3003", *port]\n'),
    'services:\n  app:\n    expose: &ports ["3003"]\n  other:\n    expose: *ports\n',
  ]) {
    const issues = analyze(input, 'docker-compose').filter(e => e.rule === 'docker-compose/no-unnecessary-quotes');
    assert.equal(issues.length, 1);
    assert.equal(input.slice(issues[0]?.start, issues[0]?.end), '"');
    assert.equal(check(input), input.replace('"3003"', '3003'));
  }
});

void test('short port reports highlight missing components and invalid hosts precisely', () => {
  for(const quote of ['', '"', "'"]) {
    for(const [value, hostText, protocolText] of [
      ['3000:80', '3', '0'],
      ['80', '8', '0'],
      ['bad-host:8080:80', 'bad-host', '0'],
      ['bad-host:8080:80/tcp', 'bad-host', undefined],
      ['3000:80/invalid', '3', `${quote}3000:80/invalid${quote}`],
    ] as const) {
      const input = dockerCompose(`    ports:\n      - &port ${quote}${value}${quote} # port\n`);
      const issues = analyze(input, 'docker-compose');
      const host = issues.find(e => e.rule === 'docker-compose/explicit-port-host');
      const protocol = issues.find(e => e.rule === 'docker-compose/explicit-port-protocol');
      assert.ok(host);
      assert.equal(input.slice(host.start, host.end), hostText);
      if(protocolText === undefined) {
        assert.equal(protocol, undefined);
      } else {
        assert.ok(protocol);
        assert.equal(input.slice(protocol.start, protocol.end), protocolText);
      }
    }
  }
});

void test('long port invalid values retain their full report ranges', () => {
  const input = dockerCompose('    ports:\n      - target: 80\n        protocol: invalid\n        host_ip: bad-host\n');
  const issues = analyze(input, 'docker-compose');
  for(const [rule, expected] of [['explicit-port-protocol', 'invalid'], ['explicit-port-host', 'bad-host']] as const) {
    const issue = issues.find(e => e.rule === `docker-compose/${rule}`);
    assert.ok(issue);
    assert.equal(input.slice(issue.start, issue.end), expected);
  }
});

void test('missing volume modes report insertion positions and port hosts highlight their first character', () => {
  for(const quote of ['', '"', "'"]) {
    const input = dockerCompose(`    ports:\n      - &port ${quote}3000:3000/tcp${quote} # port\n    volumes:\n      - &mount ${quote}./app:/app${quote} # mount\n`);
    const issues = analyze(input, 'docker-compose');
    const host = issues.find(e => e.rule === 'docker-compose/explicit-port-host');
    const mode = issues.find(e => e.rule === 'docker-compose/explicit-volume-mode');
    assert.ok(host?.edit && mode?.edit);
    assert.equal(host.start, input.indexOf('3000:3000'));
    assert.equal(host.end, host.start + 1);
    assert.equal(mode.start, input.indexOf('./app:/app') + './app:/app'.length);
    assert.equal(mode.end, mode.start);
    assert.ok(check(input).includes('127.0.0.1:3000:3000/tcp'));
    assert.ok(check(input).includes('./app:/app:ro'));
  }
  for(const input of [
    dockerCompose('    ports: [{target: 3000, protocol: tcp}]\n    volumes: [{type: bind, source: ., target: /app}]\n'),
    dockerCompose('    ports:\n      - target: 3000\n        protocol: tcp\n    volumes:\n      - type: bind\n        source: .\n        target: /app\n'),
  ]) {
    for(const issue of analyze(input, 'docker-compose').filter(e => ['docker-compose/explicit-port-host', 'docker-compose/explicit-volume-mode'].includes(e.rule))) {
      assert.ok(issue.edit);
      assert.equal(issue.start, issue.edit.start);
      assert.equal(issue.end, issue.start);
    }
  }
});
