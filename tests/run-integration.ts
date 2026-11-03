import { spawn } from 'child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

const run = async (): Promise<void> => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'config-lint-integration-'));
  try {
    const folders = [path.join(temporary, 'first'), path.join(temporary, 'second')];
    for(const folder of folders) {
      await mkdir(folder);
    }
    await writeFile(path.join(folders[1] ?? temporary, '.gitignore'), '/package.json\n');
    const workspace = path.join(temporary, 'test.code-workspace');
    await writeFile(workspace, JSON.stringify({ folders: folders.map(path => ({ path })), settings: { 'files.autoSave': 'off' } }));
    const containerArgs = process.env.CONFIG_LINT_CONTAINER === '1' ? ['--no-sandbox', '--disable-gpu'] : [];
    const child = spawn('code', [workspace, '--new-window', '--wait', '--disable-extensions', '--disable-workspace-trust', '--skip-welcome', '--skip-release-notes', '--user-data-dir', path.join(temporary, 'profile'), `--extensionDevelopmentPath=${path.resolve()}`, `--extensionTestsPath=${path.resolve('dist/tests/integration.cjs')}`, ...containerArgs], { stdio: 'inherit', detached: process.platform !== 'win32' });
    const stop = (): void => {
      if(child.pid === undefined) {
        return;
      }
      try {
        if(process.platform === 'win32') {
          child.kill('SIGKILL');
        } else {
          process.kill(-child.pid, 'SIGKILL');
        }
      } catch(error) {
        if(!(error instanceof Error) || !('code' in error) || error.code !== 'ESRCH') {
          throw error;
        }
      }
    };
    try {
      const code = await new Promise<number | null>((resolve, reject) => {
        const timeout = global.setTimeout(() => {
          reject(new Error('VS Code integration suite timed out after 120 seconds.'));
        }, 120000);
        child.once('error', e => {
          global.clearTimeout(timeout);
          reject(e);
        });
        child.once('exit', e => {
          global.clearTimeout(timeout);
          resolve(e);
        });
      });
      if(code !== 0) {
        throw new Error(`VS Code integration process failed (exit code: ${String(code)}).`);
      }
      await readFile(path.join(temporary, 'passed'), 'utf8');
      console.info('VS Code integration suite passed.');
    } finally {
      stop();
    }
  } catch(error) {
    const failure = await readFile(path.join(temporary, 'failure'), 'utf8').catch(() => undefined);
    if(failure !== undefined) {
      console.error(failure);
    }
    throw error;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
};
void run().catch(e => {
  console.error('Integration did not complete:', e);
  process.exitCode = 1;
});
