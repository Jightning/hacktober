# Notebook UI Implementation Plan

**Goal:** Make lab work central and give each page one purpose.
**Architecture:** Existing React state and APIs, a small reusable Workspace component, role-local navigation. Preserve mounted inputs when changing local pages. No dependencies or backend changes.

- [x] Shared layout: add Workspace({ navigation, children, assistant? }) with left navigation, central content, and toggleable assistant slot. Update CSS tokens and responsive layout. Keep assistant mounted while collapsed.
- [x] Teacher: split Labs, Notebook, Preview, Settings, Publish in Authoring. Preserve draft state between pages. Compact cells with expandable editors and outline. Guard leaving dirty drafts.
- [x] Student: Notebook, Progress, Ask a TA pages. Preserve answer components while switching pages. Add dirty reporting for shell transitions and unload warnings.
- [x] Staff: separate Queue and Classroom. Put selected student review in center and contextual assistant on right.
- [x] App: move publication selection into compact header, simplify role navigation, guard student and teacher unsaved work on shell transitions.
- [x] Verification: run typecheck, tests, build; inspect browser using separate role sessions and narrow viewport. Verify page switching preserves input, assistant toggle, publish, queue review. Record mock mode and any limitations.

Approved design: ../specs/2026-10-25-notebook-workspace-design.md. R4 feature and backend files remain untouched. Implement locally without pushing or deploying.


## Verification evidence

- Typecheck, all 11 existing tests, and production build pass.
- Browser preview used port 3107 and /private/tmp/labmate-notebook-ui.sqlite, independently seeded; no existing development database changed. AI explicitly mocked.
- Student: unsaved 2.5 answer retained across Progress, My labs, and Notebook; submitted successfully, automatic check verified, help request joined queue; AI collapsed successfully.
- TA used a separate localhost session from student's 127.0.0.1 session: claimed Noah's request, approved checkoff, resolved it. Question draft retained when moving Review → Queue → Review.
- Teacher: edited title, changed Settings/Preview/Publish pages without losing draft, published a new snapshot and received share link.
- Desktop teacher/student layouts visually inspected. Mobile student viewport measured 375px client width and 375px scroll width; Menu exposed navigation. Teacher mobile and exhaustive keyboard/failure-path testing remain unverified.
- Additive UI props: Authoring onDirtyChange; Student onDirtyChange and onOpenLabs. Existing callers remain valid. No R4 source, API, backend, or dependency changes.

## Refinement pass

User requested Material icons, separate collapsible navigation card, sticky side controls, natural typography, single student lab-selection surface, Queue naming, and removal of demo/role clutter. Uses self-hosted Roboto and official Google Material Symbols, with licenses in public/fonts. References: https://m3.material.io/styles/typography/applying-type and https://developers.google.com/fonts/docs/material_symbols.

The user explicitly canceled optional step checkmarks. Instead, Student reports focused or visible steps through the existing /visit route. Staff classroom/review shows that context and the viewed checkpoint (or first unverified checkpoint when viewing ordinary content). No grading, schema, API, or R4 feature changes. Simulated assistant replies retain their existing truthful mode label; global mock/demo chrome is removed.

Browser verification: desktop sidebars remain visible after scrolling; both toggle off/on; My labs has no duplicate selector; Material delete/reorder icons render with accessible names; separate staff session receives focused answer then viewport checkpoint updates. Narrow student layout and panel controls inspected. Automated gates: typecheck, 12 tests, build.

## Executable notebook pass

- Python code blocks now run with Pyodide 0.29.5 in a dedicated worker inside an opaque-origin iframe. Source stays in the browser. Standard-library execution, stdout/stderr, errors, Stop, 15-second execution timeout, 60-second loading timeout, 20k output cap. Runtime files download from the pinned Pyodide CDN on first use. Each run starts a fresh interpreter; interactive input and server-side submission of student code are not included. Teacher code edits update and save the draft; student code edits are local to the mounted cell.
- CSP restricts runner script/network access to the pinned runtime path and denies app-origin API access. Host accepts only the runner iframe's messages. Runtime output is rendered as text. No executable code route, database schema, or grading changes.
- Reference: https://pyodide.org/en/stable/usage/downloading-and-deploying.html and https://pyodide.org/en/stable/usage/webworker.html. Display-only code remains available through Markdown fenced blocks.
- Outline is a distinct persistent column; page menu moves it right when expanded. Wider desktop document, rendered authoring cells, edit-only settings, sticky Add cell and Save footer. Removed authoring workspace/Notebook headers, dirty badges and decorative separators. Existing exit guards retained. The only assistant-feature edit is punctuation in provider labels; simulated replies remain identified.
- Browser evidence: edited Python density example prints 2.5; attempted app-session API fetch fails; infinite loop times out after 15 seconds; Stop restores editing; teacher Python draft survives Save and reload. Outline remains when navigation closes, and bottom actions remain in viewport while scrolling.


## Integration with R4 (2026-10-25)

Merged remote main through `4428202`, including `522863f`. The sole conflict was assistant mode-label punctuation: kept R4 conversation isolation, loading/retry behavior, and duplicate-send guard; labels now read Assistant (simulated) / Assistant (live). No R4 tests or backend behavior were changed. Combined typecheck, all 21 tests, and build pass. See roadmap for remaining route acceptance and G2/G3 gates. R4 live evidence is historical route evidence, not a new live request from this integration checkout.
