---
name: add-domain
description: Procedural recipe for adding a complete new resource domain to gorun-backend. Use when scaffolding a new endpoint group (e.g., "notifications", "reviews"). Creates all 6 required files atomically and registers the router.
---

## Inputs

- `<domain>` — lowercase singular noun (e.g., `notification`, `review`)
- `<Domain>` — PascalCase (e.g., `Notification`, `Review`)
- `<DOMAIN>` — UPPER_SNAKE (e.g., `NOTIFICATION`, `REVIEW`)
- Routes needed (CRUD subset or custom)

## Procedure

Execute in this order — each step depends on the previous.

### Step 1 — Validator (`src/validators/<domain>.validator.ts`)

Read `src/validators/events.validator.ts` as reference. Create:

- `const objectIdRegex = /^[0-9a-fA-F]{24}$/;` at the top
- `<domain>IdSchema` — `z.object({ id: z.string().regex(objectIdRegex, { message: 'Invalid ID format' }) })`
- `create<Domain>Schema` — body fields with appropriate Zod types and constraints
- `get<Domain>QuerySchema` — include the pagination block (page + limit string→number transforms)

Export all schemas as named exports.

### Step 2 — Types (`src/services/<domain>/<domain>.types.ts`)

Read `src/services/events/events.types.ts` as reference. Define:

- `Create<Domain>Input` interface
- `Update<Domain>Input` interface (all fields optional)
- `<Domain>Filters` interface
- `<Domain>Response` interface (what the API returns, includes `id: string`, timestamps)

### Step 3 — Service (`src/services/<domain>/<domain>.service.ts`)

Read `src/services/events/events.service.ts` as reference. Structure:

```typescript
import { getPaginationParams, formatPaginatedResponse } from '../../utils/pagination.util';
import { NotFoundError, ConflictError, ForbiddenError } from '../../types/errors';
import { <DOMAIN>_CODES } from '../../types/codes';

async function get<Domain>s(filters, page, limit): Promise<PaginatedResponse<<Domain>Response>> {
  const { page: p, limit: l, skip } = getPaginationParams(page, limit);
  const total = await <Domain>Model.countDocuments(query);
  const items = await <Domain>Model.find(query).skip(skip).limit(l).lean();
  return formatPaginatedResponse(map<Domain>s(items), total, p, l);
}
```

Export service methods as a default object or named functions (match events.service.ts pattern).

### Step 4 — Controller (`src/controllers/<domain>.controller.ts`)

Read `src/controllers/events.controller.ts` as reference. Rules:

- Import `AuthRequest` from `../middleware/auth.middleware`
- Read from `req.validatedQuery`, `req.validatedParams`, `req.body`
- Call one service method per handler
- Return `res.status(200).json({ success: true, data: result })` or `res.status(201)` for creates
- Use `res.status(204).send()` for deletes
- For updates, use `Object.fromEntries(Object.entries(req.body).filter(([, v]) => v !== undefined))` — no per-field if-chains

### Step 5 — Routes (`src/routes/<domain>.routes.ts`)

Read `src/routes/events.routes.ts` as reference:

```typescript
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { validate, ValidationType } from '../middleware/validation.middleware';
import { <domain>IdSchema, create<Domain>Schema, get<Domain>QuerySchema } from '../validators/<domain>.validator';
import { get<Domain>s, create<Domain>, update<Domain>, delete<Domain> } from '../controllers/<domain>.controller';

const router = Router();

router.get('/', optionalAuthenticate, validate(get<Domain>QuerySchema, ValidationType.QUERY), asyncHandler(get<Domain>s));
router.get('/:id', optionalAuthenticate, validate(<domain>IdSchema, ValidationType.PARAMS), asyncHandler(get<Domain>ById));
router.post('/', authenticate, validate(create<Domain>Schema, ValidationType.BODY), asyncHandler(create<Domain>));
router.put('/:id', authenticate, validate(<domain>IdSchema, ValidationType.PARAMS), validate(update<Domain>Schema, ValidationType.BODY), asyncHandler(update<Domain>));
router.delete('/:id', authenticate, validate(<domain>IdSchema, ValidationType.PARAMS), asyncHandler(delete<Domain>));

export default router;
```

### Step 6 — Codes (`src/types/codes.ts`)

Add before the `API_CODES` object:

```typescript
export const <DOMAIN>_CODES = {
  SUCCESS_<DOMAIN>_CREATED: 'SUCCESS_<DOMAIN>_CREATED',
  SUCCESS_<DOMAIN>_UPDATED: 'SUCCESS_<DOMAIN>_UPDATED',
  SUCCESS_<DOMAIN>_DELETED: 'SUCCESS_<DOMAIN>_DELETED',
  SUCCESS_<DOMAIN>_RETRIEVED: 'SUCCESS_<DOMAIN>_RETRIEVED',
  ERROR_<DOMAIN>_NOT_FOUND: 'ERROR_<DOMAIN>_NOT_FOUND',
  ERROR_<DOMAIN>_INVALID_ID: 'ERROR_<DOMAIN>_INVALID_ID',
  ERROR_<DOMAIN>_FORBIDDEN: 'ERROR_<DOMAIN>_FORBIDDEN',
} as const;
```

Spread into `API_CODES`: add `...<DOMAIN>_CODES,` to the spread object.

### Step 7 — Register router (`src/app.ts`)

Add import and `app.use()` call following the existing pattern:

```typescript
import <domain>Routes from './routes/<domain>.routes';
// ...
app.use('/api/<domain>s', apiLimiter, <domain>Routes);
```

## File shape checklist

After writing all files, verify:

- [ ] `src/validators/<domain>.validator.ts` — exports `<domain>IdSchema`, `create<Domain>Schema`, `get<Domain>QuerySchema`
- [ ] `src/services/<domain>/<domain>.types.ts` — exports `Create<Domain>Input`, `Update<Domain>Input`, `<Domain>Response`
- [ ] `src/services/<domain>/<domain>.service.ts` — default export with service methods
- [ ] `src/controllers/<domain>.controller.ts` — named exports matching route handler names
- [ ] `src/routes/<domain>.routes.ts` — default export `router`
- [ ] `src/types/codes.ts` — `<DOMAIN>_CODES` added and spread into `API_CODES`
- [ ] `src/app.ts` — router mounted with `apiLimiter`

## Anti-patterns

- Forgetting `asyncHandler` wrap → uncaught errors crash Express 5
- Forgetting to register in `src/app.ts` → silent 404
- Using `req.query` directly instead of `req.validatedQuery`
- Per-field if-chains in update handler
