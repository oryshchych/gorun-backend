---
name: add-validator
description: Create a Zod validation schema for a new request shape. Use when you know what fields a request needs but haven't written the Zod schema yet.
---

## Inputs

- Domain (e.g., `events`)
- Request type: body / query / params
- Field list with types and constraints

## Procedure

### Step 1 — Open the validator file

```
src/validators/<domain>.validator.ts
```

If it doesn't exist yet, create it with the ObjectId regex at the top:

```typescript
import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
```

### Step 2 — Choose the schema template

**ID param schema** (for `/:id` routes):

```typescript
export const <domain>IdSchema = z.object({
  id: z.string().regex(objectIdRegex, { message: 'Invalid ID format' }),
});
```

**Body schema** (create/update):

```typescript
export const create<Domain>Schema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().email(),
  count: z.number().int().min(0),
  tags: z.array(z.string()).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});
```

**Query schema** (list endpoint with pagination):

```typescript
export const get<Domain>QuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(['active', 'inactive']).optional(),
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
});
```

**Update schema** (all fields optional):

```typescript
export const update<Domain>Schema = create<Domain>Schema.partial();
// OR explicitly:
export const update<Domain>Schema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  // ...
});
```

### Step 3 — Model enum values

When a field must match a Mongoose enum, import the values array from the model:

```typescript
import { EVENT_STATUS_VALUES, EVENT_LIFECYCLE_PHASE_VALUES } from '../models/Event';
// ...
status: z.enum(EVENT_STATUS_VALUES).optional();
```

This ensures Zod and Mongoose enums stay in sync automatically.

### Step 4 — String constraints

| Concern          | Zod chain                                    |
| ---------------- | -------------------------------------------- |
| Required string  | `z.string().trim().min(1)`                   |
| Optional string  | `z.string().trim().optional()`               |
| Email            | `z.string().email()`                         |
| URL              | `z.string().url()`                           |
| MongoDB ObjectId | `z.string().regex(objectIdRegex)`            |
| Positive integer | `z.number().int().positive()`                |
| Date string      | `z.string().datetime()` or `z.coerce.date()` |

### Step 5 — Export and connect to route

Export the new schema as a named export, then import it in the route file:

```typescript
import { create<Domain>Schema } from '../validators/<domain>.validator';
// In route file:
validate(create<Domain>Schema, ValidationType.BODY)
```

## Anti-patterns

- Using `z.number()` for query params — they're strings from Express; use `z.string().transform(parseInt)`
- Forgetting `.trim()` on user-facing string fields
- Using `z.any()` — if the shape is unknown, use `z.unknown()` and add a comment
- Defining `objectIdRegex` inline in multiple places within the same file
