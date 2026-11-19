# Pascal as the only floor plan editor: implementation plan

**Goal:** Every floor plan, venue template and snapshot is a Pascal scene; clients read scenes; the legacy canvas
editor, its storage columns and the `NEXT_PUBLIC_PRISM_FLOORPLAN_ENGINE` flag are gone.

**Why:** the event app can open drafts in Pascal, but the client portal draws the official layout, review pins,
layout preview and preferences from the legacy `objects` list, which a Pascal save never writes. Switching the flag
today shows clients an empty or stale layout. PRISM's rule is one format and no fallbacks, so the legacy data is
converted once and its code deleted.

**Builds on:** `feat/floorplan-editor-ui` (ADR-0010, `docs/superpowers/specs/2026-11-19-floorplan-editor-ui-design.md`).

## Decisions (maintainer's recommendations, approved by "go do all that")

1. **Clients read scenes without the editor.** A pure `planDrawing(scene)` in `@prism/floorplan-scene` turns a
   scene into what a 2D view needs: the room box (from visible walls), each visible wall as a line, and each visible
   event piece as `{ id, type, name, shape: "rect" | "circle", cx, cy, width, depth, rotation }`. The client's official
   layout view, review canvas and layout preview draw it as SVG. Clients never download the 2.8 MB editor to look.
2. **Review pins stay normalized.** Annotations keep `anchorX`/`anchorY` as 0–1 across the room box, and `objectId`
   names a scene node id. A converted plan keeps its room at `0..widthM × 0..heightM`, so existing anchors stay put.
3. **Clients draw preferences in the Pascal editor.** A client's own preference draft opens in
   `@prism/floorplan-canvas/editor` (client-only dynamic import), with no guests (seating
   `{ allowed: false, reason: "Your event team seats guests on the official layout." }`), no suppliers, and Submit
   sending the preference as today. The API accepts a scene save from a client only for their own preference draft
   (the rule that already governs their `objects` saves).
4. **Venue templates are scenes.** "Save as venue template" moves into the PMCM Pascal editor header and stores the
   current scene; a draft from a template copies the template's scene with fresh node ids and no seated guests.
   Template guests and suppliers go: the event roster and bookings replace them.
5. **One conversion, then drop the columns.** `npm --workspace prism-api run db:convert:floorplans` converts every
   plan whose `scene` is null (event drafts, preference drafts, template base plans), every snapshot version without a
   scene, remaps annotation `objectId`s through `metadata.legacyId`, and rewrites the stored `snapshotHash` of
   annotations and client decisions to the converted snapshot's hash. Event draft seats move to roster ids with
   `matchLegacyGuests`; unmatched seats are dropped and counted in the script's report. It is idempotent and has
   `--dry-run`. A migration then drops `objects`, `guests`, `suppliers`, `seats`, `seat_categories`,
   `floor_plan_objects` and the template `guests`/`suppliers`, and makes `scene`/`scene_format` NOT NULL. It raises
   "Run db:convert:floorplans first" if any plan still has no scene, so it can never run before the conversion.

## Tasks (one branch, `codex/floorplan-pascal-default`, in order)

### Task 1: clients read scenes
- `packages/floorplan-scene/src/plan-drawing.ts` + test: `planDrawing(scene): PlanDrawing` (type exported). Move
  `roomSize` logic from `packages/floorplan-canvas/src/pascal/shell/footer-counts.ts` here and use it from both.
- Client: `floorplan-review` (geometry, canvas, view-model), `layout-preview.tsx`, the official layout view and
  `snapshot-project.ts` read `scene` from the snapshot/plan and draw `planDrawing`. Pins hit-test pieces by their
  rotated box. Keep the existing review tests' behaviours, rewritten for scenes.
- API: snapshots and the client workspace already return `scene`; make the client-facing read types in
  `@prism/types` carry `scene: FloorplanSceneDocument` and stop reading `objects` on the client.
- Commit `feat(client): draw official layouts and review pins from the Pascal scene`.

### Task 2: preferences and templates in Pascal
- Client preference draft opens in the Pascal editor (decision 3); new preference drafts start from the official
  scene or a blank room scene; saving uses `PUT /plans/:planId` with `scene`.
- API: allow a client's scene save on their own preference draft; keep refusing scenes on anything else they touch.
- PMCM editor header gets "Save as venue template" (decision 4); template drafts copy the template scene.
- Commit `feat(floorplan): draw preferences and save venue templates in the Pascal editor`.

### Task 3: convert, delete legacy, drop the flag
- Conversion CLI and the guarded drop migration (decision 5), with tests for the conversion on fixture rows.
- Delete: `NEXT_PUBLIC_PRISM_FLOORPLAN_ENGINE` and `floorplanEngine`; both portals' legacy `EditorShell`; the legacy
  editor exports of `@prism/floorplan-canvas` (keep `/editor` and `/plugin`); `Project`/`CanvasObject` usage;
  `objects` write paths and validation in the API; `convertLegacyPlan` callers in the event app (`openPlanScene`
  becomes "open the stored scene"), the unmatched-seats notice; legacy branches in `table-assignment-guard.ts`,
  `floor-plan-workflow.service.ts` and the client `approvedLegacyPmcmPreference` rule; the legacy plan shape in
  `apps/api/src/kernel/shared/domain.types.ts`. `convertLegacyPlan` and `matchLegacyGuests` stay only for the CLI.
- Docs: ADR-0010 consequences, `current-architecture.md`, `actual-system.md` floor plan section, CHANGELOG.
- Commit `feat(floorplan): make Pascal the only floor plan editor and drop the legacy plan columns`.

## Critical checks per task
Typecheck and focused tests of touched workspaces (`@prism/floorplan-scene`, `@prism/floorplan-canvas`, `@prism/types`,
client, event, API floorplan module); `check:boundaries`, `check:complexity`; for Task 3 also `prisma:validate`,
`db:verify:offline`, `check:migrations`.
