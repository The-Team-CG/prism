---
type: "Decision"
title: "Floor plan editor on Pascal"
description: "Build PMCM's floor plan editor on the Pascal editor's npm packages, pinned, with PRISM's event pieces as a Pascal plugin and scenes stored through the PRISM API."
tags: [architecture, decision, floorplan, editor, pascal]
status: canonical
updated: "2026-11-19"
authority: normative
audience: [agents, engineers, reviewers]
scope: "Floor plan authoring engine, scene storage, and the Pascal dependency"
last_verified: "floorplan-scene, floorplan-canvas, event and API focused tests, typechecks, prisma:validate, db:verify:offline and the migration and boundary checks passed; the browser path is verified by hand"
decision_date: "2026-11-19"
sources:
  - id: scene-contracts
    resource: "packages/types/src/schemas/floorplan-scene.ts"
    title: "Scene document and event piece schemas"
  - id: scene-logic
    resource: "packages/floorplan-scene/src"
    title: "Scene validation, seating extraction and the legacy converter"
  - id: host-adapter
    resource: "packages/floorplan-canvas/src/pascal"
    title: "Pascal host adapter and the prism:event-layout plugin"
  - id: scene-storage
    resource: "apps/api/src/modules/floorplan/application/authoring/plans.service.ts"
    title: "Scene saves, validation and seating rules"
  - id: engine-switch
    resource: "apps/event/src/features/floorplan/editor"
    title: "Engine flag, scene opening and serialized autosaves"
---
# ADR-0010: Floor plan editor on Pascal

## At a glance

- **Decision:** PMCM's floor plan editor is the Pascal editor (`pascalorg/editor`, MIT), used through its npm
  packages inside `@prism/floorplan-canvas`. PRISM's event pieces are a Pascal plugin, and scenes save through the
  PRISM API.
- **Pinned:** `@pascal-app/*` 1.1.6, exact, with no range. Upgrades are deliberate changes that re-run the checks below.
- **Storage:** a plan's scene is Pascal's scene graph stored on `floorplan.floor_plans.scene` as format `pascal-v1`.
  The browser is never the source of truth.
- **Rollout:** the flag `NEXT_PUBLIC_PRISM_FLOORPLAN_ENGINE` opened drafts in Pascal until the legacy editor was removed.
  Every legacy plan, snapshot and draft snapshot then converted once with `npm --workspace prism-api run db:convert:floorplans`
  (dry run first), and migration `20261127090000_floorplan_drop_legacy_plan_columns` dropped the legacy columns and the
  unused `event_instances`, `published_snapshots` and `floor_plan_objects` tables. The conversion runs before the migration.

## Context

The legacy editor is a 2D canvas of outlines on a grid. Every layout starts from an empty room, and the client sees
the same flat drawing. Pascal already provides an editing engine with a 2D plan and 3D view of one scene, direct
manipulation, undo, guide images, plugins for new kinds of object and agent tools. A throwaway spike on 2026-11-19
mounted it in `apps/event` and passed every gate. The answers are recorded in the design document's spike findings.

## Decision

The four approaches considered were: depend on Pascal's packages (chosen), copy its source (rejected: we would
maintain a fast-moving codebase), keep the old editor with only Pascal's viewer for clients (rejected: editing stays
as it is), and host Pascal's container in an iframe (ruled out: separate login and storage outside PRISM roles).

### Packages

- **`@prism/types`** holds the scene document and the `prism-*` event piece schemas, like every shared contract.
- **`@prism/floorplan-scene`** is pure TypeScript with no UI. It validates a scene (size limits, dangling parents, piece
  schemas), lists table seating, and converts legacy plans. The API and the editor both use it.
- **`@prism/floorplan-canvas`** hosts Pascal. `./editor` is `PrismFloorplanEditor` and `./plugin` is the
  `prism:event-layout` plugin (`apiVersion: 1`). It still makes no HTTP, session or role decision.

### Plugin contract

Each event piece type is a node definition whose `kind` is its scene `type` and whose `schema` is the Task 1 Zod schema
from `@prism/types`, so the editor, the API and the converter agree on one shape. Guests and suppliers appear in a
scene as IDs only.

### Browser state

The editor always gets `onLoad` and `onSave`, so Pascal never writes a scene to local storage or IndexedDB. Pascal
keeps UI preferences in localStorage; they hold no layout data. Pascal's `saveAsset` writes guide images to IndexedDB,
so tracing images must go through PRISM storage before guide images are offered.

### Saving

Every scene save is validated by `@prism/floorplan-scene`. It must name the plan version it was based on, and a stale
version is refused with 409. The legacy seating rules apply to scene tables. The event app sends autosaves one at a
time, each against the version the previous save returned. A read-only session holds Pascal's read-only lease and
never saves.

## Consequences

- **Upgrades:** raising the Pascal version means rerunning the spike checks (build, theme, no browser source of truth,
  WebGL fallback, bundle size), refreshing the copied icons, HDRI and sounds in `apps/event/public` from the new
  release's commit, and reviewing `patches/@pascal-app+editor+1.1.6.patch`.
- **Typecheck reach:** the editor ships TypeScript source, so our typecheck covers it. `@types/pdfkit`,
  `@types/blob-stream` and a one-line patch keep it clean under PRISM's settings.
- **Bundle:** the editor adds about 2.8 MB of compressed JavaScript, loaded only when a draft opens in it.
- **Legacy data:** converted once and dropped (see Rollout). The legacy editor, the flag and the `Project` types are gone.
  `convertLegacyPlan` remains for the conversion script and the blank-room builders; the event app opens the stored scene.
- **Snapshots:** every submitted and approved snapshot carries the scene, and annotations pinned to a converted snapshot were
  rehashed with it.
- **Chrome patch:** Pascal gives no switch for its plugin manager, level chip, sky control, compass, shortcuts card,
  scans control or the read-only action bars. The editor patch hides them only when the host sets
  `globalThis.__PRISM_HOST__`, which `@prism/floorplan-canvas/editor` does on import; `pascal-chrome.test.ts` fails
  if the patch is not applied. Everything else is a supported extension point: `<Editor>` slots, node fields
  (`floorplan`, `geometry`, `parametrics`, `quickActions`, `movable.override` for locks) and exported stores.
- **Host-owned placement and lenses:** Pascal mounts a kind's `tool` inside the 3D canvas, which a plan opened in 2D
  never mounts, so Library placement listens to Pascal's grid events in the host and the 3D tool only draws the ghost.
  Pascal caches each piece's 2D drawing by node, so the Seating and Supplier zones lenses draw as an overlay in
  `floorplanSceneSlot` instead of inside `floorplan()`.
- **Seating source:** the editor seats the event's guest roster (`operations`), not the plan's own guest list. A scene
  save is checked against the roster through the `read-models/floorplan-seating` reader, and a zone may name only
  suppliers with a selected quote on the event. Converting a legacy plan seats each legacy guest as the roster guest
  with exactly the same name and leaves the rest of its seats empty.

## Verification

```bash
npm --workspace @prism/floorplan-scene run test
npm --workspace @prism/floorplan-canvas run test && npm --workspace @prism/floorplan-canvas run typecheck
npm --workspace prism-api run test -- plans.service floor-plan-workflow
npm --workspace @prism/event run test && npm --workspace @prism/event run typecheck
npm run check:boundaries && npm run check:migrations
```
