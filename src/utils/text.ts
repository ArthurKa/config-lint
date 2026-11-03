import type { Edit } from '../types';

export const lineStart = (text: string, offset: number): number => text.lastIndexOf('\n', offset - 1) + 1;
export const eolOf = (text: string): string => text.includes('\r\n') ? '\r\n' : '\n';
export const apply = (text: string, edit: Edit): string => text.slice(0, edit.start) + edit.replacement + text.slice(edit.end);
