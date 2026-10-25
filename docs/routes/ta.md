# R3 — TA workflow handoff

Scope: staff UI, queue boundary tests, this handoff, and (explicitly authorized) R3 roadmap checkboxes. No shared contracts, progress helpers, dependencies, schema, or endpoint changes. The user subsequently authorized committing R3 and merging it into local main after R1. The route implementation is preserved on `labmate/ta`; the integration record below identifies its commit. No push or deployment is included.

## Changes

- `src/features/staff/QueueList.tsx`: All / Help / Checkoff filters retain the server's arrival order. Filters do not change selected student state. Request type, demo identity, waiting/claimed state, elapsed arrival time, and claimant ownership are visible; unavailable actions remain hidden or disabled.
- `src/features/staff/staff.css`: scoped selected-filter styling supplements `aria-pressed` with a visible underline and border.
- `src/features/staff/Staff.tsx`: a selected-student review shortcut remains available from Queue, including empty filtered results. Claim conflicts clear prior success feedback, refresh server state, explain contention, and retain the selected student.
- `src/features/staff/StudentDetail.tsx`: each checkpoint includes its referenced submitted values (or “Not submitted”), verification state, and instructor criteria. The current step and complete submitted-work list remain available. Demo students are labeled.
- `src/features/staff/ClassroomOverview.tsx`: labels count students as unverified rather than inferring difficulty; seeded students have explicit Demo labels.
- `tests/queue.test.ts`: six independent in-memory API regressions using separately authenticated agents. Covers concurrent claims and stored ownership; release/reclaim; help refusal to approve; claimant-only approval/resolution/release; separate approval and resolution; persisted overview counts and answer-edit revocation; duplicate active requests; waiting-only owner cancellation; closed sessions; unassigned staff/student rejection; referenced-answer guards.

Existing server transitions passed the expanded tests; no server repair was necessary. Public/private projections and progress helper signatures remain unchanged.

## Automated verification — 2026-10-25

- Node 26.8.1; `npm ci` installed the existing lockfile with no package changes.
- `npm run typecheck`: pass.
- `npm test`: 27/27 pass, including six R3 tests. Supertest requires local socket access; the initial sandbox run failed with `listen EPERM`, then the same suite passed with that restriction lifted.
- `npm run build`: pass.

## Browser rehearsal — 2026-10-25

Production build served on port 3413 using the isolated SQLite file `/private/tmp/labmate-r3-20261025.sqlite`, seeded through the existing seed function. AI explicitly mocked; no live AI claim. Normal project database and shared seed files were untouched.

Independent Chrome sessions use distinct cookie hosts: Alex at `127.0.0.1:3413` and Sam at `localhost:3413`. Both identities were visibly confirmed. Initial All showed Priya help before Noah checkoff; Help and Checkoff showed only the respective requests. Filters and polling did not choose another student. After selecting Priya, Queue retained “Review Priya” even when Help became empty.

Alex claimed Priya's help. Sam saw “claimed by another TA” without claimant actions. Alex released; Sam saw waiting, reclaimed and resolved. Priya's review stayed open with “No active requests” afterward; no checkpoint was approved by help resolution. Each checkpoint displayed the referenced answer alongside its criteria. Noah's review displayed current step/checkpoint, saved 2.5 g/mL, automatic verification, pending TA verification, and the instructor rubric together.

The controlled browser race was explicitly approved. After a transient native Chrome automation mismatch, the server was resumed, Chrome was reconnected, and the race was repeated successfully. With only the isolated server briefly paused, Alex and Sam each clicked Claim on Noah's waiting checkoff; both showed disabled pending actions. After resume, Alex displayed “claimed by you”; Sam displayed the conflict explanation and “claimed by another TA”, with Noah's submitted values, current step, verification, and rubric still open. No stale success message remained in Sam's view.

Alex approved: the TA checkpoint became Verified while the request remained claimed and the success message instructed separate resolution. Alex then resolved: queue became empty, Noah stayed selected, and Classroom showed 2 of 4 fully verified, 2/4 verified on both required checkpoints. Sam's independently polled review also showed verification and the resolved empty queue. Keyboard Tab/Return activation switched filters; the selected filter's visible border/underline was inspected in the final build. Empty filtered and resolved states offered clear next actions; the race exercised an actionable error state.

The localhost session was then signed out of Sam and signed into Noah. Noah changed the saved density answer from 2.5 to 3 g/mL through the student UI and submitted it. Both student checkpoint labels changed to Not verified. Without reloading Alex's page, Classroom converged to 1 of 4 fully verified and 1/4 verified on each checkpoint. Noah's staff review showed 3 g/mL, both checkpoints Not verified, the new viewed step, and the next unverified checkpoint. This verifies stored revocation reaches the TA through polling.

The rehearsal server was stopped at the end; the isolated SQLite file is retained for inspection. No demo reset was performed. Browser verification used native Chrome controls and accessibility observations; this does not claim a mobile layout audit or a full combined G2 rehearsal.

## Integration boundaries

This route handoff does not complete R1, R2, G2, G3, or R4's outstanding browser-state matrix. No progress-helper defect was found. The overview/revocation regression uses the existing student API, without changing R2 files. No push, deployment, Git identity change, or live provider call was performed.

## Local main integration — 2026-10-25

The user authorized Git operations for this merge. R3 implementation commit: `4852b18` on `labmate/ta`. Local main was fast-forwarded to R1's `e92c29f` (including implementation `683b543`), then R3 was merged without conflicts. Combined typecheck, all 34 tests, and production build passed before finalizing the merge. This is automated integration evidence; the earlier R3 browser rehearsal is recorded above and does not close G2/G3. No push was performed.
