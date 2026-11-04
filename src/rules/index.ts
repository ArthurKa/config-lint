import type { FileKind, Issue } from '../types';
import { dockerComposeIssues } from './docker-compose';
import { dockerfileIssues } from './dockerfile';
import { packageJsonIssues } from './package-json';

const analyzers = { 'package-json': packageJsonIssues, 'docker-compose': dockerComposeIssues, dockerfile: dockerfileIssues };
export const analyze = (text: string, kind: FileKind): Issue[] => analyzers[kind](text);
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
