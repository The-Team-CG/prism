# Floor plan editor shell: one docked frame

**System goal:** UX — the PMCM floor plan editor (`apps/event`, `@prism/floorplan-canvas`).

## Why

The editor reads as several layouts glued together: a labelled rail plus a second
Library column on the left, Pascal's floating inspector card over the plan on the
right, our header on top and Pascal's tool dock at the bottom, three different
segmented controls, and no shared spacing or type scale. Planners asked for an
editor that feels like one premium tool, in the spirit of Figma, Paper and Pascal.

Approved mockup: option A, "premium pass" (session scratchpad `editor-premium.html`).

## Goals

- One frame: a top bar, one left panel, the plan, a docked inspector, a status bar.
- Nothing floats over the plan except the lens switch and the zoom control.
- One scale: 28–32 px rows, 11.5–13 px text, tabular numbers, hairline dividers.
- Brand magenta only for Submit, the armed library tile and the selection; ink for the
  active tool; neutrals everywhere else.

## Non-goals

- New planning features beyond what the mockup shows.
- Mobile redesign: phones keep Pascal's sheets; the left panel becomes one sheet.
- Changing what the inspector edits (fields stay as defined in `parametrics.ts`).

## Approaches

| Option | Trade-off | Decision |
| --- | --- | --- |
| A. One docked frame | Fixes every inconsistency; needs more of Pascal's chrome overridden | **Picked** |
| B. Pascal's floating cards everywhere | Closest to Pascal; cards cover the plan on a laptop | Rejected |
| C. Restyle only | Cheapest; keeps two toolbars and three panel types | Rejected |

## Design

- **Pascal patch (`patches/@pascal-app+editor+1.1.6.patch`).** Three v2 props:
  `dockInspector` (the node inspector renders in a fixed right column instead of the
  floating right stack, with no drag or collapse), `toolDock={false}` (no floating tool
  dock; the host draws its own tools), `sideMenu={false}` (no labelled side menu; the
  column tab is the whole left panel). `inspectorEmpty` renders in the docked column
  for the host's no-selection state.
- **Top bar.** Back · tools (Select V, Measure M, Delete X) · 2D/3D/Split · centred
  "Event / Plan name ▾" (menu: Save as venue template, Back to floor plans) · Saved ·
  undo/redo · Print menu · Preview as client · Submit for review. The "Phases"
  placeholder goes.
- **Left panel.** One column with segmented tabs Library · Guests · Layers (read-only:
  Guests · Layers). "Seat guests" switches the tab. "Plan the room" collapses to one
  row that opens the planner in place. Library tiles have no border, show the piece's
  outline and a size/seats line; sections past the first three start collapsed.
- **Canvas.** Lens switch centred at the top; zoom control bottom-right if Pascal's
  floor-plan zoom can be driven from the host, else left out; room dimensions on two
  edges; the selection's size and its gap to the nearest piece.
- **Inspector.** Pascal's panel restyled through `pascal-theme.css`; linen, overlay and
  sash as swatch rows (custom fields); table shape as a segmented control. With nothing
  selected: a Plan panel (room size, capacity, counts, layout checks; a check selects
  its pieces).
- **Status bar.** Counts · the first layout check · room size and grid.

## Left to the builder

Exact icon choices, hover states, and how far `pascal-theme.css` reaches into Pascal's
own inspectors (walls, rooms) as long as they share the same row and text scale.
