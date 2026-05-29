---
description: Run the full pre-commit triad (type-check, lint, format check) and report pass/fail.
argument-hint: (no arguments)
allowed-tools: Bash(npm run type-check:*), Bash(npm run lint:*), Bash(npm run format:check:*)
---

Run the three steps of the pre-commit triad in order. Stop and report the first failure; if all pass, confirm success.

## Steps

1. **Type-check** — `npm run type-check`
   - Runs `tsc --noEmit` with strict mode
   - Catches: type errors, unused variables/parameters, missing return types

2. **Lint** — `npm run lint`
   - Runs ESLint on `src/**/*.ts`
   - Catches: style issues, anti-patterns, unused imports

3. **Format check** — `npm run format:check`
   - Runs `prettier --check "src/**/*.{ts,js,json}"`
   - Catches: unformatted files
   - Fix with `npm run format` if this step fails

## Expected outcome

All three pass → "Pre-commit triad passed. Safe to commit."
Any fail → Report which step failed, show the error output, suggest the fix.

## Common fixes

| Failure      | Fix                                            |
| ------------ | ---------------------------------------------- |
| Type error   | Read the file, fix the type issue              |
| Lint error   | Run `npm run lint:fix` for auto-fixable issues |
| Format error | Run `npm run format` then re-check             |
