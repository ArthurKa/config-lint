import type { Edit, Issue } from '../types';
import { eolOf, lineStart } from './text';

export type SourceComment = { start: number; end: number; source: string };
type Directive = SourceComment & { kind: string; names: string[]; used: Set<string>; line: number };
type DirectiveOptions = {
  rules: Set<string>;
  comments: (text: string) => SourceComment[];
  anchor: (text: string, issue: Issue) => number;
  fileStart: (text: string) => number;
  equivalent: (before: string, after: string) => boolean;
};
const line = (text: string, offset: number): number => text.slice(0, offset).split('\n').length;
const removal = (text: string, directive: Directive, name?: string): Edit => {
  if(name !== undefined && name !== '' && directive.names.length > 1) {
    const names = directive.names.filter(e => e !== name);
    const reason = directive.source.includes(' --') ? directive.source.slice(directive.source.indexOf(' --')) : '';

    return { start: directive.start, end: directive.end, replacement: `# ${directive.kind} ${names.join(', ')}${reason}` };
  }
  const start = lineStart(text, directive.start);
  const standalone = text.slice(start, directive.start).trim() === '';

  return { start: standalone ? start : directive.start, end: directive.end + (standalone ? /^\r?\n/u.exec(text.slice(directive.end))?.[0].length ?? 0 : 0), replacement: '' };
};
export const applyCommentDirectives = (text: string, issues: Issue[], options: DirectiveOptions, suggestions = true): Issue[] => {
  const { rules } = options;
  const directives = options.comments(text).flatMap(e => {
    const match = /^(?<kind>config-lint-[\w-]+)(?<parameters>[\s\S]*)$/u.exec(e.source.slice(1).trim());
    if(!match) {
      return [];
    }
    const names = (match.groups?.parameters ?? '').split(' --')[0]?.trim() ?? '';

    return [{ ...e, kind: match.groups?.kind ?? '', names: names ? names.split(',').map(e => e.trim()) : [], used: new Set<string>(), line: line(text, e.start) }];
  }).toSorted((a, b) => a.start - b.start);
  const valid = directives.filter(e => ['config-lint-disable', 'config-lint-enable', 'config-lint-disable-next-line'].includes(e.kind));
  for(const directive of valid) {
    if(directive.kind !== 'config-lint-enable') {
      continue;
    }
    for(const rule of rules) {
      if(directive.names.length > 0 && !directive.names.includes(rule)) {
        continue;
      }
      const previous = valid.findLast(e => e.start < directive.start && e.kind !== 'config-lint-disable-next-line' && (e.names.length === 0 || e.names.includes(rule)));
      if(previous?.kind === 'config-lint-disable') {
        directive.used.add(rule);
      }
    }
  }
  const visible = issues.filter(issue => {
    if(!rules.has(issue.rule)) {
      return true;
    }
    let active: Directive | undefined;
    for(const directive of valid) {
      if(directive.start > issue.start || (directive.names.length > 0 && !directive.names.includes(issue.rule))) {
        continue;
      }
      if(directive.kind === 'config-lint-disable') {
        active = directive;
      }
      if(directive.kind === 'config-lint-enable') {
        if(active) {
          directive.used.add(issue.rule);
        }
        active = undefined;
      }
    }
    active ??= valid.findLast(e => e.kind === 'config-lint-disable-next-line' && e.line + 1 === line(text, options.anchor(text, issue)) && (e.names.length === 0 || e.names.includes(issue.rule)));
    if(active) {
      active.used.add(issue.rule);

      return false;
    }

    return true;
  }).map(issue => {
    const result = { ...issue };
    if(result.edit && directives.some(e => e.start >= (result.edit?.start ?? 0) && e.start < (result.edit?.end ?? 0))) {
      delete result.edit;
    }
    if(suggestions && rules.has(issue.rule)) {
      result.suggestions = [];
      for(const file of [false, true]) {
        const start = file ? options.fileStart(text) : lineStart(text, options.anchor(text, issue));
        const existing = valid.find(e => file ? e.start === start : (
          e.line + 1 === line(text, options.anchor(text, issue)) && e.kind === 'config-lint-disable-next-line'
        ));
        const kind = file ? 'config-lint-disable' : 'config-lint-disable-next-line';
        const edit: Edit = (
          existing?.kind === kind && existing.names.length > 0
            ? { start: existing.start, end: existing.end, replacement: existing.source.replace(existing.names.at(-1) ?? '', `${existing.names.at(-1) ?? ''}, ${issue.rule}`) }
            : { start, end: start, replacement: `${file ? '' : /^\s*/u.exec(text.slice(start, options.anchor(text, issue)))?.[0] ?? ''}# ${kind} ${issue.rule}${eolOf(text)}` }
        );
        const next = text.slice(0, edit.start) + edit.replacement + text.slice(edit.end);
        if(!options.equivalent(text, next)) {
          continue;
        }
        const shift = edit.replacement.length - (edit.end - edit.start);
        const shifted = { ...issue, start: issue.start + shift, end: issue.end + shift };
        if(applyCommentDirectives(next, [shifted], options, false).some(e => e.rule === issue.rule)) {
          continue;
        }
        result.suggestions.push({ title: `Disable ${issue.rule} for ${file ? 'this file' : 'the next line'}`, edits: [edit] });
      }
    }

    return result;
  });
  for(const directive of directives) {
    const supported = valid.includes(directive);
    for(const name of directive.names.length ? directive.names : ['']) {
      const unknown = name !== '' && !rules.has(name);
      if(supported && !unknown && (name ? directive.used.has(name) : directive.used.size > 0)) {
        continue;
      }
      const start = name ? directive.start + directive.source.indexOf(name) : directive.start + directive.source.indexOf(directive.kind);
      visible.push({
        rule: (
          !supported
            ? 'directive/invalid'
            : unknown
              ? 'directive/unknown-rule'
              : 'directive/unused'
        ),
        message: (
          !supported
            ? 'Unsupported config-lint directive.'
            : unknown
              ? `Unknown rule: ${name}.`
              : 'Unused config-lint directive.'
        ),
        start,
        end: start + (name || directive.kind).length,
        suggestions: [{ title: `Remove ${name || directive.kind}`, edits: [removal(text, directive, name)] }],
      });
    }
  }

  return visible;
};
