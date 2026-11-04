# Config Lint

A VS Code extension that lints and fixes `package.json`, Docker Compose files, and Dockerfiles in the active editor. It checks key ordering, dependency sorting, image tags, ports, volumes, and unnecessary YAML quotes.

Files must belong to an open workspace; `.gitignore`, `node_modules`, and `.git` exclusions are respected. Compose fixes can change behavior, including adding localhost port bindings and read-only volume modes. Use Quick Fixes or **Config Lint: Fix all autofixable problems**, or apply fixes when you explicitly save a file in VS Code by adding the following to your `settings.json`:

```json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.configLint": "explicit"
  }
}
```

Licensed under [MIT](LICENSE).
