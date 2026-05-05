"use client";

import type { ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Flower2,
  Gauge,
  LockKeyhole,
  Mail,
  MapPinned,
  MessageSquareText,
  PartyPopper,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Warehouse,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "../ui/navigation-menu";
import { PrismLifecycleStrip, PrismPublicRoleGrid } from "@prism/ui/public-blocks";

const lifecycleSteps = [
  { label: "Inquiry", description: "Submit event basics through the public form.", state: "current" as const },
  { label: "PMCM review", description: "Ms. Mys and the PMCM team screen scope and fit.", state: "pending" as const },
  { label: "Conforme", description: "Client portal opens only after acceptance and signed conforme.", state: "pending" as const },
  { label: "Planning", description: "Briefing, billing, documents, suppliers, and official floorplan align.", state: "pending" as const },
  { label: "Event day", description: "PMCM runs live operations, issue escalation, and closure.", state: "pending" as const },
];

const roleCards = [
  {
    title: "Start with inquiry",
    badge: "Inquiry first",
    description: "Share the event brief publicly so PMCM can review fit, scope, dates, and next steps before any workspace opens.",
    href: "/inquiry",
    actionLabel: "Start inquiry",
    icon: <FileCheck2 className="size-5" />,
  },
  {
    title: "Wait for PMCM acceptance",
    badge: "Conforme gate",
    description: "Client access begins after PMCM accepts the inquiry and the signed conforme is on file.",
    href: "/sign-in",
    actionLabel: "Client sign-in",
    icon: <ShieldCheck className="size-5" />,
  },
  {
    title: "Review the event workspace",
    badge: "Client view",
    description: "Track billing, documents, PMCM updates, layout preferences, and published official floorplans in one place.",
    icon: <MapPinned className="size-5" />,
  },
];

const platformFeatures = [
  {
    icon: ClipboardCheck,
    title: "Public inquiry intake",
    text: "Capture structured event briefs, client type, referral source, dates, and early risk notes before PMCM accepts work.",
  },
  {
    icon: ShieldCheck,
    title: "Conforme approval gate",
    text: "Keep client access, billing, briefing, and event workspace creation tied to signed approval.",
  },
  {
    icon: MapPinned,
    title: "Official layout workflow",
    text: "Share room preferences, then review the approved layout when PMCM publishes it for the event.",
  },
  {
    icon: Gauge,
    title: "Planning checks",
    text: "Keep pre-event requirements, payment milestones, supplier status, and event-day needs visible.",
  },
  {
    icon: Warehouse,
    title: "Supplier coordination",
    text: "Replace scattered quote requests with supplier records, confirmations, ingress windows, and status updates.",
  },
  {
    icon: UserCheck,
    title: "Coordinator assignments",
    text: "Assign roles, track acknowledgments, prevent double-booking, and give each coordinator only the relevant operational view.",
  },
  {
    icon: PartyPopper,
    title: "Guest moments",
    text: "Support check-in, engagement, and post-event feedback while keeping all guest submissions moderated.",
  },
  {
    icon: ReceiptText,
    title: "Billing and archive",
    text: "Carry payment milestones, important notes, files, and closure documents into one event memory.",
  },
];

const comparison = [
  { tool: "Excel", prism: "Live event state, approvals, and planning signals" },
  { tool: "Viber", prism: "Structured supplier and coordinator acknowledgments" },
  { tool: "Google Drive", prism: "Per-event file hub with lifecycle context" },
  { tool: "Canva / PowerPoint", prism: "Proposal artifacts connected to approvals" },
  { tool: "Email", prism: "Traceable requests, decisions, and approval history" },
];

function BrandMark({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <div className="flex items-center gap-3">
      <Flower2 className={tone === "dark" ? "size-11 fill-primary text-primary" : "size-11 fill-primary text-primary"} strokeWidth={1.8} />
      <div>
        <p className={tone === "dark" ? "text-3xl font-black leading-none tracking-normal text-(--prism-ink)" : "text-3xl font-black leading-none tracking-normal text-sidebar-foreground"}>PMCM</p>
        <p className={tone === "dark" ? "mt-1 text-xs font-black uppercase tracking-[0.42em] text-muted-foreground" : "mt-1 text-xs font-black uppercase tracking-[0.42em] text-sidebar-foreground/75"}>P.R.I.S.M</p>
      </div>
    </div>
  );
}

function HeroTrustStrip() {
  const items = [
    { icon: UserCheck, title: "PMCM-led planning" },
    { icon: MapPinned, title: "Official layout review" },
    { icon: ReceiptText, title: "Clear billing" },
    { icon: FileCheck2, title: "Document handoff" },
  ];

  return (
    <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-4">
      {items.map(({ icon: Icon, title }) => (
        <div key={title} className="text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary/8 text-primary">
            <Icon className="size-6" />
          </span>
          <p className="mt-3 text-sm font-black text-foreground">{title}</p>
        </div>
      ))}
    </div>
  );
}

function ProductPanel() {
  return (
    <div className="relative min-h-[650px] overflow-hidden rounded-lg border border-primary/15 bg-card shadow-[0_34px_120px_rgba(23,18,22,0.16)]">
      <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(#CCECF4_1px,transparent_1px),linear-gradient(90deg,#CCECF4_1px,transparent_1px)] [background-size:34px_34px]" />
      <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,248,242,0.68),transparent_44%),radial-gradient(circle_at_82%_6%,rgba(192,24,103,0.12),transparent_34%)]" />
      <div className="absolute inset-y-0 left-0 hidden w-16 flex-col items-center gap-6 rounded-l-lg bg-(--prism-ink) py-8 text-sidebar-foreground lg:flex">
        {[MapPinned, ReceiptText, FileCheck2, UserCheck, MessageSquareText, Gauge].map((Icon, index) => (
          <span key={index} className={index === 0 ? "grid size-9 place-items-center rounded-md bg-white/14 text-white" : "grid size-9 place-items-center rounded-md text-white/72"}>
            <Icon className="size-5" />
          </span>
        ))}
      </div>

      <div className="absolute left-6 right-6 top-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-primary/10 bg-card/86 p-4 backdrop-blur lg:left-[5.5rem]">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
            <MapPinned className="size-5" />
          </span>
          <div>
            <p className="text-xl font-black text-foreground">Your event workspace</p>
            <p className="mt-1 text-sm text-muted-foreground">Confirmed event · PMCM-guided planning</p>
          </div>
        </div>
        <button className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-bold text-foreground">
          Planning overview
        </button>
      </div>

      <div className="absolute left-7 right-7 top-28 grid gap-4 lg:left-[5.5rem] lg:grid-cols-[1fr_0.72fr]">
        <div className="rounded-lg border border-primary/12 bg-card/88 p-4 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Official floorplan review</p>
              <h2 className="mt-2 text-2xl font-black leading-tight text-foreground">Approved ballroom layout</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Review the approved layout with guest flow, entrances, and service access.</p>
            </div>
            <Badge variant="outline" className="rounded-full border-border bg-secondary text-muted-foreground">Read-only</Badge>
          </div>
          <div className="mt-4 grid aspect-[1.58] gap-2 rounded-lg border border-border bg-secondary/45 p-4">
            <div className="grid grid-cols-[0.5fr_1.05fr_0.5fr] gap-2">
              <div className="rounded-md border border-primary/15 bg-card p-2 text-center text-[10px] font-black uppercase text-muted-foreground">BAR</div>
              <div className="rounded-md bg-(--prism-ink) p-2 text-center text-xs font-black uppercase tracking-wide text-sidebar-foreground">Stage</div>
              <div className="rounded-md border border-primary/15 bg-card p-2 text-center text-[10px] font-black uppercase text-muted-foreground">AV</div>
            </div>
            <div className="grid grid-cols-5 gap-2 px-5">
              {Array.from({ length: 15 }).map((_, index) => (
                <span key={index} className="aspect-square rounded-full border border-primary/20 bg-card shadow-sm" />
              ))}
            </div>
            <div className="grid grid-cols-[0.7fr_1fr_0.7fr] gap-2">
              <div className="rounded-md border border-primary/20 bg-card p-2 text-[10px] font-black uppercase text-muted-foreground">Guest flow</div>
              <div className="rounded-md border border-primary/20 bg-card p-2 text-center text-[10px] font-black uppercase text-primary">Registration</div>
              <div className="rounded-md border border-(--prism-amber)/25 bg-(--prism-amber)/10 p-2 text-[10px] font-black uppercase text-(--prism-amber)">Service access</div>
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          {[
            { title: "Conforme status", detail: "Accepted and signed.", icon: CheckCircle2, state: "done" },
            { title: "Billing milestone", detail: "Deposit paid · balance next.", icon: ReceiptText, state: "active" },
            { title: "Document checklist", detail: "Briefs and files in one place.", icon: FileCheck2, state: "active" },
            { title: "Activity", detail: "Recent PMCM updates.", icon: MessageSquareText, state: "active" },
          ].map(({ title, detail, icon: Icon, state }) => (
            <div key={title} className="rounded-lg border border-primary/12 bg-card/90 p-4 shadow-sm backdrop-blur">
              <div className="flex items-start gap-3">
                <span className={state === "done" ? "grid size-9 place-items-center rounded-md bg-(--prism-success)/10 text-(--prism-success)" : "grid size-9 place-items-center rounded-md bg-primary/10 text-primary"}>
                  <Icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-black text-foreground">{title}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{detail}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-7 left-7 right-7 grid gap-4 lg:left-[5.5rem] lg:grid-cols-[0.48fr_0.52fr]">
        <div className="rounded-lg border border-primary/12 bg-card/92 p-4 backdrop-blur">
          <p className="mb-3 text-sm font-black text-foreground">Document checklist</p>
          {["Event brief", "Signed conforme", "Floorplan preferences", "Catering proposal"].map((item, index) => (
            <div key={item} className="flex items-center justify-between border-b border-border py-2 last:border-0">
              <span className="text-sm text-muted-foreground">{item}</span>
              {index < 3 ? <BadgeCheck className="size-4 text-(--prism-success)" /> : <span className="size-4 rounded-full border border-border" />}
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-primary/12 bg-card/92 p-4 backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-black text-foreground">Activity</p>
            <span className="text-xs font-black text-primary">View all</span>
          </div>
          {[
            "Conforme accepted",
            "Official floorplan published for review",
            "Deposit payment recorded",
            "Event brief uploaded",
          ].map((item, index) => (
            <div key={item} className="flex gap-3 py-2">
              <span className={index < 3 ? "mt-1 size-2.5 rounded-full bg-(--prism-success)" : "mt-1 size-2.5 rounded-full border border-border"} />
              <span className="text-sm leading-5 text-muted-foreground">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <Badge variant="outline" className="mb-5 rounded-full border-[#F06030]/30 bg-accent/75 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-(--prism-amber)">
        {eyebrow}
      </Badge>
      <h2 className="text-4xl font-black leading-[0.98] text-foreground sm:text-5xl lg:text-6xl">{title}</h2>
      <p className="mt-5 text-lg leading-8 text-muted-foreground">{text}</p>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, text }: { icon: typeof ShieldCheck; title: string; text: string }) {
  return (
    <Card className="group gap-0 rounded-lg border-primary/12 bg-card/80 shadow-none transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(23,18,22,0.12)]">
      <CardHeader className="gap-4">
        <div className="grid size-11 place-items-center rounded-lg bg-(--prism-ink) text-sidebar-foreground transition duration-300 group-hover:bg-[#F06030]">
          <Icon className="size-5" />
        </div>
        <div>
          <CardTitle className="text-lg font-black text-foreground">{title}</CardTitle>
          <CardDescription className="mt-2 text-sm leading-6 text-muted-foreground">{text}</CardDescription>
        </div>
      </CardHeader>
    </Card>
  );
}

function DarkBand({ children }: { children: ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-(--prism-ink) px-5 py-20 text-sidebar-foreground sm:px-8 lg:px-10">
      <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,#FFFFFF_1px,transparent_0)] [background-size:28px_28px]" />
      <div className="absolute -right-40 -top-40 size-[34rem] rounded-full border border-(--prism-amber)/25" />
      <div className="relative mx-auto max-w-[1480px]">{children}</div>
    </section>
  );
}

export function MainLandingPage() {
  return (
    <main className="h-full overflow-y-auto bg-background text-foreground">
      <section className="relative min-h-screen px-5 py-5 sm:px-8 lg:px-10">
        <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_1px_1px,#C01867_1px,transparent_0)] [background-size:30px_30px]" />
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,248,242,0.96),rgba(233,247,251,0.76)_52%,rgba(255,248,242,0.95))]" />
        <div className="relative mx-auto max-w-[1320px]">
          <header className="bg-background/80 px-1 py-6 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <BrandMark />
              <NavigationMenu className="hidden lg:flex">
                <NavigationMenuList className="gap-1">
                  {[
                    ["Services", "#platform"],
                    ["Floorplans", "#floorplans"],
                    ["Planning", "#roles"],
                    ["Support", "#faq"],
                  ].map(([label, href]) => (
                    <NavigationMenuItem key={label}>
                      <NavigationMenuLink href={href} className={label === "Services" ? "rounded-md border-b-2 border-primary px-4 py-2 text-sm font-black text-foreground transition hover:text-primary" : "rounded-md px-4 py-2 text-sm font-black text-foreground transition hover:text-primary"}>
                        {label}
                      </NavigationMenuLink>
                    </NavigationMenuItem>
                  ))}
                </NavigationMenuList>
              </NavigationMenu>
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" className="hidden h-11 rounded-md font-bold md:inline-flex">
                  <a href="/sign-in">
                    <LockKeyhole data-icon="inline-start" />
                    Sign in
                  </a>
                </Button>
                <Button asChild className="h-11 rounded-md font-black shadow-[0_16px_36px_rgba(192,24,103,0.22)]">
                  <a href="/inquiry">
                    <Mail data-icon="inline-start" />
                    Start inquiry
                  </a>
                </Button>
              </div>
            </div>
          </header>

          <div className="grid min-h-[calc(100vh-5.5rem)] items-start gap-12 py-14 lg:grid-cols-[minmax(0,0.92fr)_minmax(520px,0.78fr)] xl:py-20">
            <div className="max-w-5xl">
              <Badge variant="outline" className="mb-7 rounded-full border-[#F06030]/30 bg-accent/75 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-(--prism-amber)">
                <Sparkles className="size-4" />
                PMCM-led client planning
              </Badge>
              <h1 className="max-w-4xl prism-serif text-4xl font-black leading-[0.93] tracking-normal text-(--prism-ink) sm:text-5xl lg:text-[3.75rem] xl:text-[4.55rem]">
                Your event plan, floorplan, and approvals in one <span className="text-primary">guided workspace</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground xl:text-lg xl:leading-8">
                Start with a PMCM inquiry, then review approved layouts, billing, documents, and activity in one place.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button asChild className="h-12 rounded-full px-5 text-sm font-black uppercase tracking-[0.14em] shadow-[0_18px_40px_rgba(23,18,22,0.24)]">
                  <a href="/inquiry">
                    Start an inquiry <ArrowRight data-icon="inline-end" />
                  </a>
                </Button>
                <Button asChild variant="outline" className="h-12 rounded-full px-5 text-sm font-black uppercase tracking-[0.14em]">
                  <a href="/sign-in">
                    <LockKeyhole data-icon="inline-start" />
                    Sign in
                  </a>
                </Button>
              </div>
              <HeroTrustStrip />
            </div>

            <ProductPanel />
          </div>
        </div>
      </section>

      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1320px] gap-5 rounded-lg border border-primary/12 bg-card p-7 shadow-[0_20px_70px_rgba(23,18,22,0.08)] md:grid-cols-4">
          {[
            [UserCheck, "PMCM-led planning", "Every step is guided by PMCM from inquiry to event day."],
            [ShieldCheck, "Official layout review", "PMCM owns the official floorplan and shares approved views."],
            [ReceiptText, "Clear billing", "Milestones and dates stay visible, with no surprises."],
            [FileCheck2, "Document handoff", "Files, briefs, and approvals live in one event record."],
          ].map(([Icon, title, text]) => {
            const IconComponent = Icon as typeof UserCheck;
            return (
              <div key={title as string} className="flex items-start gap-4 border-border md:not-last:border-r md:not-last:pr-5">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/8 text-primary"><IconComponent className="size-5" /></span>
                <span>
                  <span className="block font-black text-foreground">{title as string}</span>
                  <span className="mt-1 block text-sm leading-5 text-muted-foreground">{text as string}</span>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section id="platform" className="px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1320px] gap-8 lg:grid-cols-[0.34fr_0.66fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Your workspace</p>
            <h2 className="mt-4 prism-serif text-4xl font-black leading-[0.98] text-(--prism-ink) sm:text-5xl">Everything you need, all in one place</h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">From the official floorplan to billing, documents, and activity, stay informed and in control as your event comes to life.</p>
            <div className="mt-6 grid gap-3 text-sm text-muted-foreground">
              {["Read-only official floorplans", "Milestone billing with dates", "Documents organized by stage", "Activity updates from PMCM"].map((item) => (
                <span key={item} className="flex items-center gap-2"><CheckCircle2 className="size-4 text-(--prism-success)" />{item}</span>
              ))}
            </div>
            <a href="#floorplans" className="mt-6 inline-flex items-center gap-2 text-sm font-black text-primary">See how it works <ArrowRight className="size-4" /></a>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_0.48fr]">
            <div className="rounded-lg border border-primary/12 bg-card p-5 shadow-[0_22px_70px_rgba(23,18,22,0.1)]">
              <div className="mb-4 flex items-center justify-between">
                <p className="font-black text-foreground">Official floorplan review</p>
                <Badge variant="outline" className="rounded-full bg-secondary text-muted-foreground">Read-only</Badge>
              </div>
              <div className="grid aspect-[1.5] gap-2 rounded-lg border border-border bg-secondary/45 p-4">
                <div className="grid grid-cols-[0.52fr_1.08fr_0.52fr] gap-2">
                  <span className="rounded-md border border-primary/15 bg-card p-2 text-center text-[10px] font-black uppercase text-muted-foreground">Bar</span>
                  <span className="rounded-md bg-(--prism-ink) p-2 text-center text-xs font-black uppercase text-sidebar-foreground">Stage</span>
                  <span className="rounded-md border border-primary/15 bg-card p-2 text-center text-[10px] font-black uppercase text-muted-foreground">AV</span>
                </div>
                <div className="grid grid-cols-5 gap-2 px-5">
                  {Array.from({ length: 15 }).map((_, index) => <span key={index} className="aspect-square rounded-full border border-primary/20 bg-card" />)}
                </div>
                <div className="grid grid-cols-[0.7fr_1fr_0.7fr] gap-2">
                  <span className="rounded-md border border-primary/20 bg-card p-2 text-[10px] font-black uppercase text-primary">Guest flow</span>
                  <span className="rounded-md border border-primary/20 bg-card p-2 text-center text-[10px] font-black uppercase text-muted-foreground">Registration</span>
                  <span className="rounded-md border border-(--prism-amber)/25 bg-(--prism-amber)/10 p-2 text-[10px] font-black uppercase text-(--prism-amber)">Service access</span>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-lg border border-primary/12 bg-card p-5 shadow-[0_18px_60px_rgba(23,18,22,0.08)]">
                <p className="font-black text-foreground">Billing milestone</p>
                <p className="mt-4 text-sm font-black text-[#F06030]">Deposit paid</p>
                <div className="mt-4 h-2 rounded-full bg-secondary"><div className="h-2 w-2/5 rounded-full bg-[#F06030]" /></div>
                <p className="mt-3 text-xs text-muted-foreground">Next: Balance due</p>
              </div>
              <div className="rounded-lg border border-primary/12 bg-card p-5 shadow-[0_18px_60px_rgba(23,18,22,0.08)]">
                <p className="font-black text-foreground">Document checklist</p>
                {["Event brief", "Signed conforme", "Floorplan preferences", "Catering proposal"].map((item, index) => (
                  <div key={item} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
                    <span className="text-muted-foreground">{item}</span>
                    {index < 3 ? <CheckCircle2 className="size-4 text-(--prism-success)" /> : <span className="size-4 rounded-full border border-border" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="roles" className="border-y border-primary/10 bg-card px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-[1320px]">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Your event life cycle</p>
          <div className="mt-4 grid gap-8 lg:grid-cols-[0.32fr_0.68fr] lg:items-center">
            <h2 className="prism-serif text-4xl font-black leading-[0.98] text-(--prism-ink) sm:text-5xl">Guided from inquiry to closure</h2>
            <div className="grid gap-4 md:grid-cols-6">
              {[
                [Mail, "Inquiry", "Start your inquiry with PMCM."],
                [UserCheck, "PMCM review", "We review scope, space, and goals."],
                [ShieldCheck, "Conforme", "Sign conforme to unlock planning."],
                [MapPinned, "Planning", "Review layouts, documents, and billing."],
                [PartyPopper, "Event day", "Coordinated execution and support."],
                [Warehouse, "Closure", "Final documents and records handed off."],
              ].map(([Icon, title, text]) => {
                const IconComponent = Icon as typeof Mail;
                return (
                  <div key={title as string} className="text-center">
                    <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary/8 text-primary"><IconComponent className="size-5" /></span>
                    <p className="mt-3 text-sm font-black text-foreground">{title as string}</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{text as string}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <DarkBand>
        <div id="floorplans" className="grid gap-10 lg:grid-cols-[0.34fr_0.66fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Official floorplan control</p>
            <h2 className="mt-4 prism-serif text-4xl font-black leading-[0.98] text-sidebar-foreground sm:text-5xl">Review layouts with confidence</h2>
            <p className="mt-5 text-lg leading-8 text-sidebar-foreground/75">PMCM creates and controls the official floorplans so accuracy, safety, and version history stay protected from the start.</p>
            <div className="mt-6 grid gap-3 text-sm text-sidebar-foreground/75">
              {["To-scale accuracy", "Safety and access validation", "Change-controlled versions"].map((item) => (
                <span key={item} className="flex items-center gap-2"><CheckCircle2 className="size-4 text-(--prism-success)" />{item}</span>
              ))}
            </div>
            <Button asChild variant="outline" className="mt-8 h-11 rounded-md border-white/25 bg-transparent font-black text-sidebar-foreground hover:bg-card hover:text-foreground">
              <a href="/inquiry">Learn more about floorplans</a>
            </Button>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {["Banquet layout", "Conference layout", "Reception layout"].map((title, index) => (
              <div key={title} className="rounded-lg border border-white/12 bg-card p-4 text-foreground shadow-[0_26px_80px_rgba(0,0,0,0.24)]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="font-black">{title}</p>
                  <Badge variant="outline" className={index === 2 ? "rounded-full border-[#F06030]/25 bg-[#F06030]/10 text-[#F06030]" : "rounded-full border-(--prism-success)/25 bg-(--prism-success)/10 text-(--prism-success)"}>{index === 2 ? "In review" : "Approved"}</Badge>
                </div>
                <div className="grid aspect-[0.86] gap-2 rounded-md border border-border bg-secondary/45 p-3">
                  <span className="rounded bg-(--prism-ink) p-1 text-center text-[10px] font-black uppercase text-sidebar-foreground">Stage</span>
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: index === 1 ? 12 : 9 }).map((_, tableIndex) => <span key={tableIndex} className="aspect-square rounded-full border border-primary/20 bg-card" />)}
                  </div>
                  <span className="rounded border border-primary/15 bg-card p-1 text-center text-[10px] font-black uppercase text-muted-foreground">Registration</span>
                </div>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">{index === 0 ? "Ideal for dinners and galas." : index === 1 ? "Built for presentations and sessions." : "Perfect for networking and receptions."}</p>
              </div>
            ))}
          </div>
        </div>
      </DarkBand>

      <section className="px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-4xl text-center">
          <p className="font-display text-6xl font-black text-primary">"</p>
          <p className="prism-serif text-2xl font-black leading-9 text-(--prism-ink)">PMCM's clarity and process gave us confidence at every step. Our floorplan was perfect, billing was transparent, and everything was in one place.</p>
          <div className="mt-5 text-primary">*****</div>
          <p className="mt-2 text-sm font-black text-muted-foreground">PMCM Client</p>
        </div>

        <div className="mx-auto mt-14 grid max-w-[1040px] gap-6 rounded-lg border border-primary/12 bg-card p-8 shadow-[0_24px_80px_rgba(23,18,22,0.08)] md:grid-cols-[0.32fr_0.68fr] md:items-center">
          <div className="rounded-lg bg-secondary p-5">
            <div className="grid grid-cols-3 gap-2">
              <span className="h-16 rounded-full bg-primary/15" />
              <span className="h-16 rounded-full bg-(--prism-success)/15" />
              <span className="h-16 rounded-full bg-[#F06030]/15" />
            </div>
          </div>
          <div>
            <h2 className="prism-serif text-3xl font-black leading-tight text-(--prism-ink)">Start your PMCM inquiry</h2>
            <p className="mt-2 text-muted-foreground">Tell us about your event and our team will guide you from inquiry to a successful event.</p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="h-11 rounded-md font-black"><a href="/inquiry">Start an inquiry <ArrowRight className="size-4" /></a></Button>
              <Button asChild variant="outline" className="h-11 rounded-md font-black"><a href="/sign-in"><LockKeyhole className="size-4" /> Sign in</a></Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-primary/10 bg-background px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1320px] gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <BrandMark />
          {[
            ["Platform", "How it works", "Features", "Security", "FAQ"],
            ["Services", "Event planning", "Floorplan review", "Operations support", "Client success"],
            ["Resources", "Help center", "Guides", "Templates", "Contact us"],
          ].map(([title, ...items]) => (
            <div key={title}><p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{title}</p><div className="mt-3 grid gap-2 text-sm text-muted-foreground">{items.map((item) => <span key={item}>{item}</span>)}</div></div>
          ))}
        </div>
      </footer>
    </main>
  );
}
