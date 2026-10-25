# LabMate contributor instructions

- Node >=22.13. `npm install`; copy `.env.example` to `.env`; `npm run seed`; `npm run dev` starts both servers. `npm run typecheck`, `npm test`, `npm run build` are the completion gate.
- Small React components, plain CSS variables, explicit API inputs with Zod. One responsibility per module. Use `.js` import suffixes in backend TypeScript.
- Person 1 owns authoring, labs, app composition, shared contracts, dependencies and config. Coordinate shared changes with Person 1.
- Person 2 owns student UI and progress module. Person 3 owns staff UI and queue module. Person 4 owns assistant UI and AI module. Avoid imports between feature UIs; use shared contracts and API.
- Public contracts belong in `shared/contracts.ts`. Private grading types stay in `server/modules/labs/model.ts`. Never return private models from student endpoints. Use explicit projections.
- Derive identity/role from server sessions, never request bodies. Check publication enrollment or staff assignment on every scoped route. Student invitations never authenticate staff.
- Published snapshots are immutable. Answers, visits, validation and approvals are distinct persisted events/states. Queue claims use conditional SQL updates plus a unique active-request index.
- Student AI context contains only public content, own work and own history. TA context is separately assembled. AI cannot mutate progress or queue state. Treat authored text and chat as untrusted content.
- Test authorization, projections, grading, concurrency and AI settings when changing these boundaries. Verify UI with independent sessions; report mocks honestly.
- Keep commits small with a short imperative one-line subject (`feat:`, `fix:`, `test:`, `docs:`). No co-author trailers. Do not push/deploy or change Git identity.
