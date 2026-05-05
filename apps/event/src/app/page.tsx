"use client";

import dynamic from "next/dynamic";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ArchiveRestore,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Filter,
  FileCheck2,
  KeyRound,
  LayoutGrid,
  ListFilter,
  LockKeyhole,
  MapPinned,
  MessageSquareText,
  Radio,
  ShieldCheck,
  Star,
  Tags,
  Truck,
  UserCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import {
  mvpApi,
  type DemoRole,
  type MvpAuditLog,
  type MvpApprovalRequest,
  type MvpCoordinator,
  type MvpCoordinatorAssignment,
  type MvpCoordinatorRoleRequirement,
  type MvpCoordinatorWorkspace,
  type MvpDemoState,
  type MvpDefenseReadiness,
  type MvpEvent,
  type MvpEventDayStatusFeed,
  type MvpFloorPlanDraft,
  type MvpInquiry,
  type MvpLiveOps,
  type MvpLoginHistory,
  type MvpSecurityAlert,
  type MvpSupplier,
  type MvpSupplierCategory,
  type MvpUser,
} from "@/lib/mvp-api";
import {
  PrismBrandLogo,
  PrismDashboardShell,
  PrismSectionPanel,
} from "@prism/ui";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { StatusBadge, statusClass } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import {
  AuditTrailPanel,
  ClientOnboardingTracker,
  CoordinatorAssignmentDesk,
  CoordinatorView,
  FinancialWorkspace,
  InquiryIntakeLog,
  LiveOperationsWorkspace,
  Phase4Workspace,
  SupplierDirectory,
  SupplierQuotePlanner,
} from "./components/pmcm";
import {
  DefenseControlPanel,
  EventOverviewPanels,
  EventQueuePanel,
  EventWorkflowTabs,
  SelectedEventCockpit,
  SelectedEventStatusSummary,
  buildEventWorkflowTabs,
  type PmcmDetailTab,
} from "./components/pmcm/event-command-cockpit";
import { PRESETS, type Preset } from "./components/editor/presets";
import type { Project } from "./components/editor/types";

const EditorShell = dynamic(
  () => import("./components/editor/EditorShell").then((mod) => mod.EditorShell),
  {
    ssr: false,
    loading: () => (
      <div className="grid size-full place-items-center bg-background text-sm text-muted-foreground">
        Loading PMCM editor...
      </div>
    ),
  },
);

type EventSession = MvpUser & { signedInAt: string };
type Screen =
  | { name: "portal" }
  | { name: "editor"; event: MvpEvent; draft: MvpFloorPlanDraft; project: Project };
type DetailTab = PmcmDetailTab;

const EVENT_SESSION_KEY = "prism:event-command-session";

const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function label(value: string) {
  return value.replaceAll("_", " ");
}

function dateKey(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function statusTone(status: string) {
  return statusClass(status);
}

function tierLabel(tier: string) {
  if (tier === "tier_1") return "Tier 1";
  if (tier === "tier_2") return "Tier 2";
  if (tier === "pending_first_event") return "Pending First Event";
  return label(tier);
}

function tierTone(tier: string) {
  if (tier === "tier_1") return "border-(--prism-success)/25 bg-(--prism-success)/8 text-(--prism-success)";
  if (tier === "tier_2") return "border-[#40A0D0]/30 bg-secondary text-[#40A0D0]";
  return "border-(--prism-amber)/30 bg-(--prism-amber)/8 text-(--prism-amber)";
}

function SupplierTierBadge({ tier }: { tier: string }) {
  return (
    <span className={cx("inline-flex rounded-full border px-2.5 py-1 text-xs font-black", tierTone(tier))}>
      {tierLabel(tier)}
    </span>
  );
}

function RatingStars({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-xs font-semibold text-muted-foreground">Unrated</span>;
  const rounded = Math.round(rating);

  return (
    <span className="inline-flex items-center gap-1" aria-label={`${rating.toFixed(1)} out of 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={cx(
            "size-3.5",
            index < rounded ? "fill-(--prism-amber) text-(--prism-amber)" : "text-border",
          )}
        />
      ))}
      <span className="ml-1 text-xs font-black text-foreground">{rating.toFixed(1)}</span>
    </span>
  );
}

function readSession() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(EVENT_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EventSession;
  } catch {
    window.localStorage.removeItem(EVENT_SESSION_KEY);
    return null;
  }
}

function saveSession(session: EventSession) {
  window.localStorage.setItem(EVENT_SESSION_KEY, JSON.stringify(session));
}

function Brand({ session, onSignOut }: { session?: EventSession | null; onSignOut?: () => void }) {
  return (
    <header className="border-b border-border bg-card/92 px-5 py-3.5 backdrop-blur sm:px-8">
      <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4">
        <PrismBrandLogo href="http://localhost:3001" detail="Event Command" markClassName="bg-transparent ring-0" />
        <div className="flex items-center gap-2">
          {session && (
            <span className="hidden rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-bold text-foreground sm:inline-flex">
              {session.name} · {label(session.role)}
            </span>
          )}
          {onSignOut && (
            <Button variant="outline" size="sm" onClick={onSignOut} className="rounded-lg font-bold">
              Sign out
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function Panel({ title, icon: Icon, children, aside }: { title: string; icon: LucideIcon; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <PrismSectionPanel title={title} icon={Icon} action={aside}>
      {children}
    </PrismSectionPanel>
  );
}

function PublicBrand({ label }: { label?: string }) {
  return (
    <PrismBrandLogo href="/" detail={label ?? "Event Command"} markClassName="size-12 bg-transparent ring-0" />
  );
}

function DisplayTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h1 className={cx("prism-serif text-5xl font-black leading-[0.93] tracking-normal text-(--prism-ink) sm:text-6xl xl:text-[4.85rem]", className)}>
      {children}
    </h1>
  );
}

function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={cx("prism-serif text-4xl font-black leading-[0.98] tracking-normal text-(--prism-ink) sm:text-5xl", className)}>
      {children}
    </h2>
  );
}

function MiniFloorplan({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cx("grid gap-2 rounded-md border border-border bg-secondary/35 p-4", compact ? "aspect-[1.65]" : "aspect-[1.72]")}>
      <div className="grid grid-cols-[0.45fr_1.05fr_0.45fr] gap-2">
        <div className="rounded-md border border-primary/15 bg-card p-2 text-center text-[10px] font-black uppercase text-muted-foreground">BAR</div>
        <div className="rounded-md bg-(--prism-ink) p-2 text-center text-xs font-black uppercase text-sidebar-foreground">Stage</div>
        <div className="rounded-md border border-primary/15 bg-card p-2 text-center text-[10px] font-black uppercase text-muted-foreground">AV</div>
      </div>
      <div className="grid grid-cols-5 gap-2 px-7">
        {Array.from({ length: 15 }).map((_, index) => (
          <span key={index} className="aspect-square rounded-full border border-primary/25 bg-card shadow-sm" />
        ))}
      </div>
      <div className="grid grid-cols-[0.7fr_1fr_0.7fr] gap-2">
        <div className="rounded-md border border-primary/15 bg-card p-2 text-[10px] font-black uppercase text-muted-foreground">Guest flow</div>
        <div className="rounded-md border border-primary/20 bg-card p-2 text-center text-[10px] font-black uppercase text-primary">Registration</div>
        <div className="rounded-md border border-[#F06030]/25 bg-[#F06030]/10 p-2 text-[10px] font-black uppercase text-[#F06030]">Service access</div>
      </div>
    </div>
  );
}

function EventCommandMock() {
  return (
    <section className="rounded-lg border border-primary/12 bg-card/92 p-4 shadow-[0_30px_110px_rgba(23,18,22,0.12)] backdrop-blur">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <LayoutGrid className="size-5 text-muted-foreground" />
          <p className="text-lg font-black text-foreground">Command cockpit</p>
        </div>
        <div className="grid grid-cols-4 gap-2 text-xs">
          {[
            ["18", "Action items", "text-primary"],
            ["7", "Today", "text-[#F06030]"],
            ["24", "Upcoming", "text-(--prism-success)"],
            ["May 15", "Event day", "text-[#9060A0]"],
          ].map(([value, labelText, color]) => (
            <span key={labelText} className="rounded-md border border-border bg-background px-3 py-2">
              <span className={cx("block font-black", color)}>{value}</span>
              <span className="text-muted-foreground">{labelText}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.32fr_1fr_0.4fr]">
        <div className="grid gap-3">
          <p className="px-1 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Event queue</p>
          {[
            ["New inquiries", "12", "bg-primary/10 text-primary"],
            ["Conforme pending", "6", "bg-[#F06030]/10 text-[#F06030]"],
            ["Planning in progress", "9", "bg-[#F06030]/10 text-[#F06030]"],
            ["Event day", "3", "bg-(--prism-success)/10 text-(--prism-success)"],
            ["Closing soon", "2", "bg-secondary text-muted-foreground"],
          ].map(([title, count, color]) => (
            <div key={title} className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2.5">
              <span className="text-xs font-bold text-foreground">{title}</span>
              <span className={`rounded-full px-2 py-1 text-xs font-black ${color}`}>{count}</span>
            </div>
          ))}
        </div>

        <div id="floorplans" className="rounded-md border border-border bg-background p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-foreground">Official floorplan editor</p>
              <p className="text-xs text-muted-foreground">Layout workflow · read-only review for partners</p>
            </div>
            <Button variant="outline" size="sm" className="rounded-md text-xs font-black">Open editor</Button>
          </div>
          <MiniFloorplan compact />
        </div>

        <div id="live-ops" className="grid gap-3">
          <div className="rounded-md border border-border bg-background p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-black text-foreground">Live operations</p>
              <Button variant="outline" size="sm" className="rounded-md text-xs font-black">View board</Button>
            </div>
            {[
              ["Check-ins", "132", "text-(--prism-success)"],
              ["Open issues", "3", "text-[#F06030]"],
              ["Urgent alerts", "1", "text-primary"],
              ["Announcements", "2", "text-[#40A0D0]"],
            ].map(([title, count, color]) => (
              <div key={title} className="flex items-center justify-between border-b border-border py-2 last:border-0">
                <span className="text-xs text-muted-foreground">{title}</span>
                <span className={`text-xs font-black ${color}`}>{count}</span>
              </div>
            ))}
          </div>
          <div className="rounded-md border border-border bg-background p-4">
            <p className="font-black text-foreground">Billing milestone</p>
            <p className="mt-3 text-sm font-black text-[#F06030]">Deposit paid</p>
            <div className="mt-3 h-2 rounded-full bg-secondary">
              <div className="h-2 w-2/5 rounded-full bg-[#F06030]" />
            </div>
            <Button variant="outline" className="mt-5 h-10 w-full rounded-md font-black">View billing details</Button>
          </div>
        </div>
      </div>

      <div className="mt-4 hidden gap-4 xl:grid xl:grid-cols-3">
        <div id="handoffs" className="rounded-md border border-border bg-background p-4">
          <p className="mb-3 text-sm font-black text-foreground">Supplier status</p>
          {["Catering", "AV & Lighting", "Decor & Styling", "Transport & Logistics", "Security"].map((item, index) => (
            <div key={item} className="flex items-center justify-between py-1.5">
              <span className="text-xs text-muted-foreground">{item}</span>
              <span className={cx("rounded-full px-2 py-1 text-[10px] font-black", index === 2 || index === 4 ? "bg-[#F06030]/10 text-[#F06030]" : "bg-(--prism-success)/10 text-(--prism-success)")}>{index === 2 || index === 4 ? "In progress" : "Confirmed"}</span>
            </div>
          ))}
        </div>
        <div className="rounded-md border border-border bg-background p-4">
          <p className="mb-3 text-sm font-black text-foreground">Coordinator coverage</p>
          {["Onsite lead", "Registration desk", "Guest experience", "Logistics", "Floorplan manager"].map((item, index) => (
            <div key={item} className="flex items-center justify-between py-1.5">
              <span className="text-xs text-muted-foreground">{item}</span>
              <span className={cx("rounded-full px-2 py-1 text-[10px] font-black", index === 3 ? "bg-[#F06030]/10 text-[#F06030]" : "bg-(--prism-success)/10 text-(--prism-success)")}>{index === 3 ? "Backup ready" : "Assigned"}</span>
            </div>
          ))}
        </div>
        <div id="closure" className="rounded-md border border-border bg-background p-4">
          <p className="mb-3 text-sm font-black text-foreground">Closure checklist</p>
          {["Final billing review", "Post-event report", "Client feedback", "Archive package", "Event closure"].map((item) => (
            <div key={item} className="flex items-center gap-2 py-1.5 text-xs text-muted-foreground">
              <span className="size-3 rounded-full border border-muted-foreground/40" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function buildProject(event: MvpEvent, draft: MvpFloorPlanDraft, preset?: Preset): Project {
  const widthM = 30;
  const heightM = 20;
  const pax = draft.clientPreference?.guestCount ?? 160;
  const now = Date.now();

  return {
    id: draft.floorPlanId,
    name: draft.name,
    venue: event.eventName,
    widthM,
    heightM,
    pax,
    objects: preset ? preset.build(widthM, heightM, pax) : [],
    guests: [],
    suppliers: [],
    createdAt: now,
    updatedAt: now,
  };
}

function SignIn({ onSignedIn }: { onSignedIn: (session: EventSession) => void }) {
  const [email, setEmail] = useState("mys@pmcm.test");
  const [password, setPassword] = useState("prism-admin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await mvpApi.login({ email, password });
      if (session.role !== "pmcm-admin" && session.role !== "coordinator") {
        setError(session.role === "client" ? "Client accounts belong in prism-client at http://localhost:3001." : "Supplier accounts belong in prism-supplier at http://localhost:3002.");
        return;
      }
      saveSession(session);
      onSignedIn(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="h-full overflow-y-auto bg-background text-foreground">
      <section className="relative min-h-screen overflow-hidden border-b border-primary/10 px-5 py-5 sm:px-8 lg:px-10">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,248,242,0.98),rgba(233,247,251,0.68)_58%,rgba(255,248,242,0.96))]" />
        <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(#CCECF4_1px,transparent_1px),linear-gradient(90deg,#CCECF4_1px,transparent_1px)] [background-size:42px_42px]" />
        <div className="absolute bottom-12 left-0 h-px w-[42rem] bg-[#C01867]/20" />
        <div className="absolute bottom-10 left-[34rem] size-5 rotate-45 bg-[#C01867]" />

        <div className="relative mx-auto max-w-[1320px]">
          <header className="flex items-center justify-between gap-4 bg-background/80 py-6 backdrop-blur-xl">
            <PublicBrand />

            <nav className="hidden items-center gap-8 text-sm font-black text-foreground lg:flex" aria-label="Event command sections">
              {[
                ["Command", "#command"],
                ["Floorplans", "#floorplans"],
                ["Suppliers", "#handoffs"],
                ["Live Ops", "#live-ops"],
                ["Closure", "#closure"],
              ].map(([labelText, href]) => (
                <a key={labelText} href={href} className={cx("rounded-md px-2 py-2 transition hover:text-primary", labelText === "Command" && "border-b-2 border-primary text-foreground")}>
                  {labelText}
                </a>
              ))}
            </nav>

            <Button asChild className="h-11 rounded-md px-5 font-black shadow-[0_16px_36px_rgba(192,24,103,0.22)]">
              <a href="/sign-in">
                <Radio className="size-4" />
                Sign in
              </a>
            </Button>
          </header>

          <div id="command" className="grid min-h-[calc(100vh-6.75rem)] items-start gap-10 py-10 lg:grid-cols-[0.4fr_0.6fr]">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-5 py-2 text-xs font-black uppercase tracking-[0.18em] text-primary">
                <Radio className="size-4" />
                PMCM event command
              </span>
              <DisplayTitle className="mt-7 max-w-3xl xl:text-[4.4rem]">
                One command center for every <span className="text-primary">PMCM</span> event handoff
              </DisplayTitle>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
                Track inquiries, conforme, floorplans, suppliers, coordinators, billing, live operations, and closure from one focused workspace.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild className="h-12 rounded-md px-6 text-base font-black shadow-[0_18px_40px_rgba(192,24,103,0.22)]">
                  <a href="/sign-in">
                    <LayoutGrid className="size-5" />
                    Sign in
                  </a>
                </Button>
                <Button asChild variant="outline" className="h-12 rounded-md px-6 text-base font-black">
                  <a href="#floorplans">See how it works</a>
                </Button>
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-4">
                {[
                  ["Inquiry to archive", "End-to-end visibility from first inquiry to closure."],
                  ["Official floorplans", "Layouts and approvals stay connected."],
                  ["Supplier handoffs", "Assignments, contracts, and readiness in one place."],
                  ["Live operations", "Event-day coordination stays on track."],
                ].map(([title, text]) => (
                  <div key={title} className="border-l border-border pl-3">
                    <p className="text-xs font-black text-foreground">{title}</p>
                    <p className="mt-1 hidden text-xs leading-5 text-muted-foreground xl:block">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <EventCommandMock />
          </div>
        </div>
      </section>

      <section className="border-t border-primary/10 bg-card px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1320px] gap-10 lg:grid-cols-[0.34fr_0.66fr] lg:items-center">
          <div>
            <SectionTitle>Official layouts. Clear plans. Confident execution.</SectionTitle>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">PMCM-owned floorplans keep every plan aligned and every decision visible for the entire team.</p>
            <div className="mt-6 grid gap-3 text-sm text-muted-foreground">
              {["To-scale editing and annotations", "Guest flow, entrances, and service access", "Versioned approvals with history", "All stakeholders stay in sync"].map((item) => (
                <span key={item} className="flex items-center gap-2"><CheckCircle2 className="size-4 text-(--prism-success)" />{item}</span>
              ))}
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-[0.38fr_1fr_0.42fr]">
            <div className="grid gap-2 rounded-lg border border-border bg-background p-4">
              <p className="text-xs font-black text-foreground">Event queue</p>
              {["New inquiries", "Conforme pending", "Planning in progress", "Event day"].map((item) => (
                <div key={item} className="rounded-md border border-border bg-card px-3 py-2 text-xs font-bold text-muted-foreground">{item}</div>
              ))}
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-black text-foreground">Official floorplan editor</p>
                <Badge variant="outline" className="rounded-full text-primary">Open editor</Badge>
              </div>
              <MiniFloorplan compact />
            </div>
            <div className="grid gap-3">
              <div className="rounded-lg border border-border bg-background p-4">
                <p className="font-black text-foreground">Live board</p>
                {["Check-ins", "Open issues", "Urgent alerts", "Announcements"].map((item) => (
                  <div key={item} className="flex items-center justify-between border-b border-border py-2 text-xs last:border-0">
                    <span className="text-muted-foreground">{item}</span><span className="font-black text-primary">•</span>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-border bg-background p-4">
                <p className="font-black text-foreground">Billing milestone</p>
                <p className="mt-2 text-sm font-black text-[#F06030]">Deposit paid</p>
                <div className="mt-3 h-2 rounded-full bg-secondary"><div className="h-2 w-2/5 rounded-full bg-[#F06030]" /></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-[1320px]">
          <SectionTitle className="mx-auto max-w-4xl text-center">From inquiry to archive, every handoff is connected.</SectionTitle>
          <div className="mt-12 grid gap-4 md:grid-cols-6">
            {[
              ["Inquiry", FileCheck2, "Capture details and PMCM reviews public inquiries."],
              ["Conforme", ShieldCheck, "Signed conforme opens the planning path."],
              ["Planning", CalendarDays, "Floorplans, suppliers, billing, and coordinators align."],
              ["Event day", Radio, "Live operations and coordinator actions stay on track."],
              ["Closure", ClipboardCheck, "Billing, reports, and feedback are finalized."],
              ["Archive", ArchiveRestore, "All records and outcomes are preserved."],
            ].map(([title, Icon, text]) => (
              <div key={title as string} className="text-center">
                <span className="mx-auto grid size-16 place-items-center rounded-full bg-primary/8 text-primary">
                  <Icon className="size-6" />
                </span>
                <p className="mt-4 font-black text-foreground">{title as string}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{text as string}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-primary/10 bg-card px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1320px] gap-10 lg:grid-cols-[0.34fr_0.66fr] lg:items-center">
          <div>
            <SectionTitle>Clear supplier handoffs. Aligned coordinators. Fewer surprises.</SectionTitle>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">Assignments, readiness, and coordinator coverage stay visible to the team that executes the plan.</p>
            <div className="mt-6 grid gap-3 text-sm text-muted-foreground">
              {["Status and deadlines at a glance", "Contract visibility and notes", "Mobile-ready actions for the field"].map((item) => (
                <span key={item} className="flex items-center gap-2"><CheckCircle2 className="size-4 text-(--prism-success)" />{item}</span>
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-border bg-background p-5">
              <p className="mb-4 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Supplier assignments</p>
              {["Lighting package", "Registration support", "Branding installation"].map((item, index) => (
                <div key={item} className="mb-3 rounded-md border border-border bg-card p-3 text-sm">
                  <p className="font-black text-foreground">{item}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{index === 0 ? "Due after request opens" : index === 1 ? "Awarded assignment" : "Revision window open"}</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-border bg-background p-5">
              <p className="mb-4 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Coordinator coverage</p>
              {["Onsite lead", "Registration desk", "Guest experience", "Logistics", "Floorplan manager"].map((item, index) => (
                <div key={item} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-muted-foreground">{item}</span>
                  <Badge variant="outline" className={index === 3 ? "border-[#F06030]/25 bg-[#F06030]/10 text-[#F06030]" : "border-(--prism-success)/25 bg-(--prism-success)/10 text-(--prism-success)"}>{index === 3 ? "Backup ready" : "Assigned"}</Badge>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-border bg-background p-5">
              <p className="mb-4 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Mobile actions</p>
              {["Check-in summary", "Open issues", "Update note"].map((item) => (
                <button key={item} className="mb-3 flex h-12 w-full items-center justify-between rounded-md border border-border bg-card px-3 text-sm font-black text-foreground">
                  {item}<ArrowRight className="size-4 text-muted-foreground" />
                </button>
              ))}
              <Button className="mt-2 h-11 w-full rounded-md font-black">Add update</Button>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-[1320px] rounded-lg border border-primary/12 bg-secondary/45 p-8 shadow-[0_24px_80px_rgba(23,18,22,0.08)] sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.32fr_0.68fr] lg:items-center">
            <div>
              <SectionTitle className="text-3xl sm:text-4xl">Real-time visibility. Calm operational control.</SectionTitle>
              <p className="mt-4 text-base leading-7 text-muted-foreground">One workspace to see what matters, act faster, and deliver every event with confidence.</p>
              <Button asChild className="mt-6 h-11 rounded-md font-black"><a href="/sign-in">Sign in</a></Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              {[
                ["18", "Action items"],
                ["7", "Updates today"],
                ["24", "Upcoming items"],
                ["132", "Check-ins today"],
                ["3", "Open issues"],
                ["1", "Urgent alert"],
                ["5", "Live events"],
                ["0", "Missed handoffs"],
              ].map(([value, labelText]) => (
                <div key={labelText} className="rounded-lg border border-primary/10 bg-card p-5 text-center">
                  <p className="text-3xl font-black text-(--prism-ink)">{value}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{labelText}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mx-auto mt-16 max-w-3xl text-center">
          <p className="font-display text-5xl font-black text-primary">“</p>
          <p className="text-xl leading-8 text-(--prism-ink)">Command gives our operations team one source of truth for every handoff. We see what needs action, coordinate with confidence, and deliver PMCM events without missing a beat.</p>
          <p className="mt-5 text-sm font-black text-muted-foreground">PMCM Operations Team</p>
        </div>
      </section>

      <section className="px-5 pb-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-[1320px] rounded-lg border border-primary/12 bg-card p-8 shadow-[0_24px_80px_rgba(23,18,22,0.08)] sm:p-10 lg:flex lg:items-center lg:justify-between">
          <div>
            <SectionTitle className="text-3xl sm:text-4xl">Run every handoff from command</SectionTitle>
            <p className="mt-3 max-w-2xl text-muted-foreground">Bring plans, people, and progress together in one workspace that keeps every event on track.</p>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-0">
            <Button asChild className="h-12 rounded-md px-6 font-black"><a href="/sign-in">Sign in <ArrowRight className="size-4" /></a></Button>
            <Button asChild variant="outline" className="h-12 rounded-md px-6 font-black"><a href="#command">Learn how it works</a></Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-primary/10 bg-background px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1320px] gap-8 md:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
          <PublicBrand />
          {[
            ["Platform", "Command", "Floorplans", "Suppliers", "Live Ops", "Closure"],
            ["Resources", "Help center", "Guides", "Updates", "System status"],
            ["Company", "About PMCM", "Careers", "Contact"],
          ].map(([title, ...items]) => (
            <div key={title}>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
              <div className="mt-3 grid gap-2 text-sm text-muted-foreground">{items.map((item) => <span key={item}>{item}</span>)}</div>
            </div>
          ))}
          <Button asChild className="h-11 rounded-md font-black"><a href="/sign-in">Sign in</a></Button>
        </div>
      </footer>

      {accessOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(23,18,22,0.55)] p-5 backdrop-blur-sm">
          <section id="event-sign-in" className="w-full max-w-md rounded-lg border border-border bg-card p-5 text-foreground shadow-[0_28px_90px_rgba(0,0,0,0.28)]">
            <form onSubmit={submit}>
              <div className="flex items-start justify-between gap-4">
                <span className="grid size-11 place-items-center rounded-md bg-secondary text-primary">
                  <KeyRound className="size-5" />
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setAccessOpen(false)} className="rounded-md font-black">Close</Button>
              </div>
              <h2 className="mt-4 text-2xl font-black text-foreground">Sign in</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Use an approved PMCM or coordinator account.</p>
              <div className="mt-5 flex flex-col gap-3">
                <Input value={email} onChange={(ev) => setEmail(ev.target.value)} className="h-11" placeholder="Email" />
                <Input value={password} onChange={(ev) => setPassword(ev.target.value)} type="password" className="h-11" placeholder="Password" />
                {error && (
                  <Alert variant="destructive" className="rounded-md">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button disabled={busy} className="h-11 w-full rounded-md font-black">
                  {busy ? "Signing in..." : "Sign in"} <ArrowRight className="size-4" />
                </Button>
              </div>
            </form>
            <div className="mt-5 grid gap-1.5 border-t border-border pt-4 text-xs text-muted-foreground">
              <p><span className="font-bold text-foreground">PMCM:</span> mys@pmcm.test / prism-admin</p>
              <p><span className="font-bold text-foreground">Coordinator:</span> marco@pmcm.test / prism-coordinator</p>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function PmcmPortal({
  session,
  state,
  onRefresh,
  onOpenEditor,
  onSignOut,
}: {
  session: EventSession;
  state: MvpDemoState;
  onRefresh: () => Promise<void>;
  onOpenEditor: (event: MvpEvent, draft: MvpFloorPlanDraft, preset?: Preset) => Promise<void>;
  onSignOut: () => void;
}) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(state.events[0]?.id ?? null);
  const [section, setSection] = useState<"events" | "suppliers" | "audit">("events");
  const [tab, setTab] = useState<DetailTab>("overview");
  const [approvalRequests, setApprovalRequests] = useState<MvpApprovalRequest[]>([]);
  const [liveOps, setLiveOps] = useState<MvpLiveOps | null>(null);
  const [statusFeed, setStatusFeed] = useState<MvpEventDayStatusFeed | null>(null);
  const [defenseReadiness, setDefenseReadiness] = useState<MvpDefenseReadiness | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const events = state.events.filter((event) => !event.archived);
  const supplierCategories = state.supplierCategories ?? [];
  const suppliers = state.suppliers ?? [];
  const coordinators = state.coordinators ?? [];
  const coordinatorRoleRequirements = state.coordinatorRoleRequirements ?? [];
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? events[0];
  const unreviewedInquiries = state.inquiries.filter((inquiry) => inquiry.status === "new").length;
  const drafts = selectedEvent ? state.floorPlanDrafts.filter((draft) => draft.eventId === selectedEvent.id) : [];
  const quoteRequests = (state.supplierQuoteRequests ?? []).filter((item) => item.eventId === selectedEvent?.id);
  const quotes = (state.supplierQuotes ?? []).filter((item) => item.eventId === selectedEvent?.id);
  const complianceRules = state.complianceRules ?? [];
  const checks = state.complianceChecks.filter((item) => item.eventId === selectedEvent?.id);
  const assignments = state.coordinatorAssignments.filter((item) => item.eventId === selectedEvent?.id);
  const payments = (state.paymentMilestones ?? []).filter((item) => item.eventId === selectedEvent?.id);
  const billingSources = (state.billingSources ?? []).filter((item) => item.eventId === selectedEvent?.id);
  const billingStatements = (state.billingStatements ?? []).filter((item) => item.eventId === selectedEvent?.id);
  const eventInsights = (state.eventInsights ?? []).filter((item) => item.eventId === selectedEvent?.id);
  const notificationLogs = (state.notificationLogs ?? [])
    .filter((item) => !item.eventId || item.eventId === selectedEvent?.id)
    .slice(0, 8);
  const briefing = state.briefings.find((item) => item.eventId === selectedEvent?.id);
  const selectedInquiry = state.inquiries.find((item) => item.id === selectedEvent?.inquiryId);
  const audit = state.auditLogs.filter((item) => item.eventId === selectedEvent?.id || !item.eventId).slice(0, 14);
  const activeDraft = drafts.find((draft) => draft.isActive);
  const pendingApprovals = approvalRequests.filter((request) => request.status === "pending");

  async function refreshApprovals() {
    setApprovalRequests(await mvpApi.approvalRequests());
  }

  useEffect(() => {
    refreshApprovals().catch((err) => setError(err instanceof Error ? err.message : "Unable to load approval requests"));
  }, []);

  async function loadLiveOps() {
    if (!selectedEvent) {
      setLiveOps(null);
      setStatusFeed(null);
      setDefenseReadiness(null);
      return;
    }
    const [nextLiveOps, nextStatusFeed, nextDefenseReadiness] = await Promise.all([
      mvpApi.liveOps(selectedEvent.id),
      mvpApi.eventDayStatusFeed(selectedEvent.id),
      mvpApi.defenseReadiness(selectedEvent.id),
    ]);
    setLiveOps(nextLiveOps);
    setStatusFeed(nextStatusFeed);
    setDefenseReadiness(nextDefenseReadiness);
  }

  useEffect(() => {
    if (!selectedEvent?.id) {
      setLiveOps(null);
      setStatusFeed(null);
      setDefenseReadiness(null);
      return;
    }
    Promise.all([mvpApi.liveOps(selectedEvent.id), mvpApi.eventDayStatusFeed(selectedEvent.id), mvpApi.defenseReadiness(selectedEvent.id)])
      .then(([nextLiveOps, nextStatusFeed, nextDefenseReadiness]) => {
        setLiveOps(nextLiveOps);
        setStatusFeed(nextStatusFeed);
        setDefenseReadiness(nextDefenseReadiness);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load event readiness"));
  }, [selectedEvent?.id]);

  async function run(labelText: string, action: () => Promise<unknown>) {
    setBusy(labelText);
    setError(null);
    try {
      await action();
      await onRefresh();
      await refreshApprovals();
      if (selectedEvent?.id) {
        void mvpApi.defenseReadiness(selectedEvent.id).then(setDefenseReadiness).catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function runLiveOps(labelText: string, action: () => Promise<unknown>) {
    setBusy(labelText);
    setError(null);
    try {
      await action();
      await onRefresh();
      await loadLiveOps();
      await refreshApprovals();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function createPreset(preset: Preset) {
    if (!selectedEvent) return;
    const draft = await mvpApi.createFloorPlanDraft(selectedEvent.id, {
      name: `${preset.name} PMCM draft`,
      sourceType: preset.id === "blank" ? "blank" : "preset",
      width: 30,
      height: 20,
      gridSize: 1,
    });
    await onOpenEditor(selectedEvent, draft, preset);
  }

  async function acceptInquiry(inquiry: MvpInquiry) {
    await run("accept inquiry", () => mvpApi.acceptInquiry(inquiry.id));
  }

  async function pendInquiry(inquiry: MvpInquiry) {
    await run("pend inquiry", () => mvpApi.pendInquiry(inquiry.id));
  }

  async function declineInquiry(inquiry: MvpInquiry, reason: string) {
    await run("decline inquiry", () => mvpApi.declineInquiry(inquiry.id, reason));
  }

  async function uploadConformeForInquiry(inquiry: MvpInquiry) {
    await run("upload conforme", () => mvpApi.uploadConforme(inquiry.id));
  }

  async function sendConformeReminder(inquiry: MvpInquiry) {
    await run("conforme reminder", () => mvpApi.sendConformeReminder(inquiry.id));
  }

  async function toggleSupplierBni(supplier: MvpSupplier, nextValue: boolean) {
    await run("supplier BNI flag", () => mvpApi.updateSupplier(supplier.id, { bniMember: nextValue }));
  }

  async function createSupplier(input: {
    categoryId: string;
    name: string;
    contactName?: string;
    email?: string;
    phone?: string;
    tier?: "tier_1" | "tier_2" | "pending_first_event";
    serviceInclusions?: string;
    performanceNotes?: string;
  }) {
    await run("create supplier", () => mvpApi.createSupplier(input));
  }

  async function updateSupplierProfile(supplierId: string, input: {
    name?: string;
    contactName?: string;
    email?: string;
    phone?: string;
    serviceInclusions?: string;
    performanceNotes?: string;
  }) {
    await run("update supplier", () => mvpApi.updateSupplier(supplierId, input));
  }

  async function changeSupplierTier(supplierId: string, tier: "tier_1" | "tier_2" | "pending_first_event", reason: string) {
    await run("supplier tier change", () => mvpApi.changeSupplierTier(supplierId, { tier, reason }));
  }

  async function addSupplierReview(supplierId: string, input: { rating: number; notes: string; reviewedBy?: string }) {
    await run("supplier private review", () => mvpApi.addSupplierReview(supplierId, { ...input, eventId: selectedEvent?.id }));
  }

  async function addSupplierCertification(supplierId: string, input: {
    fileName: string;
    documentType: string;
    issuer?: string;
    expiresAt?: string;
    status?: "submitted" | "verified" | "expired" | "rejected";
    notes?: string;
  }) {
    await run("supplier certification", () => mvpApi.addSupplierCertification(supplierId, input));
  }

  async function requestSupplierQuotes(input: {
    categoryId: string;
    supplierIds: string[];
    confidentialBid: boolean;
    deadline?: string;
  }) {
    if (!selectedEvent) return;
    await run("request supplier quotes", () => mvpApi.requestSupplierQuotes(selectedEvent.id, input));
  }

  async function selectSupplierQuote(quoteId: string) {
    if (!selectedEvent) return;
    await run("select supplier quote", () => mvpApi.selectSupplierQuote(selectedEvent.id, quoteId));
  }

  async function recordPayment(
    milestoneId: string,
    input: {
      amountReceived: number;
      paymentDate: string;
      paymentMethod: "Bank Transfer" | "GCash" | "Cheque";
      referenceNumber?: string;
    },
  ) {
    if (!selectedEvent) return;
    await run("record payment", () => mvpApi.recordPayment(selectedEvent.id, milestoneId, input));
  }

  async function sendBillingStatement(billingId: string) {
    if (!selectedEvent) return;
    await run("send billing statement", () => mvpApi.sendBillingStatement(selectedEvent.id, billingId));
  }

  async function createComplianceRule(input: {
    title: string;
    conditionKey: string;
    phase: string;
    severity: string;
    layer: string;
    note: string;
  }) {
    await run("create compliance rule", () => mvpApi.createComplianceRule(input));
  }

  async function runComplianceChecks(phase: string) {
    if (!selectedEvent) return;
    await run("run compliance", () => mvpApi.runCompliance(selectedEvent.id, phase));
  }

  async function resolveComplianceCheck(checkId: string) {
    if (!selectedEvent) return;
    await run("resolve compliance", () =>
      mvpApi.resolveCompliance(selectedEvent.id, checkId, {
        action: "resolve",
        note: "Resolved during PMCM review.",
        actorName: "Ms. Mys",
      }),
    );
  }

  async function overrideComplianceCheck(checkId: string, reason: string) {
    if (!selectedEvent) return;
    await run("override compliance", () =>
      mvpApi.resolveCompliance(selectedEvent.id, checkId, {
        action: "override",
        overrideReason: reason,
        actorName: "Ms. Mys",
      }),
    );
  }

  async function createBillingSource(input: {
    sourceLabel: string;
    lineItems: Array<{ label: string; amount: number }>;
    paymentSchedule: Array<{ label: string; percentage: number }>;
  }) {
    if (!selectedEvent) return;
    await run("create billing source", () => mvpApi.createBillingSource(selectedEvent.id, input));
  }

  async function approveBillingSource(sourceId: string) {
    if (!selectedEvent) return;
    await run("approve billing source", () => mvpApi.approveBillingSource(selectedEvent.id, sourceId, "Approved by PMCM for billing generation."));
  }

  async function generateBillingStatement(sourceId: string) {
    if (!selectedEvent) return;
    await run("generate billing statement", () => mvpApi.generateBillingStatement(selectedEvent.id, sourceId));
  }

  async function loadCloseGates() {
    if (!selectedEvent) throw new Error("No event selected");
    return mvpApi.closeGates(selectedEvent.id);
  }

  async function archiveSelectedEvent(overrideReason?: string) {
    if (!selectedEvent) return;
    await run("archive event", () => mvpApi.archiveEvent(selectedEvent.id, overrideReason));
  }

  async function loadEventInsights() {
    if (!selectedEvent) throw new Error("No event selected");
    return mvpApi.eventInsights(selectedEvent.id);
  }

  async function generateEventInsights() {
    if (!selectedEvent) return;
    await run("generate insights", () => mvpApi.generateEventInsights(selectedEvent.id));
  }

  async function assignCoordinator(coordinator: MvpCoordinator, role: string, overrideConflict = false) {
    if (!selectedEvent) return;
    await run("coordinator assignment", () =>
      mvpApi.assignCoordinator(selectedEvent.id, {
        coordinatorId: coordinator.id,
        role,
        overrideConflict,
      }),
    );
  }

  async function createEventDayTask(input: {
    title: string;
    assignedRole?: string;
    ownerName?: string;
    priority?: string;
    notes?: string;
    slaDueAt?: string;
  }) {
    if (!selectedEvent) return;
    await runLiveOps("create event-day task", () => mvpApi.createEventDayTask(selectedEvent.id, input));
  }

  async function updateEventDayTask(taskId: string, input: { status?: "open" | "in_progress" | "done" | "blocked"; notes?: string }) {
    if (!selectedEvent) return;
    await runLiveOps("update event-day task", () => mvpApi.updateEventDayTask(selectedEvent.id, taskId, input));
  }

  async function escalateEventDayTask(
    taskId: string,
    input: { escalationLevel: "role_lead" | "pmcm" | "critical"; notes: string; ownerRole?: string; ownerName?: string },
  ) {
    if (!selectedEvent) return;
    await runLiveOps("escalate event-day task", () => mvpApi.escalateEventDayTask(selectedEvent.id, taskId, input));
  }

  async function createUrgentIssue(input: {
    title: string;
    severity?: "low" | "medium" | "high" | "critical";
    ownerRole?: string;
    description?: string;
    slaDueAt?: string;
  }) {
    if (!selectedEvent) return;
    await runLiveOps("create urgent issue", () => mvpApi.createUrgentIssue(selectedEvent.id, input));
  }

  async function updateUrgentIssue(issueId: string, input: { status?: "open" | "assigned" | "resolved" | "cancelled"; resolution?: string }) {
    if (!selectedEvent) return;
    await runLiveOps("update urgent issue", () => mvpApi.updateUrgentIssue(selectedEvent.id, issueId, input));
  }

  async function escalateUrgentIssue(
    issueId: string,
    input: { escalationLevel: "role_lead" | "pmcm" | "critical"; notes: string; ownerRole?: string; ownerName?: string },
  ) {
    if (!selectedEvent) return;
    await runLiveOps("escalate urgent issue", () => mvpApi.escalateUrgentIssue(selectedEvent.id, issueId, input));
  }

  async function updateCoordinatorAttendance(
    assignmentId: string,
    input: { status: "present" | "late" | "absent" | "replaced"; notes?: string },
  ) {
    if (!selectedEvent) return;
    await runLiveOps("update coordinator attendance", () =>
      mvpApi.updateCoordinatorAttendance(selectedEvent.id, assignmentId, { ...input, markedBy: session.name }),
    );
  }

  async function replaceCoordinator(
    assignmentId: string,
    input: { replacementCoordinatorId: string; role: string; reason: string },
  ) {
    if (!selectedEvent) return;
    await runLiveOps("replace coordinator", () => mvpApi.replaceCoordinator(selectedEvent.id, assignmentId, input));
  }

  async function verifySupplierStatus(
    requestId: string,
    input: { verificationStatus: "self_reported" | "verified" | "disputed"; notes?: string },
  ) {
    if (!selectedEvent) return;
    await runLiveOps("verify supplier setup", () =>
      mvpApi.verifySupplierStatus(selectedEvent.id, requestId, { ...input, verifiedBy: session.name }),
    );
  }

  function openSupplierEvent(eventId: string) {
    setSelectedEventId(eventId);
    setSection("events");
    setTab("overview");
  }

  const shellNavItems = [
    { id: "events", icon: Radio, label: "Events", badge: unreviewedInquiries },
    { id: "suppliers", icon: Tags, label: "Suppliers" },
    { id: "audit", icon: ShieldCheck, label: "Audit trail" },
  ];

  const commandActions = defenseReadiness?.nextActions.map((action) => ({
    id: action.key,
    label: action.label,
    description: action.detail,
    status: action.status,
    onSelect: () => setTab(action.targetTab as DetailTab),
  })) ?? [
    {
      id: "review-inquiries",
      label: "Review inquiries",
      description: "Accept a qualified inquiry and unlock the conforme path.",
      onSelect: () => setSection("events"),
    },
    {
      id: "supplier-desk",
      label: "Open supplier desk",
      description: "Review quote coverage and supplier readiness without leaving PMCM command.",
      onSelect: () => setSection("suppliers"),
    },
  ];
  const openActionCount = defenseReadiness?.nextActions.length ?? pendingApprovals.length + unreviewedInquiries;
  const selectedEventActions = selectedEvent ? (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" className="rounded-lg font-bold" onClick={() => run("briefing", () => mvpApi.submitBriefing(selectedEvent.id))}>
        Submit briefing
      </Button>
      <Button size="sm" variant="outline" className="rounded-lg font-bold" onClick={() => setTab("suppliers")}>
        Supplier desk
      </Button>
      <Button size="sm" variant="outline" className="rounded-lg font-bold" onClick={() => setTab("live-ops")}>
        Live ops
      </Button>
    </div>
  ) : null;

  const openCheckCount = checks.filter((item) => item.status === "open").length;
  const eventTabItems = buildEventWorkflowTabs({
    draftsCount: drafts.length,
    quotesCount: quotes.length,
    assignmentsCount: assignments.length,
    paymentsCount: payments.length,
    openChecksCount: openCheckCount,
  });

  const eventRail = (
    <EventQueuePanel
      events={events}
      selectedEventId={selectedEvent?.id}
      onReset={() => run("reset", mvpApi.reset)}
      onSelectEvent={(eventId) => {
        setSection("events");
        setSelectedEventId(eventId);
        setTab("overview");
      }}
    />
  );

  return (
    <PrismDashboardShell
      productLabel="P.R.I.S.M"
      roleLabel="PMCM Event Command"
      eyebrow="Operations cockpit"
      title={selectedEvent?.eventName ?? "Event Manager"}
      description="Conforme gates, floorplans, suppliers, billing, compliance, live operations, and closure in one command surface."
      activeItemId={section}
      navItems={shellNavItems}
      onNavSelect={(id) => setSection(id as "events" | "suppliers" | "audit")}
      user={{ name: session.name, detail: label(session.role), initials: session.name.slice(0, 2).toUpperCase() }}
      searchPlaceholder="Search events, approval requests, suppliers..."
      commandActions={commandActions}
      onSignOut={onSignOut}
      rightRail={section === "events" ? eventRail : undefined}
    >
      <section className="min-w-0 space-y-4">
        {error && (
          <Alert variant="destructive" className="rounded-xl">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {section === "suppliers" ? (
          <SupplierDirectory
            categories={supplierCategories}
            suppliers={suppliers}
            onToggleBni={toggleSupplierBni}
            onCreateSupplier={createSupplier}
            onUpdateSupplier={updateSupplierProfile}
            onChangeTier={changeSupplierTier}
            onAddReview={addSupplierReview}
            onAddCertification={addSupplierCertification}
            onOpenEvent={openSupplierEvent}
            busy={Boolean(busy)}
          />
        ) : section === "audit" ? (
          <AuditTrailPanel events={events} users={state.users} session={session} />
        ) : (
          <>

        <Panel title="Admin approvals" icon={ShieldCheck}>
          {pendingApprovals.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="No pending approvals" description="New account requests will appear here for review." />
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {pendingApprovals.map((request) => (
                <div key={request.id} className="rounded-xl border border-border bg-secondary/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">{request.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{request.email}</p>
                      <p className="mt-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-(--prism-amber)">
                        {label(request.role)} · {request.organization}
                      </p>
                    </div>
                    <StatusBadge status={request.status} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={!!busy}
                      onClick={() => run("approve account", () => mvpApi.approveApprovalRequest(request.id))}
                      className="rounded-lg font-bold"
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!busy}
                      onClick={() => run("decline account", () => mvpApi.declineApprovalRequest(request.id))}
                      className="rounded-lg font-bold"
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <InquiryIntakeLog
          inquiries={state.inquiries}
          onAccept={acceptInquiry}
          onPend={pendInquiry}
          onDecline={declineInquiry}
          busy={Boolean(busy)}
        />

        <ClientOnboardingTracker
          inquiries={state.inquiries}
          onUploadConforme={uploadConformeForInquiry}
          onSendReminder={sendConformeReminder}
          busy={Boolean(busy)}
        />

        {selectedEvent ? (
          <>
            <SelectedEventCockpit
              event={selectedEvent}
              defenseReadiness={defenseReadiness}
              openActionCount={openActionCount}
              action={selectedEventActions}
            />

            {defenseReadiness && <DefenseControlPanel defenseReadiness={defenseReadiness} onSelectTab={setTab} />}

            <SelectedEventStatusSummary
              drafts={drafts}
              activeDraft={activeDraft}
              quoteRequestCount={quoteRequests.length}
              quoteCount={quotes.length}
              openCheckCount={openCheckCount}
            />

            <EventWorkflowTabs items={eventTabItems} activeTab={tab} onSelectTab={setTab} />

            {tab === "overview" && (
              <EventOverviewPanels
                event={selectedEvent}
                defenseReadiness={defenseReadiness}
                drafts={drafts}
                activeDraft={activeDraft}
                quoteRequestCount={quoteRequests.length}
                quoteCount={quotes.length}
                openCheckCount={openCheckCount}
                onSubmitBriefing={() => run("briefing", () => mvpApi.submitBriefing(selectedEvent.id))}
                onOpenSupplierDesk={() => setTab("suppliers")}
                onRunCompliance={() => run("compliance", () => mvpApi.runCompliance(selectedEvent.id, "planning"))}
                onOpenCoordinatorDesk={() => setTab("coordinators")}
                onOpenLiveOps={() => setTab("live-ops")}
                onOpenFloorplans={() => setTab("floorplans")}
                onOpenBilling={() => setTab("billing")}
                onOpenClosure={() => setTab("closure")}
              />
            )}

            {tab === "floorplans" && (
              <div className="space-y-4">
                <Panel title="Start PMCM draft" icon={MapPinned}>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {PRESETS.slice(0, 4).map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => run("create floorplan", () => createPreset(preset))}
                        className="rounded-xl border border-border bg-secondary/60 p-4 text-left transition hover:border-primary/35 hover:bg-secondary"
                      >
                        <p className="text-sm font-bold text-foreground">{preset.name}</p>
                        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{preset.description}</p>
                      </button>
                    ))}
                  </div>
                </Panel>
                <Panel title="Floorplan drafts and client preferences" icon={LayoutGrid}>
                  {drafts.length === 0 ? (
                    <EmptyState icon={LayoutGrid} title="No floorplan drafts yet" description="Pick a preset above to create the first PMCM draft for this event." />
                  ) : (
                    <div className="grid gap-3 xl:grid-cols-3">
                      {drafts.map((draft) => (
                        <div key={draft.id} className="rounded-xl border border-border bg-secondary/40 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-foreground">{draft.name}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">{label(draft.sourceType)} · {draft.createdByRole ?? "pmcm-admin"}</p>
                            </div>
                            <StatusBadge status={draft.status} />
                          </div>
                          {draft.clientPreference && (
                            <div className="mt-3 rounded-lg border border-border bg-card p-3 text-xs leading-5 text-muted-foreground">
                              <p><span className="font-bold text-foreground">Seating:</span> {draft.clientPreference.seatingStyle}</p>
                              <p><span className="font-bold text-foreground">Stage:</span> {draft.clientPreference.stagePreference}</p>
                            </div>
                          )}
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" className="rounded-lg font-bold" onClick={() => run("open draft", () => onOpenEditor(selectedEvent, draft))}>Open/Edit</Button>
                            {draft.status !== "in_review" && draft.status !== "approved" && (
                              <Button size="sm" className="rounded-lg font-bold" onClick={() => run("submit draft", () => mvpApi.submitFloorPlanDraft(selectedEvent.id, draft.id))}>Submit</Button>
                            )}
                            {draft.status !== "approved" && (
                              <Button size="sm" variant="outline" className="rounded-lg border-(--prism-success)/25 bg-(--prism-success)/8 font-bold text-(--prism-success) hover:bg-(--prism-success)/12" onClick={() => run("approve draft", () => mvpApi.approveFloorPlanDraft(selectedEvent.id, draft.id))}>Approve</Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              </div>
            )}

            {tab === "briefing" && (
              <Panel title="Briefing" icon={FileCheck2}>
                {briefing ? (
                  <div className="divide-y divide-border text-sm">
                    {[
                      { label: "Venue", value: briefing.venue },
                      { label: "Guest count", value: briefing.guestCount },
                      { label: "Budget range", value: briefing.budgetRange },
                      { label: "Services", value: briefing.serviceRequirements.join(", ") },
                    ].map(({ label: lbl, value }) => (
                      <div key={lbl} className="flex items-start justify-between gap-4 py-2.5 not-last:border-b not-last:border-border">
                        <span className="shrink-0 font-semibold text-muted-foreground">{lbl}</span>
                        <span className="text-right font-semibold text-foreground">{value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={FileCheck2} title="No briefing submitted yet" description="Use the quick action above to submit a demo briefing for this event." />
                )}
              </Panel>
            )}

            {tab === "suppliers" && (
              <Panel title="Supplier desk" icon={Truck}>
                <SupplierQuotePlanner
                  categories={supplierCategories}
                  suppliers={suppliers}
                  requests={quoteRequests}
                  quotes={quotes}
                  onRequestQuotes={requestSupplierQuotes}
                  onSelectQuote={selectSupplierQuote}
                  busy={Boolean(busy)}
                />
              </Panel>
            )}

            {tab === "coordinators" && selectedEvent && (
              <CoordinatorAssignmentDesk
                event={selectedEvent}
                coordinators={coordinators}
                assignments={state.coordinatorAssignments}
                roleRequirements={coordinatorRoleRequirements}
                busy={Boolean(busy)}
                onAssign={assignCoordinator}
              />
            )}

            {tab === "live-ops" && selectedEvent && (
              <LiveOperationsWorkspace
                event={selectedEvent}
                liveOps={liveOps}
                statusFeed={statusFeed}
                coordinators={coordinators}
                busy={Boolean(busy)}
                onReload={loadLiveOps}
                onCreateTask={createEventDayTask}
                onUpdateTask={updateEventDayTask}
                onEscalateTask={escalateEventDayTask}
                onCreateIssue={createUrgentIssue}
                onUpdateIssue={updateUrgentIssue}
                onEscalateIssue={escalateUrgentIssue}
                onUpdateCoordinatorAttendance={updateCoordinatorAttendance}
                onReplaceCoordinator={replaceCoordinator}
                onVerifySupplierStatus={verifySupplierStatus}
              />
            )}

            {tab === "billing" && (
              <FinancialWorkspace
                event={selectedEvent}
                inquiry={selectedInquiry}
                billingStatements={billingStatements}
                payments={payments}
                notificationLogs={notificationLogs}
                busy={Boolean(busy)}
                onRecordPayment={recordPayment}
                onSendBilling={sendBillingStatement}
              />
            )}

            {tab === "closure" && (
              <Phase4Workspace
                event={selectedEvent}
                rules={complianceRules}
                checks={checks}
                billingSources={billingSources}
                billingStatements={billingStatements}
                insights={eventInsights}
                busy={Boolean(busy)}
                onCreateRule={createComplianceRule}
                onRunCompliance={runComplianceChecks}
                onResolveCompliance={resolveComplianceCheck}
                onOverrideCompliance={overrideComplianceCheck}
                onCreateBillingSource={createBillingSource}
                onApproveBillingSource={approveBillingSource}
                onGenerateBillingStatement={generateBillingStatement}
                onLoadCloseGates={loadCloseGates}
                onArchive={archiveSelectedEvent}
                onLoadInsights={loadEventInsights}
                onGenerateInsights={generateEventInsights}
              />
            )}

            {tab === "activity" && (
              <Panel title="Activity and notifications" icon={MessageSquareText}>
                <div className="space-y-3">
                  {notificationLogs.length > 0 && (
                    <div className="rounded-lg border border-border bg-secondary/35 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-black text-foreground">Queued client notifications</p>
                          <p className="mt-1 text-xs text-muted-foreground">Local defense queue only; production delivery adapters stay deferred.</p>
                        </div>
                        <StatusBadge status="pending" label={`${notificationLogs.length} queued`} />
                      </div>
                      <div className="mt-3 grid gap-2">
                        {notificationLogs.map((notification) => (
                          <div key={notification.id} className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border bg-card p-3 text-sm">
                            <div className="min-w-0">
                              <p className="font-black text-foreground">{label(notification.channel)} to {notification.recipient}</p>
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{notification.message}</p>
                            </div>
                            <StatusBadge status={notification.status} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {assignments.map((assignment: MvpCoordinatorAssignment) => (
                    <div key={assignment.id} className="rounded-md border border-border bg-muted p-3 text-sm">
                      <p className="font-black">{assignment.coordinatorName}</p>
                      <p className="mt-1 text-muted-foreground">{assignment.role} · {label(assignment.status)}</p>
                    </div>
                  ))}
                  {audit.map((item) => (
                    <div key={item.id} className="flex gap-3 rounded-md bg-background p-3 text-sm">
                      <Clock3 className="mt-0.5 size-4 text-(--prism-amber)" />
                      <div><p className="font-black">{item.action}</p><p className="text-muted-foreground">{item.actor}</p></div>
                    </div>
                  ))}
                  {notificationLogs.length === 0 && assignments.length === 0 && audit.length === 0 && (
                    <EmptyState icon={MessageSquareText} title="No selected-event activity yet" description="Coordinator acknowledgments, queued notifications, and audit entries will appear here after actions run." />
                  )}
                </div>
              </Panel>
            )}
          </>
        ) : (
          <Panel title="No confirmed events" icon={AlertTriangle}>
            <p className="text-sm text-muted-foreground">Accept an inquiry and upload signed conforme to create the first PMCM event workspace.</p>
          </Panel>
        )}
          </>
        )}
      </section>
    </PrismDashboardShell>
  );
}

export default function EventCommandHome() {
  const [session, setSession] = useState<EventSession | null>(null);
  const [state, setState] = useState<MvpDemoState | null>(null);
  const [coordinatorState, setCoordinatorState] = useState<MvpCoordinatorWorkspace | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "portal" });
  const [error, setError] = useState<string | null>(null);

  async function refresh(current = session) {
    if (!current) return;
    if (current.role === "coordinator") {
      const next = await mvpApi.coordinatorWorkspace(current);
      setCoordinatorState(next);
      setState(null);
      return;
    }
    const next = await mvpApi.pmcmState();
    setState(next);
    setCoordinatorState(null);
  }

  useEffect(() => {
    const current = readSession();
    if (!current) return;
    setSession(current);
    refresh(current).catch((err) => setError(err instanceof Error ? err.message : "Unable to load event portal"));
  }, []);

  useEffect(() => {
    if (!session || screen.name !== "portal") return;
    const intervalId = window.setInterval(() => {
      refresh(session).catch((err) => setError(err instanceof Error ? err.message : "Unable to refresh event portal"));
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, [session, screen.name]);

  async function openEditor(event: MvpEvent, draft: MvpFloorPlanDraft, preset?: Preset) {
    const fallback = buildProject(event, draft, preset);
    const project = preset ? fallback : await mvpApi.loadPlan(draft.floorPlanId, fallback);
    if (preset) await mvpApi.savePlan(project);
    setScreen({ name: "editor", event, draft, project });
  }

  if (!session) return <SignIn onSignedIn={(next) => { setSession(next); refresh(next).catch((err) => setError(err instanceof Error ? err.message : "Unable to load event portal")); }} />;

  if (screen.name === "editor") {
    return (
      <div className="h-screen w-full overflow-hidden">
        <EditorShell
          project={screen.project}
          eventName={screen.event.eventName}
          draftName={screen.draft.name}
          draftStatus={screen.draft.status}
          onSave={(project) => mvpApi.savePlan(project)}
          onSubmit={async (project) => {
            await mvpApi.savePlan(project);
            await mvpApi.submitFloorPlanDraft(screen.event.id, screen.draft.id);
            await refresh(session);
            setScreen({ name: "portal" });
          }}
          onBack={() => setScreen({ name: "portal" })}
        />
      </div>
    );
  }

  const signOut = () => {
    window.localStorage.removeItem(EVENT_SESSION_KEY);
    setSession(null);
    setState(null);
    setCoordinatorState(null);
  };
  const isLoadingRoleData = session.role === "coordinator" ? !coordinatorState : !state;

  if (session.role !== "coordinator" && state) {
    return (
      <PmcmPortal
        session={session}
        state={state}
        onRefresh={() => refresh(session)}
        onOpenEditor={openEditor}
        onSignOut={signOut}
      />
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Brand session={session} onSignOut={signOut} />
      <section className="mx-auto max-w-[1480px] px-5 py-6 sm:px-8">
        {error && (
          <Alert variant="destructive" className="mb-5 rounded-lg">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {isLoadingRoleData ? (
          <Card className="min-h-[420px] rounded-lg border-primary/12 bg-card p-6" aria-live="polite">
            <div className="mx-auto grid max-w-2xl gap-4 py-10 text-center">
              <span className="mx-auto grid size-11 place-items-center rounded-lg bg-secondary text-primary">
                <Radio className="size-5" />
              </span>
              <div>
                <p className="text-sm font-black text-foreground">
                  Loading {session.role === "coordinator" ? "coordinator" : "PMCM"} command data
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {session.role === "coordinator"
                    ? "Role-safe assignments, attendance state, and event-day queues are being prepared."
                    : "Events, finance, close gates, and local notification queue are being prepared."}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {(session.role === "coordinator" ? ["Assignment", "Role queue", "Issues"] : ["Events", "Finance", "Closure"]).map((item) => (
                  <span key={item} className="h-10 rounded-md border border-border bg-secondary/45" />
                ))}
              </div>
            </div>
          </Card>
        ) : session.role === "coordinator" && coordinatorState ? (
          <CoordinatorView session={session} state={coordinatorState} onRefresh={() => refresh(session)} />
        ) : (
          null
        )}
      </section>
    </main>
  );
}
