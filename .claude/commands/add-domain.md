---
description: Scaffold a complete new resource domain (validator + types + service + controller + routes + codes + router registration).
argument-hint: <domain-name>
allowed-tools: Read, Edit, Write, Glob, Grep, Bash(find:*)
---

Scaffold a complete new resource domain following the 6-file triad pattern used throughout gorun-backend.

## Input

`$ARGUMENTS` — the domain name in lowercase singular form (e.g., `notification`, `review`, `venue`).

If no argument is provided, ask: "What is the domain name? (lowercase singular, e.g. 'notification')"

## What this command does

Invokes the `domain-scaffolder` agent to create all required files atomically:

1. `src/validators/<domain>.validator.ts` — Zod schemas for all request shapes
2. `src/services/<domain>/<domain>.types.ts` — TypeScript input/output interfaces
3. `src/services/<domain>/<domain>.service.ts` — Business logic + DB access
4. `src/controllers/<domain>.controller.ts` — Thin HTTP layer
5. `src/routes/<domain>.routes.ts` — Express Router
6. `src/types/codes.ts` — New `<DOMAIN>_CODES` const added
7. `src/app.ts` — Router registered with `apiLimiter`

## Canonical templates to read first

Before generating, read these files to match the exact pattern:

- `src/routes/events.routes.ts`
- `src/controllers/events.controller.ts`
- `src/services/events/events.service.ts`
- `src/services/events/events.types.ts`
- `src/validators/events.validator.ts`

## After scaffolding

Run `npm run pre-commit` to verify no type errors or lint issues.
