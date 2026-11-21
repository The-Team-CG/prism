"use client";

import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPinned } from "lucide-react";
import type { PrismClientFloorplanSnapshotType, PrismClientSharedFloorplanEntry } from "@prism/types";
import { PrismDashboardShell } from "@prism/ui";
import { formatPortalDate } from "@prism/ui/format-date";
import { Button } from "@prism/ui/components/button";
import { Card } from "@prism/ui/components/card";
import { LoadingState } from "@prism/ui/components/loading-state";
import { PrismEmptyLine } from "@prism/ui/page-blocks";
import { cn } from "@/app/components/ui/utils";
import { CLIENT_ACCOUNT_MENU_ITEMS, CLIENT_PORTAL_MOBILE_BAR, CLIENT_SIDEBAR_ITEMS, clientSidebarLinkHref } from "@/features/client-dashboard/workspace/model/client-dashboard-navigation";
import { drawingOfScene } from "@/features/floorplan/drawing-of-scene";
import { OfficialLayoutDrawing } from "@/features/floorplan/official-layout-drawing";
import type { ClientPlanLayout } from "@/features/floorplan/snapshot-project";
import { clientSharedFloorplanSnapshotHref } from "../model/client-shared-floorplans";
import { useClientSharedFloorplanSnapshotViewModel } from "../view-models/use-client-shared-floorplans-view-model";

const OfficialLayoutViewer = dynamic(
  () => import("@/features/floorplan/official-layout-viewer").then((mod) => mod.OfficialLayoutViewer),
  { ssr: false, loading: () => <div className="grid size-full place-items-center bg-background text-sm text-muted-foreground">Loading layout view...</div> },
);

const SNAPSHOT_LABEL: Record<PrismClientFloorplanSnapshotType, string> = {
  approved: "Approved version",
  submitted: "Version sent for review",
};

const metres = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

/** "Approved version · 36 × 24 m · Read-only": which version the reader is looking at, in one line. */
function snapshotLine(type: PrismClientFloorplanSnapshotType, layout: ClientPlanLayout) {
  const drawing = drawingOfScene(layout.scene);
  const size = drawing ? `${metres(drawing.room.width)} × ${metres(drawing.room.depth)} m` : null;
  return [SNAPSHOT_LABEL[type], size, "Read-only"].filter(Boolean).join(" · ");
}

/** Approved and submitted versions of the same layout, as links, so the reader can compare them. */
function SnapshotSwitch({ entry, current }: { entry: PrismClientSharedFloorplanEntry; current: PrismClientFloorplanSnapshotType }) {
  if (entry.availableSnapshots.length < 2) return null;
  const order: PrismClientFloorplanSnapshotType[] = ["approved", "submitted"];
  return (
    <nav aria-label="Layout versions" className="inline-flex rounded-lg bg-muted p-0.5 text-sm">
      {order.filter((type) => entry.availableSnapshots.includes(type)).map((type) => (
        <Link
          key={type}
          href={clientSharedFloorplanSnapshotHref(entry.eventId, entry.draftId, type)}
          aria-current={type === current ? "page" : undefined}
          className={cn("rounded-md px-3 py-1.5 font-medium", type === current ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}
        >
          {type === "approved" ? "Approved" : "Sent for review"}
        </Link>
      ))}
    </nav>
  );
}

/**
 * A layout PMCM shared, as a viewer: the plan drawn to scale and fitted to the frame, one line saying which version it
 * is, and a switch between the approved and the reviewed version when both were shared.
 */
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
  const type = snapshotType as PrismClientFloorplanSnapshotType;
  const title = vm.entry ? vm.entry.draftName : "Shared floorplan";
  // Open layout shows the plan in the editor PMCM drew it in, read-only and full screen.
  const [open, setOpen] = useState(false);

  if (open && vm.layout?.scene && vm.entry) {
    return (
      <main className="h-screen w-full overflow-hidden bg-background">
        <OfficialLayoutViewer scene={vm.layout.scene} eventName={vm.entry.eventName} draftName={vm.entry.draftName} draftStatus={vm.entry.draftStatus} onBack={() => setOpen(false)} />
      </main>
    );
  }

  return (
    <SnapshotFrame title={title} session={vm.session} onNavigate={(href) => router.push(href)}>
      {vm.layout && vm.entry ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{vm.entry.eventName}</span> · {formatPortalDate(vm.entry.eventDate)}
              <span className="block">{snapshotLine(type, vm.layout)}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <SnapshotSwitch entry={vm.entry} current={type} />
              {vm.layout.scene ? <Button type="button" onClick={() => setOpen(true)}>Open layout</Button> : null}
            </div>
          </div>
          <Card className="grid place-items-center gap-0 overflow-hidden bg-surface-raised p-4">
            <OfficialLayoutDrawing layout={vm.layout} className="max-h-[calc(100dvh-14rem)] w-full" />
          </Card>
        </div>
      ) : vm.loading ? (
        <LoadingState label="Loading floorplan…" />
      ) : vm.error ? (
        <Card className="px-5 py-5">
          <PrismEmptyLine icon={MapPinned} action={<Button asChild variant="outline"><Link href="/dashboard/shared-floorplans">Back to shared floorplans</Link></Button>}>
            <span className="block font-semibold text-foreground">This floorplan is not available</span>
            {vm.error}
          </PrismEmptyLine>
        </Card>
      ) : null}
    </SnapshotFrame>
  );
}

/** The portal's own frame, with the way back through Shared floorplans in the breadcrumb. */
function SnapshotFrame({
  title,
  session,
  onNavigate,
  children,
}: {
  title: string;
  session: ReturnType<typeof useClientSharedFloorplanSnapshotViewModel>["session"];
  onNavigate: (href: string) => void;
  children: ReactNode;
}) {
  // Only pages this frame can open: an event-owned page has no link outside its event, and a dead row helps no one.
  const navItems = CLIENT_SIDEBAR_ITEMS.map((item) => ({ ...item, href: clientSidebarLinkHref(item.id) })).filter((item) => item.href);
  return (
    <PrismDashboardShell
      portal="client"
      productLabel="P.R.I.S.M"
      roleLabel="Client Portal"
      title={title}
      breadcrumb={["Shared floorplans", title]}
      activeItemId="my-events"
      navItems={navItems}
      onNavSelect={(id) => {
        const href = navItems.find((item) => item.id === id)?.href;
        if (href) onNavigate(href);
      }}
      user={session ? { name: session.name, detail: session.organization, initials: session.name.slice(0, 2).toUpperCase() } : undefined}
      accountMenuItems={CLIENT_ACCOUNT_MENU_ITEMS}
      mobileBar={CLIENT_PORTAL_MOBILE_BAR}
    >
      <div className="min-w-0">{children}</div>
    </PrismDashboardShell>
  );
}
