---
name: write-integration-test
description: Write a Jest integration test for an HTTP endpoint or a utility function. Covers the mongodb-memory-server setup, supertest pattern, and data seeding approach used in this project.
---

## Inputs

- Endpoint(s) to test (e.g., `GET /api/events`, `POST /api/registrations`)
- Auth requirements (public, optional, required JWT)
- Expected response shape

## Procedure

### Step 1 — Create the test file

Path: `src/tests/<domain>.test.ts` (or `src/tests/<utility>.test.ts` for utils).

The shared `setup.ts` is loaded automatically by Jest — no import needed for MongoDB lifecycle.

### Step 2 — Standard test file skeleton

```typescript
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app'; // createApp() default export — do NOT call createApp() again
import { Event } from '../models/Event'; // import whichever models you need to seed
import { jwtConfig } from '../config/env';

// Helper: generate a test JWT
const makeToken = (userId: string, isAdmin = false) =>
  jwt.sign({ userId, isAdmin }, jwtConfig.accessSecret, { expiresIn: '1h' });

describe('<Domain> API', () => {
  describe('GET /api/<domain>', () => {
    it('returns paginated list', async () => {
      // Seed via Mongoose model directly — NOT via API
      await Event.create([
        { title: 'Race A', date: new Date('2025-09-01'), capacity: 100 /* ... */ },
        { title: 'Race B', date: new Date('2025-10-01'), capacity: 200 /* ... */ },
      ]);

      const res = await request(app).get('/api/events').expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination).toMatchObject({ page: 1, limit: 10, total: 2 });
    });
  });

  describe('POST /api/<domain>', () => {
    it('creates resource when authenticated', async () => {
      const token = makeToken('user123');

      const res = await request(app)
        .post('/api/<domain>')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'New Race', date: '2025-11-01', capacity: 50 })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('New Race');
    });

    it('returns 401 without token', async () => {
      const res = await request(app).post('/api/<domain>').send({ title: 'New Race' }).expect(401);

      expect(res.body.success).toBe(false);
    });
  });
});
```

### Step 3 — Data seeding rules

- Always seed via Mongoose models: `await Model.create({ ... })` or `await Model.insertMany([...])`
- Never seed by calling the API — that tests two things at once and makes failures ambiguous
- `afterEach` in `setup.ts` clears all collections automatically — no manual cleanup needed

### Step 4 — Auth token generation

Protected routes require a Bearer token. Generate one matching the app's JWT config:

```typescript
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/env';

const token = jwt.sign({ userId: 'someMongoId', isAdmin: false }, jwtConfig.accessSecret, {
  expiresIn: '1h',
});
```

For admin routes, pass `isAdmin: true`.

### Step 5 — Validating response shape

Use `expect(res.body).toMatchObject({...})` for partial matching (ignores extra fields).
Use `expect(res.body).toStrictEqual({...})` only when you need exact match (rarely needed).

```typescript
expect(res.body).toMatchObject({
  success: true,
  data: expect.objectContaining({ title: 'Test Race' }),
  pagination: { page: 1, total: 1 },
});
```

### Step 6 — Run tests

```bash
npm test                      # run all
npm run test:watch            # watch mode
npm run test:coverage         # with coverage
```

Jest timeout is 10 000 ms. Tests with slow DB operations are fine within that window.

## Jest config facts

- `forceExit: true` — process exits after all tests, no hanging handles
- `clearMocks: true` — mock call history cleared between tests
- `resetMocks: true` — mock implementation reset between tests
- `restoreMocks: true` — spy implementations restored between tests

## Anti-patterns

- Do NOT call `mongoose.connect()` or `MongoMemoryServer.create()` in test files — `setup.ts` handles it
- Do NOT import `createApp` — use `import app from '../app'` (default export)
- Do NOT seed via API calls (e.g., `await request(app).post('/api/events').send({...})`)
- Do NOT leave `console.log` calls in committed tests
- Do NOT write tests that rely on document order without an explicit `.sort()` query
