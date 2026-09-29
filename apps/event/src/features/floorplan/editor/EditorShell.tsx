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

type EventEditorShellProps = Omit<EditorShellProps, "readOnlyLabel" | "templateStore">;

export function EditorShell(props: EventEditorShellProps) {
  return <SharedEditorShell {...props} readOnlyLabel="Read-only" templateStore={templateStore} />;
}