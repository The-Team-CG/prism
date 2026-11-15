"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck, Settings2 } from "lucide-react";
import { manilaDateKey } from "../format-date";
import { Button } from "../components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../components/ui/sheet";
import { Skeleton } from "../components/ui/skeleton";
import { NotificationPreferencesPanel, type NotificationPreferencesActions } from "../notification-preferences";
import { PrismEmptyLine, PrismSection, PrismSectionGroupLabel } from "../page-blocks";
import { cn } from "../utils";
import { type Notice, type NoticeFilter } from "./notice-model";
import { NoticeRow, type NoticeLink } from "./notice-row";
import { useNotificationCenter, type NoticeActions, type NotificationCenterState } from "./use-notification-center";

type RowProps = {
  linkFor: (notice: Notice) => NoticeLink | null;
  vm: NotificationCenterState;
};

function Rows({ notices, linkFor, vm }: RowProps & { notices: Notice[] }) {
  const todayKey = manilaDateKey();
  return (
    <>
      {notices.map((notice) => (
        <NoticeRow key={notice.id} notice={notice} link={linkFor(notice)} todayKey={todayKey} busy={vm.busy === notice.id} onRead={vm.read} onAcknowledge={vm.acknowledge} />
      ))}
    </>
  );
}

function FilterChips({ vm }: { vm: NotificationCenterState }) {
  const chips: Array<{ id: NoticeFilter; label: string; count?: number }> = [{ id: "all", label: "All" }, { id: "unread", label: "Unread", count: vm.unread }];
  return (
    <div role="group" aria-label="Show" className="flex flex-wrap gap-1 border-b border-border px-5 pb-3">
      {chips.map((chip) => (
        <button
          key={chip.id} type="button" aria-pressed={vm.filter === chip.id} onClick={() => vm.setFilter(chip.id)}
          className={cn("rounded-md px-2.5 py-1 text-sm transition-colors", vm.filter === chip.id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
        >
          {chip.label}{chip.count ? <span className="ml-1 tabular-nums opacity-70">{chip.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div aria-label="Loading notifications" className="space-y-1 px-5 py-3">
      {[0, 1, 2, 3].map((row) => <Skeleton key={row} className="h-12 w-full" />)}
    </div>
  );
}

function EmptyInbox({ filter }: { filter: NoticeFilter }) {
  return (
    <div className="px-5 py-6">
      <PrismEmptyLine icon={Bell}>
        {filter === "unread" ? "You are all caught up. Nothing new since you last looked." : "No notifications yet. Updates about your events appear here."}
      </PrismEmptyLine>
    </div>
  );
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-6 text-sm text-muted-foreground">
      <span>Your notifications could not be loaded.</span>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>Try again</Button>
    </div>
  );
}

function InboxBody({ vm, linkFor }: RowProps) {
  if (vm.loading) return <ListSkeleton />;
  if (vm.error && vm.total === 0) return <LoadFailed onRetry={vm.retry} />;
  if (vm.days.length === 0) return <EmptyInbox filter={vm.filter} />;
  return (
    <div>
      {vm.days.map((day) => (
        <section key={day.key} aria-label={day.label}>
          <PrismSectionGroupLabel>{day.label}</PrismSectionGroupLabel>
          <ul className="divide-y divide-border"><Rows notices={day.notices} linkFor={linkFor} vm={vm} /></ul>
        </section>
      ))}
      {vm.hasMore ? (
        <div className="border-t border-border px-5 py-3">
          <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={vm.showMore}>Show older notifications</Button>
        </div>
      ) : null}
      {vm.atLimit ? <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">Showing your latest {vm.total} notifications.</p> : null}
    </div>
  );
}

/** Settings open in a side panel; the old anchors that pointed at the Viber switch open it too. */
function SettingsSheet({ actions, open, onOpenChange }: { actions: NotificationPreferencesActions; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Notification settings</SheetTitle>
          <SheetDescription>Choose where P.R.I.S.M sends your event updates.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4"><NotificationPreferencesPanel actions={actions} /></div>
      </SheetContent>
    </Sheet>
  );
}

function HeaderActions({ vm, onSettings }: { vm: NotificationCenterState; onSettings: () => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" disabled={vm.unread === 0} onClick={() => void vm.readAll()}><CheckCheck aria-hidden />Mark all read</Button>
      <Button type="button" variant="outline" size="sm" onClick={onSettings}><Settings2 aria-hidden />Notification settings</Button>
    </div>
  );
}

const SETTINGS_ANCHOR = /^#(viber|notification)-settings$/;

/**
 * Notifications for one account, the same on every portal: what is waiting on the reader first, then every notice by
 * day with its event, an unread dot and a link to the item. Channel settings sit in a side panel.
 */
export function NotificationCenter({ actions, linkFor, onChange }: {
  actions: NoticeActions & NotificationPreferencesActions;
  /** Where each notice opens for this portal's role; null for a notice with no page here. */
  linkFor: (notice: Notice) => NoticeLink | null;
  /** Runs after the reader reads or acknowledges, so a navigation badge can read again. */
  onChange?: () => void;
}) {
  const vm = useNotificationCenter(actions, onChange);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    if (SETTINGS_ANCHOR.test(window.location.hash)) setSettingsOpen(true);
  }, []);
  return (
    <div className="space-y-5">
      {vm.error ? <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{vm.error}</p> : null}
      {vm.needsYou.length > 0 ? (
        <PrismSection id="notifications-needs-you" title="Needs you" count={vm.needsYou.length} description="PMCM asked you to confirm you received these." flush>
          <ul className="divide-y divide-border"><Rows notices={vm.needsYou} linkFor={linkFor} vm={vm} /></ul>
        </PrismSection>
      ) : null}
      <PrismSection id="notification-inbox" title="Notifications" description={vm.unread ? `${vm.unread} unread` : undefined} action={<HeaderActions vm={vm} onSettings={() => setSettingsOpen(true)} />} flush>
        <div className="pt-3"><FilterChips vm={vm} /></div>
        <InboxBody vm={vm} linkFor={linkFor} />
      </PrismSection>
      <SettingsSheet actions={actions} open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
