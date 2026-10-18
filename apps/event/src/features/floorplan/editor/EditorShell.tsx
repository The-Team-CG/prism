import {
  EditorShell as SharedEditorShell,
  type AssignmentRejectionMessages,
  type EditorShellProps,
  type TemplateStore,
} from "@prism/floorplan-canvas";
import { addTemplate, loadTemplates, removeTemplate } from "./data/templates-repository";

const templateStore: TemplateStore = {
  load: loadTemplates,
  add: addTemplate,
  remove: removeTemplate,
};

/** PMCM copy for each refused table assignment code. */
const assignmentRejectionMessages: AssignmentRejectionMessages = {
  "unknown-guest": "This guest is not on the event guest list.",
  "guest-declined": "Guests who declined cannot be seated.",
  "not-a-table": "Choose a round or rectangular table with seats to seat a guest.",
  "table-hidden": "Hidden tables cannot take guests. Unhide the table first.",
  "table-full": "This table has no free seats.",
};

type EventEditorShellProps = Omit<
  EditorShellProps,
  "readOnlyLabel" | "templateStore" | "assignmentRejectionMessages"
>;

export function EditorShell(props: EventEditorShellProps) {
  return (
    <SharedEditorShell
      {...props}
      readOnlyLabel="Read-only"
      templateStore={templateStore}
      assignmentRejectionMessages={assignmentRejectionMessages}
    />
  );
}
