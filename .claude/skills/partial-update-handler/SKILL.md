---
name: partial-update-handler
description: Implement a PATCH or PUT handler cleanly without per-field if-chains. Use when you need to build an update payload from an optional-fields request body.
---

## The problem

`src/controllers/events.controller.ts` (lines 219–248) builds its update payload with 27 consecutive `if (field !== undefined)` guards:

```typescript
const updateData: UpdateEventInput = {};
if (translations !== undefined) updateData.translations = translations;
if (title !== undefined) updateData.title = title;
// ... 25 more lines
```

This is brittle, verbose, and forces the same pattern to repeat in the service layer too.

## The solution

### Option A — Object.fromEntries filter (no new files)

Use when only one domain needs partial update:

```typescript
export const update<Domain> = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.validatedParams as { id: string };
  const userId = req.user!.userId;
  const isAdmin = req.user?.isAdmin ?? false;

  const updateData = Object.fromEntries(
    Object.entries(req.body as Update<Domain>Input).filter(([, v]) => v !== undefined)
  ) as Update<Domain>Input;

  const result = await <domain>Service.update<Domain>(id, userId, updateData, isAdmin);
  res.status(200).json({ success: true, data: result });
};
```

### Option B — `pickDefined` utility (when ≥2 domains need partial update)

**Step 1:** Create `src/utils/object.util.ts`:

```typescript
export function pickDefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}
```

**Step 2:** Use in controllers:

```typescript
import { pickDefined } from '../utils/object.util';

export const update<Domain> = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.validatedParams as { id: string };
  const updateData = pickDefined(req.body as Update<Domain>Input);
  const result = await <domain>Service.update<Domain>(id, req.user!.userId, updateData);
  res.status(200).json({ success: true, data: result });
};
```

### Handling date field conversion

If the body includes a `date` field that arrives as a string, convert it before filtering:

```typescript
const raw = req.body as Update<Domain>Input & { date?: string };
const updateData = pickDefined({
  ...raw,
  ...(raw.date !== undefined && { date: new Date(raw.date) }),
}) as Update<Domain>Input;
```

## Service layer

The service receives the already-filtered `UpdateInput`. Use `$set` with the partial object:

```typescript
async function update<Domain>(
  id: string,
  userId: string,
  input: Update<Domain>Input,
  isAdmin: boolean
): Promise<<Domain>Response> {
  const existing = await <Domain>Model.findById(id).lean();
  if (!existing) {
    throw new NotFoundError('<Domain> not found', <DOMAIN>_CODES.ERROR_<DOMAIN>_NOT_FOUND);
  }
  if (!isAdmin && existing.organizerId?.toString() !== userId) {
    throw new ForbiddenError('Not authorized', <DOMAIN>_CODES.ERROR_<DOMAIN>_FORBIDDEN);
  }

  const updated = await <Domain>Model.findByIdAndUpdate(
    id,
    { $set: input },
    { new: true, runValidators: true }
  ).lean();

  return map<Domain>ToResponse(updated!);
}
```

## Checklist

- [ ] Controller uses filter approach (Option A or B) — no per-field if-chains
- [ ] Date fields converted from string before filtering
- [ ] Service uses `$set` with `input` directly
- [ ] TypeScript is happy: `npm run type-check`

## Anti-patterns

- Per-field `if (field !== undefined)` guards — that's what this skill replaces
- Passing `undefined` values to `$set` — filter them out first
- Calling `findByIdAndUpdate` without `{ new: true }` — you'll get the pre-update document
- Calling `findByIdAndUpdate` without `{ runValidators: true }` — Mongoose validators won't run
