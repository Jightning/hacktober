# LabMate implementation plan

## Architecture and assumptions

React + TypeScript + Vite, Express + TypeScript, Node's built-in SQLite driver (Node >=22.13), Zod, one npm package and lockfile. No ORM or hosted infrastructure. Public blocks are a discriminated union; private grading criteria live exclusively on the server. SQLite is authoritative across browsers. Poll every 3 seconds.

This is a local hackathon demo. An explicit DEMO_AUTH switch enables seeded identities; it is not production authentication. Students join a published link with a display name and a new server-issued cookie session. Each publish creates an immutable publication; previous links keep their snapshot and progress. Session windows use ISO timestamps. Seeded people/activity carry a demo flag; newly joined students do not. Editing answers invalidates dependent checkpoint completions so old approvals cannot certify changed work.

Design choice: a compact single-process server and SQL tables over an ORM or external service to keep integration understandable. Styling uses CSS custom properties and small semantic components, no generated decorative dashboard aesthetic.

## Contracts and transitions (freeze before feature work)

- Public block: markdown | code | image | answer | checkpoint. Checkpoint exposes mode and answer references, never rules, tolerances or rubric.
- Lab settings: studentAI, hintPolicy (conceptual | step), taAI, opensAt, closesAt.
- Student enrollment stores currentBlockId. Answer submission is independent of viewing. Completion exists only after explicit automatic check or TA approval.
- Queue: waiting -> claimed -> resolved; claimed -> waiting (release); waiting -> cancelled (student). Unique active request per publication/student. Claim is conditional SQL, only assigned staff may mutate.
- Feature components: Authoring({publicationChanged}), Student({publicationId, renderAssistant}), Staff({publicationId, renderAssistant}), Assistant({publicationId, studentId?, enabled}). Session flows through app shell. Shared renderer consumes only PublicBlock.
- API: `/api/session`, `/api/demo-identities`, `/api/session/demo`, `/api/join`; `/api/labs` drafts and publish; `/api/publications/:id` public or staff state, progress, queue, and assistant routes. Cookies are HttpOnly; mutation routes reject cross-origin requests.

## Milestones

- [x] Foundation: package/config, contracts, seed fixture, role shell; confirm frontend/backend start together.
- [x] Backend: tests first for separation, grading, queue, AI policy; implement persistence, sessions, authoring snapshots, progress, queue and provider adapter.
- [x] UI: teacher editor/settings/preview; student worksheet/queue; staff detail/overview; assistant interfaces.
- [x] Integration: build/typecheck/tests, browser flow in independent sessions, refresh/polling, live AI if available, final documentation and logical commits.

## Four follow-up workstreams

1. Person 1 — authoring/integration: improve draft validation and publish review; own authoring UI and labs. Coordinate all shared changes. Acceptance: clear field errors, new publication leaves existing students unchanged.
2. Person 2 — student: improve answer recovery and navigation on narrow screens; own student UI and progress. Acceptance: refresh persists submissions; changed answers invalidate relevant checks only.
3. Person 3 — TA: add filtering and improve queue selection; own staff UI and queue. Acceptance: competing claims yield one winner; selection stays usable while polling.
4. Person 4 — AI: verify real Gemma credentials/model and evaluate adversarial prompts; own assistant UI and AI. Acceptance: separate contexts, disabled settings enforced, failure recovery, no mock represented as live.

## Final integration checklist

- [x] Every workstream uses shared contracts; no private grading type imported into frontend.
- [x] Seed/reset commands documented and seeded rows distinguishable.
- [x] Checks pass and independent-session demo verified; record limitations rather than assuming success.
- [x] No secrets, database files, unrelated files or built output committed. Record commit IDs; no push/deploy.

## Stretch backlog, ordered by demo value

Person 1: drag/drop block editing. Person 3: AI classroom summaries with Person 4 review, advanced analytics. Person 2: timers beyond session window, OCR/photo-to-table with Person 4. Person 1: file uploads/storage, LMS integration/production SSO. Person 3: WebSockets. Person 1: complex grading. Person 2: arbitrary code execution (requires a separate secure design).

## Verification record — October 25, 2026

- Completed: 11 automated tests, frontend/backend typecheck, production build, dev startup, idempotent seed and explicit demo reset. SQLite close/reopen test confirms durable data; reset test preserves other labs.
- Completed browser flow: teacher authored, saved, previewed and published a new lab in the in-app browser; a new student joined in Safari, submitted an answer, refreshed, requested guidance and queued a checkoff. An independently authenticated TA claimed, reviewed private criteria, approved and resolved; polling updated Safari and classroom statistics.
- Completed narrow-screen check: student worksheet at 390px, no horizontal overflow; explicit automatic validation advanced 0/2 to 1/2. Screenshot of completed TA workflow: `docs/verified-ta-workflow.png`.
- Review fixes: preserve student identity on enrollment in another publication; disable form edits during in-flight saves; inject assistant UI through the shell rather than cross-feature imports.
- Live AI remains unverified: no GEMINI_API_KEY available. Official Google docs confirm configured model/API. Both roles’ labeled mock responses and history were exercised; answer-seeking student prompt returned a fixed mock hint, not evidence of live model safety. Owner: Person 4.
- Remaining owner-specific work is listed above and in README continuation prompts. Production identity/recovery/assignment UI belongs to Person 1; unsaved-answer navigation protection to Person 2; queue filtering to Person 3; live model evaluation and quota controls to Person 4.
- Finishing choice: keep local commits in this workspace; no push, deployment or Git identity changes.
