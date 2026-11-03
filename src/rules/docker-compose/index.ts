import { isMap, isScalar, isSeq, parseDocument } from 'yaml';
import type { Issue } from '../../types';
import { applyDirectives } from '../../utils/docker-compose/directives';
import { blocked, issueAt, missingValueRange, scalarEdit } from '../../utils/docker-compose/yaml';
import { longIssues, portProblems, volumeProblems } from './entries';
import { orderIssue } from './key-order';
import { quoteIssues } from './no-unnecessary-quotes';
import { pinnedImage } from './pinned-image';

export const dockerComposeIssues = (text: string): Issue[] => {
  const document = parseDocument(text, { keepSourceTokens: true, uniqueKeys: true });
  if(document.errors.length > 0) {
    return document.errors.map(e => ({ rule: 'syntax/invalid-yaml', message: e.message, start: e.pos[0], end: e.pos[1] }));
  }
  if(!isMap(document.contents)) {
    return [issueAt('syntax/invalid-yaml', 'Expected a Docker Compose mapping.', document.contents)];
  }
  const issues: Issue[] = [];
  const ordering: Issue[] = [];
  const skipped = new Set<unknown>();
  const services = document.get('services', true);
  if(isMap(services) && services.tag === undefined) {
    for(const service of services.items) {
      const mapping = service.value;
      if(!isMap(mapping) || mapping.tag !== undefined || mapping.has('<<')) {
        continue;
      }
      ordering.push(...orderIssue(text, mapping));
      issues.push(...pinnedImage(mapping));
      for(const field of ['volumes', 'ports']) {
        const entries = mapping.get(field, true);
        if(!isSeq(entries) || entries.tag !== undefined) {
          continue;
        }
        for(const entry of entries.items) {
          if(blocked(entry)) {
            skipped.add(entry);
            continue;
          }
          if(isMap(entry)) {
            issues.push(...longIssues(text, entry, field));
            continue;
          }
          if(!isScalar(entry) || (typeof entry.value !== 'string' && !(field === 'ports' && typeof entry.value === 'number'))) {
            continue;
          }
          const problems = field === 'ports' ? portProblems(String(entry.value)) : volumeProblems(String(entry.value));
          for(const problem of problems) {
            const edit = problem.fixed === undefined ? undefined : scalarEdit(text, entry, problem.fixed);
            const issue = issueAt(problem.rule, problem.message, entry, edit);
            issues.push(missingValueRange(issue, entry));
          }
        }
      }
    }
  }
  issues.push(...ordering);
  issues.push(...quoteIssues(text, document, skipped));

  return applyDirectives(text, issues);
};
