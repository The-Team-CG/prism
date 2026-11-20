# Floor plan editor UI on Pascal: event layout shell and pieces (design)

Status: approved 2026-11-19, from the mockups and the review answers below. It extends
`2026-11-19-pascal-floorplan-editor-design.md` (ADR-0010) and covers its milestone 2: real event pieces,
seating and supplier zones, inside an editor laid out for event work. Mockups and their generator are in
`output/floorplan-editor-mockup/` (`editor-v2-design.png`, `editor-v2-map.png`). They are untracked.

## Intent

PMCM designs each event room, acting as the venue designer. Today the Pascal editor opens with a general
building editor's screens: a Scene tree of sites, levels and units, a Plugins menu, a sky and time widget, a
compass and a building tool dock. It has no way to add a table. The editor should instead read as an event
planning tool. PMCM picks real pieces, places and adjusts them, seats guests and sees at a glance whether
the room works. Pascal's 2D/3D engine stays underneath.

- **System goal:** PMCM operations and UX.
- **Role:** PMCM administrator, as venue designer. Coordinators and anyone opening a submitted or approved
  draft get the same screen read-only.
- **Contexts:**
  - `floorplan` (authoring).
  - `operations`: the event guest roster becomes the seating source.
  - `commercial`: the event's booked suppliers, for zones.
  - `read-models`: the floorplan reads both.
  - `@prism/floorplan-canvas` (host adapter and plugin) and `@prism/types` (piece and roster schemas).

## Goals

1. **Event chrome:**
   - A PRISM header: back, draft and event, save status, undo/redo, 2D/3D/Split and Submit.
   - A rail with Library, Guests and Layers.
   - A footer that answers "are we done": guests against seats, and how many are seated.
2. **Place real pieces:** pick a piece in the Library, click the plan to place it, and keep placing until Esc.
3. **Pieces read as event furniture in 2D:** chairs around tables, a number on each table, stage steps, dance
   floor, bar, buffet, AV and zones.
4. **Adjust in event terms:** the selected piece's card edits shape, size, seats, number, chairs and linen.
   Its action bar moves, duplicates, deletes and seats guests.
5. **Seat guests:**
   - The table card lists who sits there, with their group and dietary needs.
   - The Guests panel seats unseated guests.
   - The Seating lens colours tables by how full they are.
6. **Supplier zones:** a zone piece carries suppliers, and the Supplier zones lens shows them.

## Non-goals (this milestone)

- Room panel, venue list, tracing the venue plan (milestone 3).
- Checks, setup styles ("Fill the room"), and the Sightlines and Guest flow lenses (milestone 4).
- Client preview and options (milestone 5), AI (milestone 6), phases and PDF (milestone 7).
- Detailed 3D models. 3D stays simple parametric shapes; 2D carries the fidelity.

## Anti-goals

- Hiding Pascal chrome with CSS selectors, which break silently on upgrade.
- A fork of Pascal's editor source.
- Seating rules that live only in the browser. The API keeps enforcing them on every save.
- Dead tabs: a rail entry without its milestone's content.

## Constraints

- Everything in ADR-0010 and `AGENTS.md`:
  - Contracts in `@prism/types`.
  - No HTTP in the canvas package.
  - The browser is never the source of truth.
- Pascal 1.1.6 extension points, as researched on 2026-11-19 (file evidence in the build-map table of the
  mockup):
  - **Editor props:** `navbarSlot`, `sidebarTabs`, `columnTabId`, `viewBar`, `viewerToolbarLeft`,
    `sceneOverlay`, `floorplanSceneSlot`, `inspectorFooter`, `loadingSlot`, `onSaveStatusChange`,
    `onSaveShortcut`.
  - **Exported functions and stores:** `armToolMode`, `setToolDefaults`, `useEditor` view setters, and
    `useCameraHintFocus`.
  - **Plugin node fields:** `tool`, `floorplan`, `parametrics`, `quickActions` and `presentation`.
- Pascal has no supported way to hide its Plugins entry, level chip, sky widget, compass, shortcuts card or
  dock scans control. It also leaves the 3D action bar visible when read-only. Changing any of these needs a
  patch.
- Pascal places a kind only through that kind's own `def.tool`, and its tools parse new nodes without an
  `id`, so piece schemas must mint one.
- There are two guest lists today:
  - **`floor_plans.guests`:** hand-kept in the legacy editor; name, RSVP, group, dietary. The API's seating
    check reads it. A scene save never writes it.
  - **`operations.guest_roster_entries`:** the event roster used for import, passes and check-in; name,
    category, eligibility, a free-text table. It has no RSVP or dietary fields.

  Neither has a VIP flag.
- Pascal switches to a phone layout below 768 px.

## Approaches (decided)

| Decision | Considered | Chosen | Why |
|---|---|---|---|
| Inspector | Pascal's floating card on the canvas; a fixed PRISM right column | **Floating card** | Native, cheap, and follows upgrades. It covers part of the room on 1280 px screens, which was accepted. |
| Pascal chrome | CSS selectors; a `patch-package` patch; leave it | **One patch to `@pascal-app/editor@1.1.6`** | It fails loudly when Pascal is upgraded, and is one reviewable file. CSS breaks silently. |
| Placement | Drag from the Library; arm a tool and click the plan | **Arm and click** | Pascal has no drag-in API. Arming is the supported path, and it repeats until Esc. |
| Guest source for seating | The plan's own `guests` list; the event's `operations` guest roster | **Event roster** | One list per event of who is coming, already used for import, passes and check-in. The plan list would need editing inside every draft. |

## Decisions from the design review

1. **Guests come from the event roster:**
   - `operations` roster entries gain `rsvp` (confirmed, pending, declined; default pending) and `dietary`,
     with an expand-only migration. `category` is shown as the group.
   - A read-model reader gives the floorplan the event's roster: id, name, group, RSVP, dietary, eligible.
   - The API's seating check (`plans.service.ts` and `table-assignment-guard.ts`) reads that roster instead
     of `floor_plans.guests`.
   - Scene tables keep storing roster entry ids.
   - The legacy editor's saves keep their current check until the legacy editor is removed.
   - Converting a legacy plan maps a legacy guest id to a roster entry when the names match exactly within
     the event. Unmatched ids are dropped from the table and listed once in the editor as "N seats could not
     be matched to the guest list".
2. **Zone suppliers:**
   - The zone picker lists the suppliers booked on the event, from data the event screen already loads; the
     host passes them in as `{ id, name, kind }`.
   - The API refuses a scene whose zones name a supplier not booked on the event.
   - The Supplier zones lens highlights zones only.
3. **Hiding a piece is saved with the plan,** as today. Hiding a table with seated guests is blocked with
   "Unseat guests to hide this table".
4. **Seating blocks count toward seats** in the footer and capacity. Guests are seated only at tables.
5. **Events where table seating is not allowed** (public, or 200+ guests, the shared rule):
   - The Guests tab stays and explains why.
   - "Seat guests" and the Seating lens are hidden.
   - The footer's guest count is the roster's eligible, non-declined entries, or the plan's `pax` when the
     roster is empty.
   - The host passes the event's privacy and guest count.
6. **Seat numbers are list order.** Fixed chair positions come with the printed seating chart in
   milestone 7.

## Design

### Shell

- **Header (`navbarSlot`, PRISM):**
  - Back, then the draft name over "event · status".
  - Save status, driven by `onSaveStatusChange` and our saver: Saving, Saved, "Not saved · Retry", and
    "Changed elsewhere · Reload".
  - Undo and redo through Pascal's scene history.
  - 2D / 3D / Split through `useEditor` view setters, with `viewBar={false}`.
  - Submit for review.
  - Phases and Preview as client are shown disabled, with a tooltip naming their milestone, as approved in
    the mockup.
  - Read-only: the header says "View only" and shows no Submit.
- **Footer (PRISM, below `<Editor>`):**
  - "N guests · M seats" with spare or short. Guests are counted as in decision 5. Seats are the sum over
    visible tables and seating blocks.
  - "Seated K of N".
  - Room size from the plan, and grid size.
- **Rail (`sidebarTabs`, our ids, never `site`):** Library (pinned with `columnTabId`), Guests and Layers.
  Room and Checks join with their milestones.
- **Pascal chrome patch:**
  - Remove the Plugins side-menu entry and its "Browse plugins" view.
  - Remove the floating level selector, the sky/time control, the compass button, the shortcuts helper card
    and the dock's references (scans) control.
  - Hide the 3D floating action bar when the scene is read-only.
  - Hide the camera hint through the supported `useCameraHintFocus.getState().focus([])`, not the patch.

### Library and placement

- **Catalog:** grouped Tables, Seating blocks, Stage & floor, Food & bar, AV, Décor & safety, and Zones.
  Each tile shows a 2D symbol, a name and its real size or seats, and a search box filters tiles.
- **Presets:** a tile is a kind plus defaults, for example `prism-table` round, 1.8 m, 8 seats. Clicking it
  calls `setToolDefaults(kind, preset)` and then `armToolMode({ mode: 'build', tool: kind })`.
  - The tile shows as armed, and a strip reads "Click the plan to place · Esc".
  - A placed table takes the next table number.
- **Placement tool:** one PRISM placement tool component, registered as every kind's `def.tool`.
  - A ghost of the piece follows the cursor, snapped to Pascal's grid.
  - A click commits a node parsed by a placeable schema that mints `${type}_${uuid}`.
  - The tool stays armed; Esc or Select ends it.
- **Kinds this milestone:**
  - Existing: `prism-table` (round, rect, cocktail), `prism-stage`, `prism-av` (LED wall, speaker, truss,
    FOH desk), `prism-catering` (buffet, carving, dessert), `prism-decor`, `prism-registration`,
    `prism-booth` and `prism-safety`.
  - New, each with a Zod schema in `@prism/types` and validation in `@prism/floorplan-scene`:
    - `prism-seating-block`: theater or classroom; rows, columns, aisle.
    - `prism-dance-floor`: size.
    - `prism-bar`: straight or L.
    - `prism-zone`: a rectangle with `supplierIds` and a label. It is resizable; a polygon zone is later.
  - `prism-shape` and `prism-fixture` stay for converted legacy objects, not offered in the Library.

### Plan and pieces

- **2D symbols:** each kind's `floorplan()` draws a recognisable top-down symbol.
  - Tables show chairs spaced by seat count, a linen edge and the table number.
  - Seating blocks show their rows of chairs, and the stage shows its steps.
  - Zones are a dashed, labelled area.
- **Seating lens:** a table is coloured full, part-full or empty.
- **Supplier zones lens:** zones are emphasised and other pieces muted.
- **3D:** simple parametric shapes per kind; a table with its chairs is one mesh group.
- **Lenses (`viewerToolbarLeft`, PRISM):** Layout, Seating and Supplier zones. Sightlines and Guest flow are
  shown disabled until milestone 4.
  - The lens is host state that each `floorplan()` reads.

### Selected piece

- **Action bar:** Pascal's move, duplicate and delete, plus a `quickActions` "Seat guests" for tables, which
  opens the Guests panel for that table.
  - Duplicating keeps today's rules: an empty copy with the next number.
- **Card:** Pascal's floating inspector, with fields from each kind's `def.parametrics`.
  - Table: shape, size, seats, number, chairs, linen.
  - The other kinds get their own fields.
  - A lock toggle.
- **`inspectorFooter` (tables):** the seated list (seat number, guest name, group or dietary), open seats,
  and a "Seat guests" button. Names come from the event roster by id (decision 1).

### Guests panel

- Unseated guests by group, with search; declined guests are not listed.
- With a table selected, clicking a guest seats them there. The eligibility rule from `@prism/types`
  (`findTableAssignmentRejection`) refuses full tables and declined guests with a short message, and the API
  checks again on save.
- Seated guests can be unseated from the table card.

### Layers panel

Our own list from the scene store, grouped:

- Venue (walls and columns, locked)
- Tables
- Seating
- Stage & floor
- Food & bar
- Zones
- Other

Each row selects the piece on click and has show/hide and lock controls.

### States

- **Loading:** our header renders at once, and `loadingSlot` shows a room-outline skeleton while the editor
  bundle and scene load.
- **Empty room:** walls only, Library pinned; the footer reads "0 seats for N guests".
- **Read-only:**
  - Pascal's lease hides the dock and card editing, and the patch hides the action bar.
  - The rail keeps Library hidden and Guests view-only.
- **Save failed:** the edits stay and the header shows "Not saved · Retry". Retry flushes the queue.
- **Conflict (409):** the header shows "Changed elsewhere · Reload", and autosave stops until reload, so
  nothing is overwritten.
- **Screens under 768 px:** the plan opens read-only with "Edit on a laptop". The target is 1280–1920 px.

### Keyboard, access, performance

- **Keyboard:** Pascal's shortcuts stay: V select, M measure, X delete, Ctrl+Z / Ctrl+Shift+Z. Ctrl+S goes
  through `onSaveShortcut` to our save queue. Esc ends placement.
- **Access:** every icon button has a label, and lens and view switches are buttons with pressed state. Text
  uses PRISM tokens at 4.5:1.
- **Performance:** the editor loads only on this screen. A 300-seat room must pan and zoom smoothly in 2D;
  chairs are drawn inside each table's symbol, not as separate nodes.

## Left to the builder

- Exact symbol drawings, colours per lens state, and preset lists per kind.
- Parametric field ranges and steps.
- The ghost's look, and Layers row details.
- Splitting this into PRs and their order; a sensible split is shell and patch, then kinds and placement,
  then card and seating, then lenses and Layers.
