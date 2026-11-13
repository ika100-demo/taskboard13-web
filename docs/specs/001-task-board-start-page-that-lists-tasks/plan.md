---
spec_id: 001-task-board-start-page-that-lists-tasks
shape: web-nextjs
spec_hash: 1cdfca581269
summary: Start page lists the Task API's tasks and adds a task through a Server Action, with validation and error states
tasks:
  - id: t1
    title: Add the server-side Task API client
    files: [lib/tasks-api.ts, docs/env-vars.md]
    covers: [AC-001.1, AC-001.2, AC-001.4, AC-001.5, AC-001.7, AC-001.8]
    parallel_safe: true
    depends_on: []
    done: true
  - id: t2
    title: Add shared title validation and UI messages
    files: [lib/task-validation.ts]
    covers: [AC-001.6, AC-001.7, AC-001.8]
    parallel_safe: true
    depends_on: []
    done: true
  - id: t3
    title: Add the create Server Action and the TaskBoard client component
    files: [app/actions.ts, app/_components/task-board.tsx]
    covers: [AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5, AC-001.6, AC-001.7, AC-001.8]
    parallel_safe: true
    depends_on: [t1, t2]
    done: true
  - id: t4
    title: Replace the landing page with the task board start page
    files: [app/page.tsx, app/globals.css, app/_components/feature-card.tsx, app/_components/icons.tsx, tests/page.test.tsx, e2e/home.spec.ts, e2e/smoke.spec.ts]
    covers: [AC-001.1, AC-001.2, AC-001.3, AC-001.8]
    parallel_safe: true
    depends_on: [t1, t2, t3]
    done: true
---

# Plan — 001 Task board start page that lists tasks and adds a task through the Task API

Contract, messages and selectors: [design.md](design.md). Levels: t1, t2 → t3 → t4.

## t1 — Add the server-side Task API client

**Files:** lib/tasks-api.ts, docs/env-vars.md
**Covers:** AC-001.1, AC-001.2, AC-001.4, AC-001.5, AC-001.7, AC-001.8
**Goal:** one module that talks to the Task API as the design's `lib/tasks-api.ts` contract says, and turns every unlisted response into a plain failure.

**Implementation notes:**
- Export `Task`, `ListTasksResult`, `CreateTaskResult`, `listTasks`, `createTask` with the signatures in design.md. No import from `lib/task-validation.ts` (that is t2's file; the message mapping lives in the action).
- Read `TASKBOARD13_API_URL` on every call; strip a trailing `/`; unset or empty is a `config` failure without a request.
- `fetch` with `cache: "no-store"`, JSON headers and `signal: AbortSignal.timeout(5000)`; read and parse the body inside the same try, so a slow body also counts as a timeout.
- Check every task item (id non-empty string, title string, due_date `null` or `YYYY-MM-DD`); keep the API's order; drop extra fields.
- `422` gives `title_invalid` only when some `detail[].loc` contains `"title"`; every other non-listed answer gives `failed`.
- Never retry; log one `logger.warn` per failure with `op`, `status`, `reason` and nothing else (no URL, no title).
- Add `TASKBOARD13_API_URL` to `docs/env-vars.md` (Core table) as in design.md.

**Done when:** the acceptance tests that call `listTasks`/`createTask` with a stubbed `fetch` pass (POST body with a `due_date` value or `null`, `422` naming `title` vs another field, `503`/other status/bad body/timeout as failure), and `devbox run quality` is clean.

## t2 — Add shared title validation and UI messages

**Files:** lib/task-validation.ts
**Covers:** AC-001.6, AC-001.7, AC-001.8
**Goal:** the validation rules and the exact user-facing strings, used by the browser and the Server Action.

**Implementation notes:**
- Export the constants and `validateTitle`, `isDueDate` exactly as in design.md; no server-only imports (the client component uses this module).
- `validateTitle`: `title.trim() === ""` gives `TITLE_REQUIRED`; `Array.from(title).length > 200` gives `TITLE_TOO_LONG`; else `null`. Never trim the title that is sent.

**Done when:** acceptance tests on the validation rules (empty, whitespace-only, 200 vs 201 code points) pass; `devbox run quality` is clean.

## t3 — Add the create Server Action and the TaskBoard client component

**Files:** app/actions.ts, app/_components/task-board.tsx
**Covers:** AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5, AC-001.6, AC-001.7, AC-001.8
**Goal:** the form above the list, with local list state, field and save errors, and the Server Action it calls.

**Implementation notes:**
- `app/actions.ts`: `"use server"`; `createTaskAction` returns `CreateTaskActionResult`. It re-validates the title, then checks that `due_date` is `null` or `isDueDate`, and only then calls `createTask`. It maps the client's `title_invalid` to `validateTitle(title) ?? TITLE_REJECTED`.
- `task-board.tsx`: `"use client"`; props `{ initialTasks: Task[] }` (type-only import from `@/lib/tasks-api`); state: tasks, title, dueDate, titleError, saveError, pending (`useTransition`).
- Markup, labels, ids, roles and texts exactly as in design.md "Page and UI"; the title is rendered as a text child only.
- Submit:
  - `preventDefault`, then clear `saveError`.
  - Validate in the browser; on failure, do not call the action.
  - Call `createTaskAction({ title, due_date: dueDate || null })`.
  - Handle `created`, `title_invalid`, `failed` and a thrown error as design.md says.
- Show the due date as the API's string in `<time dateTime>`, "No due date" for `null`, and "No tasks yet" when the list is empty.

**Done when:** these acceptance tests pass, with `@/app/actions` mocked where they render `TaskBoard`:
- AC-001.1 to AC-001.8 on `TaskBoard`: list rendering, the literal title, append without reload, form cleared, no action call on an invalid title, the `422` title message, a failed save that keeps the values and the list.
- The `createTaskAction` tests.

Also `devbox run quality` is clean.

## t4 — Replace the landing page with the task board start page

**Files:** app/page.tsx, app/globals.css, app/_components/feature-card.tsx, app/_components/icons.tsx, tests/page.test.tsx, e2e/home.spec.ts, e2e/smoke.spec.ts
**Covers:** AC-001.1, AC-001.2, AC-001.3, AC-001.8
**Goal:** `/` is the task board: it loads the tasks on the server and renders `TaskBoard`, or the load error.

**Implementation notes:**
- `app/page.tsx`: `export const dynamic = "force-dynamic"`; async `HomePage` calls `listTasks()`; always one `<h1>` "Task board"; failure renders the `LOAD_FAILED` alert and a "Try again" link to `/`, no list and no form.
- Delete `app/_components/feature-card.tsx` and `app/_components/icons.tsx` (unused afterwards; they would lower the `app/**` coverage).
- `app/globals.css`: styles for the form, field error, alert and list on the existing tokens; the page must not scroll horizontally at 375 px.
- `tests/page.test.tsx` is a template test, not an acceptance test. Drop its landing-page assertions. Keep a check that the page renders its `<h1>` "Task board" with `fetch` stubbed, or delete the file if the acceptance tests already cover the page.
- `e2e/home.spec.ts`:
  - Expect the heading "Task board" instead of "taskboard13-web".
  - Remove the "Check health" link test, but keep checking that `/api/health` answers.
  - Keep the 404 and 375 px checks.

  The local run has no API, so the page shows the load error; every check must hold for that page.
- `e2e/smoke.spec.ts`:
  - Keep the read-only check (any `<h1>`).
  - Add a read-only `@smoke` test: `/` shows the "Tasks" list or "No tasks yet", not the load error.
  - Add a `@smoke @writes` test: it adds `smoke-<uuid>` with no due date and sees it at the end of the list.

**Done when:**
- All acceptance tests for AC-001.1 to AC-001.8 pass.
- `devbox run test` keeps the 80 % coverage gate.
- `devbox run quality` is clean.
- `devbox run e2e` passes.
