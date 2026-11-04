import { type Document, isAlias, isNode, isScalar, parseDocument, visit } from 'yaml';
import type { Issue } from '../../types';
import { equivalentDockerComposeScalar, scalarPaths } from '../../utils/docker-compose/quotes';
import { equivalent, issueAt } from '../../utils/docker-compose/yaml';
import { dynamic } from '../../utils/ordering';
import { apply } from '../../utils/text';

export const quoteIssues = (text: string, document: Document, skipped: Set<unknown>): Issue[] => {
  const issues: Issue[] = [];
  const paths = scalarPaths(document);
  visit(document, (_key, node) => {
    if(isAlias(node) || skipped.has(node)) {
      return visit.SKIP;
    }
    if(isNode(node) && node.tag !== undefined) {
      return visit.SKIP;
    }
    if(!isScalar(node) || typeof node.value !== 'string' || !node.range || dynamic(node.value) || !['QUOTE_DOUBLE', 'QUOTE_SINGLE'].includes(node.type ?? '') || /[\r\n]/u.test(node.value)) {
      return undefined;
    }
    const edit = { start: node.range[0], end: node.range[1], replacement: node.value };
    const candidate = apply(text, edit);
    const same = (['1.1', '1.2'] as const).every(e => equivalent(text, candidate, e));
    const usages = paths.get(node);
    const { value } = node;
    const sameComposeValue = (
      usages !== undefined
      && usages.length > 0
      && usages.every(e => equivalentDockerComposeScalar(value, e))
      && parseDocument(candidate).errors.length === 0
    );
    if(same || sameComposeValue) {
      issues.push({ ...issueAt('docker-compose/no-unnecessary-quotes', 'Remove unnecessary quotes.', node, edit), end: node.range[0] + 1 });
    }

    return undefined;
  });

  return issues;
};
