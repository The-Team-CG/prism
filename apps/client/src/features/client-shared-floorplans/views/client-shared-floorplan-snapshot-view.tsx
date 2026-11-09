"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PrismDashboardShell } from "@prism/ui";
import { Button } from "@prism/ui/components/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@prism/ui/components/empty";
import { MapPinned } from "lucide-react";
import { CLIENT_ACCOUNT_MENU_ITEMS, clientPortalSidebarItems, clientSidebarLinkHref } from "@/features/client-dashboard/workspace/model/client-dashboard-navigation";
import { useClientSharedFloorplanSnapshotViewModel } from "../view-models/use-client-shared-floorplans-view-model";

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
      <main className="h-screen w-full overflow-hidden bg-background">
        <EditorShell
          project={vm.project}
          eventName={vm.entry.eventName}
          draftName={vm.entry.draftName}
          draftStatus={vm.entry.draftStatus}
          readOnly
          onBack={() => router.push("/dashboard/shared-floorplans")}
        />
      </main>
    );
  }

  // Loading and unavailable snapshots keep the portal frame, so the client can still reach the rest of the portal.
  return (
    <SnapshotFrame session={vm.session} onNavigate={(href) => router.push(href)}>
      {vm.loading ? (
        <p role="status" className="text-sm text-muted-foreground">Loading floorplan snapshot…</p>
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
  session,
  onNavigate,
  children,
}: {
  session: ReturnType<typeof useClientSharedFloorplanSnapshotViewModel>["session"];
  onNavigate: (href: string) => void;
  children: ReactNode;
}) {
  const navItems = clientPortalSidebarItems(2).map((item) => ({ ...item, href: clientSidebarLinkHref(item.id) }));
  return (
    <PrismDashboardShell
      portal="client"
      productLabel="P.R.I.S.M"
      roleLabel="Client Portal"
      title="Shared floorplan"
      breadcrumb={["Shared floorplans"]}
      activeItemId="my-events"
      navItems={navItems}
      onNavSelect={(id) => {
        const href = clientSidebarLinkHref(id);
        if (href) onNavigate(href);
      }}
      user={session ? { name: session.name, detail: session.organization, initials: session.name.slice(0, 2).toUpperCase() } : undefined}
      accountMenuItems={CLIENT_ACCOUNT_MENU_ITEMS}
    >
      <div className="mx-auto max-w-3xl">{children}</div>
    </PrismDashboardShell>
  );
}
