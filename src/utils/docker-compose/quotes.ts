import { type Document, isAlias, isMap, isNode, isScalar, isSeq, parseDocument, type Scalar } from 'yaml';
import { dockerComposeScalarPolicy } from '../../constants';

export type ScalarPath = Array<string | number>;
// Track every use of a scalar, including aliases, before changing its YAML type.
export const scalarPaths = (document: Document): Map<Scalar, Array<ScalarPath | null>> => {
  const paths = new Map<Scalar, Array<ScalarPath | null>>();
  let remaining = 10000;
  const state = { complete: true };
  const effectiveEntries = (node: unknown, ancestors: Set<unknown>): Map<string, unknown> => {
    remaining--;
    if(remaining < 0 || ancestors.has(node)) {
      state.complete = false;

      return new Map<string, unknown>();
    }
    const next = new Set(ancestors).add(node);
    if(isAlias(node)) {
      return effectiveEntries(node.resolve(document), next);
    }
    if(!isMap(node) || node.tag !== undefined) {
      state.complete = false;

      return new Map<string, unknown>();
    }
    const entries = new Map<string, unknown>();
    for(const pair of node.items) {
      if(!isScalar(pair.key) || typeof pair.key.value !== 'string') {
        state.complete = false;
        continue;
      }
      if(pair.key.value !== '<<') {
        entries.set(pair.key.value, pair.value);
      }
    }
    for(const pair of node.items) {
      if(!isScalar(pair.key) || pair.key.value !== '<<') {
        continue;
      }
      if(pair.key.type !== 'PLAIN') {
        state.complete = false;
        continue;
      }
      const source = isAlias(pair.value) ? pair.value.resolve(document) : pair.value;
      const sources = isSeq(source) ? source.items : [source];
      for(const item of sources) {
        for(const [key, value] of effectiveEntries(item, next)) {
          if(!entries.has(key)) {
            entries.set(key, value);
          }
        }
      }
    }

    return entries;
  };
  const walk = (node: unknown, path: ScalarPath | null, ancestors: Set<unknown>): void => {
    if(!isNode(node)) {
      return;
    }
    remaining--;
    if(remaining < 0 || ancestors.has(node)) {
      state.complete = false;
      return;
    }
    const next = new Set(ancestors).add(node);
    if(isAlias(node)) {
      walk(node.resolve(document), path, next);
      return;
    }
    const context = node.tag === undefined ? path : null;
    if(isScalar(node)) {
      const usages = paths.get(node) ?? [];
      usages.push(context);
      paths.set(node, usages);
    }
    if(isSeq(node)) {
      for(const [index, e] of node.items.entries()) {
        walk(e, context === null ? null : [...context, index], next);
      }
    }
    if(isMap(node)) {
      for(const pair of node.items) {
        walk(pair.key, null, next);
      }
      for(const [key, value] of effectiveEntries(node, new Set())) {
        walk(value, context === null ? null : [...context, key], next);
      }
    }
  };
  walk(document.contents, [], new Set());

  if(!state.complete) {
    paths.clear();
  }

  return paths;
};
export const equivalentDockerComposeScalar = (value: string, path: ScalarPath | null | undefined): boolean => {
  if(!path) {
    return false;
  }
  const policy = dockerComposeScalarPolicy.find(e => e.path.length === path.length && e.path.every((segment, index) => {
    const actual = path[index];
    if(segment === '*') {
      return typeof actual === 'string';
    }
    if(segment === '#') {
      return typeof actual === 'number';
    }

    return segment === actual;
  }));
  if(!policy) {
    return false;
  }
  const parsed = (['1.1', '1.2'] as const).map(version => parseDocument(value, { version }));
  if(parsed.some(e => e.errors.length > 0)) {
    return false;
  }
  const a = parsed[0].contents;
  const b = parsed[1].contents;
  if(!isScalar(a) || !isScalar(b) || a.value !== b.value) {
    return false;
  }
  if(typeof a.value === 'boolean') {
    return policy.types.includes('boolean') && String(a.value) === value;
  }
  if(typeof a.value !== 'number' || !Number.isFinite(a.value) || String(a.value) !== value) {
    return false;
  }
  // Canonical decimal spelling avoids octal, exponents, rounding and leading zeros.
  if(!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value)) {
    return false;
  }
  if(Number.isInteger(a.value) && !Number.isSafeInteger(a.value)) {
    return false;
  }
  const port = policy.path.includes('ports') || policy.path.includes('expose');
  if(port && (!Number.isInteger(a.value) || a.value < (policy.path.at(-1) === 'published' ? 0 : 1) || a.value > 65535)) {
    return false;
  }

  return policy.types.includes('number') || (policy.types.includes('integer') && Number.isInteger(a.value));
};
