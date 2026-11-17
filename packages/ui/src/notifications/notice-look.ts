import {
  ArrowLeftRight, Bell, CalendarClock, CalendarDays, ClipboardList, FileSignature, FileText, LayoutGrid, MessageSquare, Radio, Receipt, ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { NotificationAction, NotificationEventSection } from "@prism/types";

const SECTION_ICONS: Record<NotificationEventSection, LucideIcon> = {
  overview: CalendarDays,
  briefing: ClipboardList,
  proposal: FileSignature,
  floorplans: LayoutGrid,
  billing: Receipt,
  files: FileText,
  changes: ArrowLeftRight,
  live_ops: Radio,
};

/** The icon that tells what a notice is about at a glance; a notice with no link target gets the bell. */
export function noticeIcon(action: NotificationAction | undefined): LucideIcon {
  switch (action?.kind) {
    case "conversation": return MessageSquare;
    case "payment_receipt": return Receipt;
    case "privacy_request": return ShieldCheck;
    case "supplier_schedule": return CalendarClock;
    case "event_section": return SECTION_ICONS[action.section] ?? Bell;
    default: return Bell;
  }
}
