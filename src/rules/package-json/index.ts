import { type Node, type ParseError, parseTree } from 'jsonc-parser';
import { dependencyFields } from '../../constants';
import type { Issue } from '../../types';
import { sortDependencyKeys } from './sort-dependency-keys';
import { topLevelOrder } from './top-level-order';

export const packageJsonIssues = (text: string): Issue[] => {
  const errors: ParseError[] = [];
  const root = parseTree(text, errors, { disallowComments: true, allowTrailingComma: false });
  if(errors.length > 0 || root?.type !== 'object') {
    const start = errors[0]?.offset ?? 0;

    return [{ rule: 'syntax/invalid-json', message: 'Expected a valid JSON object.', start, end: start + 1 }];
  }
  const issues: Issue[] = [];
  const duplicateKeys = (node: Node): void => {
    if(node.type === 'object') {
      const seen = new Set<string>();
      for(const property of node.children ?? []) {
        const key = property.children?.[0];
        if(!key) {
          continue;
        }
        const name = String(key.value);
        if(seen.has(name)) {
          issues.push({ rule: 'syntax/duplicate-key', message: `Duplicate key: ${name}.`, start: key.offset, end: key.offset + key.length });
        }
        seen.add(name);
      }
    }
    for(const child of node.children ?? []) {
      duplicateKeys(child);
    }
  };
  duplicateKeys(root);
  if(issues.length > 0) {
    return issues;
  }
  for(const property of root.children ?? []) {
    const value = property.children?.[1];
    if(dependencyFields.has(String(property.children?.[0]?.value)) && value?.type === 'object') {
      issues.push(...sortDependencyKeys(text, value));
    }
  }
  issues.push(...topLevelOrder(text, root));

  return issues;
};
