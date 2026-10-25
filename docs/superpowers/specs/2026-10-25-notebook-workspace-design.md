# LabMate notebook workspace — proposed design

## Goal

Make each screen serve one task. Give lab content the largest, central region, with navigation on the left and optional AI guidance on the right. Borrow Jupyter's document outline, compact toolbar, and ordered cells without implying executable code support.

## Direction and alternatives

Recommended: a notebook workspace with focused pages. This addresses both clutter and information hierarchy while retaining the existing React application and APIs.

A visual refresh alone would be smaller but leave unrelated tasks on the same page. A dashboard of cards would separate entry points but keep the lab secondary. Neither fits the requested central document as well.

## Layout and visual language

- Compact top bar: brand, current lab, saved state where applicable, account menu.
- Approximately 220px left sidebar: role-specific pages followed by the current document outline.
- Flexible center: readable notebook canvas, typically 760–960px wide, with generous whitespace and numbered cells. Wider lists can use the available center width.
- Approximately 320px collapsible right panel: the existing assistant for supported student and TA contexts. Teacher authoring does not gain an invented AI capability.
- Warm gray application background, white document surface, charcoal text, indigo selection/action accents, and restrained amber for pending work. Statuses retain readable labels as well as color.
- Short labels such as Notebook, Preview, Settings, Publish, Progress, and Ask a TA. Explanatory text appears only for consequential decisions, empty states, or errors.
- On narrow screens, navigation becomes a toggleable menu and AI becomes a separate toggleable panel; the document retains usable width. Keyboard focus, labeled controls, and visible active-page state are required.

## Pages by role

### Teacher

Labs lists drafts and provides New lab. Opening a draft presents Notebook, Preview, Settings, and Publish in the left navigation.

Notebook shows the title, ordered cells, an outline, and a small Save / Add cell toolbar. Expand a cell to edit it; keep inactive cells compact and readable. Existing block types and reorder controls remain available. Private grading fields stay labeled and separate from student content.

Preview shows the public-facing document with a concise preview indicator. Settings contains the existing session and AI options. Publish presents a deliberate publication action and the resulting share link, with a brief immutable-snapshot explanation.

### Student

My labs lists enrolled publications. Notebook is the default lab page, with the outline at left and AI at right. Responses and checkpoint actions remain alongside their relevant cells.

Progress shows checkpoint completion independently of visits and saved answers. Ask a TA contains the request form and current request state. Navigating these local pages preserves unsaved answer inputs; switching labs or signing out must not silently discard work.

### Staff

Queue and Classroom become separate pages. Selecting a student opens a central Review view with saved work and instructor criteria. AI remains contextual to that selected student on the right. Claim, release, approve, and resolve remain explicit actions, preserving their separate meanings.

## Architecture and integration

Use small shared shell/navigation components and role-local page components. Keep feature UIs independent and retain the renderAssistant injection contract and keyed conversation identity. Retain current endpoints, authorization, public projections, grading semantics, polling, and publication immutability.

The redesign covers app composition, shared presentation, entry, authoring, student, and staff UI. R4 owns src/features/assistant/** and server/modules/ai/**; do not modify them. Style the assistant's outer slot without relying on its internal markup or masking its mode/error labels. No dependency additions are planned.

Before implementation, establish an isolated checkout and inspect current work to avoid overwriting concurrent changes. The user has requested this cross-role UI overhaul; preserve the roadmap's backend boundaries and document any additive UI prop handoff.

## State and feedback

Keep drafts and unsaved student input alive when switching local workspace pages. Guard destructive navigation when necessary. Loading, empty, failed-save, and disconnected states appear beside the affected content, retain user input, and expose an appropriate retry/action. Do not introduce decorative menu destinations without functional content.

## Verification

Run npm run typecheck, npm test, and npm run build. Verify teacher, student, and TA screens using independent sessions, including narrow layouts and keyboard navigation. Exercise draft editing, preview, settings, publishing, student saves/checks/help, and TA selection/actions. Verify assistant collapse/reopen and student switching preserve the correct conversation context. Report mock AI honestly and do not claim R4 live readiness from UI work.

## Approval status

Approved by the user; implemented with focused pages and existing APIs.
