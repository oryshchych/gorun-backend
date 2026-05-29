# gorun-backend — AI Agent Reference

## Project snapshot

`gorun-backend` is a TypeScript REST API for a running-events platform. It handles event CRUD, participant registrations, payment processing via Plata by Monobank, Google OAuth, email delivery via Resend, and image uploads via Cloudinary. The API is multilingual (Ukrainian/English). It is a personal project with no CI/CD pipeline at time of writing.

---

## Stack

| Concern    | Library                                            | Version         |
| ---------- | -------------------------------------------------- | --------------- |
| Runtime    | Node.js                                            | 24.x            |
| Language   | TypeScript                                         | ^5.9.3          |
| Framework  | Express                                            | ^5.2.1          |
| Database   | MongoDB + Mongoose                                 | ^8.19.4         |
| Validation | Zod                                                | ^4.4.3          |
| Auth       | jsonwebtoken + bcrypt                              | ^9.0.3 / ^6.0.0 |
| Logging    | Winston                                            | ^3.19.0         |
| Payments   | Plata by Monobank (custom)                         | —               |
| Email      | Resend API                                         | —               |
| Images     | Cloudinary                                         | ^2.10.0         |
| API Docs   | swagger-jsdoc + swagger-ui-express                 | ^6.3.0 / ^5.0.1 |
| Testing    | Jest + ts-jest + Supertest + mongodb-memory-server | ^29.7.0         |
| Linting    | ESLint + @typescript-eslint                        | ^8.57.0         |
| Formatting | Prettier                                           | ^3.8.3          |
| Git hooks  | Husky + lint-staged                                | ^9.0.11         |

---

## Directory map

```
src/
├── app.ts                    # createApp() factory — middleware chain, route mounts, error handlers
├── server.ts                 # Entry point — MongoDB connect, Express listen, graceful shutdown
├── cloudinary.ts             # Cloudinary SDK init
├── config/
│   ├── env.ts                # Zod-validated env — exports serverConfig, databaseConfig, jwtConfig, …
│   ├── database.ts           # connectDB() / disconnectDB()
│   ├── logger.ts             # Winston logger instance
│   └── swagger.ts            # swagger-jsdoc spec
├── controllers/              # Thin HTTP layer — one file per domain
│   ├── events.controller.ts
│   ├── registrations.controller.ts
│   ├── payments.controller.ts
│   ├── auth.controller.ts
│   ├── promoCodes.controller.ts
│   ├── adminPromoCodes.controller.ts
│   ├── results.controller.ts
│   └── webhooks.controller.ts
├── routes/                   # Express Router definitions — one file per domain
│   ├── events.routes.ts      → /api/events
│   ├── registrations.routes.ts → /api/registrations
│   ├── payments.routes.ts    → /api/payments
│   ├── auth.routes.ts        → /api/auth  (authLimiter applied)
│   ├── promoCodes.routes.ts  → /api/promo-codes
│   ├── admin.promoCodes.routes.ts → /api/admin/promo-codes
│   ├── cloudinary.routes.ts  → /api/cloudinary
│   └── webhooks.routes.ts    → /api/webhooks  (no rate limit)
├── services/                 # Business logic — one subdirectory per domain
│   ├── auth/
│   │   ├── auth.service.ts
│   │   ├── auth.oauth.service.ts
│   │   ├── auth.crypto.ts
│   │   ├── auth.helpers.ts
│   │   └── auth.types.ts
│   ├── events/
│   │   ├── events.service.ts
│   │   └── events.types.ts
│   ├── registrations/
│   │   ├── registrations.service.ts
│   │   └── registrations.types.ts
│   ├── payments/
│   │   ├── payments.service.ts
│   │   └── payments.types.ts
│   ├── email/
│   │   ├── email.service.ts
│   │   └── email.types.ts
│   ├── monobank/
│   │   └── monobank.service.ts
│   ├── promoCodes/
│   │   └── promoCodes.service.ts
│   └── results/
│       └── results.service.ts
├── models/                   # Mongoose Document interfaces + schemas
│   ├── Event.ts
│   ├── User.ts
│   ├── Registration.ts
│   ├── Payment.ts
│   ├── PromoCode.ts
│   ├── Result.ts
│   ├── RefreshToken.ts
│   ├── PasswordResetToken.ts
│   ├── OAuthState.ts
│   └── OAuthExchangeCode.ts
├── validators/               # Zod schemas — one file per domain
│   ├── events.validator.ts
│   ├── registrations.validator.ts
│   ├── payments.validator.ts
│   ├── auth.validator.ts
│   ├── promoCodes.validator.ts
│   ├── adminPromoCodes.validator.ts
│   └── webhooks.validator.ts
├── middleware/
│   ├── auth.middleware.ts        # authenticate / optionalAuthenticate; AuthRequest type
│   ├── authorization.middleware.ts # isEventOrganizer, isEventOrganizerOrAdmin
│   ├── admin.middleware.ts        # requireAdmin
│   ├── validation.middleware.ts   # validate(schema, ValidationType); ValidationType enum
│   ├── error.middleware.ts        # global error handler → structured JSON
│   ├── rateLimiter.middleware.ts  # apiLimiter, authLimiter
│   └── notFound.middleware.ts     # 404 catch-all
├── utils/
│   ├── asyncHandler.ts       # wraps async handlers, forwards errors to next()
│   ├── jwt.util.ts           # verifyAccessToken, sign helpers
│   ├── pagination.util.ts    # getPaginationParams(), formatPaginatedResponse(), PaginatedResponse<T>
│   ├── password.util.ts      # bcrypt helpers
│   ├── pricing.util.ts       # registration pricing logic
│   └── time.util.ts          # date/time helpers
├── types/
│   ├── errors.ts             # AppError, ValidationError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError
│   ├── codes.ts              # AUTH_CODES, EVENTS_CODES, … — all API_CODES; ErrorCode / SuccessCode types
│   └── express.d.ts          # req.validatedQuery, req.validatedParams augmentation
└── tests/
    ├── setup.ts              # mongodb-memory-server lifecycle (beforeAll/afterAll/afterEach)
    ├── health.test.ts
    └── pricing.util.test.ts
```

---

## Commands

| Script        | Command                 | When to use                       |
| ------------- | ----------------------- | --------------------------------- |
| Dev server    | `npm run dev`           | Local development with hot-reload |
| Build         | `npm run build`         | Compile TypeScript to `dist/`     |
| Start (prod)  | `npm start`             | Run compiled `dist/server.js`     |
| Type-check    | `npm run type-check`    | Check types without emitting      |
| Lint          | `npm run lint`          | Run ESLint on `src/**/*.ts`       |
| Lint + fix    | `npm run lint:fix`      | Auto-fix ESLint issues            |
| Format        | `npm run format`        | Prettier write on `src/**`        |
| Format check  | `npm run format:check`  | CI-safe format check              |
| Pre-commit    | `npm run pre-commit`    | type-check + lint + format:check  |
| Test          | `npm test`              | Run Jest suite                    |
| Test watch    | `npm run test:watch`    | Watch mode                        |
| Test coverage | `npm run test:coverage` | Coverage report in `coverage/`    |

---

## Conventions

### Layer boundaries

```
routes → controllers → services → models
```

- **Routes** (`src/routes/`): Wire middleware chain only. No logic.
- **Controllers** (`src/controllers/`): Extract validated request data, call one service method, return JSON. Zero business logic.
- **Services** (`src/services/<domain>/`): All business logic and DB access. Throw typed `AppError` subclasses — never `new Error(...)`.
- **Models** (`src/models/`): Mongoose schema + Document interface. No business logic.

### Adding a new domain resource

Every domain requires exactly 6 artifacts, always created together:

| File                                        | Purpose                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/validators/<domain>.validator.ts`      | Zod schemas for all request shapes                                              |
| `src/services/<domain>/<domain>.types.ts`   | TypeScript input/output interfaces for the service                              |
| `src/services/<domain>/<domain>.service.ts` | Business logic + DB access                                                      |
| `src/controllers/<domain>.controller.ts`    | Thin HTTP layer                                                                 |
| `src/routes/<domain>.routes.ts`             | Express Router                                                                  |
| `src/app.ts`                                | Register new router with `app.use('/api/<domain>', apiLimiter, <domain>Routes)` |

Also add domain codes to `src/types/codes.ts` following the `DOMAIN_CODES` const pattern.

### Route middleware chain (canonical pattern)

```typescript
router.get(
  '/:id',
  optionalAuthenticate, // or authenticate for protected routes
  validate(idSchema, ValidationType.PARAMS),
  asyncHandler(handler)
);
```

- Always wrap handlers in `asyncHandler` — never use `.catch(next)` inline.
- `authenticate` = required JWT, rejects 401 if missing/invalid.
- `optionalAuthenticate` = attaches `req.user` if token present, never rejects.
- `isEventOrganizerOrAdmin` / `requireAdmin` go after `authenticate`, before the handler.
- `validate(schema, ValidationType)` goes after auth, before handler. Uses `ValidationType.BODY`, `QUERY`, or `PARAMS`.

### Validation (Zod)

- Parsed values are stored in `req.validatedQuery` (QUERY), `req.validatedParams` (PARAMS), or `req.body` (BODY).
- The `objectIdRegex = /^[0-9a-fA-F]{24}$/` constant is defined locally in each validator file — do not redefine it; look to consolidate if adding a shared validators file.
- Pagination query fields (`page`, `limit`) follow this pattern in every query schema:
  ```typescript
  page: z.string().optional().transform(val => (val ? parseInt(val, 10) : 1)).refine(val => val > 0),
  limit: z.string().optional().transform(val => (val ? parseInt(val, 10) : 10)).refine(val => val > 0 && val <= 100),
  ```

### Pagination (services)

Always use `src/utils/pagination.util.ts`:

```typescript
const { page: parsedPage, limit: parsedLimit, skip } = getPaginationParams(page, limit);
const total = await Model.countDocuments(query);
const items = await Model.find(query).skip(skip).limit(parsedLimit).lean();
return formatPaginatedResponse(items, total, parsedPage, parsedLimit);
```

Response shape: `{ success: true, data: T[], pagination: { page, limit, total, totalPages } }`.

### Authentication and `req.user`

`req.user` shape (from `AuthRequest` in `src/middleware/auth.middleware.ts`):

```typescript
{ userId: string; isAdmin?: boolean; adminRole?: string | null }
```

Access it as `req.user!.userId` (after `authenticate`) or `req.user?.isAdmin ?? false` (after `optionalAuthenticate`).

### Error handling

Never throw raw `Error`. Use typed subclasses from `src/types/errors.ts`:

- `NotFoundError(message)` → 404
- `UnauthorizedError(message)` → 401
- `ForbiddenError(message)` → 403
- `ConflictError(message)` → 409
- `ValidationError(errors, code, statusCode)` → 400

Error codes come from `src/types/codes.ts`. Add domain-specific codes to the relevant `DOMAIN_CODES` const, then they're automatically included in `API_CODES` and the `ErrorCode` type.

### Partial update handlers

Do NOT write field-by-field `if (field !== undefined) updateData.field = field` loops. Instead, destructure `req.body` then build the update object with only defined fields using `Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined))` or a typed `pickDefined<T>()` utility.

### Mongoose models

- Always call `.lean()` on read queries to get plain objects (better performance, avoids Mongoose document overhead).
- Use `.select('field1 field2')` to project only needed fields.
- Model files: export the Mongoose `Model` as default and the Document interface / sub-types as named exports.

### Logging

Use `logger` from `src/config/logger.ts` (Winston). Use `logger.info()`, `logger.warn()`, `logger.error()`. Never use `console.log` in source files.

### Multilingual fields

Events have bilingual content in a `translations` field: `{ title: { en, uk }, description: { en, uk }, location: { en, uk }, … }`. A `lang` query param (`'en' | 'uk'`) resolves which translation to surface. Resolved fields are prefixed with `resolved` in the response (e.g., `resolvedTitle`, `resolvedDescription`).

### Tests

- Test files live in `src/tests/` and match `**/__tests__/**/*.ts` or `**/*.{spec,test}.ts`.
- All tests use the shared setup from `src/tests/setup.ts` (mongodb-memory-server lifecycle). The setup file is configured in `jest.config.js` as `setupFilesAfterFramework`.
- Import the app: `import app from '../app'` (the module exports `createApp()` result as default).
- Use `supertest` for HTTP assertions: `const res = await request(app).get('/api/...').expect(200)`.
- Seed test data via Mongoose models directly (not via API calls).
- `afterEach` in `setup.ts` clears all collections automatically — no manual cleanup needed per test.

---

## Do / Don't

| Do                                                                   | Don't                                                   |
| -------------------------------------------------------------------- | ------------------------------------------------------- |
| Throw typed `AppError` subclasses in services                        | Throw raw `Error` or `new Error(...)`                   |
| Use `asyncHandler()` for every route handler                         | Call `handler().catch(next)` inline                     |
| Store validated data in `req.validatedQuery` / `req.validatedParams` | Re-read raw `req.query` / `req.params` after validation |
| Use `.lean()` on all read-only Mongoose queries                      | Return full Mongoose Documents to controllers           |
| Use `getPaginationParams` + `formatPaginatedResponse`                | Hand-roll pagination math in services                   |
| Add new codes to `src/types/codes.ts` in the right const             | Use string literals as error codes                      |
| Register new routers in `src/app.ts` with `apiLimiter`               | Skip rate limiting on new routes                        |
| Use `logger` (Winston) for all log output                            | Use `console.log` / `console.error`                     |
| Use `ValidationType.QUERY` for query params (not BODY)               | Mix up BODY/QUERY/PARAMS enum values                    |
| Import `AuthRequest` from `src/middleware/auth.middleware`           | Re-define the user type inline                          |

---

## Where to look for X

| What                                                     | Where                                             |
| -------------------------------------------------------- | ------------------------------------------------- |
| JWT verify / sign                                        | `src/utils/jwt.util.ts`                           |
| Bcrypt hash / compare                                    | `src/utils/password.util.ts`                      |
| DB connection                                            | `src/config/database.ts`                          |
| Environment variables                                    | `src/config/env.ts` (all envs validated with Zod) |
| Pagination helpers                                       | `src/utils/pagination.util.ts`                    |
| Error classes                                            | `src/types/errors.ts`                             |
| Error / success codes                                    | `src/types/codes.ts`                              |
| `req.validatedQuery` type augmentation                   | `src/types/express.d.ts`                          |
| Auth middleware (`authenticate`, `optionalAuthenticate`) | `src/middleware/auth.middleware.ts`               |
| Admin guard (`requireAdmin`)                             | `src/middleware/admin.middleware.ts`              |
| Organizer/admin guard                                    | `src/middleware/authorization.middleware.ts`      |
| Validation middleware (`validate()`, `ValidationType`)   | `src/middleware/validation.middleware.ts`         |
| Winston logger                                           | `src/config/logger.ts`                            |
| Route mounting order                                     | `src/app.ts`                                      |
| Monobank payment integration                             | `src/services/monobank/monobank.service.ts`       |
| Pricing logic                                            | `src/utils/pricing.util.ts`                       |
| Test MongoDB lifecycle                                   | `src/tests/setup.ts`                              |

---

## Workflow

- Branch off `develop` (not `main`).
- Pre-commit triad (runs automatically via Husky): `npm run type-check && npm run lint && npm run format:check`. Run manually with `npm run pre-commit`.
- PR convention: target `develop`, describe what changed and why, link related issues.
- No CI pipeline exists — run the pre-commit triad locally before pushing.
- Swagger docs auto-generated at `/api-docs` from JSDoc comments in route files.
