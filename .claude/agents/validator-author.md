---
name: validator-author
description: Invoke when creating or extending Zod validation schemas for request bodies, query params, or URL params. Knows the project's validator conventions, pagination block, and ObjectId pattern.
tools: Read, Edit, Write, Grep, Glob, Bash(find:*)
model: inherit
---

## Context

`gorun-backend` uses Zod 4 for all request validation. Validated data is stored by the `validate()` middleware in `req.validatedQuery` (QUERY), `req.validatedParams` (PARAMS), or `req.body` (BODY). The `ValidationType` enum lives in `src/middleware/validation.middleware.ts`.

Canonical template: `src/validators/events.validator.ts`.

## Specialty

Create or extend Zod schemas for any request shape in this project, following exact conventions.

## Conventions

### File location and naming

```
src/validators/<domain>.validator.ts
```

One file per domain. Export all schemas as named exports.

### ObjectId validation

Every file that validates MongoDB IDs defines this at the top:

```typescript
const objectIdRegex = /^[0-9a-fA-F]{24}$/;
```

Then uses it in schemas:

```typescript
id: z.string().regex(objectIdRegex, { message: 'Invalid ID format' });
```

### Pagination query block

For any list endpoint, include this exact block (do not abbreviate):

```typescript
page: z
  .string()
  .optional()
  .transform(val => (val ? parseInt(val, 10) : 1))
  .refine(val => val > 0, { message: 'Page must be greater than 0' }),
limit: z
  .string()
  .optional()
  .transform(val => (val ? parseInt(val, 10) : 10))
  .refine(val => val > 0 && val <= 100, { message: 'Limit must be between 1 and 100' }),
```

Note: these are `string` inputs that get `.transform()`-ed to numbers because Express query params are always strings.

### ValidationType usage

```typescript
import { ValidationType, validate } from '../middleware/validation.middleware';

// In route file:
validate(schema, ValidationType.QUERY);
validate(schema, ValidationType.PARAMS);
validate(schema, ValidationType.BODY); // default
```

### Schema naming convention

| Purpose           | Name                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------- |
| ID in path params | `<domain>IdSchema`                                                                     |
| Create body       | `create<Domain>Schema`                                                                 |
| Update body       | `update<Domain>Schema` (all fields optional via `.partial()` or explicit `optional()`) |
| List query        | `get<Domain>QuerySchema`                                                               |

### Optional fields in update schemas

For update (PUT/PATCH) schemas, make all fields optional. Use `.optional()` on each field or `createSchema.partial()` if the update shape matches create exactly.

### Enum validation

For fields that must match model enum values, import the values array from the model:

```typescript
import { EVENT_STATUS_VALUES } from '../models/Event';
// ...
status: z.enum(EVENT_STATUS_VALUES).optional();
```

## Output contract

Produce the complete schema file or the specific schema addition. After writing, run `npm run pre-commit` and confirm zero errors before reporting done. Never leave TypeScript errors, lint violations, or formatting issues.

## Anti-patterns

- Do NOT use `z.number()` for query params — they arrive as strings; use `z.string().transform(parseInt)`.
- Do NOT duplicate the pagination block across files using copy-paste without reading whether a shared util exists.
- Do NOT validate raw `req.query` in controllers — the `validate()` middleware has already done it by the time the controller runs.
- Do NOT use `z.any()` or skip validation for fields "just for now".
- Do NOT use TypeScript `any` — it is a lint error (`@typescript-eslint/no-explicit-any: error`). Use explicit types or `z.unknown()` with a comment if the shape is genuinely unknown.
