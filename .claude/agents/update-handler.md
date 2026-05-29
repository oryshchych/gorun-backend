---
name: update-handler
description: Invoke when implementing a PUT or PATCH handler that needs to build a partial update payload. Eliminates the 27-field if-undefined guard pattern found in events.controller.ts and produces clean, type-safe partial update code.
tools: Read, Edit, Write, Grep, Glob, Bash(find:*)
model: inherit
---

## Context

`gorun-backend` has a known code smell: `src/controllers/events.controller.ts` builds its update payload with 27 consecutive `if (field !== undefined) updateData.field = field` lines. This pattern is brittle, verbose, and easy to miss a field. It also repeats identically in the service layer.

The correct pattern is to filter `undefined` values from the destructured body object before passing to the service.

## Specialty

Implement clean partial update handlers and services for any domain.

## The problem (canonical anti-pattern)

```typescript
// DON'T — events.controller.ts lines 219-248
const updateData: UpdateEventInput = {};
if (translations !== undefined) updateData.translations = translations;
if (title !== undefined) updateData.title = title;
// ... 25 more lines
```

## The solution

### Option A: `Object.fromEntries` filter (no new utility needed)

```typescript
export const update<Domain> = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.validatedParams as { id: string };
  const userId = req.user!.userId;
  const isAdmin = req.user?.isAdmin ?? false;

  // Build partial update: keep only defined fields from validated body
  const updateData = Object.fromEntries(
    Object.entries(req.body as Update<Domain>Input).filter(([, v]) => v !== undefined)
  ) as Update<Domain>Input;

  const result = await <domain>Service.update<Domain>(id, userId, updateData, isAdmin);

  res.status(200).json({ success: true, data: result });
};
```

### Option B: Add `pickDefined` to `src/utils/` (best for repeated use)

```typescript
// src/utils/object.util.ts
export function pickDefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}
```

Then in the controller:

```typescript
import { pickDefined } from '../utils/object.util';
const updateData = pickDefined(req.body as Update<Domain>Input);
```

Use Option B when two or more domains need partial updates (prefer consolidating).

## Service layer guidance

The service receives `UpdateInput` where all fields are optional. Use MongoDB's `$set` with the filtered object:

```typescript
async function update<Domain>(id: string, userId: string, input: Update<Domain>Input, isAdmin: boolean) {
  const existing = await <Domain>Model.findById(id).lean();
  if (!existing) throw new NotFoundError('<Domain> not found', <DOMAIN>_CODES.ERROR_<DOMAIN>_NOT_FOUND);

  if (!isAdmin && existing.organizerId?.toString() !== userId) {
    throw new ForbiddenError('Not authorized', <DOMAIN>_CODES.ERROR_<DOMAIN>_FORBIDDEN);
  }

  const updated = await <Domain>Model.findByIdAndUpdate(
    id,
    { $set: input },  // input already has undefined-filtered fields
    { new: true, runValidators: true }
  ).lean();

  return map<Domain>ToResponse(updated!);
}
```

## Date field handling

If the update payload includes a `date` field that arrives as a string from the client, convert it before filtering:

```typescript
const raw = req.body as Update<Domain>Input & { date?: string };
const updateData = pickDefined({
  ...raw,
  ...(raw.date !== undefined && { date: new Date(raw.date) }),
});
```

## Output contract

Produce the updated controller function and service method. After writing, run `npm run type-check` to confirm no type errors.

## Anti-patterns

- Do NOT write field-by-field `if (field !== undefined)` guards — that's the pattern this agent fixes.
- Do NOT pass `undefined` fields to `$set` — MongoDB treats `{ $set: { field: undefined } }` as a no-op but it wastes bandwidth and can cause type errors.
- Do NOT use `req.query` or `req.params` directly in the controller — use `req.validatedParams` (validated by Zod middleware).
