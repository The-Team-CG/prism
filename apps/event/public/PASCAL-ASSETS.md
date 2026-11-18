# Pascal editor assets

`icons/`, `hdri/` and `audios/` are copied unchanged from the Pascal editor's demo app, which the npm packages do
not ship. The floor plan editor (`@prism/floorplan-canvas/editor`) loads them from these paths.

- **Source:** `apps/editor/public` in https://github.com/pascalorg/editor
- **Commit:** `b5519cca2808170e0c3d27eaf726acad6181cf29`, the `gitHead` npm records for `@pascal-app/editor@1.1.6`
  (the pinned release). Sampled files match that commit byte for byte.
- **Licence:** MIT, Copyright (c) 2026 Pascal Group Inc.

When the pinned Pascal version changes, copy these folders again from the new release's `gitHead` and update the
commit above.
