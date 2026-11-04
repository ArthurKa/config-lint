export type FileKind = 'package-json' | 'docker-compose' | 'dockerfile';
export type Edit = { start: number; end: number; replacement: string };
export type Issue = { rule: string; message: string; start: number; end: number; edit?: Edit; suggestions?: Array<{ title: string; edits: Edit[] }> };
export type ValueProblem = { rule: string; message: string; fixed?: string };
