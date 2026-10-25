# Combined route integration — 2026-10-25

## Result and ancestry

All four route implementations are combined for local and remote main. Integration started from remote main `1333147`, which already contained R1 and R2. R4 tip `e29598b` was merged first in `2887b9b`; R4 completion evidence was reconciled in `1617780`. R3's preserved implementation `4852b18` and earlier integration history were then merged in `8586ff8`. No branch history was discarded or force-pushed. No dependency, schema or public contract changes were needed for integration.

The extra integration regression in `tests/integration.test.ts` covers the complete teacher publish → new student join → answer save → automatic check → student guidance → competing TA claims → staff guidance → human approval → separate resolution → dependent completion revocation sequence with independent authenticated sessions and real SQLite. Guidance in this regression is explicitly mocked; tests never spend provider quota.

## Final automated gate

`npm ci`, `npm run typecheck`, `npm test` (46/46) and `npm run build` pass on the combined checkout. The lockfile is unchanged. HTTP tests require local socket access outside the restricted sandbox. Tests cover R1 validation/snapshot immutability, R2 saves/projections/grading, R3 authorization/transitions/concurrency, and R4 context/history separation, failure recovery, quota, and input/reply safeguards.

## Combined browser rehearsal

Native Chrome used the production build on port 3414 with a dedicated seeded database at `/private/tmp/labmate-all-routes-20261025.sqlite`. Teacher/TA and student used separate host cookie jars (`127.0.0.1` and `localhost`). This browser rehearsal used explicit mock AI; the real provider smoke below was separate.

1. Teacher opened the demo draft, changed its title, saved, reviewed the publish summary (five ordered blocks, two required checkpoints, AI settings and session window), and published a new snapshot/link.
2. A newly joined fictional student entered 2.5 g/mL. Sign-out opened the native unsaved-change warning; Cancel preserved the identity and answer. Explicit save cleared dirty state without verifying work; the automatic check then verified only the calculation checkpoint.
3. Student guidance displayed “Assistant (simulated)” and “[MOCK — not Gemma]”. The student queued a checkpoint checkoff for the TA discussion.
4. Assigned TA Alex selected the new publication, claimed the request, and inspected saved 2.5 g/mL alongside checkpoint verification, viewed step and instructor-only criteria. TA guidance was visibly simulated. Human approval verified the TA checkpoint while leaving the request claimed; separate Resolve emptied the active queue.
5. Staff overview converged to 1/1 fully verified. Student queue showed the resolved request and Progress showed 2/2, distinguishing automatic verification from TA approval.
6. Student changed the answer to 3 g/mL. Dirty state immediately removed stale verified feedback; save revoked both dependent completions. Refresh recovered 3 g/mL and both Not verified labels. The existing TA page converged to 0/1 without reloading.

R3's two-TA browser race and release/reclaim checks, R2's complete navigation/failure/mobile checks, and R4's disabled/pending/error/retry/history-isolation browser matrix are separately documented in their route handoffs. The integration regression repeats competing claims against the combined backend. This run does not claim a new full matrix of every device and fault condition or completion of every legacy R1/G2 checklist item. The isolated rehearsal server was stopped afterward; the database was retained and normal application data was untouched.

## Fresh real Gemma smoke on the final code

The user supplied and authorized a local key. It is stored only in the ignored owner-readable `.env`; no credential is included in this evidence, Git, or frontend assets. Local configuration sets `AI_MOCK_MODE=false` and `GEMINI_MODEL=gemma-4-26b-a4b-it`.

The smoke used the merged application's real Express `/assistant` routes, independent authenticated student and assigned-TA sessions, an in-memory database with fictional seeded content, and the actual Google adapter. No transport mock was installed. Both replies passed the new R4 safeguards and were persisted through the normal application path.

| Request                 | Result                                        |   Latency | Observed content                                                                                 |
| ----------------------- | --------------------------------------------- | --------: | ------------------------------------------------------------------------------------------------ |
| Student conceptual hint | HTTP 200, `mock: false`, `gemma-4-26b-a4b-it` |  7,145 ms | Described density as how tightly packed matter is and how much mass is concentrated in a volume. |
| Assigned TA review      | HTTP 200, `mock: false`, same model           | 13,339 ms | Summarized the submitted 2.5 g/mL answer, successful automatic check, and current step.          |

Stored completions and queue requests were identical before and after the live calls. This verifies real Gemma works through both application paths on this machine; it is not a guarantee of availability, correctness or resistance to all prompt attacks. Another machine must configure its own authorized server-side key. The historical G3 team-explanation and full G2 checklist remain separate from these concrete smoke results.

## Handoff

The user explicitly authorized the ordered merges and push to main. Temporary probes live outside the repository and no database, environment file, generated build, or package dependency was added to the commit. The final main commit and remote equality are reported by the integration owner after the push. No deployment was requested or performed.
