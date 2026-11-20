# Floor plan pieces: beautiful, realistic 3D and presentation 2D

**System goal:** UX: the event pieces PMCM lays out in the floor plan editor, and what clients see.

## Why

The pieces read as flat diagrams. In 3D they are thin, sharp-edged shapes in flat colour presets, while Pascal's own
asset library sets the bar with chunky, bevelled forms, true proportions and textured wood, fabric and leather. In 2D
every symbol is the same white fill and grey hairline, where event planning tools draw tables in their linen colour,
chairs in their own colour, and big table numbers.

## Approaches

| Option | Trade-off | Decision |
| --- | --- | --- |
| Rework our procedural designs with Pascal's textured materials | Stays parametric (seats, colours, sizes) and instanced; no assets to source | **Picked** |
| Ready-made models (CC0) for the hero pieces | More realistic up close; licensing, download weight, colour variants | Rejected |
| 2D presentation style (linen-filled tables, coloured chairs, big numbers) | Reads at a glance, matches the 3D dressing | **Picked** |
| 2D architectural style (ink lineweights, hatching) | Prints cleanly, colder on screen | Not now |

## Design

- **Tinted textures.** Pascal's fabric and wood textures bake in one colour. A tinted reference
  (`prism-tint:<library id>:<hex>`) keeps a texture's weave or grain (normal, roughness, ao maps) and takes our colour,
  so every linen, sash and seat colour is a real woven fabric. Built with Pascal's `createMaterialFromPreset`.
- **Linen.** The round cloth rolls over a soft edge, falls in folds and pools slightly at the floor; long tables get
  a fitted cloth with a box-pleat corner. Overlays and runners in a satin-like finish.
- **Place settings.** Every dining seat gets a charger, plate, folded napkin, cutlery and two glasses, drawn as one
  instanced design at the seat spots, like the chairs.
- **Chairs.** Each style drawn as itself, at true proportions with rounded edges: chiavari (bamboo-turned gold legs,
  rungs, railed back, ivory cushion), tiffany (white), banquet (padded seat and raked back on a dark frame), cross-back
  (wood, X back, linen pad), ghost (clear Louis back), covered (fitted cover, sash with a bow and tails).
- **Centrepieces.** Low floral (a dome of blooms and greenery in a low bowl), tall floral (a slim vase under a
  cascading arrangement), candles (pillars in hurricane glasses).
- **Stage, bar, dance floor.** Wood-grain decks and bar fronts, marble bar top, brass foot rail, velvet stage skirt.
- **2D.** Tables filled in their linen colour with a soft shadow; chairs in their style's colour; large table
  numbers; stage and bar solid; dance floors in their finish.

## Constraints

Pascal recipe limits (8 slots, 512 shapes, 64 repeats, the triangle budget, the range sweep); chairs and place
settings stay instanced; complexity ≤ 10; no new contracts.
