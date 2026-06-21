# CFZZS Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace user-visible ZJDCRM branding with CFZZS without renaming deployed Cloudflare resources or repository identifiers.

**Architecture:** Update the static fallback brand, runtime metadata, visible documentation labels, and exported file prefix. Preserve lowercase technical identifiers such as `zjdcrm`, `zjdcrm-db`, `zjdcrm-files`, Worker/Pages project names, repository URL, API health service, and existing file paths.

**Tech Stack:** React, Vite, Hono, D1, Playwright, Vitest.

---

### Task 1: Lock the new default brand with tests

**Files:**
- Modify: `tests/unit/app-smoke.test.ts`
- Modify: `tests/e2e/app.spec.ts`

- [ ] Change the expected app name and browser title to `CFZZS`.
- [ ] Run the focused tests and confirm they fail against the current `ZJDCRM` values.

### Task 2: Update all user-visible brand fallbacks

**Files:**
- Modify: `src/app/meta.ts`
- Modify: `src/app/AppShell.tsx`
- Modify: `src/app/AdminShell.tsx`
- Modify: `src/features/auth/LoginPage.tsx`
- Modify: `index.html`
- Modify: `.env.example`
- Modify: `server/modules/workflows/workflows.routes.ts`
- Modify: `src/styles/global.css`

- [ ] Replace visible defaults and metadata with `CFZZS`.
- [ ] Change exported CSV names from `zjdcrm-clues-*.csv` to `cfzzs-clues-*.csv`.
- [ ] Run focused unit, integration, build, and browser tests.

### Task 3: Synchronize product documentation labels

**Files:**
- Modify: `README.md`
- Modify: `AGENT_HANDOFF_PROMPT.md`
- Modify: `LICENSE`
- Modify: `migrations/0005_seed.sql`
- Modify: product-name headings/descriptions in existing design and implementation documents.

- [ ] Replace product-display references while retaining exact technical resource names, repository URLs, commands, and paths.
- [ ] Search the repository and confirm remaining `ZJDCRM` references are technical identifiers only.

### Task 4: Publish and verify production

- [ ] Run `npm run test:run`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run e2e`.
- [ ] Commit and push only `main`.
- [ ] Wait for GitHub Actions and Pages deployment.
- [ ] Log into production as `admin`, set `site_name` to `CFZZS`, and verify login, business shell, admin shell, all route headings, employee management, attachments, import/export, and recovery pages.
