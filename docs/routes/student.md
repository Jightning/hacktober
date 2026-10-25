# R2 Student workflow handoff

Verified 2026-10-25 on local `main`. **R2 complete.** G2 combined rehearsal and G3 final live smoke remain separate integration gates.

## Commits and scope

- Baseline `6173842` already includes notebook UI, G1 dirty callback and shell consumer, and R4 integration. Do not cherry-pick those UI commits again.
- `c1611a8`: preceding shared dev-proxy fix and regression test, committed separately; preserves host validation on alternate Vite ports.
- `a1e23cd`: student save/progress recovery and regression tests.
- This documentation commit records R2 acceptance and updates its roadmap checkboxes.

R2 changes are confined to `src/features/student/**`, `tests/student.test.ts`, and optional `tests/student.browser.mjs`. No shared contracts, backend routes, grading rules, database schema, dependencies, assistant behavior, or TA queue implementation changed. Existing `progress`, `requests`, and `verify` signatures are retained.

## Behavior

- Failed saves keep the typed answer dirty and offer Retry save. Inputs and submission are locked during an in-flight write; a synchronous guard prevents duplicate sends.
- A confirmed write clears unsaved state. If the following refresh fails, the UI explicitly says the answer was saved and progress could not refresh. Pending reconciliation is separate from unsaved edits, so successful writes do not cause false exit warnings.
- Checkpoint feedback is tied to the submitted answer version. Local edits suppress obsolete feedback and disable automatic checking until submission. Confirmed changed answers suppress dependent stored completion indicators until a fresh server response confirms the new work. Progress totals use that same reconciled view.
- Student polling ignores superseded responses, preventing an older read from replacing a newer save. Scheduled polls skip while a read is pending, so slow networks do not continually supersede themselves. Explicit post-mutation refreshes can supersede older reads; failed polls retry automatically.
- Queue actions prevent duplicate clicks and refresh after conflicts. Waiting cancellation remains available; claimed cancellation remains unavailable. Existing API errors remain visible and request text survives failures.

## G1 contract and navigation

`Student.onDirtyChange?: (dirty: boolean) => void` aggregates unsaved answer edits and clears on unmount. The existing stable callback in `src/app/App.tsx` guards lab switches, sign-out, and the home link. Student owns the native beforeunload listener and removes it when clean/unmounted. My labs and local pages retain the mounted answer inputs. No new shell changes were needed for R2.

## Automated verification

`npm run typecheck`, `npm test`, and `npm run build` pass: **26 tests**, including four new student API tests. The tests use seeded in-memory databases and independent student/teacher/TA sessions. Additional snapshots are published through the teacher API, never by editing published snapshots.

Covered: visits and submissions do not verify work; incorrect values/units fail; rejected writes retain saved work; two independent answer/checkpoint groups preserve unrelated automatic and TA approvals; changed value or units revoke only dependent approvals; unchanged resubmission retains approval; queue history is not changed by progress invalidation; fresh-session recovery; student/publication isolation and rejection of forged identity or unenrolled access.

Optional browser regressions are retained in `tests/student.browser.mjs`. With Playwright installed outside the app dependency tree and an isolated seeded app running:

```sh
R2_TEST_URL=http://127.0.0.1:3112 node tests/student.browser.mjs
```

`PLAYWRIGHT_MODULE` may point to an existing Playwright module, and `CHROME_PATH` may select an installed Chrome executable. The script intentionally requires an explicit test URL and writes seeded student-2's answers. Never point it at a shared or production database. It checks stale passing feedback, successful writes followed by failed refresh, a pre-save response arriving after a newer refresh, 4.2-second reads exceeding the polling interval, ordered outline links, and visible keyboard focus.

## Browser acceptance evidence

Headless installed Chrome, production build served on `127.0.0.1:3112`, isolated `/private/tmp/labmate-r2.sqlite`, explicit simulated AI. Student and teacher/TA API sessions were independent. Failures and delayed reads were injected only in the student browser; backend state was real SQLite.

| Check | Result |
| --- | --- |
| Notebook → Progress → Notebook and My labs → Back to lab | Typed answer preserved; polling also preserves edits |
| Failed save, then polling and retry | Value and dirty state retained; retry saved and reload recovered it |
| Delayed save | Input and submit disabled; exactly one write |
| Successful save followed by failed refresh | Saved value retained, clear refresh status, no false unsaved warning; reload recovered persisted value |
| Cancel lab switch, sign-out, home, reload | Selected lab/session and typed answer retained |
| Confirm discard via lab switch or sign-out | Transition succeeds; local edit discarded and dirty state resets |
| Save then home/sign-out/reload | No unnecessary warning; stored value recovered |
| Automatic check then answer change | Previous passing feedback removed; server revokes dependent completion |
| Failed refresh after changed approved answer | Notebook and Progress do not restore obsolete verification |
| Delayed old polling response after new save | New answer remains visible and survives reload |
| Reads consistently slower than polling interval | Initial state still loads; no refresh starvation |
| Help versus checkoff | Distinct request types; checkoff selector contains only TA checkpoint |
| Waiting cancel, claim, resolve, duplicate race | Waiting can cancel; claimed cannot; duplicate error refreshes active request without losing text |
| Closed session | Closure explained; request button disabled |
| Keyboard and outline | Ordered links target matching cells; Tab reaches submit with visible focus; Enter changes page |
| 390px viewport | No document horizontal overflow; navigation works; screenshot visually inspected |

Local mobile artifact: `/private/tmp/r2-student-mobile.png`. The broader acceptance matrix was executed with a temporary browser script; the race regressions above are committed for reuse.

## Limits and remaining integration work

No R2 blocker found. This is not a complete screen-reader or cross-browser certification. AI was explicitly simulated here; R4 owns live-model evidence. Editable Python code remains local to the mounted cell and is not a persisted answer or graded checkpoint, as documented in the UI handoff. No localStorage authority was introduced. R1/R3 acceptance and the team-wide G2/G3 rehearsal remain open.
