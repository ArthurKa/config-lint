import ignore from 'ignore';
import type { FileKind } from '../types';

export const fileKind = (relative: string): FileKind | undefined => {
  if(relative.startsWith('../') || relative.startsWith('/') || relative.split('/').some(e => e === '.git' || e === 'node_modules')) {
    return undefined;
  }
  const name = relative.split('/').at(-1);
  if(name === 'package.json') {
    return 'package-json';
  }

  if(/^Dockerfile(?:[.-].+)?$/u.test(name ?? '')) {
    return 'dockerfile';
  }

  return /^(?:docker-)?compose(?:[.-].+)?\.ya?ml$/u.test(name ?? '') ? 'docker-compose' : undefined;
};
export const eligibleKind = async (relative: string, readIgnore: (directory: string) => Promise<string> | string): Promise<FileKind | undefined> => {
  const kind = fileKind(relative);
  if(!kind) {
    return undefined;
  }
  const parts = relative.split('/');
  const matchers: Array<{ prefix: string; matcher: ReturnType<typeof ignore> }> = [];
  for(let depth = 0; depth < parts.length; depth++) {
    const directory = parts.slice(0, depth).join('/');
    matchers.push({ prefix: directory === '' ? '' : `${directory}/`, matcher: ignore().add(await readIgnore(directory)) });
    const candidate = parts.slice(0, depth + 1).join('/') + (depth < parts.length - 1 ? '/' : '');
    let excluded = false;
    for(const { prefix, matcher } of matchers) {
      const test = matcher.test(candidate.slice(prefix.length));
      if(test.ignored) {
        excluded = true;
      }
      if(test.unignored) {
        excluded = false;
      }
    }
    if(excluded) {
      return undefined;
    }
  }

  return kind;
};
