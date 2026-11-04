import assert from 'assert/strict';
import { test } from 'node:test';
import { eligibleKind, fileKind } from './eligibility';

void test('file patterns', () => {
  for(const name of ['package.json', 'apps/api/package.json', 'compose.yaml', 'a/compose.override.yml', 'docker-compose-dev.yaml']) {
    assert.ok(fileKind(name));
  }
  for(const name of ['package.json.bak', 'my-compose.yml', 'node_modules/foo/package.json', '.git/compose.yml', '../package.json']) {
    assert.equal(fileKind(name), undefined);
  }
});
void test('nested ignore overrides and excluded parent directories', async () => {
  const files: Record<string, string> = { '': '*.json\n!package.json\nblocked/\n', apps: '!package.json\n', 'apps/api': '!package.json\n', blocked: '!package.json\n' };
  const read = (directory: string): string => files[directory] ?? '';
  assert.equal(await eligibleKind('apps/api/package.json', read), 'package-json');
  assert.equal(await eligibleKind('blocked/package.json', read), undefined);
  assert.equal(await eligibleKind('node_modules/package.json', read), undefined);
  assert.equal(await eligibleKind('apps/package.json', e => e === '' ? '**/package.json' : '!package.json'), 'package-json');
  assert.equal(await eligibleKind('package.json', () => '/package.json'), undefined);
  assert.equal(await eligibleKind('apps/package.json', e => e === '' ? '/package.json' : ''), 'package-json');
});
void test('Dockerfile variants share workspace exclusions and nested ignores', async () => {
  for(const name of ['Dockerfile', 'apps/api/Dockerfile.dev', 'Dockerfile-dev']) {
    assert.equal(fileKind(name), 'dockerfile');
  }
  for(const name of ['dockerfile', 'api.Dockerfile', 'Dockerfile.', 'Dockerfile-', '.git/Dockerfile', 'node_modules/Dockerfile', '../Dockerfile', '/Dockerfile']) {
    assert.equal(fileKind(name), undefined);
  }
  assert.equal(await eligibleKind('apps/Dockerfile', e => e === '' ? '**/Dockerfile' : '!Dockerfile'), 'dockerfile');
  assert.equal(await eligibleKind('apps/Dockerfile', () => 'apps/'), undefined);
  assert.equal(await eligibleKind('Dockerfile.dev', () => 'Dockerfile.*'), undefined);
});
