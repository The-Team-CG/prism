# Floor plan editor shell Implementation Plan

> **For agentic workers:** executed natively, task by task; steps use checkbox syntax.

**Goal:** Turn the floor plan editor into one docked frame with one visual scale.

**Architecture:** Three new v2 props in the Pascal patch move the inspector into a docked
column and drop Pascal's tool dock and side menu; `@prism/floorplan-canvas` then draws the
top bar, one tabbed left panel, canvas chrome, inspector extras and the status bar.

**Tech Stack:** React 19, Pascal editor 1.1.6 via patch-package, Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-floorplan-editor-shell-design.md`

## Global Constraints

- Pascal changes only through `patches/@pascal-app+editor+1.1.6.patch` (`npx patch-package @pascal-app/editor`).
- No fallbacks; complexity ≤ 10; contracts stay in `@prism/types`.
- Visual rules: no nav underlines, no uppercase/outline badge pills.
- Read-only plans: no Library tab, no tools, no Submit.

## Review Focus

- Read-only plan: panel shows Guests · Layers, inspector has no edit controls, no tools in the bar.
- Nothing selected: inspector shows the Plan panel, not an empty column.
- "Seat guests" from a table switches the left panel to Guests with that table's filter.
- Narrow laptop (1280 px): plan stays usable between 272 px and 288 px columns.
- Multi-selection still shows Pascal's multi-selection panel in the docked column.

---

### Task 1: Pascal patch — docked inspector, no tool dock, no side menu

**Files:** `node_modules/@pascal-app/editor/src/components/editor/{index,editor-layout-v2}.tsx`,
`components/ui/panels/panel-wrapper.tsx`, `patches/@pascal-app+editor+1.1.6.patch`

- [ ] `EditorProps` gains `dockInspector?: boolean`, `inspectorEmpty?: ReactNode`, `toolDock?: boolean` (default true), `sideMenu?: boolean` (default true).
- [ ] v2: with `dockInspector`, `RightStack` is not rendered; `EditorLayoutV2` gets `inspectorColumn` and draws it as a 288 px `<aside>` after `RightColumn` (desktop only; mobile keeps the sheet).
- [ ] `DockedInspectorContext` makes `PanelWrapper` static: full height, no drag, no collapse, no grip, no shadow.
- [ ] `toolDock={false}` skips `ActionMenu`; `sideMenu={false}` skips `MenuColumn`.
- [ ] Regenerate the patch; `npm --workspace @prism/floorplan-canvas run typecheck`.

### Task 2: One tabbed left panel

**Files:** `shell/rail-tabs.tsx` → `shell/side-panel.tsx`, `prism-floorplan-editor.tsx`, `inspector/host-state.ts`, tests in `editor-shell.test.tsx`

- [ ] One sidebar tab `plan` whose component is `SidePanel` (segmented Library · Guests · Layers); `columnTabId="plan"`, `sideMenu={false}`.
- [ ] Panel tab lives in host state; the guests opener sets it to `guests`.
- [ ] Test: read-only shows Guests and Layers only; opening guests from a table selects the Guests tab.

### Task 3: Top bar

**Files:** `shell/editor-header.tsx`, new `shell/tool-group.tsx`, `shell/view-switch.tsx`, tests

- [ ] `ToolGroup`: Select (V), Measure (M, `setToolDefaults('measurement',{kind:'smart'})` + `setTool`), Delete (X) via `useEditor`; active tool in ink.
- [ ] Centred breadcrumb with a plan menu (Save as venue template, Back to floor plans); Phases placeholder removed.
- [ ] Right side: Saved · undo · redo · Print menu (icon) · Preview as client (icon) · Submit.
- [ ] Test: the print menu still offers Floor plan / Pull sheet / Seating list; the plan menu saves a template.

### Task 4: Canvas chrome

**Files:** `shell/lens-switch.tsx`, new `shell/plan-measures.tsx`, `prism-floorplan-editor.tsx`

- [ ] Lens switch moves to `sceneOverlay`, centred at the top; its findings list moves to the Plan panel (Task 5).
- [ ] `PlanMeasures` in `floorplanSceneSlot`: room dimension lines; the selected piece's size chip and gap to the nearest standing piece (`gapBetween` from `@prism/floorplan-scene`).
- [ ] Zoom control only if Pascal's floor-plan zoom can be set from the host without a patch; otherwise note it as left out.

### Task 5: Inspector

**Files:** `pascal-theme.css`, `inspector/parametrics.ts`, new `inspector/swatch-field.tsx`, new `shell/plan-panel.tsx`, tests

- [ ] Swatch rows for linen, overlay and sash as custom fields; shape as a segmented enum.
- [ ] `PlanPanel` as `inspectorEmpty`: room size, capacity per style, counts, layout checks (click selects the pieces). Hidden while something is selected.
- [ ] Theme: one row height, text scale and hairlines across Pascal's panels; active states in ink.
- [ ] Test: Plan panel lists layout checks and selecting one selects its pieces.

### Task 6: Status bar, library tiles, verification

**Files:** `shell/editor-footer.tsx`, `library/library-panel.tsx`, `library/room-planner.tsx`, `CHANGELOG.md`

- [ ] Footer: counts · first layout check · room and grid.
- [ ] Borderless tiles with the piece outline; "Plan the room" as one row that expands in place.
- [ ] Typecheck + tests (canvas, scene); browser check against the mockup at 1440 and 1280; CHANGELOG line; commits per task.
