"use client";

import { FormEvent, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArchiveRestore,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  KeyRound,
  LayoutGrid,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { PrismBrandLogo } from "@prism/ui";

import { prismApi } from "@/lib/prism-api";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { saveEventSession, type EventSession } from "@/app/lib/session";

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}
function PublicBrand({ label }: { label?: string }) {
  return (
    <PrismBrandLogo href="/" detail={label ?? "Event Command"} markClassName="size-12 bg-transparent ring-0" />
  );
}

function DisplayTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h1 className={cx("prism-serif text-5xl font-black leading-[0.93] tracking-normal text-(--prism-ink) sm:text-6xl xl:text-[4.85rem]", className)}>
      {children}
    </h1>
  );
}

function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
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

export function EventCommandLanding({ onSignedIn }: { onSignedIn: (session: EventSession) => void }) {
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
      const session = await prismApi.login({ email, password });
      if (session.role !== "pmcm-admin" && session.role !== "coordinator") {
        setError(session.role === "client" ? "Client accounts belong in prism-client at http://localhost:3001." : "Supplier accounts belong in prism-supplier at http://localhost:3002.");
        return;
      }
      saveEventSession(session);
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
                <a key={labelText} href={href} className="rounded-md px-2 py-2 transition hover:text-primary">
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
              <DisplayTitle className="max-w-3xl xl:text-[4.4rem]">
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

