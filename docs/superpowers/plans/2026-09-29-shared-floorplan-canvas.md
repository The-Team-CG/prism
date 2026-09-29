# Shared Floorplan Canvas Implementation Plan

> **For agentic workers:** Execute inline using the approved maintainability sequence. Track each deliverable with the checkboxes below.

**Goal:** Consolidate duplicate floorplan editor mechanics in `@prism/floorplan-canvas` while client/event apps retain storage, role decisions, and official-plan ownership.

**Architecture:** The new package owns the editor store, drawing/pointer mechanics, panels, shell, and canvas-only types. Its `EditorShell` receives a `templateStore` adapter and `readOnlyLabel`; role wrappers bind each portal's existing template repository and copy. It has no app, session, authorization, or HTTP imports.

**Tech Stack:** TypeScript, React 19, lucide-react, Vitest, npm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-29-shared-floorplan-canvas-design.md`

## Global Constraints

- Client users can submit preferences and view approved official layouts read-only; PMCM owns official plans in `apps/event`.
- The shared package does not call APIs, read session or role data, or own draft approval or persistence.
- Template repositories remain in their current role apps and satisfy the shared package's injected adapter.
- Reuse existing workspace dependencies; add no external package.
- Export existing package contracts through `@prism/types` when they represent cross-app domain data; keep editor-only state types inside the focused canvas package.
- Update root `CHANGELOG.md`, `AGENTS.md`, `docs/architecture/current-architecture.md`, and `scripts/check-prism-boundaries.mjs` with its behavior test.

---

### Task 1: Create the shared editor module

**Files:**
- Create: `packages/floorplan-canvas/package.json`, `tsconfig.json`, `src/index.ts`
- Move from `apps/client/src/features/floorplan/editor/`: `assetLibrary.ts`, `AssetsPanel.tsx`, `canvas-draw.ts`, `canvas-geometry.ts`, `canvas-pointer.ts`, `editor-reducer.ts`, `editor-shortcuts.ts`, `GuestsPanel.tsx`, `LayersPanel.tsx`, `LeftPanel.tsx`, `RightPanel.tsx`, `StatusBar.tsx`, `store.tsx`, `SuppliersPanel.tsx`, `templates.ts`, `TemplatesPanel.tsx`, `Toolbar.tsx`, `top-bar-helpers.ts`, `types.ts`
- Create shared `Canvas.tsx`, `EditorShell.tsx`, and `TopBar.tsx` from the client implementation, preserving the `readOnly` pointer and keyboard behavior and parameterizing only the role-specific top-bar label.

**Interfaces:**
- `EditorShellProps` retains project, back, event/draft labels, read-only flag, and save/submit callbacks, and adds `templateStore: { load(): Promise<FloorPlanTemplate[]>; add(template: CreateTemplateInput): Promise<FloorPlanTemplate>; remove(id: string): Promise<void> }` and `readOnlyLabel: string`.
- The package root exports `EditorShell`, `CanvasObject`, `Project`, `FloorPlanTemplate`, and `cloneTemplateObjects`.
- `TemplatesPanel` consumes only the injected template store; it never imports a portal repository.

- [ ] Create the focused workspace package with React and lucide-react peers, TypeScript build/typecheck scripts, and Vitest tests.
- [ ] Move the shared implementation into `src/` and replace template repository imports with the injected adapter.
- [ ] Typecheck the package and preserve the existing editor behavior.

### Task 2: Replace duplicated portal implementations with role adapters

**Files:**
- Modify: `apps/client/package.json`, `apps/event/package.json`, and root `package-lock.json`
- Keep: each portal's `editor/EditorShell.tsx`, `editor/index.ts`, and `editor/data/templates-repository.ts`
- Delete: duplicate editor mechanics from both portal directories after wrappers re-export the same public types and actions.

**Interfaces:**
- Client wrapper injects its current template repository and label `Floor plan view`.
- Event wrapper injects its current template repository and label `Read-only`.
- App callers keep their current `@/features/floorplan/editor` entrypoint and imports.

- [ ] Add the workspace dependency to client and event; update the lockfile.
- [ ] Replace each local shell with a thin adapter and keep both index exports stable.
- [ ] Remove duplicated role-neutral mechanics and typecheck client and event.

### Task 3: Verify behavior and package ownership

**Files:**
- Create: `packages/floorplan-canvas/src/canvas-pointer.test.ts`, `src/editor-reducer.test.ts`
- Modify: `scripts/check-prism-boundaries.mjs`, `scripts/check-prism-boundaries.test.mjs`

- [ ] Test that a real draw gesture adds the expected object and that undo/redo restores/removes it through editor actions.
- [ ] Test that read-only pointer editing and canvas drops yield no model mutations.
- [ ] Add a boundary rule preventing the shared canvas package from importing app modules, app aliases, API clients, or app facades; test both allowed portal imports and blocked package imports.
- [ ] Run package tests, package typecheck/build, both portal typechecks, and both boundary commands.

### Task 4: Promote the architecture decision and delivery record

**Files:**
- Modify: `AGENTS.md`, `docs/architecture/current-architecture.md`, `docs/log.md`, `CHANGELOG.md`
- Remove after promotion: this temporary implementation plan.

- [ ] Document the package's narrow role, public import, dependency direction, and excluded workflow ownership in the canonical guides.
- [ ] Record the delivery in the root changelog and documentation ledger.
- [ ] Review the diff and run `git diff --check` before the focused commit.