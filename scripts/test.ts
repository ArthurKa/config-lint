import { spawnSync } from 'child_process';
import { readdir } from 'fs/promises';
import { build } from 'esbuild';

const entries = (await readdir('src', { recursive: true })).filter(e => /\.(?:unit|int)\.test\.ts$/u.test(e)).map(e => `src/${e}`);
await build({ entryPoints: entries, outdir: 'dist/tests/source', outbase: 'src', bundle: true, platform: 'node', format: 'cjs', mainFields: ['module', 'main'], outExtension: { '.js': '.cjs' } });
const result = spawnSync(process.execPath, ['--test', ...entries.map(e => e.replace(/^src/u, 'dist/tests/source').replace(/\.ts$/u, '.cjs'))], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
