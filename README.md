# Config Lint

Recommended `settings.json` setting to apply fixes when you explicitly save a file (merge with your existing save actions):

```json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.configLint": "explicit"
  }
}
```

A VS Code extension that lints and fixes `package.json` and Docker Compose files in the active editor. It checks key ordering, dependency sorting, image tags, ports, volumes, and unnecessary YAML quotes.

Use Quick Fixes or **Config Lint: Fix all autofixable problems**. Files must belong to an open workspace; `.gitignore`, `node_modules`, and `.git` exclusions are respected. Compose fixes can change behavior, including adding localhost port bindings and read-only volume modes.

Licensed under [MIT](LICENSE).
