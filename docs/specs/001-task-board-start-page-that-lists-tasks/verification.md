# Verification — 001 Task board start page that lists tasks and adds a task through the Task API

**Commit:** fd6d3de · **Base:** c2b1a85 · **Trace:** 8/8 criteria named by tests

| Criterion | Verdict | Tests | Implementation | Notes |
|---|---|---|---|---|
| AC-001.1 | met | `tests/tasks-page.test.tsx::AC-001.1 lists every task in the API's order…`, `tests/tasks-api.test.ts::AC-001.1 listTasks returns the tasks in the API's order…` | `lib/tasks-api.ts:70`, `lib/tasks-api.ts:86`, `app/page.tsx:10`, `app/_components/task-board.tsx:82-86` | 3 items checked by position: title, `YYYY-MM-DD`, "No due date" for null; the date string is shown exactly as the API returns it (no `Date` parsing) |
| AC-001.2 | met | `tests/tasks-page.test.tsx::AC-001.2 shows No tasks yet…` | `app/_components/task-board.tsx:77` | asserts the text and that no "Tasks" list is rendered |
| AC-001.3 | met | `tests/tasks-page.test.tsx::AC-001.3 shows a markup title literally and creates no b element` | `app/_components/task-board.tsx:82` | React text child, no `dangerouslySetInnerHTML`; test checks literal text and `querySelector("b")` is null |
| AC-001.4 | met | `tests/task-board.test.tsx::AC-001.4 sends title and due date…`, `…::AC-001.4 replaces No tasks yet…`, `tests/tasks-api.test.ts::AC-001.4 createTask POSTs title and due_date…` | `app/_components/task-board.tsx:31-37`, `app/actions.ts:21`, `lib/tasks-api.ts:96-102` | action called with `{title:"Buy milk", due_date:"2026-12-01"}`; POST body parsed and compared; task appended last; both inputs cleared; `type="date"` asserted |
| AC-001.5 | met | `tests/task-board.test.tsx::AC-001.5 sends due_date null…`, `tests/tasks-api.test.ts::AC-001.5 createTask sends due_date null explicitly` | `app/_components/task-board.tsx:31`, `app/_components/task-board.tsx:84` | `due_date: null` in action call and POST body; appended item shows "No due date" |
| AC-001.6 | met | `tests/task-board.test.tsx::AC-001.6 rejects a title that is %s…` (empty, whitespace, 201 chars), `…::AC-001.6 accepts a title of exactly 200 characters`, `tests/tasks-api.test.ts::AC-001.6 the server action rejects an invalid title without calling the API` | `lib/task-validation.ts:11-15`, `app/_components/task-board.tsx:23-27`, `app/_components/task-board.tsx:60-62`, `app/actions.ts:16-17` | message bound to the title field (`aria-describedby="title-error"`, `aria-invalid`), values kept, list unchanged, action not called; action itself makes no fetch |
| AC-001.7 | met | `tests/task-board.test.tsx::AC-001.7 shows a message next to the title…`, `tests/tasks-api.test.ts::AC-001.7 a 422 naming title becomes title_invalid with a message` | `lib/tasks-api.ts:108`, `app/actions.ts:23`, `app/_components/task-board.tsx:38-39` | 422 with `loc: ["body","title"]` gives `title_invalid` + `TITLE_REJECTED`; a 422 for `due_date` gives `failed` (AC-001.8 test) |
| AC-001.8 | met | `tests/tasks-page.test.tsx::AC-001.8 shows the load error…` (unreachable, 503, 418, malformed body), `…::AC-001.8 shows the load error once the API has been silent for 5000 ms`, `tests/task-board.test.tsx::AC-001.8 shows the save error and keeps the values…`, `tests/tasks-api.test.ts::AC-001.8 createTask reports failed on %s`, `…::listTasks/createTask gives up at 5000 ms and not before` | `lib/tasks-api.ts:54`, `lib/tasks-api.ts:70-93`, `app/page.tsx:22`, `app/_components/task-board.tsx:41`, `app/_components/task-board.tsx:44` | load error replaces list and "No tasks yet"; save error keeps both inputs and the list; timeout boundary checked at 4999/5000 ms; no retry (one fetch call asserted) |

## Non-goals

The spec lists no non-goals. No auth or browser-side API calls were added: `TASKBOARD13_API_URL` is read only in `lib/tasks-api.ts` (server), never `NEXT_PUBLIC_`. Template-owned layout (header, footer, navigation, `app/layout.tsx`) is unchanged; `app/globals.css` only adds `.board` styles. ✔

## Deviations from the plan

- `tests/tasks-api.test.ts`, `tests/task-board.test.tsx`, `tests/tasks-page.test.tsx` are in no task's `files`: they are the acceptance tests from the red/test-review commits (`04ef73e`, `7e43b00`, `aac7954`), unchanged since `aac7954`. Acceptable.
- `docs/backlog.md` is in no task's `files`: the generated `cplat spec index` row. Acceptable (its status column says `approved`; the next index run refreshes it).
- All four tasks are `done: true`. `tests/page.test.tsx` was deleted, which plan t4 allows (acceptance tests cover the page).

## Contract

Matches `design.md`: `listTasks`/`createTask`/`createTaskAction` signatures and result types, base URL with trailing `/` stripped, `cache: "no-store"`, `AbortSignal.timeout(5000)` with the body read inside the same try, item validation, the `422`-names-`title` mapping, the exact messages in `lib/task-validation.ts`, and the UI selectors (`form "Add a task"`, labels "Title"/"Due date", `#title-error`, `role="alert"`, `ul "Tasks"`, `<time dateTime>`). Logging carries only `op`, `status`, `reason`. ✔

## Smoke tests

- SMOKE: e2e/smoke.spec.ts — "the root page loads at the base URL @smoke" (template check, any `<h1>`) also passes on the load-error page; the new read-only test "the start page lists the tasks or says there are none @smoke" covers the feature and fails on the load error.
- SMOKE: e2e/home.spec.ts — the "Task board" heading check passes on the load-error page by design (local run has no API); it does not claim criterion coverage.

**Result:** pass

## Mutation check (report only)

Skipped: no mutation check for shape web-nextjs yet.
