# Event pieces as Pascal procedural designs: implementation plan

**Goal:** PRISM's event pieces look like real event furniture in 3D and read cleanly on the 2D plan, using Pascal's
procedural design language and its plan styling instead of our placeholder boxes and plain outlines.

**Why:** Pascal ships a parametric design language (`@pascal-app/core/procedural-items`: parameters, material slots
with finishes, parts that repeat with `index`/`count` and `sin`/`cos` expressions) and a builder
(`buildProceduralGeometry` in `@pascal-app/nodes`). Our pieces are boxes and cylinders today. PMCM sells layouts to
clients in 3D and reads them in 2D; both need to look like the event.

**Builds on:** `codex/floorplan-pascal-default` (PR #515). ADR-0010.

## Decisions (maintainer's recommendations; "ok lets do it then")
1. **Our nodes stay ours.** `prism-*` node types, their schemas and data (seats, `guestIds`, numbers, zones, lenses,
   Layers) do not change. Only each kind's `geometry()` and `floorplan()` change.
2. **3D from designs.** Each kind has a Pascal design (a `Recipe`, validated with `validateDesign`) whose parameters
   come from the node: a round table's diameter, seat count, linen and chair style; a banquet table's width, depth and
   seats; a theater block's rows, columns and aisle; a stage's size, height and steps; and so on. `geometry()` builds
   it with Pascal's builder and returns one `Group` of meshes, one per material slot, with PRISM materials. Chairs
   ring a round table by seat count (`sin`/`cos` of the repeat index); banquet chairs line both long sides.
3. **Materials:** linen colour from the card (`white`, `ivory`, `black`, `blush`), chair finishes by style
   (`chiavari` gold, `banquet` fabric, `ghost` clear, `cross-back` wood), stage deck black, dance floor parquet,
   bar wood and metal, LED wall dark glass, zone a translucent floor tint. Shared material instances.
4. **2D stays ours, in Pascal's plan style.** Table numbers, seat fill, lenses and the seating list need our symbols.
   Restyle them to read like Pascal's plan: its palette and selected/hovered stroke from `ctx.viewState`, chairs
   drawn per chair style, the linen ring in the card's linen colour, label sizes that scale with the piece.
5. **No Pascal catalog models.** The catalog's GLB models are hosted by Pascal with no stated licence; we do not copy
   them. Revisit if Pascal grants rights.

## Tasks
1. Designs and 3D (`packages/floorplan-canvas/src/pascal/designs/`): one design per kind family, a builder from node
   to `ProceduralItemNode`-shaped input, `geometry()`/`geometryKey()` wired in `event-layout-plugin.ts`, the placement
   ghost using the same build. Tests: every design passes `validateDesign`; a round table with 8 seats builds 8
   chairs; every kind builds non-empty geometry for its Library presets; build time for a 300-seat room is reported.
2. 2D restyle (`packages/floorplan-canvas/src/pascal/symbols/`): palette and view-state styling, chair styles, linen
   colour. Keep the existing symbol tests' behaviours (chair counts, labels, placement transform).
3. Browser check of a mixed room in 2D and 3D, with screenshots.
