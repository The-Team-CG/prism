"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { ShieldCheck } from "lucide-react";
import { PrismDashboardShell } from "@prism/ui";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { ConformeUploadModal } from "@/features/conforme/upload";
import { humanizeToken } from "@/features/pmcm-kit/model/formatters";
import {
  EventDashboardSessionSkeleton,
  EventDashboardSkeleton,
  SkeletonCard,
  SkeletonLine,
  eventDashboardSkeletonVariant,
} from "@/app/(portal)/dashboard/components/event-dashboard-skeleton";
import { isPmcmAdmin } from "@/app/lib/role-guards";
import { CoordinatorView } from "@/features/coordinators/desk";
import type { EventDashboardClientProps } from "../model/event-dashboard-routing";
import type { EventDashboardShellViewModel } from "../view-models/use-event-dashboard-shell-view-model";
export type { EventDashboardClientProps };

const EditorShell = dynamic(
  () => import("@/features/floorplan/editor").then((mod) => mod.EditorShell),
  {
    ssr: false,
    loading: () => (
      <div className="grid size-full place-items-center bg-background text-sm text-muted-foreground">
        Loading PMCM editor...
      </div>
    ),
  },
);

export type EventDashboardShellViewProps = {
  viewModel: EventDashboardShellViewModel;
  children?: ReactNode;
};

export function EventDashboardShellView({ viewModel, children }: EventDashboardShellViewProps) {
  const {
    routeState,
    session,
    state,
    coordinatorState,
    screen,
    error,
    sidebarActiveOverride,
    activeSidebarItemId,
    shellNavItems,
    shellCopy,
    refresh,
    handleSidebarNav,
    signOut,
    saveEditorPlan,
    submitEditorPlan,
    closeEditor,
    loadingShellCopy,
    loadingShellNavItems,
    conformeUploadTarget,
    uploadConforme,
    closeConformeUpload,
  } = viewModel;
  /* Loading */
  if (!session) {
    return <EventDashboardSessionSkeleton />;
  }

  /* Wrong role */
  if (session.role !== "pmcm-admin" && session.role !== "coordinator") {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6">
        <section className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
          <ShieldCheck className="size-12 rounded-xl bg-amber-50 p-2.5 text-amber-600" />
          <h1 className="mt-5 text-xl font-bold text-foreground">Wrong portal for this account.</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {session.role === "client"
              ? "Client accounts belong in the client portal at http://localhost:3001."
              : "Supplier accounts belong in the supplier portal at http://localhost:3002."}
          </p>
          <Button className="mt-5 rounded-lg font-bold" onClick={signOut}>
            Use event team sign-in
          </Button>
        </section>
      </main>
    );
  }

  /* Editor fullscreen */
  if (screen.name === "editor") {
    return (
      <div className="h-screen w-full overflow-hidden">
        <EditorShell
          project={screen.project}
          eventName={screen.event.eventName}
          draftName={screen.draft.name}
          draftStatus={screen.draft.status}
          readOnly={!isPmcmAdmin(session.role)}
          onSave={saveEditorPlan}
          onSubmit={submitEditorPlan}
          onBack={closeEditor}
        />
      </div>
    );
  }

  /* Coordinator view */
  if (session.role === "coordinator") {
    if (!coordinatorState) {
      return (
        <main className="grid min-h-screen place-items-center bg-background px-6">
          {error ? (
            <Alert variant="destructive" className="max-w-md rounded-xl"><AlertDescription>{error}</AlertDescription></Alert>
          ) : (
            <div className="w-full max-w-5xl">
              <SkeletonCard>
                <div className="flex items-center gap-3">
                  <SkeletonLine className="size-10 rounded-md" />
                  <div>
                    <SkeletonLine className="h-4 w-44 rounded-md" />
                    <SkeletonLine className="mt-2 h-3 w-64 rounded-md" />
                  </div>
                </div>
              </SkeletonCard>
              <div className="mt-5">
                <EventDashboardSkeleton variant="coordinator" />
              </div>
            </div>
          )}
        </main>
      );
    }
    return (
      <CoordinatorView session={session} state={coordinatorState} onRefresh={() => refresh(session)} onSignOut={signOut} />
    );
  }

  /* PMCM loading */
  if (!state) {
    const loadingVariant = eventDashboardSkeletonVariant(routeState);
    return (
      <PrismDashboardShell
        productLabel="P.R.I.S.M"
        roleLabel="PMCM Event Command"
        eyebrow={loadingShellCopy.eyebrow}
        title={loadingShellCopy.title}
        description="Loading the PMCM event command data, route context, and workspace queue."
        activeItemId={activeSidebarItemId}
        navItems={loadingShellNavItems}
        sidebarMode="single"
        onNavSelect={handleSidebarNav}
        user={{ name: session.name, detail: humanizeToken(session.role), initials: session.name.slice(0, 2).toUpperCase() }}
        searchPlaceholder="Search events, suppliers, inquiries..."
        showTopBarSearch={false}
        onSignOut={signOut}
      >
        {error ? (
          <Alert variant="destructive" className="max-w-md rounded-xl"><AlertDescription>{error}</AlertDescription></Alert>
        ) : (
          <EventDashboardSkeleton variant={loadingVariant} />
        )}
      </PrismDashboardShell>
    );
  }

  return (
    <PrismDashboardShell
      productLabel="P.R.I.S.M"
      roleLabel="PMCM Event Command"
      eyebrow={shellCopy.eyebrow}
      title={shellCopy.title}
      description={shellCopy.description}
      activeItemId={sidebarActiveOverride ?? activeSidebarItemId}
      navItems={shellNavItems}
      sidebarMode="single"
      onNavSelect={handleSidebarNav}
      user={{ name: session.name, detail: humanizeToken(session.role), initials: session.name.slice(0, 2).toUpperCase() }}
      searchPlaceholder="Search events, suppliers, inquiries..."
      showTopBarSearch={false}
      onSignOut={signOut}
    >
      {children}
      {conformeUploadTarget && (
        <ConformeUploadModal
          inquiry={conformeUploadTarget}
          onUpload={uploadConforme}
          onClose={closeConformeUpload}
        />
      )}
    </PrismDashboardShell>
  );
}
