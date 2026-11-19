import { getMaterialPresetByRef } from "@pascal-app/core";
import { ProceduralItemNode } from "@pascal-app/core/procedural-items";
import { buildProceduralGeometry } from "@pascal-app/nodes/procedural-item";
import { configureViewer, createMaterialFromPreset, resolveSlotDefaultMaterial, type RenderShading } from "@pascal-app/viewer";
import { setDesignRuntime } from "./designs";
import { parseFinish, type Finish } from "./designs/finishes";

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

/**
 * A library material's textures in our colour: a dyed finish drops the baked colour and its baked shading (ambient
 * occlusion, which reads as blotches once the colour changes) and keeps the relief; a stained one keeps them all and
 * multiplies. A glowing finish also lights itself, which the viewer's bloom picks up in high-quality renders. Pascal
 * caches the material by its preset, so each finish builds once.
 */
function finishMaterial(spec: Finish, shading: RenderShading) {
  const preset = getMaterialPresetByRef(`library:${spec.library}`);
  if (!preset) throw new Error(`Pascal has no library material "${spec.library}"`);
  const { albedoMap, aoMap, ...relief } = preset.maps;
  const repeat = spec.repeat ?? preset.mapProperties.repeatX;
  const normalScale = (spec.relief ?? 1) * preset.mapProperties.normalScaleX;
  return createMaterialFromPreset(
    {
      maps: spec.mode === "dye" ? relief : { albedoMap, aoMap, ...relief },
      mapProperties: {
        ...preset.mapProperties,
        color: spec.color,
        roughness: spec.roughness ?? preset.mapProperties.roughness,
        metalness: spec.metalness ?? preset.mapProperties.metalness,
        repeatX: repeat,
        repeatY: repeat,
        normalScaleX: normalScale,
        normalScaleY: normalScale,
        opacity: spec.opacity ?? preset.mapProperties.opacity,
        emissiveColor: spec.glow?.color ?? preset.mapProperties.emissiveColor,
        emissiveIntensity: spec.glow?.intensity ?? preset.mapProperties.emissiveIntensity,
      },
    },
    shading,
  );
}

/** Event pieces build with Pascal's procedural builder and dress in its material library. */
setDesignRuntime({
  build: (recipe, parameters) =>
    buildProceduralGeometry(ProceduralItemNode.parse({ recipe, parameters })).batches.map(({ slot, geometry }) => ({ slot, geometry })),
  material: (ref, shading) => {
    const spec = parseFinish(ref);
    return spec ? finishMaterial(spec, shading as RenderShading) : resolveSlotDefaultMaterial(ref, shading as RenderShading);
  },
});
