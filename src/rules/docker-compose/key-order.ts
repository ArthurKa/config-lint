import { isNode, isScalar, type YAMLMap } from 'yaml';
import { dockerComposeBottom, dockerComposeTop } from '../../constants';
import type { Edit, Issue } from '../../types';
import { equivalent, issueAt, scalarKey } from '../../utils/docker-compose/yaml';
import { firstOrderingChange, rank } from '../../utils/ordering';
import { apply, eolOf, lineStart } from '../../utils/text';

const commentStart = (text: string, offset: number): number => {
  let start = lineStart(text, offset);
  const indent = offset - start;
  while(start > 0) {
    const previous = lineStart(text, start - 1);
    const line = text.slice(previous, start).trimEnd();
    if(line.trim() !== '' && !line.startsWith(`${' '.repeat(indent)}#`)) {
      break;
    }
    start = previous;
  }

  return start;
};
export const orderIssue = (text: string, mapping: YAMLMap): Issue[] => {
  const pairs = mapping.items;
  const sorted = pairs.toSorted((a, b) => (
    rank(scalarKey(a.key), dockerComposeTop, dockerComposeBottom) - rank(scalarKey(b.key), dockerComposeTop, dockerComposeBottom)
  ));
  if(sorted.every((e, i) => e === pairs[i]) || !mapping.range) {
    return [];
  }
  let edit: Edit | undefined;
  if(mapping.flow === true) {
    const spans = pairs.map(e => {
      if(!isScalar(e.key) || !e.key.range || !isNode(e.value) || !e.value.range) {
        return undefined;
      }

      return { start: e.key.range[0], end: e.value.range[1] };
    });
    const first = spans[0];
    const last = spans.at(-1);
    if(first && last && spans.every(e => e !== undefined)) {
      const chunks = new Map(pairs.map((e, i) => [e, text.slice(spans[i]?.start, spans[i]?.end)] as const));
      edit = {
        start: first.start,
        end: last.end,
        replacement: sorted.map((e, i) => {
          const previous = spans[i - 1];
          const current = spans[i];

          return (previous && current ? text.slice(previous.end, current.start) : '') + chunks.get(e);
        }).join(''),
      };
    }
  } else if(pairs.every(e => isScalar(e.key) && e.key.range !== undefined)) {
    const starts = pairs.map(e => commentStart(text, isScalar(e.key) ? e.key.range?.[0] ?? 0 : 0));
    const end = mapping.range[1];
    const eol = eolOf(text);
    const chunks = new Map(pairs.map((e, i) => [e, text.slice(starts[i], starts[i + 1] ?? end).replace(/\r?\n$/u, '')] as const));
    edit = { start: starts[0] ?? 0, end, replacement: sorted.map(e => chunks.get(e)).join(eol) + (text[end - 1] === '\n' ? eol : '') };
  }
  // Reordering must not break aliases, change block-scalar values, or lose comments.
  if(edit && !equivalent(text, apply(text, edit), '1.2')) {
    edit = undefined;
  }

  const affected = firstOrderingChange(pairs, sorted);

  return affected ? [issueAt('docker-compose/key-order', 'Use the configured Docker Compose property order.', affected.key, edit)] : [];
};
