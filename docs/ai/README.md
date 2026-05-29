# AI Assistant Configuration — gorun-backend

This directory contains the human documentation for the AI assistant setup in this repo.

---

## Topology

| Tool                  | Reads from                                                  | How                                           |
| --------------------- | ----------------------------------------------------------- | --------------------------------------------- |
| Claude Code           | `AGENTS.md` (via `CLAUDE.md` symlink)                       | Automatically on session start                |
| Gemini CLI            | `AGENTS.md` (via `GEMINI.md` symlink)                       | Automatically on session start                |
| GitHub Copilot        | `AGENTS.md` (via `.github/copilot-instructions.md` symlink) | Automatically injected into context           |
| Cursor                | `.cursor/rules/*.mdc`                                       | Injected by glob match or `alwaysApply: true` |
| Claude Code subagents | `.claude/agents/*.md`                                       | Invoked by description match                  |
| Claude Code skills    | `.claude/skills/*/SKILL.md`                                 | Invoked via `/skill-name` slash command       |
| Claude Code commands  | `.claude/commands/*.md`                                     | Invoked via `/<command-name>`                 |

**Single source of truth**: `AGENTS.md` — edit only this file for project docs. `CLAUDE.md`, `GEMINI.md`, and `.github/copilot-instructions.md` are symlinks and require no maintenance.

---

## How to update conventions

1. Edit `AGENTS.md` directly.
2. All symlinked files (`CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`) update automatically.
3. If the convention also affects a specific layer (controllers, services, etc.), update the matching `.cursor/rules/*.mdc` file to keep Cursor in sync.

---

## How to add a new agent

1. Create `.claude/agents/<name>.md`
2. Required frontmatter:
   ```yaml
   ---
   name: <kebab-case>
   description: <when to invoke — specific trigger condition, not generic>
   tools: Read, Edit, Write, Grep, Glob, Bash(<specific>:*)
   model: inherit
   ---
   ```
3. Body structure: context → specialty → how it works → output contract → anti-patterns
4. Verify Claude Code picks it up: `/agents` in a new session should list it

---

## How to add a new skill

1. Create the directory: `.claude/skills/<skill-name>/`
2. Create `.claude/skills/<skill-name>/SKILL.md` with frontmatter:
   ```yaml
   ---
   name: <skill-name>
   description: <when this skill applies — one line>
   ---
   ```
3. Body: inputs → numbered procedure → file shape checklist → anti-patterns
4. Optional: add `reference/*.txt` files for template snippets
5. Invoke with `/<skill-name>` in Claude Code

---

## How to add a new slash command

1. Create `.claude/commands/<command-name>.md` with frontmatter:
   ```yaml
   ---
   description: <one-line summary shown in autocomplete>
   argument-hint: <args or (no arguments)>
   allowed-tools: Read, Edit, Bash(<specific>:*)
   ---
   ```
2. Body: describe what the command does and the exact steps
3. Invoke with `/<command-name>` in Claude Code

---

## How to add a Cursor rule

1. Create `.cursor/rules/<NN>-<name>.mdc` (number for ordering)
2. Required frontmatter (comma-separated string for globs, NOT YAML array):
   ```yaml
   ---
   description: <when this rule applies>
   globs: src/controllers/**/*.ts, src/middleware/**/*.ts
   alwaysApply: false
   ---
   ```
3. Use `alwaysApply: true` ONLY for `00-project-overview.mdc`
4. Keep globs tight — scope to the directories the rule actually governs
5. Content must be specific to this repo (real file paths, real conventions)

---

## Tool quirks

### Cursor MDC frontmatter

`globs` must be a **comma-separated string**, not a YAML array:

```yaml
# Correct:
globs: src/controllers/**/*.ts, src/services/**/*.ts

# Wrong (Cursor ignores this):
globs:
  - src/controllers/**/*.ts
  - src/services/**/*.ts
```

### Windows + symlinks

`CLAUDE.md`, `GEMINI.md`, and `.github/copilot-instructions.md` are Unix symlinks. On Windows, symlink creation requires Developer Mode or admin rights. If a teammate is on Windows without symlink support, switch to pointer stubs:

```bash
echo "See AGENTS.md for full documentation." > CLAUDE.md
```

### Per-developer settings

`.claude/settings.local.json` is gitignored. Use it for personal overrides (e.g., additional allow rules for your local setup) that shouldn't affect teammates.

### settings.json management

The harness may auto-append to `.claude/settings.json` when you approve tool calls interactively. This overwrites the committed content. Re-write the file after an interactive session adds unwanted entries. The `deny` list and `hooks` config are the important parts to preserve.

---

## Where to file issues with the AI setup

Open an issue or PR in this repo. Tag it `ai-config`. Changes to `AGENTS.md` are the most impactful — agents follow the docs literally, so inaccuracies cause confident wrong behavior.
