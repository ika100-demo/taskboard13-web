---
spec_id: 001-task-board-start-page-that-lists-tasks
title: Task board start page that lists tasks and adds a task through the Task API
status: done
priority: P1
shape: web-nextjs
parent: ika100-demo/taskboard13-gitops:001-persistent-tasks-in-postgres-with-a-web
---

# 001 — Task board start page that lists tasks and adds a task through the Task API

## Problem

The taskboard13 Task API keeps tasks in memory, so every restart or redeploy of the API empties the board, and nobody can rely on a task still being there. The only way to see or add tasks is to call the API by hand, because the web component has no features yet. This spec makes the board usable: tasks are kept in a Postgres database that belongs to the system, and people see and create tasks in the web UI.

## System context

Slice of the system plan `001-persistent-tasks-in-postgres-with-a-web` in `ika100-demo/taskboard13-gitops` for `taskboard13-web` (web-nextjs). The system criteria and the contract below are binding: every criterion of this spec implements one of them and names it: `(system AC-<NNN>.<n>)`.

### System criteria

- **AC-001.2** Given tasks exist, when a person opens the web UI's start page, then it lists every task the API returns, oldest first, each showing its title and its due date as `YYYY-MM-DD`, or "No due date" when it has none; given no tasks exist, the page shows "No tasks yet".
- **AC-001.3** Given a task whose title is `<b>Buy milk</b>`, when a person opens the start page, then the title is shown literally as the text `<b>Buy milk</b>` and is not interpreted as markup.
- **AC-001.4** Given the start page is open, when a person enters the title "Buy milk" and the due date 2026-12-01 and submits the form, then "Buy milk" with 2026-12-01 appears at the end of the list without a manual page reload, the form is cleared, and `GET /tasks` on the API also returns the task.
- **AC-001.5** Given the start page is open, when a person submits the form with a title only, then the task appears at the end of the list with "No due date".
- **AC-001.6** Given the start page is open, when a person submits the form with an empty or whitespace-only title or a title longer than 200 characters, then a message next to the title field says what is wrong, the entered values stay in the form, and no task is created (the list and `GET /tasks` are unchanged).
- **AC-001.8** Given the API cannot list tasks (unreachable or answering an error), when a person opens the start page or submits the form, then the page shows "Tasks could not be loaded. Please try again." (or "The task could not be saved. Please try again." for the form) instead of an empty list, and keeps the entered values in the form.

### Contract

Between `taskboard13-web` (caller, server side only) and `taskboard13-api`. Base URL: env `TASKBOARD13_API_URL` (cluster: `http://taskboard13-api`). No auth (non-goal), no prefix, JSON in and out (`Content-Type: application/json`). The existing contract of the API's spec `001-create-and-list-tasks-in-memory` stays unchanged except for the `503` added below.

### `GET /tasks`

- `200` — JSON array of `{"id": string, "title": string, "due_date": "YYYY-MM-DD" | null}`, creation order, oldest first; `[]` when none. Values identical to the `201` responses, also across API restarts and redeploys.
- `503` — database unreachable: `{"error": "<non-empty message>"}`.

### `POST /tasks`

Request: `{"title": string, "due_date": "YYYY-MM-DD" | null}`; `title` 1 to 200 characters with at least one non-whitespace character, stored as sent; `due_date` absent or `null` means no due date; unknown fields ignored. The web always sends both fields (`due_date: null` when none).

- `201` — the created task `{"id": "<32 lowercase hex>", "title", "due_date"}`; it is in every later `GET /tasks`.
- `422` — validation failed, nothing stored; FastAPI body `{"detail": [{"loc": ["body", "<field>", ...], "msg": "<text>", "type": "...", "input": ...}]}`. Validation runs before any database access, so an invalid body answers `422` even while the database is down. The web maps an entry whose `loc` contains `"title"` to the title field message; a `422` for any other field is treated as an unlisted response.
- `503` — database unreachable: `{"error": "<non-empty message>"}`, nothing stored.

### Probes (API)

- `GET /health` — `200` while the process runs, independent of the database (so Kubernetes does not restart the API during a database outage).
- `GET /ready` — `200` when a database round trip (`SELECT 1`) succeeds, `503` otherwise; it turns `200` again by itself when the database is back.

### Errors

- API errors outside validation use `{"error": "<human-readable message>"}` with status `503` (database unreachable or timing out) or `500` (unexpected); validation errors use the FastAPI `422` body above. Messages never contain connection strings or credentials.
- The web treats every response the contract does not list for that call (any other status, a non-JSON or malformed body, a `422` not naming `title`) like an unreachable API: on load "Tasks could not be loaded. Please try again.", on submit "The task could not be saved. Please try again." with the entered values kept. It never shows an empty list or "No tasks yet" in that case, and never retries a `POST` by itself (no duplicate tasks).

### Timeouts

- Web → API: 5 s total per call (`GET /tasks` and `POST /tasks`), connect included; a timeout or refused connection is handled like an unlisted response (above). No automatic retry; the person retries.
- API → database: connect timeout 3 s and statement timeout 5 s; when either hits, the request answers `503` within about 5 s, so it stays inside the web's 5 s budget in the common case. `/ready`'s check uses a 2 s timeout.
- When the database is down the API keeps running (`/health` 200, `/ready` 503) and reconnects on later requests without a restart; Kubernetes takes the API out of its Service while not ready, so the web then gets a refused or timed-out connection, which it shows as the AC-001.8 messages.

### Provided by the system

The gitops part of this plan wires these for this repo; rely on them, do not ask for them again:

- env `TASKBOARD13_API_URL=http://taskboard13-api`

### Notes for this repo

The API base URL comes from the server-side env TASKBOARD13_API_URL (http://taskboard13-api in the
cluster); the browser never calls the API directly: list loading and form submission go through
the web's own server side (server component, route handler or server action).
The start page / replaces the template's landing page.

## Stories

<!-- As a <persona>, I want <goal>, so that <benefit>. -->

## Acceptance criteria

- **AC-001.1** Given GET /tasks on the API returns tasks, when a person opens the start page /, then it lists every returned task in the API's order (oldest first), each with its title and its due_date as YYYY-MM-DD, or the text "No due date" when due_date is null (system AC-001.2)
- **AC-001.2** Given GET /tasks on the API returns [], when a person opens the start page, then it shows "No tasks yet" (system AC-001.2)
- **AC-001.3** Given the API returns a task titled <b>Buy milk</b>, when a person opens the start page, then the page shows the literal text <b>Buy milk</b> and no <b> element is created from it (system AC-001.3)
- **AC-001.4** Given the start page is open, when a person enters the title "Buy milk", picks the due date 2026-12-01 in the date picker and submits the form above the list, then the web sends POST /tasks with {"title": "Buy milk", "due_date": "2026-12-01"} and, on 201, "Buy milk" with 2026-12-01 appears at the end of the list without a page reload and the form is cleared (system AC-001.4)
- **AC-001.5** Given the start page is open, when a person submits the form with a title and no due date, then the web sends POST /tasks with due_date null and the task appears at the end of the list with "No due date" (system AC-001.5)
- **AC-001.6** Given the start page is open, when a person submits an empty or whitespace-only title or one longer than 200 characters, then a message next to the title field says what is wrong, the entered values stay in the form, the list is unchanged and no POST /tasks is sent (system AC-001.6)
- **AC-001.7** Given the API answers POST /tasks with 422 naming the field title, when a person submits the form, then the same kind of message appears next to the title field, the entered values stay in the form and the list is unchanged (system AC-001.6)
- **AC-001.8** Given the API is unreachable, too slow (over 5 s) or answers a status the contract does not list, when a person opens the start page, then it shows "Tasks could not be loaded. Please try again." instead of a list; when a person submits the form, then it shows "The task could not be saved. Please try again." and keeps the entered values (system AC-001.8)

## Non-goals

## Assumptions

<!-- Spec 149: decisions taken by default, approved with the spec. One bullet each: - **A1** <the decision> (other option: <…>; affects AC-…). A revised one is struck through (~~…~~), never deleted. -->

## Open questions

<!-- Only what may not be decided by default (spec 149): security or access, money, destroying or migrating data, or a request too ambiguous to build. Approval is refused while any is open. Strike answered ones (~~…~~) and fold the answer into the criteria. -->

## Changelog

- 2026-11-13 created from the system plan, with its criteria (spec 147)
- 2026-11-13 approved
- 2026-11-13 building
- 2026-11-13 done
