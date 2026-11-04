import type { Issue } from '../../types';
import { applyCommentDirectives } from '../directives';
import { parseDockerfile } from './parser';

const signature = (text: string): string => {
  const { document } = parseDockerfile(text);

  return JSON.stringify({
    directives: document.getDirectives().map(e => e.toString()),
    instructions: document.getInstructions().map(e => [e.getKeyword(), e.getArgumentsContent()]),
  });
};
export const applyDirectives = (text: string, issues: Issue[]): Issue[] => applyCommentDirectives(text, issues, {
  rules: new Set(['dockerfile/pinned-image']),
  comments(source) {
    const { document, range } = parseDockerfile(source);

    return document.getComments().map(e => {
      const span = range(e.getRange());

      return { ...span, source: source.slice(span.start, span.end) };
    });
  },
  anchor(source, issue) {
    const { document, range } = parseDockerfile(source);
    const instruction = document.getFROMs().find(e => {
      const span = range(e.getRange());

      return span.start <= issue.start && span.end >= issue.end;
    });

    return instruction ? range(instruction.getRange()).start : issue.start;
  },
  fileStart(source) {
    const { document, range } = parseDockerfile(source);
    const last = document.getDirectives().at(-1);
    if(!last) {
      return Number(source.startsWith('\uFEFF'));
    }
    const { end } = range(last.getRange());

    return end + (/^\r?\n/u.exec(source.slice(end))?.[0].length ?? 0);
  },
  equivalent: (before, after) => signature(before) === signature(after),
});
