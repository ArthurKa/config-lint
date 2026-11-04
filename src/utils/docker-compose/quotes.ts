import { isScalar, parseDocument } from 'yaml';
import { dockerComposeScalarPolicy } from '../../constants';
import { nodePaths, type ScalarPath } from './resolution';

export const scalarPaths = nodePaths;

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
