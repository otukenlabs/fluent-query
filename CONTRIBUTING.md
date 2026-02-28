# Contributing to fluent-query

Thanks for contributing.

## Development setup

1. Clone the repository.
2. Install dependencies:

```bash
npm install
```

3. Run tests:

```bash
bun test
```

4. Type-check:

```bash
bunx tsc --noEmit
```

5. Optional build verification (recommended before release):

```bash
npm run build
```

## Project conventions

### Code style

- Keep changes focused and minimal.
- Preserve existing public APIs unless the change is intentionally breaking.
- Update TypeScript types and JSDoc together when changing method signatures.
- Add or update tests for behavior changes.

## Testing expectations

Before opening a PR, run:

```bash
bun test
bunx tsc --noEmit
```

If your changes affect packaging/output behavior, also run:

```bash
npm run build
```

PRs that change behavior should include tests in `src/**/*.test.ts`.

## Pull request checklist

- [ ] Scope is focused to one logical change
- [ ] Tests added/updated and passing
- [ ] Typecheck passes
- [ ] Build passes (if packaging/output paths changed)
- [ ] README updated if user-facing API changed
- [ ] CHANGELOG updated for notable changes

## Commit guidance

Use clear, descriptive commit messages.
Examples:

- `feat: add arrayPipeline lazy query composition`
- `refactor: standardize string matching on ignoreCase`
- `fix: handle null values in whereIn`

## Release notes

- Breaking changes must be explicitly documented in `CHANGELOG.md`.
- Include migration notes when renaming/removing public APIs.
