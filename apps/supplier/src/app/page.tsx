"use client";

import { BadgeCheck, ClipboardList, FileCheck2, PackageCheck, Truck, Warehouse } from "lucide-react";
import { PrismLifecycleStrip, PrismPublicRoleGrid } from "@prism/ui/public-blocks";
import { PrismPublicShell } from "@prism/ui/public-shell";
import {
  PrismBadge,
  PrismCard,
  PrismCardContent,
  PrismCardHeader,
  PrismCardTitle,
} from "@prism/ui/primitives";

const supplierSteps = [
  { label: "Assignment", description: "PMCM assigns quote or event-day responsibility.", state: "current" as const },
  { label: "Quote", description: "Supplier submits or revises before lock.", state: "pending" as const },
  {
    label: "Confirmation",
    description: "Selected assignment is confirmed with readiness and contract metadata.",
    state: "pending" as const,
  },
  { label: "Event day", description: "Supplier posts role-safe live status updates.", state: "pending" as const },
  { label: "Closure", description: "PMCM verifies status and archives supplier records.", state: "pending" as const },
];

const supplierCards = [
  {
    title: "Quote deadlines",
    badge: "Time boxed",
    description: "Every request shows the response deadline, revision state, lock status, and PMCM selection result.",
    icon: <ClipboardList className="size-5" />,
  },
  {
    title: "Assignment readiness",
    badge: "Confirmed",
    description: "Selected suppliers confirm availability, contract metadata, setup expectations, and pre-event readiness.",
    icon: <PackageCheck className="size-5" />,
  },
  {
    title: "Event-day status",
    badge: "Mobile safe",
    description: "Arrival, setup, and completion actions stay large enough for fast venue-floor updates.",
    icon: <Truck className="size-5" />,
  },
];

function SupplierPreview() {
  return (
    <PrismCard className="overflow-hidden">
      <PrismCardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Supplier workspace</p>
            <PrismCardTitle className="mt-2 text-2xl">Production lights and truss</PrismCardTitle>
          </div>
          <PrismBadge tone="warning">Quote due</PrismBadge>
        </div>
      </PrismCardHeader>
      <PrismCardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["Deadline", "May 9, 5:00 PM"],
            ["Visibility", "Client hidden"],
            ["Assignment", "Awaiting PMCM"],
            ["Ingress", "2:00 AM setup"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border bg-secondary/45 p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
              <p className="mt-1 text-sm font-black text-foreground">{value}</p>
            </div>
          ))}
        </div>
        <a
          href="/sign-in"
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-black text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          Supplier sign in
          <BadgeCheck className="size-4" />
        </a>
      </PrismCardContent>
    </PrismCard>
  );
}

export default function SupplierHome() {
  return (
    <PrismPublicShell
      eyebrow="Supplier network surface"
      badgeIcon={Warehouse}
      badgeText="Assigned suppliers only"
      productDetail="Supplier Portal"
      title="Supplier work stays scoped, clear, and deadline driven."
      description="P.R.I.S.M gives suppliers a focused portal for quote requests, revisions, assignment confirmation, readiness, contract metadata, and simple event-day status updates."
      aside={<SupplierPreview />}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap gap-3">
          <a
            href="/sign-in"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-black text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            Supplier sign in
          </a>
          <a
            href="#workflow"
            className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-black text-foreground transition hover:bg-secondary"
          >
            Review workflow
          </a>
        </div>
        <PrismLifecycleStrip steps={supplierSteps} />
        <section id="workflow">
          <PrismPublicRoleGrid roles={supplierCards} />
        </section>
        <section className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <FileCheck2 className="mt-0.5 size-5 text-primary" />
            <div>
              <p className="font-black text-foreground">No external delivery is simulated.</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Supplier reminders and assignments are represented as in-app queue states for the defense path.
              </p>
            </div>
          </div>
        </section>
      </div>
    </PrismPublicShell>
  );
}
