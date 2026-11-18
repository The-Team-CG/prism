# Floor Plan Editor on Pascal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove Pascal works inside PRISM (spike). Then lay the foundation, so PMCM drafts can be edited in the Pascal editor behind a flag and saved as scenes through the API.

**Architecture:**
- **Contracts:** scene document and event node schemas are Zod in `@prism/types`.
- **Pure logic:** the new `@prism/floorplan-scene` holds scene validation, table-assignment extraction and the legacy converter. The API and the editor both use it.
- **Editor adapter:** `@prism/floorplan-canvas` adds `/editor` and `/plugin` subpaths that wrap Pascal's `<Editor>` and register the `prism:event-layout` plugin.
- **Storage:** the API stores the scene on `floorplan.floor_plans` beside the legacy columns.
- **App:** `apps/event` picks the engine with `NEXT_PUBLIC_PRISM_FLOORPLAN_ENGINE`.

**Tech Stack:**
- Pascal (`@pascal-app/core`, `viewer`, `editor`, `nodes`), pinned to the exact version the spike validates.
- three 0.187, `@react-three/fiber` 9, `@react-three/drei` 10.
- Zod 4, Vitest, NestJS, Prisma, Next 16, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-11-19-pascal-floorplan-editor-design.md`

## Global Constraints

- **Shared contracts:** Zod schema + `z.infer` in `@prism/types` only. No parallel hand types and no `as any`.
- **HTTP:** only in `features/**/data` via `@prism/api-client`.
- **Package isolation:** `@prism/floorplan-canvas` and `@prism/floorplan-scene` make no HTTP, session or role decisions.
- **Browser state:** the browser is never the source of truth. Pascal's IndexedDB persistence is off in PRISM hosts.
- **Versions:** Pascal packages are pinned to one exact version (no `^`). Plugin `apiVersion: 1`.
- **Scene format:** `pascal-v1`. Guests and suppliers appear in scenes as IDs only.
- **Loading:** the editor loads only on the floorplans editor screen, through a client-only dynamic import.
- **Legacy data:** the legacy `objects`, `guests`, `suppliers` and `seats` columns stay readable and are not written by the Pascal engine.
- **Changelog:** update root `CHANGELOG.md` for the delivery. Add one ADR, `docs/architecture/decisions/adr-0010-floorplan-editor-on-pascal.md`.
- **Checks:** run typecheck and focused tests per touched workspace, `check:boundaries` when imports move, and `prisma:validate` + `db:verify:offline` for the schema change.

## Review Focus

1. **Stale save:** a scene save with an old `expectedUpdatedAt` must return 409 like legacy saves, so it never overwrites someone else's change. Covered in Task 4.
2. **Seating rules:** a scene that seats a declined guest, overfills a table, seats one guest twice, or seats anyone at a public event must be refused, just as the legacy editor refuses it. Covered in Task 4.
3. **Oversized or malformed scene:** a scene over 5,000 nodes or 2 MB serialized, or one with dangling `parentId`s, must be rejected with 400, not stored. Covered in Tasks 2 and 4.
4. **Unusual legacy plans:** lines, text, unknown names, and hidden, locked or rotated objects must convert without silent loss. Covered in Task 3.
5. **Read-only sessions:** a coordinator, or anyone viewing an approved draft, can open the Pascal editor but cannot save. Covered in Task 6.

---

### Task 0: Spike — Pascal inside the event app (throwaway)

A gate, not a deliverable. Work on branch `spike/pascal-editor`, never merge it, and delete it afterwards. Only the findings come back, as a "Spike findings" section appended to the spec on the plan branch.

**Files (spike branch only):**
- `apps/event/package.json`: add `@pascal-app/core`, `@pascal-app/viewer`, `@pascal-app/editor`, `@pascal-app/nodes`, `three@0.187.x`, `@react-three/fiber@9`, `@react-three/drei@10`.
- The event app global CSS: add a Tailwind 4 `@source` for `node_modules/@pascal-app`.
- `apps/event/src/app/(portal)/dashboard/spike-pascal/page.tsx`: mounts `<Editor layoutVersion="v2">` after `loadPlugin(builtinPlugin)`, with `onLoad`/`onSave` bound to an in-memory variable.

- [ ] **Step 1: Answer each question, with evidence (screenshot, number, or code reference):**
  1. **Build:** do `next dev` and `next build` for `@prism/event` succeed on Next 16 with Pascal?
  2. **Theme:** does the light theme render with PRISM tokens (no `.dark` ancestor)? Which CSS variables does Pascal read?
  3. **Persistence:** can IndexedDB persistence be disabled? Say how, which prop or store option. Confirm `idb-keyval` writes nothing (DevTools → Application → IndexedDB).
  4. **WebGL fallback:** does the 3D view render with `navigator.gpu` removed? Use Chrome with `--disable-features=WebGPU`.
  5. **Bundle size:** what are the gzipped JS bytes the route adds (`next build` output)? Load time on a throttled "Fast 4G" profile?
  6. **Save payload:** what is the exact type of the `onSave(scene)` argument? Confirm it carries `nodes: Record<string, node>` and `rootNodeIds: string[]`, and record the field names.
  7. **Plan axes:** is legacy screen +y Pascal +z? Is a legacy clockwise rotation in degrees equal to `rotation[1] = -deg × π / 180`? Place one rotated item and compare.
  8. **2D symbols:** can a plugin's `floorplan` geometry draw a round table with 10 chairs? Or is a custom 2D renderer needed to reach the mockup fidelity?
  9. **AI chat:** can the editor's chat panel post to a host-provided endpoint?
  10. **Server use:** can `@pascal-app/core` be imported in Node (the API process) without a DOM, and which entry points are safe?

- [ ] **Step 2: Gate**
  - **Stop:** if 1, 3 or 4 fails, stop and bring the finding back to the design.
  - **Change the plan:** if 6, 7 or 10 differs from this plan's assumptions, update Tasks 1–5 before starting them.

- [ ] **Step 3: Record and commit the findings (plan branch)**

```bash
git add docs/superpowers/specs/2026-11-19-pascal-floorplan-editor-design.md
git commit -m "docs(floorplan): record the Pascal spike findings"
```

---

### Task 1: Scene contracts in `@prism/types`

**Files:**
- Create: `packages/types/src/schemas/floorplan-scene.ts`, `packages/types/src/schemas/floorplan-scene.test.ts`
- Modify: `packages/types/src/schemas/session-spatial-inputs.ts` (`updatePlanSchema`), `packages/types/src/schemas/floorplan-inputs.ts` (`prismFloorPlanSnapshotSchema`), the package index export

**Interfaces:**
- **Produces, in `floorplan-scene.ts`:**
  - `FLOORPLAN_SCENE_FORMAT = "pascal-v1"`.
  - `floorplanSceneNodeSchema`: a passthrough object with `id: string`, `type: string`, `parentId: string | null`, and `visible: boolean`, defaulting to `true`.
  - `floorplanSceneDocumentSchema`: `{ format: literal("pascal-v1"), pascalVersion: string, nodes: record(string, floorplanSceneNodeSchema), rootNodeIds: string[], collections?: record(string, unknown), materials?: record(string, unknown), installedPlugins?: string[] }`. The optional fields are Pascal's `SceneGraph` fields from spike answer 6; they must round-trip unchanged.
  - Exported type: `FloorplanSceneDocument`.
- **Produces, event node schemas (each extends the node schema):**
  - `prismTableNodeSchema`:

    | Field | Type | Default |
    |---|---|---|
    | `type` | literal `"prism-table"` | — |
    | `shape` | `"round" \| "rect" \| "cocktail"` | — |
    | `position` | `[x, y, z]` metres | — |
    | `rotation` | radians | — |
    | `width`, `depth` | metres, > 0 | — |
    | `seats` | int ≥ 0 | — |
    | `number` | int | optional |
    | `chairStyle` | string | `"chiavari"` |
    | `linen` | string | `"white"` |
    | `guestIds` | unique string[] | `[]` |
    | `supplierIds` | string[] | `[]` |
    | `locked` | boolean | `false` |

  - `prismPieceNodeSchema`:
    - `type` is one of: `prism-seat`, `prism-stage`, `prism-av`, `prism-catering`, `prism-registration`, `prism-booth`, `prism-decor`, `prism-safety`, `prism-fixture`, `prism-shape`.
    - `variant: string`.
    - `position`, `rotation`, `width` and `depth` as on the table.
    - `label?: string`.
    - `supplierIds` and `locked` with the same defaults as the table.
  - Exported types: `PrismTableNode` and `PrismPieceNode`.
- **Produces, existing schemas extended:**
  - `updatePlanSchema` gains `scene: floorplanSceneDocumentSchema.optional()`.
  - `prismFloorPlanSnapshotSchema` gains `scene: floorplanSceneDocumentSchema.optional()` and `sceneFormat: z.string().optional()`.

- [ ] **Step 1: Write failing tests in `floorplan-scene.test.ts`**
  - `accepts a minimal pascal-v1 document`.
  - `rejects another format`: `format: "pascal-v2"` fails.
  - `fills table defaults`: parsing `{ type: "prism-table", shape: "round", position: [1,0,2], rotation: 0, width: 1.8, depth: 1.8, seats: 10, id: "prism-table_a", parentId: "level_1" }` gives `guestIds` `[]`, `chairStyle` `"chiavari"` and `locked` `false`.
  - `rejects duplicate guest ids`: `guestIds: ["g1","g1"]` fails.
  - `updatePlanSchema accepts a scene`: the existing required fields plus a scene parse.

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm --workspace @prism/types run test -- floorplan-scene`
Expected: FAIL, with the module not found.

- [ ] **Step 3: Implement the schemas and extensions listed under Interfaces**

- [ ] **Step 4: Build, test and typecheck**

Run: `npm --workspace @prism/types run build && npm --workspace @prism/types run test && npm --workspace @prism/types run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit** `feat(types): add the Pascal floor plan scene contracts`

---

### Task 2: `@prism/floorplan-scene` package — validation and seating extraction

**Files:**
- Create: `packages/floorplan-scene/package.json`, `tsconfig.json`, `src/index.ts`, `src/validate-scene.ts`, `src/validate-scene.test.ts`, `src/table-assignments.ts`, `src/table-assignments.test.ts`
- Modify: `scripts/check-prism-boundaries.mjs` (new rule), `scripts/check-prism-boundaries.test.mjs` (or the existing boundary rule test)

**Package setup:**
- Mirror `packages/portal-query/package.json`: name `@prism/floorplan-scene`, `exports: { ".": "./src/index.ts" }`, and the same `typecheck`, `test`, `test:ci` and `lint` scripts.
- Dependencies: `@prism/types` and `@pascal-app/core@1.1.6`, pinned exactly. Spike answer 10 showed it loads in Node without a DOM.
- Boundary rule `"floorplan scene must stay pure"`: files under `packages/floorplan-scene/` may not import `react`, `@pascal-app/editor`, `@pascal-app/viewer`, `@prism/api-client`, `@prism/ui` or any app.

**Interfaces:**
- **Consumes:** `floorplanSceneDocumentSchema`, `prismTableNodeSchema`, `prismPieceNodeSchema` and `FloorplanSceneDocument` (Task 1).
- **Produces:**
  - `SCENE_LIMITS = { maxNodes: 5000, maxBytes: 2_000_000 }`.
  - `validateFloorplanScene(input: unknown): { ok: true; scene: FloorplanSceneDocument } | { ok: false; issues: string[] }`.
    - Structural checks: the schema parses, nodes ≤ `maxNodes`, `JSON.stringify` length ≤ `maxBytes`, every `parentId` is null or a key in `nodes`, every `rootNodeIds` entry exists and has a null `parentId`.
    - Each node whose `type` starts with `prism-` parses with its event schema.
  - `tableAssignmentsOf(scene: FloorplanSceneDocument): Array<{ tableId: string; seats: number; hidden: boolean; guestIds: string[] }>`. One entry per `prism-table` node. `hidden` is true when the table or any ancestor has `visible: false`.

- [ ] **Step 1: Write failing tests**
  - `validate-scene.test.ts`:
    - `accepts a converted fixture`: a site → building → level → table document is ok.
    - `rejects 5001 nodes` with an issue containing `"too many nodes"`.
    - `rejects a dangling parentId` with an issue naming the node ID.
    - `rejects a prism-table with seats -1`.
    - `rejects a root that has a parent`.
  - `table-assignments.test.ts`:
    - `lists every table with seats and guests`.
    - `marks a table hidden when its level is hidden`.

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm --workspace @prism/floorplan-scene run test`
Expected: FAIL.

- [ ] **Step 3: Implement both modules and the boundary rule**

- [ ] **Step 4: Verify**

Run: `npm --workspace @prism/floorplan-scene run test && npm --workspace @prism/floorplan-scene run typecheck && npm run check:boundaries && npm run test:boundaries`
Expected: PASS.

- [ ] **Step 5: Commit** `feat(floorplan-scene): validate scenes and list table seating`

---

### Task 3: Legacy plan converter

**Files:**
- Create: `packages/floorplan-scene/src/convert-legacy-plan.ts`, `src/convert-legacy-plan.test.ts`, `src/__fixtures__/legacy-plans.ts`

**Interfaces:**
- **Consumes:** `FloorPlanCanvasObject` (`@prism/types`, `floorplan-canvas-inputs.ts`), the Task 1 schemas, and `validateFloorplanScene` (Task 2).
- **Produces:** `convertLegacyPlan(plan: { name: string; widthM: number; heightM: number; objects: FloorPlanCanvasObject[] }, pascalVersion: string): FloorplanSceneDocument`.

**Mapping:**
- **Scene skeleton:** `site` → `building` → `level`, built with Pascal's `SiteNode`, `BuildingNode` and `LevelNode` `.parse()`.
  - Four perimeter walls (`WallNode`, thickness 0.2) around `[0,0]`–`[widthM,heightM]` give the room. The editor derives its floor, ceiling and zone on load (spike finding).
  - Every parent's `children` array lists its children's IDs.
- **Placement:**
  - Every converted object is placed at its centre: `(x + w/2, y + h/2)` → `position [cx, 0, cy]`.
  - Rotation: `rotation = -deg × π / 180`, unless spike answer 7 says otherwise.
  - `width = w` and `depth = h`.
  - `hidden` → `visible: false`. `locked` is carried over as-is.
  - `assignedGuestIds` → `guestIds` and `assignedSupplierIds` → `supplierIds`.
  - The legacy object ID is kept in `metadata.legacyId`.
- **Type mapping**, first match wins:

| Legacy | Scene node |
|---|---|
| `category: "architecture"`, name starts `Wall` | Pascal `wall`: `start`/`end` on the long axis through the centre, `thickness` = short side |
| `architecture`, name starts `Pillar` | Pascal `column` (`ColumnNode.parse`), at the object's centre |
| other `architecture` (Door, Window) | `prism-fixture`, `variant` = lower-kebab name, `locked: true` |
| `furniture`, `kind: "ellipse"`, `seats > 0` | `prism-table`, `shape: "round"` |
| `furniture`, `kind: "ellipse"`, no seats | `prism-table`, `shape: "cocktail"`, `seats: 0` |
| `furniture`, `kind: "rect"`, `seats > 0` | `prism-table`, `shape: "rect"` |
| `furniture`, `kind: "rect"`, no seats, `max(w,h) < 0.6` | `prism-seat` |
| `furniture`, `kind: "rect"`, no seats otherwise | `prism-catering`, `variant: "buffet"` |
| `stage`, name `Stage` | `prism-stage` |
| other `stage` | `prism-av`, `variant` = lower-kebab name |
| `registration`, name `Registration Desk` | `prism-registration` |
| `registration`, name contains `Booth` | `prism-booth` |
| other `registration` | `prism-decor`, `variant` = lower-kebab name |
| `safety` | `prism-safety`, `variant` = lower-kebab name |
| `kind: "line"` or anything left | `prism-shape`, `variant` = `kind`, `label` = `label ?? name` |

- [ ] **Step 1: Write failing tests using fixtures from the current editor's asset library**
  - **Banquet table:** the round banquet `{x:2, y:3, w:1.8, h:1.8, rotation:0, seats:10, assignedGuestIds:["g1"]}` becomes `prism-table` round with `position [2.9,0,3.9]`, `seats 10` and `guestIds ["g1"]`.
  - **Wall:** `{x:0, y:0, w:4, h:0.2}` becomes `wall` with `start [0,0.1]`, `end [4,0.1]` and `thickness 0.2`.
  - **Rotated VIP table:** at 90° it gives `rotation` ≈ `-π/2` (tolerance 1e-9).
  - **Hidden, locked chair:** gives `visible:false`, `locked:true` and `type "prism-seat"`.
  - **Line and text:** a `kind:"line"` object and a text-labelled rect with an unknown name both become `prism-shape` with `label` preserved.
  - **Count and validity:** the converted document passes `validateFloorplanScene`, and node count = objects + 7 (site, building, level, four perimeter walls).
  - **Children:** every node's `parentId` appears in that parent's `children`.

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm --workspace @prism/floorplan-scene run test -- convert-legacy-plan`
Expected: FAIL.

- [ ] **Step 3: Implement `convertLegacyPlan`**
  - Build Pascal built-in nodes with their own `.parse()`, which generates the typed IDs.
  - Build `prism-*` nodes with the Task 1 schemas, using IDs `prism-<kind>_<crypto.randomUUID()>`.

- [ ] **Step 4: Run the tests and typecheck**

Run: `npm --workspace @prism/floorplan-scene run test && npm --workspace @prism/floorplan-scene run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit** `feat(floorplan-scene): convert legacy floor plans to Pascal scenes`

---

### Task 4: Store and serve scenes through the API

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (`FloorPlan`: `scene Json?`, `sceneFormat String? @map("scene_format")`)
- Create: `apps/api/prisma/migrations/20261124090000_floorplan_floor_plan_scene/migration.sql` (two nullable columns on `"floorplan"."floor_plans"`)
- Modify:
  - `apps/api/src/modules/floorplan/application/authoring/plans.service.ts`: `mapPlan` returns `scene` and `sceneFormat`; `updatePlan` handles `scene`; `assertTableAssignmentsEligible` reads scene tables.
  - `apps/api/src/modules/floorplan/application/authoring/plan-patch.ts`: `scene` patch field.
  - `apps/api/src/modules/floorplan/application/live/floor-plan-workflow.service.ts`: `floorPlanSnapshot` includes `scene` and `sceneFormat`.
  - `apps/api/package.json`: depend on `@prism/floorplan-scene`.
  - `docs/architecture/persistence-ownership.md`: the `floor_plans` row lists the `scene` JSON column.
- Test: `apps/api/src/modules/floorplan/application/authoring/plans.service.test.ts`, the workflow service test beside it

**Interfaces:**
- **Consumes:** `updatePlanSchema.scene` (Task 1); `validateFloorplanScene`, `tableAssignmentsOf` and `FLOORPLAN_SCENE_FORMAT` (Tasks 1–2).
- **Produces:**
  - **`GET /plans/:planId`:** adds `scene: FloorplanSceneDocument | null` and `sceneFormat: string | null`.
  - **`PUT /plans/:planId` with `scene`:**
    - Validates the scene server-side; failure is 400 with the `issues`.
    - Stores `scene` and `sceneFormat = "pascal-v1"`.
    - Leaves the legacy `objects` and `floor_plan_objects` rows untouched.
  - **Submitted and approved snapshots:** carry `scene` and `sceneFormat`.

- [ ] **Step 1: Write failing tests**
  - `plans.service.test.ts`:
    - `stores a valid scene and returns it`.
    - `rejects an invalid scene with 400 listing issues`.
    - `returns 409 for a scene save with a stale expectedUpdatedAt`.
    - `refuses scene seating that is ineligible`: one case each for a declined guest, a full table, a guest seated twice, and a public event. The legacy rejection codes apply.
    - `keeps legacy objects unchanged on a scene save`.
    - `refuses a scene save from a role that cannot edit the plan`, reusing the existing forbidden-role setup.
  - Workflow test: `approval snapshot includes the scene`.

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm --workspace prism-api run test -- plans.service floor-plan-workflow`
Expected: FAIL.

- [ ] **Step 3: Implement the schema, migration and service changes**
  - Map scene tables through `tableAssignmentsOf` into the shape the existing eligibility check takes.
  - When a save carries both `objects` and `scene`, reject it with 400 `"Send objects or scene, not both"`.

- [ ] **Step 4: Verify**

Run: `npm --workspace prism-api run test -- plans.service floor-plan-workflow && npm --workspace prism-api run prisma:validate && npm --workspace prism-api run typecheck && npm --workspace prism-api run db:verify:offline && npm --workspace prism-api run db:check:domain-persistence`
Expected: PASS. If `db:check:domain-persistence` is not a workspace script, use the root script of that name.

- [ ] **Step 5: Commit** `feat(floorplan): store Pascal scenes on floor plans and in snapshots`

---

### Task 5: Pascal host adapter and placeholder event plugin

**Files:**
- Modify: `packages/floorplan-canvas/package.json`:
  - Add `exports` `"./editor"` and `"./plugin"`.
  - Pin the Pascal packages to the spike version as dependencies.
  - Add `three`, `@react-three/fiber` and `@react-three/drei` as peers.
  - Depend on `@prism/floorplan-scene`.
- Modify (host integration from the spike):
  - Root `package.json`:
    - Add the dev dependencies `@types/pdfkit` and `@types/blob-stream`, plus `patch-package`.
    - `postinstall` becomes `patch-package && npm --workspace @prism/types run build`.
  - `patches/@pascal-app+editor+1.1.6.patch`: in `src/lib/follow-pascal-targets.ts`, `buildingOf` declares `let node: Nodes[string] | undefined = nodes[id]`. That is the only Pascal error under PRISM's TypeScript settings. Open the same fix upstream.
  - `apps/event/next.config.ts`: `transpilePackages` gains `three`, `@pascal-app/core`, `@pascal-app/viewer`, `@pascal-app/editor` and `@pascal-app/nodes`. No `ignoreBuildErrors`.
  - `apps/event/src/app/globals.css`:
    - `@import "@pascal-app/viewer/ui/theme.css"` before `@prism/tokens/theme.css`, then `@import "@prism/floorplan-canvas/pascal-theme.css"`.
    - `@source` for `node_modules/@pascal-app/editor/src`, `@pascal-app/viewer/dist/ui` and `@pascal-app/nodes/dist`.
  - `apps/event/public/icons/`, `hdri/` and `audios/`: copied from `pascalorg/editor` `apps/editor/public` at the commit published as 1.1.6. Record the source commit in `apps/event/public/PASCAL-ASSETS.md`.
- Create:
  - `packages/floorplan-canvas/src/pascal/pascal-theme.css`: maps Pascal's `--sidebar-*` and `--shadow-elevation-*` variables to PRISM tokens, so the side panels render light.
  - `packages/floorplan-canvas/src/pascal/scene-document.ts` + test
  - `src/pascal/prism-floorplan-editor.tsx`
  - `src/pascal/event-layout-plugin.ts` + test
  - `src/pascal/editor-entry.ts` (the `./editor` export)
  - `src/pascal/plugin-entry.ts` (the `./plugin` export)

**Interfaces:**
- **Consumes:** `FloorplanSceneDocument` and `FLOORPLAN_SCENE_FORMAT` (Task 1); the `onSave` payload type and field names recorded in spike answer 6.
- **Produces:**
  - **`toSceneDocument` / `fromSceneDocument`:**
    - `toSceneDocument(pascalScene: PascalSaveScene, pascalVersion: string): FloorplanSceneDocument`.
    - `fromSceneDocument(doc: FloorplanSceneDocument): PascalSaveScene`.
    - `PascalSaveScene` is the spike-recorded type, re-exported from Pascal, not hand-written.
  - **`prismEventLayoutPlugin: Plugin`:**
    - `id: "prism:event-layout"`, `apiVersion: 1`.
    - `nodes`: one definition per Task 1 event type. Each `schema` is the Task 1 Zod schema.
    - Placeholder geometry: a cylinder of `width` diameter for round and cocktail tables, otherwise a box of `width × depth × 0.75 m`.
    - A 2D footprint polygon from the same size.
    - `presentation.label` is the variant name.
  - **`PrismFloorplanEditor`** props: `{ scene: FloorplanSceneDocument; readOnly: boolean; onSave(doc: FloorplanSceneDocument): Promise<unknown>; onSubmit?(doc: FloorplanSceneDocument): Promise<unknown>; onBack(): void; eventName?: string; draftName?: string; draftStatus?: string }`.
    - Mounts `<Editor layoutVersion="v2">` with `onLoad`/`onSave` always supplied, so Pascal never falls back to local scene storage (spike answer 3).
    - Passes `sidebarTabs` with the built-in Scene tab (`id: "site"`). Milestone 2 adds Room, Library, Guests and Checks.
    - Loads `builtinPlugin` and `prismEventLayoutPlugin` once.
    - Blocks edits when `readOnly`.

- [ ] **Step 1: Write failing tests**
  - `scene-document.test.ts`:
    - `round-trips a converted fixture`: `fromSceneDocument(toSceneDocument(x)) ≍ x`.
    - `stamps format and version`.
  - `event-layout-plugin.test.ts`:
    - `registers one definition per prism node type`.
    - `parses a converted table through the registered schema`.

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm --workspace @prism/floorplan-canvas run test -- pascal`
Expected: FAIL.

- [ ] **Step 3: Implement the four modules**

- [ ] **Step 4: Verify**

Run: `npm --workspace @prism/floorplan-canvas run test && npm --workspace @prism/floorplan-canvas run typecheck && npm --workspace @prism/event run typecheck && npm run check:boundaries`
Expected: PASS, with no errors from `node_modules/@pascal-app`. The existing legacy canvas tests still pass.

- [ ] **Step 5: Commit** `feat(floorplan-canvas): host the Pascal editor with a placeholder event plugin`

---

### Task 6: Event app on the Pascal engine behind a flag, with the ADR

**Files:**
- Create:
  - `apps/event/src/features/floorplan/editor/model/editor-engine.ts` + test
  - `apps/event/src/features/floorplan/editor/use-cases/open-plan-scene.ts` + test
  - `apps/event/src/features/floorplan/editor/PascalEditorShell.tsx`
  - `docs/architecture/decisions/adr-0010-floorplan-editor-on-pascal.md`
- Modify:
  - `apps/event/src/features/event-dashboard/shell/views/sections/event-dashboard-editor-screen.tsx`: picks the engine.
  - `apps/event/src/features/event-dashboard/shell/view-models/use-event-dashboard-shell-view-model.ts`: `saveEditorScene` and `submitEditorScene` beside the legacy commands.
  - The data command behind `commands.savePlan`: sends `{ expectedUpdatedAt, scene }`.
  - `apps/event/.env.example`: `NEXT_PUBLIC_PRISM_FLOORPLAN_ENGINE=legacy`.
  - Event app global CSS: Tailwind `@source` for `@pascal-app` (from the spike).
  - `AGENTS.md` (package table row for `@prism/floorplan-scene`; `@prism/floorplan-canvas` now hosts Pascal).
  - `docs/architecture/current-architecture.md`.
  - `docs/architecture/decisions/index.md`.
  - `docs/index.md`.
  - `CHANGELOG.md`.

**Interfaces:**
- **Consumes:** `PrismFloorplanEditor` (Task 5), `convertLegacyPlan` (Task 3), the `GET`/`PUT /plans/:planId` scene fields (Task 4).
- **Produces:**
  - `floorplanEngine(): "pascal" | "legacy"`: reads `process.env.NEXT_PUBLIC_PRISM_FLOORPLAN_ENGINE`. Anything other than `"pascal"` is `"legacy"`.
  - `openPlanScene(plan: { scene: FloorplanSceneDocument | null; name: string; widthM: number; heightM: number; objects: FloorPlanCanvasObject[] }, pascalVersion: string): { scene: FloorplanSceneDocument; converted: boolean }`.
    - Returns the stored scene, or converts on open with `converted: true`.
    - The first save stores the conversion.

- [ ] **Step 1: Write failing tests**
  - `editor-engine.test.ts`: `defaults to legacy`; `"pascal" selects pascal`; `"PASCAL " is legacy`. Exact match only.
  - `open-plan-scene.test.ts`: `uses the stored scene`; `converts a legacy plan once and marks converted`.
  - A view-model test: `read-only for a coordinator and for an approved draft on the pascal engine`. Same rule as legacy: `screen.readOnly || !isPmcmAdmin(role)`. `saveEditorScene` is never called while read-only.
  - A view-model test: `saveEditorScene chains updatedAt across consecutive autosaves`. Pascal autosaves repeatedly (spike answer 6), so each PUT sends the `updatedAt` returned by the previous one, and two quick saves never produce a 409.

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm --workspace @prism/event run test -- editor-engine open-plan-scene event-dashboard-shell`
Expected: FAIL.

- [ ] **Step 3: Implement the engine switch**
  - Load `PascalEditorShell` through `next/dynamic` with `ssr: false`, as the legacy shell is loaded today.
  - Write ADR-0010:
    - Decision: approach A from the spec.
    - Status: accepted.
    - Consequences: the pinned version, the plugin contract, the IndexedDB rule, and the legacy columns kept until removal.
  - Update the docs and changelog listed under Files. Changelog line: "PMCM can open drafts in the new Pascal-based floor plan editor when `NEXT_PUBLIC_PRISM_FLOORPLAN_ENGINE=pascal`; existing layouts convert on first open."

- [ ] **Step 4: Verify**
  - Run: `npm --workspace @prism/event run test && npm --workspace @prism/event run typecheck && npm run check:boundaries && npm run test:ci:guards`. Expected: PASS.
  - Manual path, using the local browser recipe:
    1. With the engine set to `pascal`, PMCM opens a UAT draft, places a piece and saves.
    2. Reload: the piece is still there.
    3. Submit and approve: the approval snapshot has `scene`.
    4. A coordinator session opens the draft read-only.
    5. With the engine set to `legacy`, the old editor still opens the same draft.

- [ ] **Step 5: Commit** `feat(event): open floor plan drafts in the Pascal editor behind a flag`

---

## Later milestones (one plan each, written when the previous one ships)

| # | Milestone (spec rollout step) | Ships | First plan input |
|---|---|---|---|
| 2 | Event pieces | Real 2D symbols and 3D models for every event kind; `prism-dance-floor`, `prism-bar`, `prism-seating-block`, `prism-zone`; inspector parametrics; Guests and supplier panels | Spike answer 8 |
| 3 | Venues and rooms | `floorplan.venues` / `venue_rooms`; last-approved reuse; guide-image tracing; ocular survey as a room starter; retire `venue_templates` | Design "Data" section |
| 4 | Checks and setup styles | Pure checks with the spec's default thresholds; acknowledgement on approval; arrangers per setup style | Design "Checks" table |
| 5 | Client and supplier | `PrismFloorplanViewer`; Option A/B sets; client choice and comment pins; supplier zone view; one-time conversion of approved legacy snapshots; retire the client preference editor and `floorplan-preferences` / `reopen-preference` | Product decision in spec |
| 6 | AI assistant | `floorplan-layout-assist` gateway use case; plugin agent tools and operations; `POST /events/:eventId/floorplans/:draftId/assistant` | Design "AI" section; spike answer 9 |
| 7 | Finish | Phases, PDF export, flag removal, deletion of the legacy canvas and legacy columns | All earlier milestones |

The design placed the one-time conversion script in the foundation step. It
moves to milestone 5, the first place unconverted approved snapshots are read
in the new viewer. Until then, conversion on open covers every draft PMCM edits.
