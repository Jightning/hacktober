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
- Feature components: Authoring({publicationChanged}), Student({publicationId}), Staff({publicationId}), Assistant({publicationId, studentId?}). Session flows through app shell. Shared renderer consumes only PublicBlock.
- API: `/api/session`, `/api/demo-identities`, `/api/session/demo`, `/api/join`; `/api/labs` drafts and publish; `/api/publications/:id` public or staff state, progress, queue, and assistant routes. Cookies are HttpOnly; mutation routes reject cross-origin requests.

## Milestones
- [ ] Foundation: package/config, contracts, seed fixture, role shell; confirm frontend/backend start together.
- [ ] Backend: tests first for separation, grading, queue, AI policy; implement persistence, sessions, authoring snapshots, progress, queue and provider adapter.
- [ ] UI: teacher editor/settings/preview; student worksheet/queue; staff detail/overview; assistant interfaces.
- [ ] Integration: build/typecheck/tests, browser flow in independent sessions, refresh/polling, live AI if available, final documentation and logical commits.

## Four follow-up workstreams
1. Person 1 — authoring/integration: improve draft validation and publish review; own authoring UI and labs. Coordinate all shared changes. Acceptance: clear field errors, new publication leaves existing students unchanged.
2. Person 2 — student: improve answer recovery and navigation on narrow screens; own student UI and progress. Acceptance: refresh persists submissions; changed answers invalidate relevant checks only.
3. Person 3 — TA: add filtering and improve queue selection; own staff UI and queue. Acceptance: competing claims yield one winner; selection stays usable while polling.
4. Person 4 — AI: verify real Gemma credentials/model and evaluate adversarial prompts; own assistant UI and AI. Acceptance: separate contexts, disabled settings enforced, failure recovery, no mock represented as live.

## Final integration checklist
- [ ] Every workstream uses shared contracts; no private grading type imported into frontend.
- [ ] Seed/reset commands documented and seeded rows distinguishable.
- [ ] Checks pass and independent-session demo verified; record limitations rather than assuming success.
- [ ] No secrets, database files, unrelated files or built output committed. Record commit IDs; no push/deploy.

## Stretch backlog, ordered by demo value
Person 1: drag/drop block editing. Person 3: AI classroom summaries with Person 4 review, advanced analytics. Person 2: timers beyond session window, OCR/photo-to-table with Person 4. Person 1: file uploads/storage, LMS integration/production SSO. Person 3: WebSockets. Person 1: complex grading. Person 2: arbitrary code execution (requires a separate secure design).
