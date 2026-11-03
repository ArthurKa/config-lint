import type { Node } from 'jsonc-parser';
import { packageJsonBottom, packageJsonTop } from '../../constants';
import type { Issue } from '../../types';
import { firstOrderingChange, rank } from '../ordering';

export const sort = (text: string, node: Node, alphabetical: boolean): Issue[] => {
  const issues: Issue[] = [];
  const children = node.children ?? [];
  const sorted = children.toSorted((a, b) => {
    const x = String(a.children?.[0]?.value);
    const y = String(b.children?.[0]?.value);
    if(!alphabetical) {
      return rank(x, packageJsonTop, packageJsonBottom) - rank(y, packageJsonTop, packageJsonBottom);
    }

    return x < y ? -1 : Number(x > y);
  });
  if(sorted.every((e, i) => e === children[i])) {
    return [];
  }
  const first = children[0];
  const last = children.at(-1);
  if(!first || !last) {
    return [];
  }
  const replacement = sorted.map((e, i) => {
    const previous = children[i - 1];
    const current = children[i];
    const separator = previous && current ? text.slice(previous.offset + previous.length, current.offset) : '';

    return separator + text.slice(e.offset, e.offset + e.length);
  }).join('');
  const affected = firstOrderingChange(children, sorted);
  if(affected) {
    const key = affected.children?.[0];
    issues.push({
      rule: alphabetical ? 'package-json/sort-dependency-keys' : 'package-json/top-level-order',
      message: alphabetical ? 'Sort dependency names alphabetically.' : 'Use the configured package.json property order.',
      start: key?.offset ?? affected.offset,
      end: (key?.offset ?? affected.offset) + (key?.length ?? 1),
      edit: { start: first.offset, end: last.offset + last.length, replacement },
    });
  }

  return issues;
};
