---
description: Analyze the current diff for cross-repo contract changes (API, types, env, auth, errors) and emit a paste-ready prompt for the sibling repo.
argument-hint: [--range <git-range>] [--target <name-or-path>] [--quiet]
allowed-tools: Read, Glob, Grep, Bash(git diff:*), Bash(git log:*), Bash(git status:*), Bash(git rev-parse:*), Bash(git branch:*)
---

# /cross-repo-sync

Detect whether the current diff likely requires matching changes in a sibling repository (frontend ↔ backend), and emit a structured prompt for that repo's Claude Code session.

## When to invoke

After making changes that touch any of:

- API client wrappers / route handlers
- Request/response types or DTOs / shared schemas
- Env vars consumed by either side
- Auth headers / tokens / cookies
- Error codes / status code conventions
- Pagination / filter / sort param shapes

Not needed for: pure UI tweaks, copy edits, internal refactors with stable contracts, tests.

## Arguments

- `--range <git-range>` — git range to analyze. Defaults to staged+unstaged (`HEAD` working tree).
- `--target <name-or-path>` — sibling repo name or absolute path. If absent, ask the user.
- `--quiet` — emit ONLY the final prompt block, no preamble.

## Procedure

### 1. Identify scope

- If `--range` was supplied, `git diff <range>`. Otherwise compare working tree against `HEAD` (`git diff HEAD`) PLUS include staged via `git diff --cached`. Dedupe by path.
- Capture: list of changed files, last commit hash + subject (`git log -1 --pretty=format:"%h %s"`), current branch.
- If diff is empty, abort with: `No changes detected in range — nothing to sync.`

### 2. Identify this repo's role (informational only)

Inspect package.json / pyproject.toml / go.mod / Cargo.toml / pom.xml / Gemfile to label source side as frontend or backend in the emitted prompt.

### 3. Scan for cross-repo signals

For every changed file, apply these heuristics. Bias toward false positives — better to surface a non-issue than miss a contract drift.

**A. HTTP route/path strings**

- Method + path literals: `GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS` followed by a URL-like path
- Client calls: `apiClient.<method>("...")`, `fetch("...", ...)`, `axios.<method>("...")`
- Backend route definitions: `@(Get|Post|Put|Patch|Delete)("...")`, `router.<method>("...")`, `app.<method>("...")`, `path("...", ...)`
- Files matching `**/routes/**`, `**/controllers/**`, `**/api/**`, `**/handlers/**`, `**/endpoints/**`

**B. Shared types / DTOs / schemas**

- `types/**`, `**/dto/**`, `**/dtos/**`, `**/schemas/**`, `**/models/**`, `**/entities/**`
- Zod / Joi / Yup / Pydantic / marshmallow schema files
- OpenAPI / GraphQL SDL files (`.openapi.*`, `*.graphql`, `*.gql`)
- Prisma `schema.prisma`, TypeORM entities, SQLAlchemy models, GORM models

**C. Env vars**

- New/changed lines in `.env.example`, `.env.sample`, `.env.template`
- `process.env.X`, `os.getenv("X")`, `Deno.env.get("X")`, `std::env::var("X")`
- Config files referencing env

**D. Auth / session**

- Lines containing `Authorization`, `Bearer `, `X-API-Key`, `cookie`, `session`, `csrf`, `jwt`, `refresh_token`, `access_token`
- `**/middleware/**`, `**/guards/**`, `**/interceptors/**`

**E. Error / status codes**

- `status: \d{3}`, `statusCode: \d{3}`, `res.status(\d{3})`, `HTTPException(status_code=`, `throw new HttpException`, `c.JSON(\d{3}`, `w.WriteHeader(\d{3}`
- Custom error code enums

**F. Pagination / filter conventions**

- Param names: `page`, `limit`, `offset`, `cursor`, `pageSize`, `perPage`, `sort`, `order`, `q`, `search`, `filter` when newly appearing as request keys

### 4. Cluster findings

Group into: API contracts / Shared types / Env vars / Auth / Errors / Pagination. For each: one-line description + source `path:start-end` + short relevant diff snippet (3-10 lines).

### 5. Confirm with the user (unless --quiet)

- 1+ findings: list as numbered preview, ask user to confirm / drop false positives.
- 0 findings: print `No cross-repo signals detected in this range.` and exit.

### 6. Resolve target name

- If `--target` provided, use verbatim.
- Else look for sibling repos in `~/Documents/Personal/`, `~/code/`, `~/src/`, `~/dev/` by similar root name. If one match, suggest it.
- Else ask the user.

### 7. Emit the final prompt

A single fenced markdown block with this structure:

```
# Cross-repo sync required

**Source repo:** <repo-name> (<frontend|backend>)
**Branch:** <branch>
**Last commit:** <hash> <subject>

## Changes requiring attention

### API contracts
<numbered list with path:line and snippet>

### Shared types
<...>

### Env vars
<...>

### Auth
<...>

### Errors / status codes
<...>

### Pagination / filters
<...>

## Suggested actions

For each finding above, check whether your repo:
1. Consumes this endpoint / type / env var / auth header / error code
2. Needs to update its client calls, type definitions, or config accordingly

Run `/cross-repo-sync` in this repo after you make changes to surface any reverse drift.
```

Print this block so the user can paste it directly into the sibling repo's Claude Code session.
