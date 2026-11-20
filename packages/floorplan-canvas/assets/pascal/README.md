# Pascal editor assets

The Pascal editor loads these from the portal's own origin. The npm packages don't ship them, and without them Pascal
fetches them from its hosted site.

| Path | What it is |
| --- | --- |
| `icons/` | The editor's UI icons. Pascal hard-codes `/icons/...`. |
| `cursor.svg` | The 2D plan's pointer. Pascal hard-codes `/cursor.svg`. |
| `hdri/` | 3D lighting. |
| `audios/` | Interface sounds. |
| `material/` | The material library's textures (fabrics, woods, metals, parquet). Event pieces are dressed in them. |

- **Source:** `apps/editor/public` in https://github.com/pascalorg/editor
- **Commit:** `b5519cca2808170e0c3d27eaf726acad6181cf29`, the `gitHead` npm records for `@pascal-app/editor@1.1.6`
  (the pinned release). Files are copied unchanged.
- **Licence:** MIT, Copyright (c) 2026 Pascal Group Inc. This is the repository's licence; `material/` has no
  separate terms there.

**What `material/` holds.** It keeps only the files Pascal's material library references (`material-library.js` in
`@pascal-app/core`): KTX2 textures and thumbnails. The repository's WebP and JPG sources are dropped.

**Woods are encoded here.** Pascal's repository ships its wood textures only as WebP sources. Their KTX2 files exist only
on Pascal's hosted site. `finewood_27`, `woodplank_48`, `hungarian_parquet_2` and `square_parquet_21` (the woods event
pieces resolve to) were encoded from those sources with `ktx2-encoder` 0.6.0 and `sharp`, matching Pascal's own files:
- 512 px with full mips
- base colour: ETC1S, sRGB
- AO and roughness: ETC1S, linear
- normal maps: UASTC with Zstandard, linear

The other wood, floor and roof materials have no textures here, and they draw in their preview colour if picked in the
editor.

`scripts/sync-pascal-assets.mjs` copies this folder into each portal that hosts the editor (`apps/event`,
`apps/client`) before `dev` and `build`. It also copies the KTX2 Basis transcoder from `three` into `/basis/`. The
copies are not committed. `src/pascal/pascal-runtime.ts` points Pascal's viewer at them.

When the pinned Pascal version changes, copy these folders again from the new release's `gitHead` and update the
commit above.
