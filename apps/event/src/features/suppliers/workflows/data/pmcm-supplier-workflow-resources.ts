import { defineResource } from "@prism/portal-query";
import { pmcmSupplierWorkflowRepository } from "./pmcm-supplier-workflow-repository";

/** One event's supplier workflows (contracts, creative tasks, payables, event-day status) as PMCM works them. */
export const pmcmSupplierWorkflows = defineResource({
  name: "suppliers.pmcm-workflows",
  staleMs: 10_000,
  fetch: (eventId: string) => pmcmSupplierWorkflowRepository.load(eventId),
});

/** The ingress and egress windows published to one event's suppliers. */
export const pmcmSupplierScheduleWindows = defineResource({
  name: "suppliers.pmcm-schedule-windows",
  staleMs: 10_000,
  fetch: (eventId: string) => pmcmSupplierWorkflowRepository.listSchedules(eventId),
});
