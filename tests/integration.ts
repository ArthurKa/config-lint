/* eslint-disable ts/no-unnecessary-condition -- Runtime assertions verify the extension host. */

import assert from 'assert/strict';
import { setTimeout as delay } from 'timers/promises';
import * as vscode from 'vscode';

const waitFor = async (condition: () => boolean): Promise<void> => {
  for(let attempt = 0; attempt < 100; attempt++) {
    if(condition()) {
      return;
    }
    await delay(50);
  }
  assert.fail('Timed out waiting for editor state');
};
const execute = async (): Promise<void> => {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  const secondRoot = vscode.workspace.workspaceFolders?.[1]?.uri;
  assert.ok(root);
  assert.ok(secondRoot);
  const extension = vscode.extensions.getExtension('arthurka.config-lint');
  assert.ok(extension);
  await extension.activate();
  const open = async (relative: string, content: string, folder = root): Promise<vscode.TextEditor> => {
    const uri = vscode.Uri.joinPath(folder, relative);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content));

    return vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri));
  };
  const ours = (uri: vscode.Uri): vscode.Diagnostic[] => vscode.languages.getDiagnostics(uri).filter(e => e.source === 'Config Lint');
  const original = '{"license":"MIT","name":"demo","dependencies":{"z":"1","a":"2"}}';
  const editor = await open('package.json', original);
  await waitFor(() => ours(editor.document.uri).length === 2);
  await vscode.commands.executeCommand('configLint.fixAll');
  assert.equal(editor.document.isDirty, true);
  assert.equal(editor.document.getText(), '{"name":"demo","dependencies":{"a":"2","z":"1"},"license":"MIT"}');
  await waitFor(() => ours(editor.document.uri).length === 0);
  await vscode.commands.executeCommand('undo');
  assert.equal(editor.document.getText(), original);
  await waitFor(() => ours(editor.document.uri).length === 2);
  const actions = await vscode.commands.executeCommand<vscode.CodeAction[]>('vscode.executeCodeActionProvider', editor.document.uri, ours(editor.document.uri)[0]?.range, vscode.CodeActionKind.QuickFix.value);
  const action = actions?.find(e => e.edit !== undefined && e.title.startsWith('Fix:'));
  assert.ok(action?.edit);
  await vscode.workspace.applyEdit(action.edit);
  assert.notEqual(editor.document.getText(), original);
  const yaml = await open('compose.yaml', 'services:\n  app:\n    ports:\n      - 3000\n    volumes:\n      - ./app:/app\n');
  await waitFor(() => ours(yaml.document.uri).length >= 3);
  assert.equal(ours(editor.document.uri).length, 0);
  await vscode.commands.executeCommand('configLint.fixAll');
  assert.ok(yaml.document.getText().includes('127.0.0.1::3000/tcp'));
  assert.ok(yaml.document.getText().includes('./app:/app:ro'));
  await waitFor(() => ours(yaml.document.uri).length === 0);
  const ignored = await open('package.json', original, secondRoot);
  await delay(400);
  assert.equal(ours(ignored.document.uri).length, 0);
  await vscode.commands.executeCommand('configLint.fixAll');
  assert.equal(ignored.document.getText(), original);
  const ignoreFile = await open('.gitignore', '/package.json\n', root);
  await vscode.window.showTextDocument(editor.document);
  await delay(400);
  assert.equal(ours(editor.document.uri).length, 0);
  // Unsaved ignore-file changes must affect eligibility, too.
  const ignoreEditor = await vscode.window.showTextDocument(ignoreFile.document);
  await ignoreEditor.edit(e => {
    e.delete(new vscode.Range(0, 0, ignoreFile.document.lineCount, 0));
  });
  await vscode.window.showTextDocument(editor.document);
  await waitFor(() => ours(editor.document.uri).length > 0);
  const unsupported = await open('notes.txt', original);
  await delay(300);
  assert.equal(ours(editor.document.uri).length, 0);
  await vscode.commands.executeCommand('configLint.fixAll');
  assert.equal(unsupported.document.getText(), original);
  // Source actions work independently of the requested range and do not mix in Quick Fixes.
  const saveEditor = await vscode.window.showTextDocument(editor.document);
  await saveEditor.edit(e => {
    e.replace(new vscode.Range(0, 0, editor.document.lineCount, 0), original);
  });
  const sourceActions = await vscode.commands.executeCommand<vscode.CodeAction[]>('vscode.executeCodeActionProvider', editor.document.uri, new vscode.Range(0, 0, 0, 0), 'source.fixAll.configLint');
  assert.equal(sourceActions?.length, 1);
  assert.equal(sourceActions?.[0]?.kind?.value, 'source.fixAll.configLint');
  const unrelated = await vscode.commands.executeCommand<vscode.CodeAction[]>('vscode.executeCodeActionProvider', editor.document.uri, new vscode.Range(0, 0, 0, 0), 'source.fixAll.eslint');
  assert.equal(unrelated?.length, 0);
  await vscode.workspace.getConfiguration('editor').update('codeActionsOnSave', {
    'source.fixAll.eslint': 'explicit', 'source.fixAll.configLint': 'explicit',
  }, vscode.ConfigurationTarget.Workspace);
  await vscode.workspace.getConfiguration('editor').update('formatOnSave', false, vscode.ConfigurationTarget.Workspace);
  await vscode.commands.executeCommand('workbench.action.files.save');
  assert.equal(editor.document.isDirty, false);
  assert.equal(editor.document.getText(), '{"name":"demo","dependencies":{"a":"2","z":"1"},"license":"MIT"}');
  assert.equal(Buffer.from(await vscode.workspace.fs.readFile(editor.document.uri)).toString(), editor.document.getText());
  const noOp = await vscode.commands.executeCommand<vscode.CodeAction[]>('vscode.executeCodeActionProvider', editor.document.uri, new vscode.Range(0, 0, 0, 0), 'source.fixAll.configLint');
  assert.equal(noOp?.length, 0);
  const dockerComposeEditor = await vscode.window.showTextDocument(yaml.document);
  await dockerComposeEditor.edit(e => {
    e.replace(new vscode.Range(0, 0, yaml.document.lineCount, 0), 'services:\n  app:\n    ports: [3000]\n');
  });
  await vscode.commands.executeCommand('workbench.action.files.save');
  assert.ok(yaml.document.getText().includes('127.0.0.1::3000/tcp'));
  assert.equal(yaml.document.isDirty, false);
  await vscode.window.showTextDocument(ignored.document);
  const excluded = await vscode.commands.executeCommand<vscode.CodeAction[]>('vscode.executeCodeActionProvider', ignored.document.uri, new vscode.Range(0, 0, 0, 0), 'source.fixAll.configLint');
  assert.equal(excluded?.length, 0);
  const anchoredSource = 'services:\n  redis: &redis\n    image: redis:7\n    volumes:\n      - ./healthcheck.sh:/app/healthcheck.sh:ro\n      - ./redis-data:/data\n  replica: *redis\n';
  const anchoredExpected = anchoredSource.replace('./redis-data:/data', './redis-data:/data:ro');
  const anchored = await open('compose.anchor.yaml', anchoredSource);
  await waitFor(() => ours(anchored.document.uri).length === 1);
  const mountWarning = ours(anchored.document.uri)[0];
  assert.ok(mountWarning);
  assert.equal(mountWarning.code, 'docker-compose/explicit-volume-mode');
  assert.ok(mountWarning.range.isEmpty);
  assert.equal(anchored.document.offsetAt(mountWarning.range.start), anchoredSource.indexOf('./redis-data:/data') + './redis-data:/data'.length);
  const anchorActions = await vscode.commands.executeCommand<vscode.CodeAction[]>('vscode.executeCodeActionProvider', anchored.document.uri, mountWarning.range, vscode.CodeActionKind.QuickFix.value);
  const anchorFix = anchorActions?.find(e => e.edit !== undefined && e.title.startsWith('Fix:'));
  assert.ok(anchorFix?.edit);
  await vscode.workspace.applyEdit(anchorFix.edit);
  assert.equal(anchored.document.getText(), anchoredExpected);
  await vscode.commands.executeCommand('undo');
  assert.equal(anchored.document.getText(), anchoredSource);
  await vscode.commands.executeCommand('configLint.fixAll');
  assert.equal(anchored.document.getText(), anchoredExpected);
  await anchored.edit(e => {
    e.replace(new vscode.Range(0, 0, anchored.document.lineCount, 0), anchoredSource);
  });
  await vscode.commands.executeCommand('workbench.action.files.save');
  assert.equal(anchored.document.getText(), anchoredExpected);
  assert.equal(anchored.document.isDirty, false);
  assert.equal(Buffer.from(await vscode.workspace.fs.readFile(anchored.document.uri)).toString(), anchoredExpected);
  await waitFor(() => ours(anchored.document.uri).length === 0);
  const mergedText = 'services:\n  scanner: &scanner\n    expose: ["3003"]\n  dev:\n    <<: *scanner\n';
  const merged = await open('docker-compose.merge.yaml', mergedText);
  await waitFor(() => ours(merged.document.uri).length === 1);
  const quoteWarning = ours(merged.document.uri)[0];
  assert.ok(quoteWarning);
  assert.equal(quoteWarning.code, 'docker-compose/no-unnecessary-quotes');
  assert.equal(merged.document.getText(quoteWarning.range), '"3003"');
  const mergeActions = await vscode.commands.executeCommand<vscode.CodeAction[]>('vscode.executeCodeActionProvider', merged.document.uri, quoteWarning.range, vscode.CodeActionKind.QuickFix.value);
  const mergeFix = mergeActions?.find(e => e.edit !== undefined && e.title.startsWith('Fix:'));
  assert.ok(mergeFix?.edit);
  await vscode.workspace.applyEdit(mergeFix.edit);
  assert.equal(merged.document.getText(), mergedText.replace('"3003"', '3003'));
  await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(root, '../passed'), Buffer.from('passed'));
  console.info('Config Lint VS Code integration checks passed');
};

export const run = async (): Promise<void> => {
  try {
    await execute();
  } catch(error) {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri;
    if(root) {
      await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(root, '../failure'), Buffer.from(error instanceof Error ? error.stack ?? error.message : String(error)));
    }
    throw error;
  }
};
