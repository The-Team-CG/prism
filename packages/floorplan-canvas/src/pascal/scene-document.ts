import type { SceneGraph } from "@pascal-app/editor";
import { FLOORPLAN_EVENT_LAYOUT_PLUGIN_ID, FLOORPLAN_SCENE_FORMAT, floorplanSceneDocumentSchema, type FloorplanSceneDocument } from "@prism/types";

/** The scene the Pascal editor hands to `onSave` and takes back from `onLoad`. */
export type PascalSaveScene = SceneGraph;

/** The Pascal release this package is pinned to; every saved scene records it. */
export const PASCAL_VERSION = "1.1.6";

/**
 * Wraps the editor's scene with PRISM's storage format and the Pascal version that saved it. The editor types its
 * nodes as unknown, so they are parsed into scene nodes here; a node without an id, type or parent fails loudly
 * rather than reaching the API.
 */
export function toSceneDocument(scene: PascalSaveScene, pascalVersion: string): FloorplanSceneDocument {
  return floorplanSceneDocumentSchema.parse({
    format: FLOORPLAN_SCENE_FORMAT,
    pascalVersion,
    nodes: scene.nodes,
    rootNodeIds: scene.rootNodeIds,
    ...(scene.collections === undefined ? {} : { collections: scene.collections }),
    ...(scene.materials === undefined ? {} : { materials: scene.materials }),
    ...(scene.installedPlugins === undefined ? {} : { installedPlugins: scene.installedPlugins }),
  });
}

/**
 * The stored document as the editor loads it. Pascal draws a plugin's pieces only when the scene lists the plugin,
 * so the PRISM event pieces are always installed, including in scenes saved before they were.
 */
export function fromSceneDocument(document: FloorplanSceneDocument): PascalSaveScene {
  const installed = document.installedPlugins ?? [];
  return {
    nodes: document.nodes,
    rootNodeIds: document.rootNodeIds,
    ...(document.collections === undefined ? {} : { collections: document.collections }),
    ...(document.materials === undefined ? {} : { materials: document.materials }),
    installedPlugins: installed.includes(FLOORPLAN_EVENT_LAYOUT_PLUGIN_ID) ? installed : [...installed, FLOORPLAN_EVENT_LAYOUT_PLUGIN_ID],
  };
}
