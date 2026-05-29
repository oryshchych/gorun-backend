---
name: add-route
description: Add a single route to an existing domain without scaffolding a full new domain. Use when a domain already exists and you need one new endpoint (e.g., "add GET /api/events/:id/participants").
---

## Inputs

- Target domain (e.g., `events`)
- HTTP method + path (e.g., `GET /api/events/:id/stats`)
- Auth requirement: public / optional auth / required auth / admin only
- Request shape: body fields, query params, path params

## Procedure

### Step 1 — Add Zod schema to validator

Open `src/validators/<domain>.validator.ts`. Add the new schema:

```typescript
// For query params:
export const get<Domain>StatsQuerySchema = z.object({
  // ... fields
});

// For body:
export const <domain>StatsSchema = z.object({
  // ... fields
});
```

If the route only uses an existing ID param, reuse `<domain>IdSchema` — don't create a duplicate.

### Step 2 — Add controller function

Open `src/controllers/<domain>.controller.ts`. Add a named export:

```typescript
export const get<Domain>Stats = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.validatedParams as { id: string };
  const result = await <domain>Service.get<Domain>Stats(id);
  res.status(200).json({ success: true, data: result });
};
```

Rules:

- Read from `req.validatedQuery` / `req.validatedParams` / `req.body` (not raw `req.query`)
- Call exactly one service method
- Return `{ success: true, data: ... }`

### Step 3 — Add service method

Open `src/services/<domain>/<domain>.service.ts`. Add the new async function. Throw typed errors:

```typescript
async function get<Domain>Stats(id: string): Promise<<Domain>Stats> {
  const doc = await <Domain>Model.findById(id).lean();
  if (!doc) throw new NotFoundError('<Domain> not found', <DOMAIN>_CODES.ERROR_<DOMAIN>_NOT_FOUND);
  // ... logic
}
```

### Step 4 — Add route line

Open `src/routes/<domain>.routes.ts`. Add the route in the correct position (note: named static paths like `/my`, `/single` must come before `/:id` to avoid conflicts):

```typescript
router.get(
  '/:id/stats',
  optionalAuthenticate, // or authenticate / requireAdmin
  validate(<domain>IdSchema, ValidationType.PARAMS),
  validate(get < Domain > StatsQuerySchema, ValidationType.QUERY), // if query params
  asyncHandler(get < Domain > Stats)
);
```

**Middleware chain order (always):**

1. Auth guard (`authenticate` / `optionalAuthenticate`)
2. Param validation (`ValidationType.PARAMS`)
3. Authorization guard (`isEventOrganizerOrAdmin` / `requireAdmin`) — after auth
4. Body/query validation (`ValidationType.BODY` / `ValidationType.QUERY`)
5. `asyncHandler(handler)` — always last

## File shape checklist

- [ ] New Zod schema exported from `src/validators/<domain>.validator.ts`
- [ ] New controller function exported from `src/controllers/<domain>.controller.ts`
- [ ] New service method added to `src/services/<domain>/<domain>.service.ts`
- [ ] Route line added in `src/routes/<domain>.routes.ts` with correct position relative to `/:id`

## Anti-patterns

- Adding a static path (`/mine`, `/count`) AFTER `/:id` — Express will match `/:id` first
- Forgetting `asyncHandler` — uncaught async errors crash Express 5
- Reading `req.query` directly instead of `req.validatedQuery`
- Adding logic in the controller that belongs in the service
