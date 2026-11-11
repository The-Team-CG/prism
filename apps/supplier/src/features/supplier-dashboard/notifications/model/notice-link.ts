import type { NotificationAction } from "@prism/types";
import { supplierSectionHref, supplierWorkTargetHref } from "../../workspace/model/supplier-workspace-types";

export type NoticeLink = { href: string; label: string };

/**
 * Where a supplier notice sends the reader. A schedule revision opens its booking; a file requirement
 * opens Files. Billing and floor plans are the client's, so suppliers get no link for those.
 */
export function supplierNoticeLink(action: NotificationAction | undefined): NoticeLink | null {
  if (action?.kind === "supplier_schedule") {
    return { href: supplierWorkTargetHref("bookings", action.requestId), label: `Review schedule revision ${action.revision}` };
  }
  if (action?.kind === "event_section" && action.section === "files") return { href: supplierSectionHref("files"), label: "Open files" };
  return null;
}
