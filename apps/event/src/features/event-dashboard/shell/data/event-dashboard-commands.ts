import { closureCommands } from "./commands/closure-commands";
import { commercialCommands } from "./commands/commercial-commands";
import { complianceCommands } from "./commands/compliance-commands";
import { floorplanCommands } from "./commands/floorplan-commands";
import { guestCommands } from "./commands/guest-commands";
import { identityCommands } from "./commands/identity-commands";
import { lifecycleCommands } from "./commands/lifecycle-commands";
import { operationsCommands } from "./commands/operations-commands";

/** Screen-level composition for the PMCM shell; endpoint work stays with each domain. */
export const eventDashboardCommands = {
  ...identityCommands,
  ...lifecycleCommands,
  ...floorplanCommands,
  ...commercialCommands,
  ...complianceCommands,
  ...operationsCommands,
  ...guestCommands,
  ...closureCommands,
};

export type EventDashboardCommands = typeof eventDashboardCommands;
