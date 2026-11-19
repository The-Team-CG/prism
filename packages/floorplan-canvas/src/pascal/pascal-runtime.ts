import { ProceduralItemNode } from "@pascal-app/core/procedural-items";
import { buildProceduralGeometry } from "@pascal-app/nodes/procedural-item";
import { configureViewer, resolveSlotDefaultMaterial, type RenderShading } from "@pascal-app/viewer";
import { setDesignRuntime } from "./designs";

/**
 * Pascal loads its textures, sounds, icons and KTX2 decoder from Pascal's hosted site unless told otherwise. PRISM
 * serves the MIT-licensed copies itself (see `apps/event/public/PASCAL-ASSETS.md`), from the portal's own origin.
 */
configureViewer({
  assetsBaseUrl: "",
  iconsBaseUrl: "/icons",
  sfxBaseUrl: "/audios/sfx",
  decoders: { basisPath: "/basis/" },
});

/** Event pieces build with Pascal's procedural builder and dress in its material library. */
setDesignRuntime({
  build: (recipe, parameters) =>
    buildProceduralGeometry(ProceduralItemNode.parse({ recipe, parameters })).batches.map(({ slot, geometry }) => ({ slot, geometry })),
  material: (ref, shading) => resolveSlotDefaultMaterial(ref, shading as RenderShading),
});
