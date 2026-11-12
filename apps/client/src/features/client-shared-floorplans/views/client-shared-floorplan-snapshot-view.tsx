"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PrismDashboardShell } from "@prism/ui";
import { Button } from "@prism/ui/components/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@prism/ui/components/empty";
import { MapPinned } from "lucide-react";
import { CLIENT_ACCOUNT_MENU_ITEMS, clientEventSidebarItems, dashboardHref } from "@/features/client-dashboard/workspace/model/client-dashboard-navigation";
import { useClientSharedFloorplanSnapshotViewModel } from "../view-models/use-client-shared-floorplans-view-model";
import { LoadingState } from "@prism/ui/components/loading-state";

const EditorShell = dynamic(
  () => import("@/features/floorplan/editor").then((module) => module.EditorShell),
  {
    ssr: false,
    loading: () => (
      <div className="grid size-full place-items-center bg-background text-sm text-muted-foreground">
        Loading floorplan view…
      </div>
    ),
  },
);

export function ClientSharedFloorplanSnapshotView({
  eventId,
  draftId,
  snapshotType,
}: {
  eventId: string;
  draftId: string;
  snapshotType: string;
}) {
  const router = useRouter();
  const vm = useClientSharedFloorplanSnapshotViewModel(eventId, draftId, snapshotType);

  if (vm.project && vm.entry) {
    return (
      <SnapshotFrame eventId={eventId} session={vm.session} onNavigate={(href) => router.push(href)}>
      <div className="h-[70dvh] w-full overflow-hidden rounded-lg border border-border bg-background">
        <EditorShell
          project={vm.project}
          eventName={vm.entry.eventName}
          draftName={vm.entry.draftName}
          draftStatus={vm.entry.draftStatus}
          readOnly
          onBack={() => router.push(dashboardHref("floorplan", eventId))}
        />
      </div>
      </SnapshotFrame>
    );
  }

  // Loading and unavailable snapshots keep the portal frame, so the client can still reach the rest of the portal.
  return (
    <SnapshotFrame eventId={eventId} session={vm.session} onNavigate={(href) => router.push(href)}>
      {vm.loading ? (
        <LoadingState label="Loading floorplan snapshot…" />
      ) : vm.error ? (
        <Empty className="gap-6 p-8 md:p-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MapPinned aria-hidden />
            </EmptyMedia>
            <EmptyTitle className="text-lg font-semibold">This floorplan is not available</EmptyTitle>
            <EmptyDescription>{vm.error}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild variant="outline"><Link href="/dashboard/shared-floorplans">Back to shared floorplans</Link></Button>
          </EmptyContent>
        </Empty>
      ) : null}
    </SnapshotFrame>
  );
}

function SnapshotFrame({
  eventId,
  session,
  onNavigate,
  children,
}: {
  eventId: string;
  session: ReturnType<typeof useClientSharedFloorplanSnapshotViewModel>["session"];
  onNavigate: (href: string) => void;
  children: ReactNode;
}) {
  const navItems = clientEventSidebarItems(eventId);
  return (
    <PrismDashboardShell
      portal="client"
      productLabel="P.R.I.S.M"
      roleLabel="Client Portal"
      title="Floor plan"
      breadcrumb={["My events", "Floor plan", "Shared snapshot"]}
      activeItemId="event-floorplan"
      navItems={navItems}
      onNavSelect={(id) => {
        const href = navItems.find((item) => item.id === id)?.href;
        if (href) onNavigate(href);
      }}
      user={session ? { name: session.name, detail: session.organization, initials: session.name.slice(0, 2).toUpperCase() } : undefined}
      accountMenuItems={CLIENT_ACCOUNT_MENU_ITEMS}
      sidebarContext={<Link href="/dashboard/events" className="block text-sm text-muted-foreground hover:text-foreground">All events</Link>}
    >
      <div className="min-w-0">{children}</div>
    </PrismDashboardShell>
  );
}
