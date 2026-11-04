import { isMap, isScalar, isSeq, parseDocument } from 'yaml';
import type { Issue } from '../../types';
import { applyDirectives } from '../../utils/docker-compose/directives';
import { composeResolver, nodePaths } from '../../utils/docker-compose/resolution';
import { blocked, issueAt, scalarEdit, scalarIssueRange } from '../../utils/docker-compose/yaml';
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
  const resolver = composeResolver(document);
  const paths = nodePaths(document);
  const inspectEntry = (item: unknown, field: string): Issue[] => {
    const foundIssues: Issue[] = [];
    const entry = resolver.resolve(item);
    const usages = paths.get(entry);
    const compatible = usages !== undefined && usages.length > 0 && usages.every(e => (
      e !== null && e.length === 4 && e[0] === 'services' && e[2] === field && typeof e[3] === 'number'
    ));
    const addIssues = (found: Issue[]): void => {
      foundIssues.push(...found.map(e => {
        if(compatible) {
          return e;
        }
        const { edit: _edit, ...report } = e;

        return report;
      }));
    };
    if(isMap(entry) && entry.tag === undefined) {
      const long = resolver.entries(entry);
      const fields = new Map([...long.fields].map(([key, value]) => [key, resolver.resolve(value)] as const));
      if(long.complete) {
        addIssues(longIssues(text, entry, field, fields));
      }
      if([...fields.values()].some(blocked)) {
        skipped.add(entry);
      }

      return foundIssues;
    }
    if(blocked(entry)) {
      skipped.add(entry);

      return foundIssues;
    }
    if(!isScalar(entry) || (typeof entry.value !== 'string' && !(field === 'ports' && typeof entry.value === 'number'))) {
      return foundIssues;
    }
    const problems = field === 'ports' ? portProblems(String(entry.value)) : volumeProblems(String(entry.value));
    for(const problem of problems) {
      const edit = problem.fixed === undefined ? undefined : scalarEdit(text, entry, problem.fixed);
      const issue = issueAt(problem.rule, problem.message, entry, edit);
      addIssues([scalarIssueRange(text, issue, entry)]);
    }

    return foundIssues;
  };
  const services = resolver.resolve(document.get('services', true));
  if(isMap(services) && services.tag === undefined) {
    for(const service of resolver.entries(services).fields.values()) {
      const mapping = resolver.resolve(service);
      if(!isMap(mapping) || mapping.tag !== undefined) {
        continue;
      }
      const effective = resolver.entries(mapping);
      for(const source of effective.mappings) {
        ordering.push(...orderIssue(text, source));
      }
      if(effective.complete) {
        const fields = new Map([...effective.fields].map(([key, value]) => [key, resolver.resolve(value)] as const));
        issues.push(...pinnedImage(fields));
      }
      for(const field of ['volumes', 'ports']) {
        const entries = resolver.resolve(effective.fields.get(field));
        if(!isSeq(entries) || entries.tag !== undefined) {
          continue;
        }
        for(const item of entries.items) {
          issues.push(...inspectEntry(item, field));
        }
      }
    }
  }
  issues.push(...ordering);
  issues.push(...quoteIssues(text, document, skipped));

  const unique = issues.filter((issue, i) => issues.findIndex(e => (
    e.rule === issue.rule && e.start === issue.start && e.end === issue.end
  )) === i);

  return applyDirectives(text, unique);
};
