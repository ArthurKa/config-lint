import { Parser } from 'yaml';
import type { Issue } from '../../types';
import { applyCommentDirectives, type SourceComment } from '../directives';
import { equivalent } from './yaml';

const rules = new Set(['explicit-port-host', 'explicit-port-protocol', 'explicit-volume-mode', 'invalid-port', 'invalid-volume', 'key-order', 'no-unnecessary-quotes', 'pinned-image'].map(e => `docker-compose/${e}`));
const comments = (text: string): SourceComment[] => {
  const result: SourceComment[] = [];
  const visit = (value: unknown): void => {
    if(value === null || typeof value !== 'object') {
      return;
    }
    if('type' in value && value.type === 'comment' && 'source' in value && typeof value.source === 'string' && 'offset' in value && typeof value.offset === 'number') {
      result.push({ start: value.offset, end: value.offset + value.source.length, source: value.source });
      return;
    }
    for(const child of Object.values(value)) {
      visit(child);
    }
  };
  for(const token of new Parser().parse(text)) {
    visit(token);
  }

  return result.toSorted((a, b) => a.start - b.start);
};
export const applyDirectives = (text: string, issues: Issue[], suggestions = true): Issue[] => applyCommentDirectives(text, issues, {
  rules, comments, anchor: (_text, issue) => issue.start, fileStart: e => Number(e.startsWith('\uFEFF')), equivalent: (before, after) => equivalent(before, after, '1.2'),
}, suggestions);
