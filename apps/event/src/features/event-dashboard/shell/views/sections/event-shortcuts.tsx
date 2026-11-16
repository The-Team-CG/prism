"use client";

import Link from "next/link";
import { FileText, MessageSquareText, ReceiptText, type LucideIcon } from "lucide-react";
import type { EventShortcutCounts } from "@/features/pmcm-overview";
import { eventWorkspaceHref } from "../../model/event-dashboard-routing";

const SHORTCUTS: Array<{ key: keyof EventShortcutCounts; label: string; icon: LucideIcon; tab: "billing" | "files" | "messages"; noun: string }> = [
  { key: "billing", label: "Billing", icon: ReceiptText, tab: "billing", noun: "overdue" },
  { key: "files", label: "Files", icon: FileText, tab: "files", noun: "open" },
  { key: "messages", label: "Messages", icon: MessageSquareText, tab: "messages", noun: "unread" },
];

/** Straight to the event's Billing, Files and Messages, each with what is waiting there. */
export function EventShortcuts({ eventId, counts }: { eventId: string; counts: EventShortcutCounts }) {
  return (
    <nav aria-label="Go to" className="flex flex-wrap gap-1.5">
      {SHORTCUTS.map(({ key, label, icon: Icon, tab, noun }) => {
        const count = counts[key] ?? 0;
        const tone = count && key !== "files" ? "border-primary/30 text-primary" : "border-border text-muted-foreground";
        return (
          <Link key={key} href={eventWorkspaceHref(eventId, tab)} aria-label={count ? `${label}, ${count} ${noun}` : label}
            className={`relative z-10 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors hover:bg-muted ${tone}`}>
            <Icon aria-hidden className="size-3" />{label}{count ? <span className="tabular-nums">· {count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
