"use client";

import type { ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Gauge,
  LockKeyhole,
  Mail,
  MapPinned,
  MessageSquareText,
  Network,
  PartyPopper,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UsersRound,
  Warehouse,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { Avatar, AvatarFallback } from "../ui/avatar";
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
import { Progress } from "../ui/progress";
import { Separator } from "../ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

const lifecycle = [
  "Inquiry",
  "Conforme",
  "Briefing",
  "Planning",
  "Event day",
  "Closure",
];

const roleTabs = [
  {
    value: "event",
    label: "Event ops",
    title: "One command surface for PMCM planning work.",
    text: "Track every event from public inquiry to post-event archive with gates, readiness checks, billing status, and operational accountability visible in one place.",
    stats: ["6 phases", "Live readiness", "Audit trail"],
  },
  {
    value: "client",
    label: "Client",
    title: "A gated client portal after conforme approval.",
    text: "Clients submit briefing details, provide layout preferences, review official PMCM layouts, approve proposals, upload documents, and see progress without exposing internal cost or supplier data.",
    stats: ["Approval gate", "Briefing", "Files"],
  },
  {
    value: "supplier",
    label: "Supplier",
    title: "Quote and readiness workflows without Viber drift.",
    text: "Suppliers receive scoped quote requests, confirm assignments, acknowledge readiness, and update arrival or setup status from a focused portal.",
    stats: ["Quotes", "Ingress", "Status"],
  },
  {
    value: "coordinator",
    label: "Coordinator",
    title: "Role-specific event-day views for the team.",
    text: "Coordinators see their assigned event, call time, role instructions, task list, communication thread, and urgent issue action without digging through group chats.",
    stats: ["Roles", "Tasks", "Urgent issue"],
  },
  {
    value: "guest",
    label: "Guest",
    title: "Lightweight guest experiences that do not need an app.",
    text: "Guests can check in, join event engagement moments, and submit post-event feedback through simple web pages that feed moderated PMCM queues.",
    stats: ["Check-in", "Engage", "Feedback"],
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
    text: "Clients provide structured spatial preferences while PMCM owns official room layout editing, review, and approval.",
  },
  {
    icon: Gauge,
    title: "Compliance readiness",
    text: "Surface must-fix items, pre-event checks, payment risk, supplier readiness, and event-day blockers.",
  },
  {
    icon: Warehouse,
    title: "Supplier coordination",
    text: "Replace scattered quote requests with scoped supplier records, confirmations, ingress windows, and readiness signals.",
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
    text: "Carry payment milestones, audit notes, files, and closure documents into a searchable event memory.",
  },
];

const comparison = [
  { tool: "Excel", prism: "Live event state, gates, and readiness signals" },
  { tool: "Viber", prism: "Structured supplier and coordinator acknowledgments" },
  { tool: "Google Drive", prism: "Per-event file hub with lifecycle context" },
  { tool: "Canva / PowerPoint", prism: "Proposal artifacts connected to approvals" },
  { tool: "Email", prism: "Traceable requests, decisions, and audit history" },
];

function BrandMark({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={
          tone === "dark"
            ? "flex h-12 w-36 items-center justify-center rounded-md border border-primary/12 bg-white px-3 shadow-sm"
            : "flex h-12 w-36 items-center justify-center rounded-md border border-white/15 bg-white px-3 shadow-sm"
        }
      >
        <img src="/pmcm-logo.png" alt="PMCM logo" className="h-9 w-full object-contain" />
      </div>
      <div>
        <p className={tone === "dark" ? "text-xs font-black uppercase tracking-[0.24em] text-foreground" : "text-xs font-black uppercase tracking-[0.24em] text-sidebar-foreground"}>P.R.I.S.M</p>
        <p className={tone === "dark" ? "text-sm text-muted-foreground" : "text-sm text-sidebar-foreground/75"}>Event operating system</p>
      </div>
    </div>
  );
}

function MetricCard({ label, value, text }: { label: string; value: string; text: string }) {
  return (
    <Card className="gap-0 rounded-md border-primary/15 bg-card/80 shadow-none backdrop-blur">
      <CardContent className="p-4">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-(--prism-amber)">{label}</p>
        <p className="mt-2 text-3xl font-black text-foreground">{value}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}

function ProductPanel() {
  return (
    <div className="relative min-h-[620px] overflow-hidden rounded-lg border border-primary/15 bg-secondary shadow-[0_34px_120px_rgba(23,18,22,0.22)]">
      <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(#CCECF4_1px,transparent_1px),linear-gradient(90deg,#CCECF4_1px,transparent_1px)] [background-size:34px_34px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(240,96,48,0.32),transparent_28%),radial-gradient(circle_at_86%_16%,rgba(192,24,103,0.18),transparent_34%)]" />

      <Card className="absolute left-6 right-6 top-6 gap-0 rounded-lg border-primary/10 bg-card/85 shadow-none backdrop-blur">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-(--prism-amber)">Live event record</p>
            <p className="mt-1 text-lg font-black text-foreground">Leadership Forum 2026</p>
          </div>
          <Badge variant="secondary" className="rounded-full bg-secondary text-(--prism-success)">Ready for PMCM review</Badge>
        </CardContent>
      </Card>

      <div className="absolute left-7 right-7 top-28 grid gap-3 md:grid-cols-3">
        {lifecycle.map((item, index) => (
          <Card key={item} className="gap-0 rounded-lg border-primary/12 bg-card/82 shadow-none backdrop-blur">
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="grid size-7 place-items-center rounded-md bg-(--prism-ink) text-xs font-black text-sidebar-foreground">{index + 1}</span>
                {index < 3 ? <CheckCircle2 className="size-4 text-(--prism-success)" /> : <CalendarClock className="size-4 text-(--prism-amber)" />}
              </div>
              <p className="mt-3 text-sm font-black text-foreground">{item}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="absolute bottom-7 left-7 w-[min(21rem,calc(100%-3.5rem))] gap-0 rounded-lg border-primary/12 bg-card/92 shadow-none backdrop-blur">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground">Readiness</p>
            <Badge variant="outline" className="rounded-full border-[#F06030]/30 text-(--prism-amber)">86%</Badge>
          </div>
          <Progress value={86} className="h-2" />
          <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground">
            {[
              "Supplier quotes received",
              "Official layout approved",
              "Coordinator assignments pending",
            ].map((item) => (
              <div key={item} className="flex items-center justify-between gap-3">
                <span>{item}</span>
                <BadgeCheck className="size-4 text-(--prism-success)" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="absolute bottom-7 right-7 hidden w-80 gap-0 rounded-lg border-primary/12 bg-(--prism-ink) text-sidebar-foreground shadow-[0_24px_80px_rgba(23,18,22,0.34)] md:block">
        <CardContent className="p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-(--prism-amber)">Role handoff</p>
          <div className="mt-4 flex -space-x-2">
            {['PM', 'CL', 'SU', 'CO', 'GU'].map((item) => (
              <Avatar key={item} className="size-9 border-2 border-primary">
                <AvatarFallback className="bg-card text-xs font-black text-foreground">{item}</AvatarFallback>
              </Avatar>
            ))}
          </div>
          <p className="mt-5 text-2xl font-black leading-tight">One event record. Every role aligned.</p>
          <p className="mt-3 text-sm leading-6 text-sidebar-foreground/75">Client approvals, supplier status, guest flows, coordinator tasks, billing, and archive all point back to the same operational source.</p>
        </CardContent>
      </Card>
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
        <div className="relative mx-auto max-w-[1480px]">
          <header className="sticky top-4 z-30 rounded-lg border border-primary/12 bg-card/82 px-4 py-3 shadow-[0_18px_60px_rgba(23,18,22,0.08)] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <BrandMark />
              <NavigationMenu className="hidden lg:flex">
                <NavigationMenuList className="gap-1">
                  {[
                    ["Platform", "#platform"],
                    ["Roles", "#roles"],
                    ["Operations", "#operations"],
                    ["FAQ", "#faq"],
                  ].map(([label, href]) => (
                    <NavigationMenuItem key={label}>
                      <NavigationMenuLink href={href} className="rounded-full px-4 py-2 text-sm font-bold text-muted-foreground hover:bg-secondary hover:text-foreground">
                        {label}
                      </NavigationMenuLink>
                    </NavigationMenuItem>
                  ))}
                </NavigationMenuList>
              </NavigationMenu>
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" className="hidden h-10 rounded-full font-bold md:inline-flex">
                  <a href="/sign-in">
                    <LockKeyhole data-icon="inline-start" />
                    Sign in
                  </a>
                </Button>
                <Button asChild className="h-10 rounded-full font-black shadow-[0_16px_36px_rgba(23,18,22,0.2)]">
                  <a href="/inquiry">
                    <Mail data-icon="inline-start" />
                    Inquiry
                  </a>
                </Button>
              </div>
            </div>
          </header>

          <div className="grid min-h-[calc(100vh-5.5rem)] items-center gap-12 py-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(520px,0.78fr)]">
            <div className="max-w-5xl">
              <Badge variant="outline" className="mb-7 rounded-full border-[#F06030]/30 bg-accent/75 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-(--prism-amber)">
                <Sparkles className="size-4" />
                PMCM-grade event operations
              </Badge>
              <h1 className="text-5xl font-black leading-[0.9] text-foreground sm:text-7xl xl:text-[6.7rem]">
                One operating system for every event moving part.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground">
                P.R.I.S.M connects public inquiries, conforme gates, official layouts, suppliers, coordinators, guests, billing, compliance, and closure into one auditable event command center.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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
              <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
                <MetricCard label="Personas" value="5" text="PMCM, clients, suppliers, coordinators, and guests." />
                <MetricCard label="Lifecycle" value="6" text="From inquiry through post-event closure." />
                <MetricCard label="Source" value="1" text="Every role returns to the same event record." />
              </div>
            </div>

            <ProductPanel />
          </div>
        </div>
      </section>

      <section id="platform" className="border-y border-primary/12 bg-card px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-[1480px]">
          <SectionHeading
            eyebrow="Platform surface"
            title="Built around the actual event lifecycle."
            text="P.R.I.S.M is not a generic task board. Each surface exists because event operations need gates, approvals, role handoffs, supplier visibility, and closure discipline."
          />
          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {platformFeatures.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </section>

      <DarkBand>
        <div id="roles" className="grid gap-10 lg:grid-cols-[0.72fr_1fr] lg:items-start">
          <div>
            <Badge variant="outline" className="mb-6 rounded-full border-(--prism-amber)/35 bg-card/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-(--prism-amber)">
              Connected roles
            </Badge>
            <h2 className="text-4xl font-black leading-[0.98] sm:text-5xl lg:text-6xl">Every portal is a focused view of the same operation.</h2>
            <p className="mt-5 text-lg leading-8 text-sidebar-foreground/75">The main platform, supplier portal, guest portal, and event command surface should feel connected while staying precise for each audience.</p>
          </div>

          <Tabs defaultValue="event" className="w-full">
            <TabsList className="grid h-auto grid-cols-2 gap-2 rounded-lg bg-card/10 p-2 md:grid-cols-5">
              {roleTabs.map((role) => (
                <TabsTrigger key={role.value} value={role.value} className="rounded-lg text-sidebar-foreground/75 data-[state=active]:bg-card data-[state=active]:text-foreground">
                  {role.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {roleTabs.map((role) => (
              <TabsContent key={role.value} value={role.value} className="mt-5">
                <Card className="gap-0 rounded-lg border-white/15 bg-card text-foreground">
                  <CardHeader>
                    <CardTitle className="text-3xl font-black">{role.title}</CardTitle>
                    <CardDescription className="max-w-2xl text-base leading-7 text-muted-foreground">{role.text}</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-3">
                    {role.stats.map((stat) => (
                      <div key={stat} className="rounded-lg border border-primary/12 bg-background p-4 text-sm font-black uppercase tracking-[0.14em] text-primary">
                        {stat}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </DarkBand>

      <section id="operations" className="bg-background px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1480px] gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <Badge variant="outline" className="mb-6 rounded-full border-[#F06030]/30 bg-accent/75 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-(--prism-amber)">
              Why it exists
            </Badge>
            <h2 className="text-4xl font-black leading-[0.98] text-foreground sm:text-5xl lg:text-6xl">Replace scattered coordination with controlled handoffs.</h2>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">P.R.I.S.M keeps the warmth of PMCM service while adding operational memory, approval gates, and visible accountability.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="h-12 rounded-full px-5 text-sm font-black uppercase tracking-[0.14em]">
                <a href="/inquiry">Start a serious brief <ArrowRight data-icon="inline-end" /></a>
              </Button>
              <Button asChild variant="outline" className="h-12 rounded-full px-5 text-sm font-black uppercase tracking-[0.14em]">
                <a href="/sign-in">
                  <MapPinned data-icon="inline-start" />
                  Sign in
                </a>
              </Button>
            </div>
          </div>

          <Card className="rounded-lg border-primary/12 bg-card shadow-[0_28px_90px_rgba(23,18,22,0.13)]">
            <CardHeader>
              <CardTitle className="text-2xl font-black text-foreground">From tool sprawl to one event record</CardTitle>
              <CardDescription>Marketing copy is grounded in the docs: the current alternative is spreadsheets, chat, documents, folders, and email.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {comparison.map((item) => (
                <div key={item.tool} className="grid gap-3 rounded-lg border border-primary/10 bg-background p-4 sm:grid-cols-[0.42fr_1fr]">
                  <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-(--prism-amber)">
                    <MessageSquareText className="size-4" />
                    {item.tool}
                  </div>
                  <div className="text-sm font-semibold leading-6 text-primary">{item.prism}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="faq" className="border-t border-primary/12 bg-card px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[0.8fr_1fr]">
          <div>
            <Badge variant="outline" className="mb-6 rounded-full border-[#F06030]/30 bg-accent/75 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-(--prism-amber)">
              Operating rules
            </Badge>
            <h2 className="text-4xl font-black leading-[0.98] text-foreground sm:text-5xl">Clear gates before access.</h2>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">The public pages can sell the platform vision, but the product rules stay precise: sign-in approval and conforme gates matter.</p>
          </div>
          <Accordion type="single" collapsible className="rounded-lg border border-primary/12 bg-background px-5">
            <AccordionItem value="approval">
              <AccordionTrigger>Can users sign in immediately?</AccordionTrigger>
              <AccordionContent>No. Mock sign-in already requires admin approval before access is granted.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="conforme">
              <AccordionTrigger>When does event work begin?</AccordionTrigger>
              <AccordionContent>Event creation and client portal activation should remain gated by conforme and PMCM approval.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="satellites">
              <AccordionTrigger>Are supplier and guest portals live now?</AccordionTrigger>
              <AccordionContent>This pass creates polished portal landing pages. Full supplier, guest, and event workflows remain future implementation work.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="backend">
              <AccordionTrigger>Does this change backend behavior?</AccordionTrigger>
              <AccordionContent>No. This is a public/frontend landing pass only.</AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      <footer className="bg-(--prism-ink) px-5 py-10 text-sidebar-foreground sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <BrandMark tone="light" />
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="secondary" className="rounded-full font-black">
              <a href="/inquiry">Start inquiry</a>
            </Button>
            <Button asChild variant="outline" className="rounded-full border-white/30 bg-transparent font-black text-sidebar-foreground hover:bg-card hover:text-foreground">
              <a href="/sign-in">Sign in</a>
            </Button>
          </div>
        </div>
      </footer>
    </main>
  );
}
