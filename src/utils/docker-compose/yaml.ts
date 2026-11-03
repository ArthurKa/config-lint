import { isAlias, isMap, isNode, isScalar, parseDocument, type Scalar, type YAMLMap } from 'yaml';
import type { Edit, Issue } from '../../types';
import { dynamic } from '../ordering';
import { apply, eolOf, lineStart } from '../text';

export const blocked = (node: unknown): boolean => {
  if(!isNode(node)) {
    return false;
  }
  if(isAlias(node) || node.tag !== undefined) {
    return true;
  }
  if(isScalar(node)) {
    return typeof node.value === 'string' && dynamic(node.value);
  }
  if(isMap(node)) {
    return node.has('<<') || node.items.some(e => blocked(e.key) || blocked(e.value));
  }

  return node.items.some(blocked);
};
export const scalarKey = (node: unknown): string => isScalar(node) ? String(node.value) : '';
export const canonical = (value: unknown): unknown => {
  if(Array.isArray(value)) {
    return value.map(canonical);
  }
  if(value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).toSorted(([a], [b]) => a < b ? -1 : Number(a > b)).map(([key, item]) => [key, canonical(item)]));
  }

  return value;
};
export const equivalent = (before: string, after: string, version: '1.1' | '1.2'): boolean => {
  try {
    const a = parseDocument(before, { version, uniqueKeys: true });
    const b = parseDocument(after, { version, uniqueKeys: true });

    return a.errors.length === 0 && b.errors.length === 0 && JSON.stringify(canonical(a.toJS())) === JSON.stringify(canonical(b.toJS()));
  } catch {
    return false;
  }
};
export const plainSafe = (value: string): boolean => {
  if(value === '' || value.trim() !== value || /[\r\n]/u.test(value)) {
    return false;
  }

  return (['1.1', '1.2'] as const).every(version => {
    const document = parseDocument(`value: ${value}`, { version });

    return document.errors.length === 0 && document.get('value') === value;
  });
};
export const scalarEdit = (text: string, node: Scalar, value: string): Edit | undefined => {
  if(!node.range) {
    return undefined;
  }
  const edit = { start: node.range[0], end: node.range[1], replacement: JSON.stringify(value) };
  if(plainSafe(value) && equivalent(apply(text, edit), apply(text, { ...edit, replacement: value }), '1.2')) {
    edit.replacement = value;
  }

  return edit;
};
export const issueAt = (rule: string, message: string, node: unknown, edit?: Edit): Issue => {
  const range = isNode(node) ? node.range : undefined;

  return { rule, message, start: range?.[0] ?? 0, end: range?.[1] ?? 1, ...(edit === undefined ? {} : { edit }) };
};
export const missingValueRange = (issue: Issue, node: Scalar): Issue => {
  if(!issue.edit || !node.range) {
    return issue;
  }
  const quoted = node.type === 'QUOTE_DOUBLE' || node.type === 'QUOTE_SINGLE';
  if(issue.rule === 'docker-compose/explicit-volume-mode') {
    const start = node.range[1] - Number(quoted);

    return { ...issue, start, end: start };
  }
  if(issue.rule === 'docker-compose/explicit-port-host') {
    const start = node.range[0] + Number(quoted);

    return { ...issue, start, end: start };
  }

  return issue;
};
export const addProperty = (text: string, mapping: YAMLMap, key: string, value: string): Edit | undefined => {
  if(!mapping.range) {
    return undefined;
  }
  if(mapping.flow === true) {
    const start = mapping.range[0] + 1;

    return { start, end: start, replacement: `${key}: ${value}${mapping.items.length > 0 ? ', ' : ''}` };
  }
  const first = mapping.items[0]?.key;
  if(!isScalar(first) || !first.range) {
    return undefined;
  }
  const start = first.range[0];
  const indent = start - lineStart(text, start);

  return { start, end: start, replacement: `${key}: ${value}${eolOf(text)}${' '.repeat(indent)}` };
};
