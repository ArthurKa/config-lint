import path from 'path';
import * as vscode from 'vscode';
import { analyze, fix } from './rules';
import type { FileKind } from './types';
import { eligibleKind } from './utils/eligibility';

export const activate = (context: vscode.ExtensionContext): void => {
  const diagnostics = vscode.languages.createDiagnosticCollection('Config Lint');
  const fixAllKind = vscode.CodeActionKind.SourceFixAll.append('configLint');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const eligible = (document: vscode.TextDocument): Promise<FileKind | undefined> => {
    const root = vscode.workspace.getWorkspaceFolder(document.uri);
    if(!root || document.isUntitled) {
      return Promise.resolve(undefined);
    }
    const relative = path.relative(root.uri.fsPath, document.uri.fsPath).split(path.sep).join('/');

    return eligibleKind(relative, async directory => {
      const uri = vscode.Uri.joinPath(root.uri, directory, '.gitignore');
      const opened = vscode.workspace.textDocuments.find(e => e.uri.toString() === uri.toString());
      if(opened) {
        return opened.getText();
      }
      try {
        const content = await vscode.workspace.fs.readFile(uri);

        return Buffer.from(content).toString();
      } catch(error) {
        if(error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
          return '';
        }
        throw error;
      }
    });
  };
  let generation = 0;
  const output = vscode.window.createOutputChannel('Config Lint');
  const refresh = async (): Promise<void> => {
    generation++;
    const current = generation;
    diagnostics.clear();
    const editor = vscode.window.activeTextEditor;
    if(!editor) {
      return;
    }
    const { document } = editor;
    const { version } = document;
    const kind = await eligible(document);
    if(current !== generation || !kind || document.version !== version || vscode.window.activeTextEditor?.document !== document) {
      return;
    }
    diagnostics.set(document.uri, analyze(document.getText(), kind).map(e => {
      const range = new vscode.Range(document.positionAt(e.start), document.positionAt(e.end));
      const diagnostic = new vscode.Diagnostic(range, e.message, vscode.DiagnosticSeverity.Warning);
      diagnostic.code = e.rule;
      diagnostic.source = 'Config Lint';

      return diagnostic;
    }));
  };
  const safelyRefresh = (): void => {
    void refresh().catch(e => {
      output.appendLine(String(e));
    });
  };
  const schedule = (): void => {
    generation++;
    diagnostics.clear();
    global.clearTimeout(timer);
    timer = global.setTimeout(() => {
      safelyRefresh();
    }, 200);
  };
  context.subscriptions.push(
    diagnostics,
    output,
    vscode.window.onDidChangeActiveTextEditor(() => {
      diagnostics.clear();
      safelyRefresh();
    }),
    vscode.workspace.onDidChangeTextDocument(e => {
      if(e.document === vscode.window.activeTextEditor?.document || path.basename(e.document.uri.path) === '.gitignore') {
        schedule();
      }
    }),
    vscode.commands.registerCommand('configLint.fixAll', async () => {
      const editor = vscode.window.activeTextEditor;
      if(!editor) {
        return;
      }
      const { document } = editor;
      const { version } = document;
      const kind = await eligible(document);
      if(!kind || version !== document.version || editor !== vscode.window.activeTextEditor) {
        return;
      }
      const before = document.getText();
      const after = fix(before, kind);
      if(before !== after) {
        await editor.edit(e => {
          e.replace(new vscode.Range(document.positionAt(0), document.positionAt(before.length)), after);
        });
      }
      await refresh();
    }),
    vscode.languages.registerCodeActionsProvider({ pattern: '**/*' }, {
      async provideCodeActions(document, range, actionContext, token) {
        const active = vscode.window.activeTextEditor;
        if(document !== active?.document) {
          return [];
        }
        const { version } = document;
        const kind = await eligible(document);
        if(!kind || version !== document.version || vscode.window.activeTextEditor !== active || token.isCancellationRequested) {
          return [];
        }

        const sourceActions: vscode.CodeAction[] = [];
        if(actionContext.only === undefined || actionContext.only.contains(fixAllKind)) {
          const before = document.getText();
          const after = fix(before, kind);
          if(before !== after) {
            const action = new vscode.CodeAction('Fix all autofixable problems (Config Lint)', fixAllKind);
            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(document.uri, new vscode.Range(document.positionAt(0), document.positionAt(before.length)), after);
            sourceActions.push(action);
          }
        }
        if(actionContext.only !== undefined && !actionContext.only.contains(vscode.CodeActionKind.QuickFix)) {
          return sourceActions;
        }

        const quickFixes = analyze(document.getText(), kind).filter(e => {
          const issueRange = new vscode.Range(document.positionAt(e.start), document.positionAt(e.end));

          return range.intersection(issueRange) !== undefined;
        }).flatMap(e => {
          const suggestions = (e.suggestions ?? []).map(suggestion => {
            const action = new vscode.CodeAction(suggestion.title, vscode.CodeActionKind.QuickFix);
            action.diagnostics = actionContext.diagnostics.filter(diagnostic => diagnostic.source === 'Config Lint' && diagnostic.code === e.rule);
            action.edit = new vscode.WorkspaceEdit();
            for(const edit of suggestion.edits) {
              action.edit.replace(document.uri, new vscode.Range(document.positionAt(edit.start), document.positionAt(edit.end)), edit.replacement);
            }

            return action;
          });
          if(!e.edit) {
            return suggestions;
          }
          const action = new vscode.CodeAction(`Fix: ${e.message}`, vscode.CodeActionKind.QuickFix);
          action.edit = new vscode.WorkspaceEdit();
          action.edit.replace(document.uri, new vscode.Range(document.positionAt(e.edit.start), document.positionAt(e.edit.end)), e.edit.replacement);

          return [action, ...suggestions];
        });

        return [...sourceActions, ...quickFixes.filter((action, i) => quickFixes.findIndex(e => (
          e.title === action.title && JSON.stringify(e.edit?.entries()) === JSON.stringify(action.edit?.entries())
        )) === i)];
      },
    }, { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix, fixAllKind] }),
    {
      dispose() {
        global.clearTimeout(timer);
      },
    },
  );
  const watcher = vscode.workspace.createFileSystemWatcher('**/.gitignore');
  context.subscriptions.push(
    watcher,
    watcher.onDidChange(schedule),
    watcher.onDidCreate(schedule),
    watcher.onDidDelete(schedule),
    vscode.workspace.onDidChangeWorkspaceFolders(schedule),
    vscode.workspace.onDidCloseTextDocument(schedule),
  );
  safelyRefresh();
};
