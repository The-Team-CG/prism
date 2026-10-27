import type { PrismFileRequirementItem } from "@prism/types";
import { dashboardHref } from "../../workspace/model/client-dashboard-navigation";

export function clientFileRequirementDestination(item: PrismFileRequirementItem, eventId: string) {
  if (item.key === "official_floorplan") return { href: dashboardHref("floorplan", eventId), label: "View official layout" };
  if (item.key === "billing_statement") return { href: dashboardHref("billing", eventId), label: "View billing" };
  if (item.key === "client_feedback") return { href: `/dashboard/events/${encodeURIComponent(eventId)}/activity`, label: "View event feedback" };
  return { href: "#event-files", label: "View uploads and shared files" };
}

export function clientFileRequirementDetail(item: PrismFileRequirementItem): string {
  const available = ["approved", "complete", "generated"].includes(item.status);
  if (item.key === "official_floorplan") return available ? "PMCM’s official layout is available in Floor plan." : "PMCM prepares the official layout. Review its progress in Floor plan; an upload here does not replace it.";
  if (item.key === "billing_statement") return available ? "Your statement and payment schedule are available in Billing." : "PMCM has not issued this record yet. Check Billing for the current payment schedule.";
  if (item.key === "signed_conforme") return "The signed agreement and acknowledgments belong to the conforme version used for this event.";
  if (item.key === "post_event_documents") return "Review the completion documents PMCM requests or shares after the event.";
  if (item.key === "client_feedback") return item.status === "submitted" ? "Your feedback has been recorded for PMCM to review." : "Tell PMCM how the event went. Your feedback is part of event closure.";
  return item.detail.replaceAll("_", " ");
}
