import { MessageSquareText } from "lucide-react";

import type { PrismAuditLog, PrismCoordinatorAssignment, PrismEvent, PrismNotificationLog } from "@prism/types";
import { EmptyState } from "@/app/components/ui/empty-state";
import { cx, label } from "@/features/pmcm-kit";
import { Panel } from "@/features/pmcm-kit";

export function EventActivityPanel({
  event,
  notificationLogs,
  assignments,
  audit,
}: {
  event: PrismEvent;
  notificationLogs: PrismNotificationLog[];
  assignments: PrismCoordinatorAssignment[];
  audit: PrismAuditLog[];
}) {
  return (
    <Panel title="Messages" icon={MessageSquareText}>
      <div className="grid min-h-[560px] overflow-hidden rounded-lg border border-border bg-background lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="border-b border-border bg-secondary/45 p-3 lg:border-b-0 lg:border-r">
          <p className="px-2 text-sm font-black text-foreground">Event Threads</p>
          <div className="mt-3 space-y-2">
            {[
              { title: event.clientName, detail: "Client coordination", tag: "Client" },
              {
                title: "Coordinator Team",
                detail: `${assignments.length} assignment${assignments.length === 1 ? "" : "s"}`,
                tag: "Team",
              },
              { title: "Supplier Desk", detail: "Quotes and setup confirmations", tag: "Supplier" },
              { title: "PMCM Internal", detail: "Team-only notes", tag: "Internal" },
            ].map((thread, index) => (
              <div key={thread.title} className={cx("rounded-md px-3 py-3", index === 0 ? "bg-card shadow-sm" : "hover:bg-card/70")}>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-black text-foreground">{thread.title}</p>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary">
                    {thread.tag}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{thread.detail}</p>
              </div>
            ))}
          </div>
        </aside>
        <div className="flex min-w-0 flex-col">
          <div className="border-b border-border bg-card px-4 py-3">
            <p className="font-black text-foreground">{event.clientName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{event.eventName} message thread</p>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {notificationLogs.map((notification) => (
              <div key={notification.id} className="flex justify-end">
                <div className="max-w-[min(44rem,84%)]">
                  <div className="rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm font-medium leading-6 text-primary-foreground">
                    {notification.message}
                  </div>
                  <p className="mt-1 text-right text-[11px] font-semibold text-muted-foreground">
                    {label(notification.channel)} to {notification.recipient}
                  </p>
                </div>
              </div>
            ))}
            {assignments.map((assignment) => (
              <div key={assignment.id} className="flex justify-start">
                <div className="max-w-[min(40rem,84%)]">
                  <div className="rounded-2xl rounded-bl-md bg-card px-4 py-3 text-sm font-medium leading-6 text-foreground ring-1 ring-border">
                    {assignment.coordinatorName} is assigned as {assignment.role}.
                  </div>
                  <p className="mt-1 text-[11px] font-semibold text-muted-foreground">{label(assignment.status)}</p>
                </div>
              </div>
            ))}
            {audit.slice(0, 4).map((item) => (
              <div key={item.id} className="mx-auto w-fit rounded-full bg-secondary px-3 py-1 text-[11px] font-black text-muted-foreground">
                {item.action}
              </div>
            ))}
            {notificationLogs.length === 0 && assignments.length === 0 && audit.length === 0 && (
              <EmptyState
                icon={MessageSquareText}
                title="No messages yet"
                description="Start from the message composer once the event thread is ready."
              />
            )}
          </div>
          <div className="border-t border-border bg-card p-3">
            <div className="flex gap-2">
              <input
                className="h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                placeholder={`Reply to ${event.clientName}...`}
              />
              <button type="button" className="h-10 rounded-md bg-primary px-4 text-sm font-black text-primary-foreground">
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
