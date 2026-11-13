# Design — 001 Task board start page that lists tasks and adds a task through the Task API

## Decisions

- **Reads in a Server Component, writes through a Server Action, both through one typed client in `lib/tasks-api.ts`.** The browser never sees `TASKBOARD13_API_URL` or calls the API (spec "Notes for this repo"). A Server Action needs no public route of our own, which a route handler would. The page is `force-dynamic`, so `next build` never calls the API and every visit lists the current tasks.
- **The client component holds the list and the form state** (`app/_components/task-board.tsx`, `"use client"`). It gets the first tasks as props and appends the task from the `201` locally (AC-001.4, AC-001.5: no reload, no refetch, API order kept). Its inputs are controlled, so the entered values stay after every failure (AC-001.6 to AC-001.8).
- **Validation runs in the browser first and again in the Server Action** (`lib/task-validation.ts`, shared). An invalid title never reaches the action, so no `POST /tasks` is sent (AC-001.6). The action checks again and does not call the API for an invalid body.
- **Title length counts Unicode code points** (`Array.from(title).length`), not UTF-16 units, so the web limit matches the API's (Pydantic counts code points). The title is sent as entered, not trimmed ("stored as sent").
- **Due dates are shown exactly as the API returns them** (`YYYY-MM-DD` string), never parsed into a `Date`, so no time zone can shift the day (AC-001.1).
- **Titles are rendered as React text only**, never through `dangerouslySetInnerHTML`, so `<b>Buy milk</b>` is literal text (AC-001.3).
- **Any response the contract does not list counts as "unavailable"**: that covers other statuses, non-JSON or malformed bodies, a `422` that does not name `title`, and a timeout (5 s through `AbortSignal.timeout(5000)`, reading the body included). It also covers a refused connection and a missing `TASKBOARD13_API_URL`. No retries, so no duplicate tasks.
- **On a load failure the page shows only the load error** (in an alert, with a "Try again" link to `/`), no list and no form: a task added there could not be shown in its place in the list.
- **`/api/ready` stays independent of the Task API.** Tying readiness to the API would take the web out of its Service during an API outage, and the person would get no page at all instead of the AC-001.8 message.
- **No ADR**: these choices are local to this feature and fit the template's App Router conventions (ADR-004).

## Modules

| Module | Responsibility | New / changed |
|---|---|---|
| `lib/tasks-api.ts` | server-side client: `listTasks`, `createTask`, base URL, 5 s timeout, response checking, structured logs | new |
| `lib/task-validation.ts` | `validateTitle`, `isDueDate`, the user-facing messages | new |
| `app/actions.ts` | `"use server"`: `createTaskAction` (re-validates, calls `createTask`, maps a `422` to the field message) | new |
| `app/_components/task-board.tsx` | `"use client"`: form above the list, local list state, field and save errors | new |
| `app/page.tsx` | async Server Component: `listTasks()`, renders `TaskBoard` or the load error | replaced (template landing page goes) |
| `app/_components/feature-card.tsx`, `app/_components/icons.tsx` | template landing page parts | deleted |
| `app/globals.css` | board, form and error styles on the existing design tokens | changed |
| `docs/env-vars.md` | documents `TASKBOARD13_API_URL` | changed |

## Contract

### Task API (upstream, binding from the system plan)

Exactly as in the spec's "Contract" section: `GET /tasks` (`200` array, `503`), `POST /tasks` (`201`, `422` FastAPI body, `503`), base URL `TASKBOARD13_API_URL`, 5 s per call, no retry.

### `lib/tasks-api.ts` (server only)

```ts
export type Task = { id: string; title: string; due_date: string | null }; // due_date: "YYYY-MM-DD" | null

export type ListTasksResult = { ok: true; tasks: Task[] } | { ok: false };

export type CreateTaskResult =
  | { status: "created"; task: Task }
  | { status: "title_invalid" } // the API answered 422 naming "title"
  | { status: "failed" };

export function listTasks(): Promise<ListTasksResult>;
export function createTask(input: { title: string; due_date: string | null }): Promise<CreateTaskResult>;
```

- Base URL: `process.env.TASKBOARD13_API_URL`, read on every call, trailing `/` stripped; URL `${base}/tasks`. Unset or empty: no request, logged with `logger.error`, result `{ ok: false }` / `{ status: "failed" }`.
- Request: `fetch(url, { method, headers: { "Content-Type": "application/json", Accept: "application/json" }, body, cache: "no-store", signal: AbortSignal.timeout(5000) })`. `POST` body is always `{"title": <as entered>, "due_date": "<YYYY-MM-DD>" | null}`.
- `listTasks`: a `200` whose JSON body is an array of valid items gives `{ ok: true, tasks }` in the API's order, extra fields dropped. A valid item has `id` (non-empty string), `title` (string) and `due_date` (`null` or a `^\d{4}-\d{2}-\d{2}$` string). Anything else gives `{ ok: false }`: other status, `503`, bad JSON, a bad item, a thrown error, a timeout.
- `createTask`: `201` with a body that passes the same item check gives `created`. `422` whose `detail` is an array with an entry whose `loc` array contains `"title"` gives `title_invalid`. Anything else gives `failed`.
- Every failure logs one `logger.warn("tasks api call failed", { op: "list" | "create", status?: number, reason: "status" | "body" | "timeout" | "network" | "config" })`. Never log the base URL, request bodies or titles.

### `lib/task-validation.ts` (browser and server)

```ts
export const TITLE_MAX = 200;
export const TITLE_REQUIRED = "Enter a title.";
export const TITLE_TOO_LONG = "The title can have at most 200 characters.";
export const TITLE_REJECTED = "The title was not accepted. Please check it.";
export const LOAD_FAILED = "Tasks could not be loaded. Please try again.";
export const SAVE_FAILED = "The task could not be saved. Please try again.";
export const NO_TASKS = "No tasks yet";
export const NO_DUE_DATE = "No due date";

/** null when valid; TITLE_REQUIRED when empty or whitespace-only; TITLE_TOO_LONG when over 200 code points. */
export function validateTitle(title: string): string | null;
/** true for a "YYYY-MM-DD" string. */
export function isDueDate(value: string): boolean;
```

### `app/actions.ts`

```ts
"use server";
export type CreateTaskActionResult =
  | { status: "created"; task: Task }
  | { status: "title_invalid"; message: string }
  | { status: "failed" };

export async function createTaskAction(input: { title: string; due_date: string | null }): Promise<CreateTaskActionResult>;
```

- `validateTitle(input.title)` fails: `{ status: "title_invalid", message }`, no API call.
- `due_date` neither `null` nor `isDueDate`: `{ status: "failed" }`, no API call.
- Otherwise `createTask(input)`: `created` and `failed` pass through; `title_invalid` becomes `{ status: "title_invalid", message: validateTitle(input.title) ?? TITLE_REJECTED }` (AC-001.7).

### Page and UI (what acceptance tests select on)

- `app/page.tsx`: `export const dynamic = "force-dynamic"`; `export default async function HomePage()`. Always one `<h1>` "Task board".
- Load failure: `<p role="alert">Tasks could not be loaded. Please try again.</p>` plus a link "Try again" to `/`; no list, no "No tasks yet", no form (AC-001.8).
- Loaded: `<TaskBoard initialTasks={tasks} />`, the form first, then the list.
- Form (`<form aria-label="Add a task">`):
  - text input labelled "Title" (`name="title"`, no `required`/`maxLength` attribute, so our own messages show), `aria-invalid` and `aria-describedby="title-error"` while an error shows;
  - title error: `<p id="title-error">` directly after the title input, text `TITLE_REQUIRED`, `TITLE_TOO_LONG` or the `title_invalid` message (AC-001.6, AC-001.7);
  - date input labelled "Due date" (`type="date"`, `name="due_date"`); empty sends `due_date: null` (AC-001.5);
  - submit button "Add task", disabled while a save is in flight;
  - save error: `<p role="alert">The task could not be saved. Please try again.</p>` (AC-001.8).
- Submit, in order:
  1. Call `preventDefault`.
  2. If `validateTitle(title)` fails, show the error and stop: no action call, no POST.
  3. Otherwise call `createTaskAction({ title, due_date: dueDate || null })` in a transition.
  4. On `created`, append the task and clear both inputs and both errors. On `title_invalid`, show the message and keep the values. On `failed`, or when the action throws, show `SAVE_FAILED` and keep the values.

  The list never changes on a failure.
- List: `<ul aria-label="Tasks">`, one `<li>` per task in order; the title as text; the due date as `<time dateTime="YYYY-MM-DD">YYYY-MM-DD</time>` or the text "No due date" (AC-001.1, AC-001.3). No tasks: `<p>No tasks yet</p>` instead of the list (AC-001.2); the first created task replaces it with the list.

### Configuration

| Variable | Default | Description |
|---|---|---|
| `TASKBOARD13_API_URL` | _(unset: the page shows the load error)_ | Task API base URL, server side only (cluster: `http://taskboard13-api`, set by the gitops repo). Never `NEXT_PUBLIC_`. |

## Testing notes

- Acceptance tests run in Vitest (`tests/`):
  - `await HomePage()` rendered with `fetch` stubbed (`vi.stubGlobal`): AC-001.1 to AC-001.3 and the load half of AC-001.8.
  - `TaskBoard` rendered with `@/app/actions` mocked: AC-001.4 to AC-001.8.
  - `createTask` and `createTaskAction` with `fetch` stubbed: the exact `POST` body, the `422` mapping and the timeout.

  No Playwright test needs a stub API.
- The template tests that assert the landing page (`tests/page.test.tsx`, `e2e/home.spec.ts`) are replaced in plan task t4, together with the page.
