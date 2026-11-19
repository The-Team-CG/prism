# Floor Plan Editor UI and Event Pieces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Pascal-hosted floor plan editor into an event layout tool for PMCM:
- event chrome
- a Library of real pieces placed by click
- event symbols in 2D
- an event inspector
- seating against the event guest roster
- supplier zones
- Seating and Supplier zones lenses
- a Layers list

**Architecture:**
- Pascal 1.1.6 stays the engine. PRISM fills its supported extension points: `<Editor>` props, the
  `prism:event-layout` plugin's node fields, and exported stores.
- One `patch-package` patch removes the chrome Pascal gives no switch for.
- Piece contracts live in `@prism/types`, and scene rules in `@prism/floorplan-scene`.
- The API checks scene seating against the `operations` roster, and zone suppliers against the event's
  bookings, both through read-model readers.

**Tech Stack:**
- Pascal `@pascal-app/{core,editor,nodes,viewer}` 1.1.6 and three 0.187.
- React 19, Next 16, Zod 4, Vitest.
- NestJS and Prisma 7.
- `patch-package`.

**Spec:**
- `docs/superpowers/specs/2026-11-19-floorplan-editor-ui-design.md`
- Parent: `docs/superpowers/specs/2026-11-19-pascal-floorplan-editor-design.md`, ADR-0010.
- Mockups: `output/floorplan-editor-mockup/editor-v2-{design,map}.png` (untracked; regenerate with `node output/floorplan-editor-mockup/build2.mjs`).

## Global Constraints

- Shared contracts are Zod schemas with `z.infer` in `@prism/types` only. No `as any`, and no `zod` import outside `@prism/types` (lint `prism(no-inline-zod)`).
- `@prism/floorplan-canvas` makes no HTTP, session or role decisions. Data and callbacks arrive as props from `apps/event`.
- HTTP calls live only in `apps/event/src/features/**/data` via `@prism/api-client`.
- Pascal stays at exactly 1.1.6. Chrome changes are made in `patches/@pascal-app+editor+1.1.6.patch` (LF line endings, already pinned by `.gitattributes`), never as CSS selectors aimed at Pascal internals.
- Every function has cyclomatic complexity ≤ 10 (`npm run check:complexity`).
- Seating rule: `findTableAssignmentRejection` and `seatingUnavailableReason` from `@prism/types`. The API is authoritative on every save.
- Guests carry name, group, RSVP and dietary. There is no VIP field. The roster's `category` is shown as the group.
- Copy (exact):
  - "Click the plan to place · Esc"
  - "Unseat guests to hide this table"
  - "Not saved · Retry"
  - "Changed elsewhere · Reload"
  - "View only"
  - "Edit on a laptop"
  - "N seats could not be matched to the guest list"
- Visual rules (`AGENTS.md`): no nav underlines, and no eyebrow, outline or uppercase badge pills. Use PRISM tokens only.
- Each delivery updates `CHANGELOG.md` with one concise line.

## Review Focus

1. **A seated table becomes hidden or loses seats:** hiding a table with guests is blocked; lowering its seats below the number seated is refused by the card with the rule's message. Neither ever autosaves into a 400 loop. Tests: Tasks 9 and 11.
2. **Two autosaves race a conflict:** after a 409, no further save is sent until reload, and edits made after the conflict are not silently dropped (the header keeps "Changed elsewhere · Reload"). Test: Task 6.
3. **Placement on a read-only scene:** a Library tile cannot arm a tool when read-only, and Esc always disarms. Test: Task 7.
4. **Legacy seats without a roster match:** converting keeps matched guests, drops the rest, and reports the count once. A second open does not report it again once saved. Test: Task 10.
5. **Event not eligible for seating (public, or 200+ guests):** the Guests tab explains, and "Seat guests" and the Seating lens are absent. The API refuses new seats regardless. Tests: Tasks 2 and 10.

---

### Task 1: RSVP and dietary on the event roster

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (`OpsGuestRosterEntry`: `rsvp String @default("pending")`, `dietary String @default("")`)
- Create: `apps/api/prisma/migrations/20261125090000_operations_guest_roster_rsvp_dietary/migration.sql` (header `prism-owner: operations`, `prism-kind: schema`, `prism-risk: medium`)
- Modify: `apps/api/prisma/domain-ownership.json` (`guest_roster_entries` columnCount +2)
- Modify: `packages/types/src/event-ops/operations.ts` (`PrismGuestRosterEntry`), and the roster write schemas in `packages/types/src/schemas/` used by roster import and update
- Modify: the operations roster mapper and import service in `apps/api/src/modules/operations/application/guest/` (find with `grep -rn "guestName" apps/api/src/modules/operations`)
- Test: the existing roster service test beside that service

**Interfaces:**
- Produces:
  - `guestRosterRsvpSchema = z.enum(["confirmed", "pending", "declined"])`, exported from `@prism/types`.
  - `PrismGuestRosterEntry` gains `rsvp: "confirmed" | "pending" | "declined"` and `dietary: string`.
  - Roster import accepts optional `rsvp` and `dietary` columns. An unknown RSVP value is a row error, not a silent default.

- [ ] **Step 1: Write failing tests:** "imports rsvp and dietary columns", "rejects an unknown rsvp value with the row number", "returns rsvp and dietary on roster reads (pending and empty by default)".
- [ ] **Step 2:** Run `npx vitest run --root apps/api <roster test file>`. Expected: FAIL.
- [ ] **Step 3:** Implement the schema, migration, contracts, mapper and import.
- [ ] **Step 4:** Run the test, `npm run check:migrations`, `npm run check:domain-persistence`, `npm --workspace prism-api run prisma:validate`, `npm --workspace prism-api run db:verify:offline`, and the API typecheck. Expected: PASS.
- [ ] **Step 5:** Commit `feat(operations): record RSVP and dietary needs on the event guest roster`.

### Task 2: Scene seating checked against the roster, zone suppliers against bookings

**Files:**
- Create: `apps/api/src/modules/read-models/floorplan-seating/` (port, Prisma reader and module, following `participant-facts/`)
- Modify: `apps/api/src/modules/read-models/commercial-facts-reader.ts` (add booked supplier ids)
- Modify: `apps/api/src/modules/floorplan/application/authoring/plans.service.ts` (the `seatingLayouts` scene branch takes roster guests) and `table-assignment-guard.ts`
- Modify: the floorplan module's imports for the new reader
- Test: `apps/api/src/modules/floorplan/application/authoring/plans.service.test.ts` (extend the "Pascal scene saves" block)

**Interfaces:**
- Produces:
  - `FLOORPLAN_SEATING_ROSTER_READER` with `listSeatingGuests(eventId: string, db?: Prisma.TransactionClient): Promise<TableEligibilityGuest[]>`. It returns roster entries that are not withdrawn and have `eligibility === "eligible"`, as `{ id, rsvp }`.
  - Commercial facts gain `bookedSupplierIds(eventId: string, db?): Promise<Set<string>>`: suppliers whose quote request for the event has status `selected`.
- Behaviour:
  - A scene save checks tables against the roster guests, not `changes.guests` or the stored plan roster.
  - A save without a scene (legacy) keeps today's behaviour.
  - A scene whose `prism-zone` nodes list a supplier that is not booked is refused with 400 "Zones can only name suppliers booked on this event."

- [ ] **Step 1: Write failing tests:**
  - "checks scene seating against the event roster": a roster with a declined guest seated is refused with the declined message.
  - "a withdrawn roster guest is unknown".
  - "a legacy save still checks the plan guest list".
  - "refuses a zone naming an unbooked supplier".
  - "accepts a zone naming a booked supplier".
  - Keep the public-event and 200-guest refusals passing with roster guests.
- [ ] **Step 2:** Run `npx vitest run --root apps/api src/modules/floorplan`. Expected: FAIL.
- [ ] **Step 3:** Implement the reader, the commercial method and the scene branch.
- [ ] **Step 4:** Run the floorplan tests, `npm run check:boundaries` and the API typecheck. Expected: PASS.
- [ ] **Step 5:** Commit `feat(floorplan): check scene seating against the event roster and zones against bookings`.

### Task 3: New piece kinds and scene helpers

**Files:**
- Modify: `packages/types/src/schemas/floorplan-scene.ts`
- Modify: `packages/floorplan-scene/src/validate-scene.ts`, `index.ts`
- Create: `packages/floorplan-scene/src/scene-capacity.ts` + test
- Test: `packages/types/src/schemas/floorplan-scene.test.ts`, `packages/floorplan-scene/src/validate-scene.test.ts`

**Interfaces:**
- Produces in `@prism/types`:
  - `prismSeatingBlockNodeSchema`: `type: "prism-seating-block"`, `style: "theater" | "classroom"`, `rows` int ≥ 1, `columns` int ≥ 1, `aisle` m ≥ 0, plus placement.
  - `prismDanceFloorNodeSchema`: `type: "prism-dance-floor"`, plus placement.
  - `prismBarNodeSchema`: `type: "prism-bar"`, `shape: "straight" | "l"`, plus placement.
  - `prismZoneNodeSchema`: `type: "prism-zone"`, `label: string`, plus placement (`supplierIds` already in placement).
  - `prismEventPieceTypes` (a const array of every `prism-*` type), `PrismEventPieceType` (its element type), and `prismEventPieceSchemaFor(type: PrismEventPieceType)` returning that type's schema.
  - `placeableEventPieceSchemaFor(type)`: the same schema with `id` defaulting to `` `${type}_${crypto.randomUUID()}` ``, so Pascal tools can parse without an id.
  - Optional piece fields used by the card and symbols: tables gain `centerpiece?: string`; stages gain `steps?: boolean` and `heightM?: number`.
- Produces in `@prism/floorplan-scene`:
  - `sceneSeatCount(scene): number`: seats of visible tables plus `rows × columns` of visible seating blocks.
  - `nextTableNumber(scene): number`: one past the highest table `number`.
  - `zoneSupplierIds(scene): string[]`.
  - `validateFloorplanScene` validates every new type through `prismEventPieceSchemaFor`.

- [ ] **Step 1: Write failing tests:**
  - Each new schema parses a valid node and rejects a bad field.
  - `placeableEventPieceSchemaFor("prism-table").parse(nodeWithoutId).id` matches `/^prism-table_/`.
  - `sceneSeatCount` counts a hidden table as 0 and a 5 × 4 block as 20.
  - `nextTableNumber` on tables numbered 1 and 7 is 8.
  - `validateFloorplanScene` rejects a `prism-zone` without a label.
- [ ] **Step 2:** Run `npm --workspace @prism/types run test` and `npm --workspace @prism/floorplan-scene run test`. Expected: FAIL.
- [ ] **Step 3:** Implement. Rebuild `@prism/types` and `@prism/floorplan-scene`, since the API loads their `dist`.
- [ ] **Step 4:** Run both tests and typechecks, the API typecheck, and `npm run check:complexity`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(floorplan-scene): add seating blocks, dance floor, bar and supplier zones`.

### Task 4: Pascal chrome patch and editor configuration

**Files:**
- Modify: `node_modules/@pascal-app/editor/src/...`, then regenerate `patches/@pascal-app+editor+1.1.6.patch` with `npx patch-package @pascal-app/editor`. Files located on 2026-11-19:
  - `components/ui/sidebar/use-plugin-panels.tsx` (Plugins entry)
  - `components/editor/views/use-editor-views.ts` (Browse plugins view)
  - `components/editor/index.tsx` (mounts of `FloatingLevelSelector`, `SkyControl`, `HelperManager` and `FloatingActionMenu`)
  - `components/editor/floorplan-panel.tsx` (`FloorplanCompassButton`)
  - `components/ui/action-menu/view-toggles.tsx` (`ReferencesControl`)
- Modify: `packages/floorplan-canvas/src/pascal/prism-floorplan-editor.tsx` (`viewBar={false}`, camera hint)
- Create: `packages/floorplan-canvas/src/pascal/pascal-chrome.test.ts`

**Interfaces:**
- Produces: a single host flag for the patched mount points, `globalThis.__PRISM_HOST__ = true`, set by `PrismFloorplanEditor` before mounting. Every patched mount reads `!globalThis.__PRISM_HOST__ && <original condition>`, so Pascal's own behaviour is unchanged without the host. The 3D `FloatingActionMenu` mount also requires `!readOnly`.
- Camera hint: `useCameraHintFocus.getState().focus([])` on mount.

- [ ] **Step 1: Write the failing test** `pascal-chrome.test.ts`. For each listed file in `node_modules/@pascal-app/editor/src`, it asserts the file contains `__PRISM_HOST__`. This proves the patch was applied by `postinstall`.
- [ ] **Step 2:** Run `npm --workspace @prism/floorplan-canvas run test -- pascal-chrome`. Expected: FAIL.
- [ ] **Step 3:** Edit the mounts, regenerate the patch, and set the flag and `viewBar={false}` in the host.
- [ ] **Step 4:** Run the test, the canvas and event typechecks, and `npx patch-package` (applies cleanly). Expected: PASS. Open the editor locally: no Plugins entry, level chip, sky widget, compass, shortcuts card or scans control.
- [ ] **Step 5:** Commit `feat(floorplan-canvas): hide Pascal's building-editor chrome in PRISM`.

### Task 5: Editor context and shell (header, footer, rail, states)

**Files:**
- Create: `packages/floorplan-canvas/src/pascal/editor-context.tsx` (`PrismFloorplanContext` and its provider)
- Create: `packages/floorplan-canvas/src/pascal/shell/editor-header.tsx`, `editor-footer.tsx`, `view-switch.tsx`, `loading-room.tsx`
- Create: `packages/floorplan-canvas/src/pascal/shell/footer-counts.ts` + test
- Modify: `prism-floorplan-editor.tsx` (`navbarSlot`, `sidebarTabs`, `columnTabId`, `loadingSlot`, `onSaveStatusChange`, footer below `<Editor>`, the small-screen rule. Ctrl+S needs nothing extra: Pascal flushes autosave through our `onSave`)
- Modify: `editor-entry.ts` (export the new prop types)
- Test: `packages/floorplan-canvas/src/pascal/shell/editor-shell.test.tsx` (jsdom; mock `@pascal-app/editor`'s `Editor` to render its slots)

**Interfaces:**
- Produces `PrismFloorplanEditorProps`, adding to today's props:
  - `guests: PrismFloorplanSeatingGuest[]`
  - `suppliers: PrismFloorplanSupplier[]`
  - `seating: { allowed: boolean; reason: string | null }`
  - `guestCount: number`
  - `saveState: SceneSaveState`
  - `onRetrySave(): void`
  - `onReload(): void`
  - `unmatchedSeats: number`
- Produces in `@prism/types` (read models):
  - `PrismFloorplanSeatingGuest = { id: string; name: string; group: string | null; rsvp: "confirmed" | "pending" | "declined"; dietary: string | null }`
  - `PrismFloorplanSupplier = { id: string; name: string; kind: string }`
  - `SceneSaveState = "saved" | "saving" | "failed" | "conflict"`
- Produces `usePrismFloorplan(): PrismFloorplanContextValue` (the props above, plus `readOnly`), read by every panel, footer and card in later tasks.
- Produces `footerCounts(scene, guests, guestCount): { guests: number; seats: number; seated: number }`:
  - `guests` is the guests not declined, or `guestCount` when the list is empty.
  - `seats` comes from `sceneSeatCount`.
  - `seated` counts unique guest ids at visible tables.
- Rail tab ids: `"library"`, `"guests"`, `"layers"`. Library is `columnTabId`. Read-only removes `"library"`.
- Header 2D/3D/Split calls `useEditor.getState().setViewLayout(...)`. Undo and redo call Pascal's scene history.
- Phases and "Preview as client" render disabled with the tooltips "Phases arrive with milestone 7" and "Client view arrives with milestone 5".
- Under `(max-width: 767px)`: read-only, with a banner "Edit on a laptop".

- [ ] **Step 1: Write failing tests:**
  - `footerCounts`: declined guests are excluded, it falls back to `guestCount` when the list is empty, and a guest listed twice is counted once.
  - Header shows "Not saved · Retry" for `failed` and calls `onRetrySave`.
  - Header shows "Changed elsewhere · Reload" for `conflict` and calls `onReload`.
  - Header shows "View only" with no Submit when read-only.
  - The rail omits Library when read-only.
  - The small-screen banner appears under 768 px.
- [ ] **Step 2:** Run `npm --workspace @prism/floorplan-canvas run test -- shell`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the canvas tests, typecheck and lint, and `npm run check:complexity`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(floorplan-canvas): event header, footer, rail and editor states`.

### Task 6: Save queue states, conflict stop and Ctrl+S

**Files:**
- Modify: `apps/event/src/features/floorplan/editor/use-cases/scene-saver.ts` + test
- Modify: `apps/event/src/features/floorplan/editor/PascalEditorShell.tsx` (wire `saveState`, `onRetrySave`, `onReload`)

**Interfaces:**
- Consumes: `SceneSaveState` (Task 5).
- Produces:
  - `createSceneSaver(...)` returns `{ save(scene), retry(), state(): SceneSaveState, subscribe(listener): () => void, updatedAt() }`.
  - A rejection carrying HTTP 409 (`PrismApiError.status === 409`) sets `conflict`. While in `conflict`, `save` resolves without sending and keeps the latest scene as `pending`.
  - `retry()` resends the latest pending scene after `failed`.
  - `onReload` re-opens the draft (the shell's `closeEditor`, then `openEditor`).

- [ ] **Step 1: Write failing tests:**
  - "after a 409 no further save is sent and the state stays conflict".
  - "retry after a failure resends the latest scene, not the failed one".
  - "subscribers hear saving then saved".
  - Keep the existing chaining tests passing.
- [ ] **Step 2:** Run `npx vitest run --root apps/event src/features/floorplan/editor`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the event tests and typecheck. Expected: PASS.
- [ ] **Step 5:** Commit `feat(event): stop autosave on a conflict and retry failed floor plan saves`.

### Task 7: Library and click-to-place

**Files:**
- Create: `packages/floorplan-canvas/src/pascal/library/catalog.ts` + test (preset list)
- Create: `packages/floorplan-canvas/src/pascal/library/library-panel.tsx`
- Create: `packages/floorplan-canvas/src/pascal/tools/place-piece-tool.tsx` (one R3F tool component)
- Modify: `event-layout-plugin.ts` (each definition gets `tool: () => import("./tools/place-piece-tool")`, and a `schema` from `placeableEventPieceSchemaFor`)
- Test: `packages/floorplan-canvas/src/pascal/library/library-panel.test.tsx`

**Interfaces:**
- Consumes:
  - `placeableEventPieceSchemaFor` and `nextTableNumber` (Task 3).
  - `usePrismFloorplan` (Task 5).
- Produces:
  - `LIBRARY_CATALOG: { section: string; items: LibraryItem[] }[]`.
  - `LibraryItem = { id: string; kind: PrismEventPieceType; label: string; meta: string; preset: Record<string, unknown> }`.
  - Sections: "Tables", "Seating blocks", "Stage & floor", "Food & bar", "AV", "Décor & safety", "Zones".
  - Presets include round 1.8 m · 8 and · 10, banquet 2.4 m · 8, cocktail 0.7 m, theater 5 × 4, classroom 3 × 4, stage with steps, dance floor 6 × 6 m, LED wall 5 m, bar L, buffet 3 m and supplier zone.
- Arming: a tile calls `setToolDefaults(kind, preset)`, then `armToolMode({ mode: "build", tool: kind })`. The armed strip reads "Click the plan to place · Esc".
- The tool:
  - follows `emitter` `grid:move` with a ghost
  - commits on click with `useScene.getState().createNode(placeableEventPieceSchemaFor(kind).parse({ ...defaults, parentId: levelId, position, number }), levelId)`, where `number` is only for tables
  - stays armed
  - Esc calls `useEditor.getState().setTool(null)`
- Read-only: tiles are not rendered (the tab is removed in Task 5), and the tool refuses to commit.

- [ ] **Step 1: Write failing tests:**
  - The catalog has those sections and every item's kind has a registered definition.
  - Search "round" leaves only round tables.
  - Clicking a tile calls `setToolDefaults` and `armToolMode` with the item's kind and preset (mock `@pascal-app/editor`), and shows the armed strip.
  - Esc clears it.
  - With `readOnly`, the panel renders no tiles and `armToolMode` is never called.
  - The tool's pure `placeNode(kind, defaults, position, scene)` helper gives a table the next number and a new id.
- [ ] **Step 2:** Run `npm --workspace @prism/floorplan-canvas run test -- library`. Expected: FAIL.
- [ ] **Step 3:** Implement. Keep `placeNode` pure and in its own file so it can be tested without R3F.
- [ ] **Step 4:** Run the canvas tests, typecheck and lint. Expected: PASS. Locally, arm Round · 8 and place three; they number up from the highest table.
- [ ] **Step 5:** Commit `feat(floorplan-canvas): place event pieces from the Library`.

### Task 8: Event symbols, 3D shapes and lenses

**Files:**
- Create: `packages/floorplan-canvas/src/pascal/symbols/` (one file per kind family: `table-symbol.ts`, `seating-block-symbol.ts`, `stage-symbol.ts`, `floor-and-bar-symbol.ts`, `zone-symbol.ts`, `small-piece-symbol.ts`) + `symbols.test.ts`
- Create: `packages/floorplan-canvas/src/pascal/lens.ts` (lens store) + test
- Create: `packages/floorplan-canvas/src/pascal/shell/lens-switch.tsx` (`viewerToolbarLeft`)
- Modify: `event-layout-plugin.ts` (`floorplan` and `geometry` per kind)

**Interfaces:**
- Produces:
  - `PrismLens = "layout" | "seating" | "supplier-zones"`.
  - `prismLens.get(): PrismLens`, `prismLens.set(lens)`, `prismLens.subscribe(listener)`.
  - Setting a lens marks every `prism-*` node dirty through `useScene.getState().markDirty(id)`, so Pascal redraws.
  - `tableFill(seats: number, seated: number): "empty" | "part" | "full"`.
- Symbols:
  - Tables draw chairs spaced by seat count, the linen edge and the number.
  - Seating blocks draw `rows × columns` chairs with the aisle.
  - The stage draws steps when `steps`.
  - Zones are a dashed outline with the label.
- Seating lens: tables are filled by `tableFill`, and other pieces muted. Supplier zones lens: zones emphasised and others muted.
- Sightlines and Guest flow buttons render disabled with "Arrives with checks in milestone 4".
- Without `seating.allowed`, the Seating lens button is not rendered.
- 3D: one group per piece. A table with its chairs is one group of simple meshes.

- [ ] **Step 1: Write failing tests:**
  - A table with 8 seats yields 8 chair rects and a text child with its number.
  - A 3 × 4 classroom block yields 12 chairs.
  - The zone symbol includes its label.
  - `tableFill(8, 0) === "empty"`, `tableFill(8, 5) === "part"` and `tableFill(8, 8) === "full"`.
  - `prismLens.set("seating")` notifies subscribers and marks prism nodes dirty (mock `useScene`).
  - Every symbol is still a translated, rotated group (keep today's footprint test).
- [ ] **Step 2:** Run `npm --workspace @prism/floorplan-canvas run test -- symbols lens`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the canvas tests, typecheck and lint, and `check:complexity`. Expected: PASS. Locally, a 300-seat room pans and zooms smoothly in 2D.
- [ ] **Step 5:** Commit `feat(floorplan-canvas): draw event pieces as event symbols, with Seating and Supplier zones lenses`.

### Task 9: Inspector card, seated list and Seat guests action

**Files:**
- Create: `packages/floorplan-canvas/src/pascal/inspector/parametrics.ts` + test (descriptor per kind)
- Create: `packages/floorplan-canvas/src/pascal/inspector/seated-guests-footer.tsx` + test
- Create: `packages/floorplan-canvas/src/pascal/inspector/zone-suppliers-field.tsx`
- Modify: `event-layout-plugin.ts` (`parametrics` and `quickActions`); `prism-floorplan-editor.tsx` (`inspectorFooter`)

**Interfaces:**
- Consumes: `usePrismFloorplan` (guests, suppliers, seating, readOnly).
- Produces:
  - Parametric groups:
    - Table: Shape (enum), Size (number, m, 0.6–3.6, step 0.1), Seats (number, 0–24, step 1), Number, Chairs (enum chiavari, banquet, ghost, cross-back), Linen (enum white, ivory, black, blush), Centerpiece (enum none, low floral, tall floral, candles).
    - Seating block: style, rows, columns, aisle.
    - Stage: width, depth, height, steps.
    - Zone: label, plus a suppliers custom editor.
    - Others: width and depth.
  - Seats below the seated count are refused by a `derive` that keeps `seats ≥ guestIds.length`, and the card shows "Unseat guests first".
- The footer, for a selected `prism-table`, lists `seat n · name · group or dietary` and the open seats, with "Seat guests". "Seat guests" switches the rail to `"guests"` with the table as the seating target.
- `quickActions` for tables: `{ id: "seat-guests", label: "Seat guests" }`, absent when `!seating.allowed` or read-only.

- [ ] **Step 1: Write failing tests:**
  - The table descriptor has those fields and ranges.
  - `derive` keeps seats at 6 when 6 are seated and the patch asks for 4.
  - The footer shows "Dee Lim" with "Vegetarian" and two open seats for a table with 8 seats and 6 roster guests.
  - The quick action is absent when seating is not allowed.
  - The zone field lists the event's suppliers by name.
- [ ] **Step 2:** Run `npm --workspace @prism/floorplan-canvas run test -- inspector`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the canvas tests, typecheck and lint. Expected: PASS.
- [ ] **Step 5:** Commit `feat(floorplan-canvas): event inspector with the seated guest list`.

### Task 10: Guests panel, roster data and legacy seat matching

**Files:**
- Create: `packages/floorplan-canvas/src/pascal/guests/guests-panel.tsx` + test
- Create: `apps/event/src/features/floorplan/editor/data/seating-data.ts` (roster via `eventApi.guest.roster(eventId)`, mapped to `PrismFloorplanSeatingGuest`, and suppliers from the event's `selected` quote requests)
- Modify: `apps/event/src/features/floorplan/editor/use-cases/open-plan-scene.ts` + test (map legacy guest ids to roster ids by exact name)
- Modify: `PascalEditorShell.tsx`, `event-dashboard-editor-screen.tsx` and the shell view-model `openEditor` (load roster and suppliers with the scene; pass `seating` from `seatingUnavailableReason(guestCount, event.privacy)`)

**Interfaces:**
- Consumes: Task 5's props; `findTableAssignmentRejection`, `seatingUnavailableReason` and `SEATING_LIST_MAX_GUESTS` from `@prism/types`.
- Produces:
  - `openPlanScene(plan, pascalVersion, legacyGuests: FloorPlanGuest[], roster: PrismFloorplanSeatingGuest[]): { scene; converted: boolean; unmatchedSeats: number }`.
  - Guests panel:
    - unseated guests grouped by group, with search, declined guests excluded
    - with a seating target table, clicking a guest adds them through `useScene` updates when the rule allows, otherwise shows the rule's message
    - when `!seating.allowed`, the panel shows `seating.reason` and no seat actions

- [ ] **Step 1: Write failing tests:**
  - `openPlanScene` maps "Ana Reyes" to her roster id, drops an unmatched id and returns `unmatchedSeats: 1`.
  - A stored scene returns `unmatchedSeats: 0`.
  - The panel seats a guest at the target table, refuses a full table with "This table has no free seats.", hides declined guests, and shows the reason with no seat buttons on a public event.
- [ ] **Step 2:** Run `npm --workspace @prism/floorplan-canvas run test -- guests` and `npx vitest run --root apps/event src/features/floorplan/editor`. Expected: FAIL.
- [ ] **Step 3:** Implement. The editor shows "N seats could not be matched to the guest list" once, in `sceneOverlay`, when `unmatchedSeats > 0`.
- [ ] **Step 4:** Run the tests, the event and canvas typechecks, and lint. Expected: PASS.
- [ ] **Step 5:** Commit `feat(floorplan): seat event roster guests in the floor plan editor`.

### Task 11: Layers panel

**Files:**
- Create: `packages/floorplan-canvas/src/pascal/layers/layer-groups.ts` + test, and `layers-panel.tsx`

**Interfaces:**
- Produces:
  - `layerGroups(scene): { id: string; label: string; nodeIds: string[] }[]`, with groups Venue (walls, columns), Tables, Seating, Stage & floor, Food & bar, Zones and Other, in that order, omitting empty groups.
  - Rows select through Pascal's selection store, and toggle `visible` and `locked`.
  - Hiding a `prism-table` with `guestIds.length > 0` is refused with "Unseat guests to hide this table".
  - Venue rows are locked and offer no hide.

- [ ] **Step 1: Write failing tests:**
  - A converted plan groups its four walls under Venue and its tables under Tables.
  - The hide toggle on a seated table leaves `visible` true and shows the message.
  - An empty group is omitted.
- [ ] **Step 2:** Run `npm --workspace @prism/floorplan-canvas run test -- layer`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the canvas tests, typecheck and lint. Expected: PASS.
- [ ] **Step 5:** Commit `feat(floorplan-canvas): Layers list grouped for event layouts`.

### Task 12: Docs, changelog and browser verification

**Files:**
- Modify:
  - `CHANGELOG.md`: one line naming the event chrome, Library placement, symbols, the inspector, roster seating, zones, lenses and Layers.
  - `docs/architecture/decisions/adr-0010-floorplan-editor-on-pascal.md`: consequences gain the chrome patch, the host flag, and the roster as the seating source.
  - `docs/architecture/current-architecture.md`: the floorplan paragraph names the roster reader.
- Create: screenshots in `output/pascal-floorplan-check/` (untracked).

- [ ] **Step 1:** Run the full focused set:
  - `npm --workspace @prism/types run test`
  - `npm --workspace @prism/floorplan-scene run test`
  - `npm --workspace @prism/floorplan-canvas run test`
  - `npm --workspace @prism/event run test`
  - `npx vitest run --root apps/api src/modules/floorplan src/modules/operations src/modules/read-models`
  - typechecks for types, scene, canvas, event and API
  - `npm run check:boundaries`, `npm run check:complexity`, `npm run check:migrations`, `npm run test:ci:guards`

  Expected: all PASS.
- [ ] **Step 2: Browser path, with the local stack and engine `pascal`; screenshot each:**
  - PMCM places tables from the Library and seats two roster guests.
  - Seating lens.
  - Supplier zone with a booked supplier.
  - Hiding a seated table is refused.
  - Reload keeps everything.
  - A 409 from a second tab shows "Changed elsewhere · Reload".
  - Approved draft is view only.
  - Narrow window shows "Edit on a laptop".
- [ ] **Step 3:** Commit `docs(floorplan): record the event editor shell and roster seating`.
