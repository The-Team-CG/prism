# Floor plan editor on Pascal — design

Status: approved 2026-11-19. The architecture decision becomes ADR-0010 in the
foundation step. This working document is removed once its acceptance work is
done.

## Intent

PMCM lays out every event in the floor plan editor, and the editor does not look
or work like an event planner's tool. Objects are thin outlines on a CAD grid,
every new layout starts from an empty room, and the client sees the same flat
drawing. A planner wants a room they recognise, real tables, chairs, stage and
bar, layouts that start from the last approved setup for that room, and checks
that catch blocked exits before the client does.

Pascal Editor (`pascalorg/editor`, MIT, React Three Fiber, WebGPU with WebGL
fallback) already solves the editing engine: 2D plan and 3D view of one scene,
direct manipulation, smart guides, undo, guide-image tracing, plugins for new
object kinds, and agent tools. PRISM adopts it as the engine and builds the
event layer as a Pascal plugin, with layouts stored through the PRISM API and AI
help routed through PRISM's AI gateway.

- **System goal:** PMCM operations and UX; client and supplier portals get a
  better read-only view.
- **Roles:** PMCM administrator and coordinator author layouts; clients view,
  choose and comment; suppliers view their zones. Guests are unaffected.
- **Contexts:** `floorplan` (authoring, live) owns layouts, venues and rooms.
  `event-lifecycle` keeps client visibility and the ocular survey.
  `operations` owns guests; layouts store guest IDs only. `platform-ops`
  (`ai-governance`) runs the AI use case. `commercial` owns suppliers; layouts
  store supplier IDs only.

## Goals

1. **Venues and rooms:** PMCM keeps one list of venues and their rooms. A room
   stores its shell: walls, doors, windows, columns, exits, house rules and
   size. A new layout for a room starts from that room's last approved layout,
   and venue fixtures stay locked.
2. **Real event pieces:** tables with chairs, linen and centerpieces, theater
   and classroom rows, stage with steps, dance floor, bar, buffet, AV, décor,
   registration and safety items. Each draws as a recognisable top-down symbol
   in 2D and a model in 3D.
3. **Fast layout:** setup styles that fill the room for a guest count, smart
   guides, align and distribute, repeat in a row or grid, and a measure tool. A
   table and its chairs move as one piece.
4. **Seating and suppliers:** numbered tables, guests seated with VIP and
   dietary tags, and supplier zones such as catering back-of-house and the AV
   desk.
5. **Checks while you work:** capacity against guest count, aisle widths, exit
   clearance, stage sightlines past columns, and a clear load-in route.
6. **Client review:** PMCM sends Option A and Option B. The client sees them in
   2D and 3D, picks one, and pins comments.
7. **AI help:** arrange the room for N guests, seat guests by group, fix a
   failing check, and draft another option. Every AI change is previewed and
   applied as one undo step.
8. **Output:** a printable PDF with a scale bar, legend and title block.
9. **Room through the day:** ceremony, cocktails and reception as phases of one
   layout, each with a flip summary.

## Non-goals

- Pascal's hosted services: cloud projects, hosted MCP, and Architect runs
  billed in Pascal credits.
- Building modelling beyond one room level: roofs, storeys, terrain and IFC
  import stay hidden.
- Real-time co-editing by several people at once.
- Phone LiDAR room capture.
- Guest portal changes.

## Anti-goals

- The browser holding the source of truth. Pascal persists scenes to IndexedDB
  by default; PRISM layouts live only in the API.
- Guest names, emails or contact details reaching an AI provider.
- Draft, approval or visibility rules moving into the canvas package or the
  plugin. Workflows stay in the API.
- A diverging fork of Pascal that cannot take upstream releases.

## Constraints

- `AGENTS.md`:
  - Shared write contracts are Zod schemas in `@prism/types`.
  - HTTP goes through `features/**/data` and `@prism/api-client`.
  - Storage keys live in `@prism/types`.
  - There is no browser fixture state.
  - Role apps own storage and read-only policy.
  - PMCM owns official plans in `apps/event`.
- **Pascal 1.1.x:** React 19, Next ≥ 15 (PRISM is on 16), three 0.187,
  `@react-three/fiber` 9, `@react-three/drei` 10, and Tailwind classes, so
  Tailwind 4 must scan the packages. Plugin contract `apiVersion: 1`. Agent
  operations are pure functions over scene nodes.
- **AI:** calls go through the `ai-governance` gateway. That means a
  registered use case, the real-data and ZDR gate, and an audit row per call.
  With no provider configured, AI actions show as unavailable.
- **Bundle:** the editor is large (three.js, manifold-3d, pdfkit). It loads
  only on the floor plan route.

## Approaches

| | Approach | Trade-off | Outcome |
|---|---|---|---|
| **A** | Depend on Pascal's npm packages at one exact version inside `@prism/floorplan-canvas`. Add a PRISM event-layout plugin, store scenes through the API, and run AI through the PRISM gateway. | Upstream fixes arrive by raising the version. We're limited to the plugin contract, which covers node kinds, 2D/3D drawing, inspector, panels, views and agent tools. | **Chosen** |
| B | Copy Pascal's source into the monorepo. | Full control, but we would maintain a fast-moving 25k-star codebase ourselves. | Rejected |
| C | Keep the current 2D editor and use only Pascal's 3D viewer for clients. | Smallest change, but leaves the editing experience as it is. | Rejected |
| D | Self-host Pascal's container in an iframe. | Separate login and storage outside PRISM roles and data ownership. | Ruled out |

## Design

### Packages

- **`@prism/floorplan-scene` (new, pure TypeScript):**
  - Contents: the event-layout node schemas, setup-style arrangers, checks,
    agent tool contracts and operations, and the converter from the current
    `objects` format.
  - Dependencies: `@pascal-app/core` pure entry points and Zod only. It has no
    React or browser code.
  - Consumers: the editor plugin and the API, which validates submitted scenes
    and runs AI operations server-side.
- **`@prism/floorplan-canvas` becomes the Pascal host adapter.** Subpaths:
  - `/editor`: `PrismFloorplanEditor`. It wraps `<Editor layoutVersion="v2">`
    with PRISM theme tokens, host panels and `onLoad`/`onSave` props, and turns
    off local IndexedDB persistence.
  - `/viewer`: `PrismFloorplanViewer`, a read-only `<Viewer>` with comment pins.
  - `/plugin`: the `prism:event-layout` plugin, which supplies node kinds,
    panels, views and the chat extension.

  The package still makes no HTTP, session or role decisions. The current
  canvas code is deleted once its callers have moved.
- **Role apps:**
  - `apps/event` mounts the editor through a client-only dynamic import on the
    floorplans route.
  - `apps/client` mounts the viewer.
  - `apps/supplier` mounts the viewer filtered to the supplier's zones.

### Data

- `floorplan.floor_plans` gains `scene Json` and `scene_format`
  (`pascal-v1:<schemaVersion>`). Draft snapshots (submitted and approved) store
  the scene. The `objects`, `guests`, `suppliers` and `seats` columns stay
  read-only until migration finishes, then a later migration drops them.
- New `floorplan.venues` and `floorplan.venue_rooms`:
  - **Room fields:** name, size, house rules, the shell scene, and
    `last_approved_floor_plan_id`.
  - **Ownership:** venues are shared by PMCM, not owned per user.
  - **Linking:** an event links a room by scalar ID. There is no cross-domain
    foreign key.
  - **Replaces:** the per-user `venue_templates` free-text venue field.
- **Placed pieces:** table nodes carry `guestIds` and zone nodes carry
  `supplierIds`. Names, dietary needs and VIP flags are resolved at read time
  from the `operations` and `commercial` read models.
- **Options:** Option A and Option B are sibling drafts in one option set on
  the existing `OpsFloorPlanDraft`. The client's choice is recorded on the set.
- **Phases:** a layout has ordered phases. Event-layer nodes carry `phaseIds`;
  venue nodes belong to every phase. The flip summary is the difference between
  adjacent phases.
- **Contracts:** scene save, option send, client choice, comment and AI request
  bodies are Zod schemas in `@prism/types`.
- **Existing endpoints:** client comments reuse the existing `client-review`
  and `client-annotations` endpoints, with pins anchored to a node ID or a
  position. The authoring endpoints (`plans`, `templates`, `layout-events` and
  `publish`) switch to scenes or are retired. Before choosing, the builder
  confirms which of them have callers.

### Event-layout plugin

**Node kinds:**

| Kind | Parameters |
|---|---|
| `table` | Shape: round, rectangular, serpentine, sweetheart or cocktail. Size, seats, chair style, linen, centerpiece, number, `guestIds` |
| `seating-block` | Theater or classroom; rows, columns, aisle |
| `stage` | Width, depth, height, steps, skirt |
| `dance-floor` | Size and finish |
| `bar` | Straight or L-shaped |
| `catering-station` | Buffet, carving or dessert |
| `av` | LED wall, speaker, truss, FOH desk |
| `decor` | Plant, arch, photo wall |
| `registration` | — |
| `booth` | — |
| `safety` | Exit sign, extinguisher, first aid |
| `zone` | Supplier zone or back-of-house; carries `supplierIds` |

Walls, doors, windows, columns, slabs and guide images are Pascal built-ins.

**Drawing:**
- Each kind has a 2D symbol (`floorplan` geometry) and a 3D model (parametric
  `geometry`, or a `renderer` for detailed pieces).
- Pascal's 2D primitive set may not express chairs, plates and florals at the
  fidelity of the mockups. The spike decides whether to stay inside that set or
  use a custom 2D renderer.

**Host panels:**
- Library: event catalog with search, plus the setup-style button.
- Guests: unseated list, drag guests to seats, filter by group.
- Checks: a list of issues, each with a fix action.
- Phases.

**Views:**
- Lenses: Layout, Seating, Sightlines, Guest flow and Supplier zones.
- Print/PDF.

**Inspector:** parametrics for each kind, plus custom panels for seating and
supplier assignment.

### Flow

1. **Venue and room:** PMCM picks a room from the venue list. A known room opens
   its last approved layout. A new room is traced over the venue's floor plan
   image or PDF, or built from the ocular survey. Walls, columns and exits stay
   locked.
2. **Setup style:** banquet, theater, classroom, cocktail or boardroom, plus the
   guest count. The arranger fills the room and keeps aisle, exit and stage
   clearances.
3. **Design:** library pieces, smart guides, repeat, align, measure, and a split
   3D view.
4. **Seat and assign:** number tables, seat guests and assign supplier zones.
5. **Check:** checks run live. Submit and approval run them again in the API.
6. **Client options:** PMCM sends Option A and Option B. The client views them
   in 2D and 3D, chooses one and comments. Clients do not draw.
7. **Approve and run:**
   - The approved option becomes the official layout.
   - Suppliers see their zones.
   - Live ops and the coordinator view read it.
   - The PDF exports.
8. **Back to the venue:** the approved layout becomes the room's starting point.

### Checks

Checks are pure functions in `@prism/floorplan-scene`, shared by the editor and
the API:

| Check | Rule (default, configurable per room) |
|---|---|
| Capacity | Seats ≥ guest count for the phase |
| Aisles | Main aisle ≥ 1.8 m, others ≥ 1.2 m |
| Exits | 1.5 m clear in front of every exit |
| Sightlines | Stage focal point visible from every seat past columns and tall pieces |
| Load-in | A path at least 1.5 m wide from the service door to catering and stage zones |

Failures are warnings. Approving a layout with open warnings requires the
approver to acknowledge each one, and the acknowledgement is audited.

### AI

- **Tools:** plugin agent tools with `runsIn: 'operation'`:
  - `layout_arrange` (setup style, guest count, constraints)
  - `layout_seat_guests` (groups and rules)
  - `layout_fix_check` (issue ID)
  - `layout_create_option` (from a draft, with a style)
  - `layout_explain_checks`
- **Surface:** Pascal's chat panel, plus actions on the Checks panel.
- **Path:**
  1. The editor posts to
     `POST /events/:eventId/floorplans/:draftId/assistant`.
  2. The API calls the gateway under a new `floorplan-layout-assist` use case.
  3. The model returns tool calls.
  4. The API runs the operations server-side against the stored scene, which
     validates every change.
  5. The editor shows a preview, and PMCM applies it as one undo step.
- **Data sent:** room geometry, node kinds and positions, counts, and guest
  group sizes and tags. Names, emails and contacts are never sent.
- **Without AI:** "Arrange" and "Fix" keep working through the same
  deterministic operations.
- **Roles:** PMCM administrators and coordinators can use it. Clients and
  suppliers cannot. Each request writes one audit row.

### Migration and rollout

0. **Spike (throwaway; a gate, not a deliverable).** Mount the Pascal editor on
   the `apps/event` floorplans route with PRISM save and load. Prove:
   - Next 16 and Tailwind 4 work.
   - The light theme matches PRISM tokens.
   - IndexedDB persistence is off.
   - The WebGL fallback works.
   - Bundle size and load time on the route are acceptable.
   - The 2D symbols can reach the mockup fidelity.
   - Pascal's chat panel can send its requests to a host-provided endpoint.
1. **Foundation:**
   - ADR-0010.
   - `@prism/floorplan-scene`.
   - Scene storage migration.
   - Converter from `objects` to scene: lazy on open, plus a one-time script.
   - PMCM drafts on the new editor behind a flag.
2. **Event pieces:** the plugin catalog, inspector, seating and supplier zones.
3. **Venues and rooms:** the venue list, last-approved reuse, guide-image
   tracing, and the ocular survey as a room starter.
4. **Checks and setup styles.**
5. **Client and supplier:** viewer, options, choice and comments.
6. **AI assistant** behind the gateway use case.
7. **Finish:** phases and PDF export; remove the flag and delete the old canvas
   code and legacy columns.

### Testing

- **Unit tests:** arrangers, checks, operations and the converter, with fixture
  layouts from the current format.
- **API tests:**
  - Forbidden-role cases on save, send, choose, comment, approve and assistant.
  - Server-side check and operation validation.
  - Gateway disabled.
- **Browser smoke:** the editor loads, saves, reloads and approves. The client
  views and chooses.
- **Visual check:** the 2D symbols and 3D models against the mockups.

## Decisions made in design (review these)

- **Venue list:** a PMCM-wide venue and room list, not matching on typed venue
  names.
- **Scene stored whole:** layouts are stored as the Pascal scene JSON in
  `floorplan`, with guests and suppliers by ID only.
- **Pure scene package:** a new `@prism/floorplan-scene`, so the API can run
  checks and AI operations without importing UI code.
- **Check thresholds:** the defaults in the checks table, configurable per room.
  Checks warn, and approval needs an acknowledgement.
- **Hosted AI:** Pascal's hosted AI is not used. AI runs through the PRISM
  gateway with no personal data.
- **3D models:** parametric where possible. Detailed pieces use models we have
  the rights to ship.

## Product decision

- **Client role in layouts (decided 2026-11-19).** Clients no longer draw
  layout preferences. They view PMCM's options in 2D and 3D, choose one, and
  pin comments. The client portal mounts only the viewer. The client
  preference editor and its endpoints (`floorplan-preferences` and
  `reopen-preference`) are retired with the old canvas.

## Left to the builder

- Exact visual tokens for the 2D symbols and the 3D materials.
- The chair-arrangement maths per table size.
- The setup-style packing algorithm.
- PDF title block layout.
- Panel ordering.
- Smart-guide tolerances.
