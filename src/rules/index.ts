import type { FileKind, Issue } from '../types';
import { dockerComposeIssues } from './docker-compose';
import { packageJsonIssues } from './package-json';

export const analyze = (text: string, kind: FileKind): Issue[] => kind === 'package-json' ? packageJsonIssues(text) : dockerComposeIssues(text);
export const fix = (text: string, kind: FileKind): string => {
  let result = text;
  const seen = new Set<string>();
  while(!seen.has(result)) {
    seen.add(result);
    const issue = analyze(result, kind).find(e => e.edit !== undefined);
    const edit = issue?.edit;
    if(!edit) {
      return result;
    }
    const next = result.slice(0, edit.start) + edit.replacement + result.slice(edit.end);
    if(analyze(next, kind).some(e => e.rule.startsWith('syntax/'))) {
      return result;
    }
    result = next;
  }

  return result;
};
