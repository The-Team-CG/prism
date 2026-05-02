import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  ClipboardList,
  FileCheck2,
  Handshake,
  MapPinned,
  MessageSquareText,
  PackageCheck,
  ShieldCheck,
  Truck,
  Warehouse,
} from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";

const workflow = [
  "Scoped request",
  "Quote submitted",
  "Assignment confirmed",
  "Readiness checked",
  "Ingress tracked",
  "Closure noted",
];

const features: Array<{ icon: LucideIcon; title: string; text: string }> = [
  {
    icon: ClipboardList,
    title: "Quote requests",
    text: "Receive event scale, date, venue context, inclusions, and response deadline in one structured brief.",
  },
  {
    icon: ShieldCheck,
    title: "Confidential bidding",
    text: "Bid-stage requests can hide client identity until PMCM formally awards or converts the workspace.",
  },
  {
    icon: Handshake,
    title: "Assignment confirmation",
    text: "Accept terms, confirm availability, and keep PMCM visibility separate from chat threads.",
  },
  {
    icon: PackageCheck,
    title: "Readiness checks",
    text: "Confirm deliverables before event week and surface concerns early through a traceable status update.",
  },
  {
    icon: Truck,
    title: "Ingress and egress",
    text: "See setup windows, arrival expectations, egress sequence, and status handoffs from the event day team.",
  },
  {
    icon: FileCheck2,
    title: "Contracts and files",
    text: "Keep service contracts, quote revisions, and operational notes attached to the event record.",
  },
];

function PortalBadge() {
  return (
    <Badge variant="outline" className="rounded-full border-(--prism-amber)/40 bg-accent px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-(--prism-amber)">
      <Warehouse className="size-4" />
      Supplier network surface
    </Badge>
  );
}

function FeatureCard({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <Card className="gap-0 rounded-lg border-primary/12 bg-card/85 p-5 shadow-[0_18px_60px_rgba(23,18,22,0.07)] backdrop-blur">
      <div className="grid size-11 place-items-center rounded-lg bg-(--prism-ink) text-sidebar-foreground">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-5 text-xl font-black text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </Card>
  );
}

export default function SupplierHome() {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <section className="relative px-5 py-5 sm:px-8 lg:px-10">
        <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_1px_1px,#C01867_1px,transparent_0)] [background-size:30px_30px]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,248,242,0.96),rgba(233,247,251,0.72)_56%,rgba(255,248,242,0.94))]" />

        <div className="relative mx-auto max-w-[1420px]">
          <header className="flex items-center justify-between gap-4 rounded-lg border border-primary/12 bg-card/82 px-4 py-3 shadow-[0_18px_60px_rgba(23,18,22,0.08)] backdrop-blur-xl">
            <a href="http://localhost:3001" className="flex items-center gap-3">
              <span className="flex h-12 w-36 items-center justify-center rounded-md border border-primary/12 bg-white px-3 shadow-sm">
                <img src="/pmcm-logo.png" alt="PMCM logo" className="h-9 w-full object-contain" />
              </span>
              <span>
                <span className="block text-xs font-black uppercase tracking-[0.24em] text-foreground">P.R.I.S.M</span>
                <span className="block text-sm text-muted-foreground">Supplier Portal</span>
              </span>
            </a>
            <nav className="hidden items-center gap-6 text-sm font-bold text-muted-foreground md:flex">
              <a href="#network" className="hover:text-foreground">Network</a>
              <a href="#workflow" className="hover:text-foreground">Workflow</a>
              <a href="#readiness" className="hover:text-foreground">Readiness</a>
            </nav>
            <Button asChild className="h-10 rounded-full font-black shadow-[0_16px_36px_rgba(23,18,22,0.2)]">
              <a href="/sign-in">Sign in <ArrowRight className="size-4" /></a>
            </Button>
          </header>

          <div className="grid min-h-[calc(100vh-5rem)] items-center gap-12 py-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(480px,0.82fr)]">
            <div>
              <PortalBadge />
              <h1 className="mt-7 max-w-4xl text-5xl font-black leading-[0.9] text-foreground sm:text-7xl xl:text-[6.3rem]">
                Supplier coordination without lost threads.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground">
                A focused supplier surface for quote requests, bid confidentiality, assignment acceptance, readiness confirmation, ingress status, and event-day handoffs.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button asChild className="h-12 rounded-full px-5 text-sm font-black uppercase tracking-[0.14em] shadow-[0_18px_40px_rgba(23,18,22,0.24)]">
                  <a href="/sign-in">Supplier sign in <ArrowRight className="size-4" /></a>
                </Button>
                <Button asChild variant="outline" className="h-12 rounded-full px-5 text-sm font-black uppercase tracking-[0.14em]">
                  <a href="#workflow">Review workflow</a>
                </Button>
              </div>
            </div>

            <div className="relative min-h-[560px] overflow-hidden rounded-lg border border-primary/15 bg-secondary shadow-[0_34px_120px_rgba(23,18,22,0.22)]">
              <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(#CCECF4_1px,transparent_1px),linear-gradient(90deg,#CCECF4_1px,transparent_1px)] [background-size:34px_34px]" />
              <div className="absolute left-6 right-6 top-6 rounded-lg border border-primary/10 bg-card/88 p-5 backdrop-blur">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-(--prism-amber)">Quote request</p>
                <h2 className="mt-2 text-2xl font-black text-foreground">Production lights and truss</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Corporate forum, 300 pax, ballroom ingress 2:00 AM, confidential until awarded.</p>
              </div>
              <div className="absolute left-6 right-6 top-44 grid gap-3 sm:grid-cols-2">
                {[
                  ["Deadline", "Apr 29, 5:00 PM"],
                  ["Status", "Awaiting quote"],
                  ["Ingress", "2:00 AM - 5:00 AM"],
                  ["Visibility", "Client hidden"],
                ].map(([label, value]) => (
                <Card key={label} className="gap-0 rounded-lg border-primary/10 bg-card/85 p-4 backdrop-blur">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-(--prism-amber)">{label}</p>
                  <p className="mt-2 text-sm font-black text-foreground">{value}</p>
                </Card>
                ))}
              </div>
              <div className="absolute bottom-6 left-6 right-6 rounded-lg bg-(--prism-ink) p-5 text-sidebar-foreground shadow-[0_24px_80px_rgba(23,18,22,0.34)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-(--prism-amber)">Readiness</p>
                    <p className="mt-2 text-2xl font-black">Pre-event confirmation due</p>
                  </div>
                  <BadgeCheck className="size-10 text-(--prism-amber)" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="network" className="border-y border-primary/12 bg-card px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-[1420px]">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-(--prism-amber)">Network capabilities</p>
            <h2 className="mt-4 text-4xl font-black leading-[0.98] sm:text-5xl">Built for suppliers who need clarity before event day.</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {features.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="bg-(--prism-ink) px-5 py-20 text-sidebar-foreground sm:px-8 lg:px-10">
        <div className="mx-auto max-w-[1420px]">
          <div className="grid gap-10 lg:grid-cols-[0.65fr_1fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-(--prism-amber)">Supplier workflow</p>
              <h2 className="mt-4 text-4xl font-black leading-[0.98] sm:text-5xl">Every handoff is visible to PMCM.</h2>
              <p className="mt-5 text-lg leading-8 text-sidebar-foreground/75">The portal is a preview surface for the future workflow. It keeps supplier actions aligned to the event command record.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {workflow.map((step, index) => (
              <Card key={step} className="gap-0 rounded-lg border-white/15 bg-card/10 p-4 text-sidebar-foreground">
                <span className="grid size-8 place-items-center rounded-full bg-[#F06030] text-sm font-black text-foreground">{index + 1}</span>
                <p className="mt-4 text-lg font-black">{step}</p>
              </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="readiness" className="bg-background px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-[1420px] flex-col gap-6 rounded-lg border border-primary/12 bg-card p-6 shadow-[0_28px_90px_rgba(23,18,22,0.12)] md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-(--prism-amber)">Status promise</p>
            <h2 className="mt-2 text-3xl font-black text-foreground">Arrived, set up, ready, done.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Future event-day supplier actions stay simple enough for phones and structured enough for operations.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {["Arrived", "Set up", "Done"].map((item) => (
              <div key={item} className="rounded-lg bg-secondary px-5 py-4 text-center text-sm font-black text-foreground">{item}</div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
