import {
  EditorShell as SharedEditorShell,
  type EditorShellProps,
  type TemplateStore,
} from "@prism/floorplan-canvas";
import { addTemplate, loadTemplates, removeTemplate } from "./data/templates-repository";

const templateStore: TemplateStore = {
  load: loadTemplates,
  add: addTemplate,
  remove: removeTemplate,
};

type ClientEditorShellProps = Omit<EditorShellProps, "readOnlyLabel" | "templateStore">;

export function EditorShell(props: ClientEditorShellProps) {
  return <SharedEditorShell {...props} readOnlyLabel="Floor plan view" templateStore={templateStore} />;
}