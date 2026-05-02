"use client";

import { CheckCircle2, ClipboardCheck, MessageCircleHeart, PartyPopper, ShieldCheck, TicketCheck } from "lucide-react";
import { PrismLifecycleStrip, PrismPublicRoleGrid } from "@prism/ui/public-blocks";
import { PrismPublicShell } from "@prism/ui/public-shell";
import {
  PrismBadge,
  PrismCard,
  PrismCardContent,
  PrismCardHeader,
  PrismCardTitle,
} from "@prism/ui/primitives";

const guestSteps = [
  { label: "Event code", description: "Guest access starts with a PMCM-issued event code.", state: "current" as const },
  { label: "Consent", description: "Privacy consent is required before check-in or feedback.", state: "pending" as const },
  { label: "Check-in", description: "Guest or walk-in attendance is recorded for PMCM operations.", state: "pending" as const },
  { label: "Feedback", description: "Feedback is submitted for moderation after or during the event.", state: "pending" as const },
];

const guestCards = [
  {
    title: "Access-code entry",
    badge: "Gated",
    description: "Guests cannot open the event dashboard until they provide the PMCM-issued event code.",
    icon: <TicketCheck className="size-5" />,
  },
  {
    title: "Consent first",
    badge: "Required",
    description: "Privacy consent is shown before check-in and feedback writes are accepted.",
    icon: <ShieldCheck className="size-5" />,
  },
  {
    title: "Moderated feedback",
    badge: "Reviewed",
    description: "Guest comments feed PMCM moderation and never become public automatically.",
    icon: <MessageCircleHeart className="size-5" />,
  },
];

function GuestPreview() {
  return (
    <PrismCard className="overflow-hidden">
      <PrismCardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Guest pass</p>
            <PrismCardTitle className="mt-2 text-2xl">Leadership Forum 2026</PrismCardTitle>
          </div>
          <PrismBadge tone="info">Event code</PrismBadge>
        </div>
      </PrismCardHeader>
      <PrismCardContent>
        <div className="rounded-lg bg-(--prism-ink) p-5 text-sidebar-foreground">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-(--prism-amber)">Ready at registration</p>
          <div className="mt-5 grid gap-2">
            {[
              ["Access", "Code required"],
              ["Check-in", "Name or walk-in"],
              ["Feedback", "PMCM moderated"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-md bg-white/8 px-3 py-2 text-sm">
                <span>{label}</span>
                <span className="font-black">{value}</span>
              </div>
            ))}
          </div>
        </div>
        <a
          href="/open"
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-black text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          Open with code
          <CheckCircle2 className="size-4" />
        </a>
      </PrismCardContent>
    </PrismCard>
  );
}

export default function GuestHome() {
  return (
    <PrismPublicShell
      eyebrow="Guest experience"
      badgeIcon={PartyPopper}
      badgeText="Event-code access"
      productDetail="Guest Portal"
      title="Guest actions stay fast, consented, and role safe."
      description="P.R.I.S.M guest pages support event-code entry, check-in, walk-in verification, consent, and moderated feedback without exposing a public dashboard shortcut."
      aside={<GuestPreview />}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap gap-3">
          <a
            href="/open"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-black text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            Open with code
          </a>
          <a
            href="#guest-flow"
            className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-black text-foreground transition hover:bg-secondary"
          >
            Preview flow
          </a>
        </div>
        <section id="guest-flow">
          <PrismLifecycleStrip steps={guestSteps} />
        </section>
        <PrismPublicRoleGrid roles={guestCards} />
        <section className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <ClipboardCheck className="mt-0.5 size-5 text-primary" />
            <div>
              <p className="font-black text-foreground">Event-day flow stays code gated.</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Guest access stays simple, browser based, and moderated through the PMCM-issued event code.
              </p>
            </div>
          </div>
        </section>
      </div>
    </PrismPublicShell>
  );
}
