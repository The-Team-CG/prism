"use client";

import {
  ArrowRight,
  BadgeCheck,
  Bell,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  LayoutGrid,
  LockKeyhole,
  MessageSquareText,
  PackageCheck,
  PenLine,
  Radio,
  ShieldCheck,
  Smartphone,
  Target,
  Truck,
  UserRound,
} from "lucide-react";
import { PrismBrandLogo } from "@prism/ui";

function BrandMark() {
  return (
    <PrismBrandLogo href="/" detail="Supplier Portal" markClassName="size-12 bg-transparent ring-0" />
  );
}

function SupplierActionBoard() {
  const rows = [
    { title: "Quote due", detail: "Submit your pricing quote", scope: "Lighting package", meta: "Due soon", tone: "orange", icon: CalendarClock },
    { title: "Revision open", detail: "Client requested changes", scope: "Branding setup", meta: "Action needed", tone: "orange", icon: PenLine },
    { title: "Assignment selected", detail: "You're confirmed for this work", scope: "Registration support", meta: "Assigned", tone: "green", icon: CheckCircle2 },
    { title: "Contract details", detail: "Review and download", scope: "Terms and insurance on file", meta: "Locked", tone: "green", icon: FileCheck2 },
    { title: "Readiness notes", detail: "Items to complete before event", scope: "Power needs, load-in, access", meta: "Review", tone: "blue", icon: ClipboardCheck },
  ];

  return (
    <section className="overflow-hidden rounded-lg border border-primary/12 bg-card shadow-[0_30px_110px_rgba(23,18,22,0.12)]">
      <div className="grid lg:grid-cols-[76px_1fr]">
        <aside className="hidden bg-(--prism-ink) p-4 text-sidebar-foreground lg:grid lg:content-start lg:gap-6">
          {[Target, FileCheck2, ClipboardCheck, UserRound, MessageSquareText, Bell, ShieldCheck].map((Icon, index) => (
            <span key={index} className="grid size-10 place-items-center rounded-md text-sidebar-foreground/80">
              <Icon className="size-5" />
            </span>
          ))}
        </aside>
        <div className="p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-2xl font-black text-foreground">Your action board</p>
              <p className="mt-1 text-sm text-muted-foreground">All items reflect assigned work.</p>
            </div>
            <button className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-bold text-foreground">
              <CalendarClock className="size-4" />
              Upcoming event
            </button>
          </div>

          <div className="grid gap-3">
            {rows.map(({ title, detail, scope, meta, tone, icon: Icon }) => (
              <div key={title} className="grid gap-3 rounded-md border border-border bg-background p-4 sm:grid-cols-[1fr_1.1fr_auto] sm:items-center">
                <div className="flex items-center gap-4">
                  <span className={tone === "green" ? "grid size-12 place-items-center rounded-md bg-(--prism-success)/10 text-(--prism-success)" : tone === "blue" ? "grid size-12 place-items-center rounded-md bg-[#40A0D0]/10 text-[#40A0D0]" : "grid size-12 place-items-center rounded-md bg-[#F06030]/10 text-[#F06030]"}>
                    <Icon className="size-6" />
                  </span>
                  <span>
                    <span className="block text-base font-black text-foreground">{title}</span>
                    <span className="block text-sm leading-5 text-muted-foreground">{detail}</span>
                  </span>
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{scope}</p>
                  <p className="text-xs leading-5 text-muted-foreground">Assigned by PMCM</p>
                </div>
                <span className={tone === "green" ? "w-fit rounded-full bg-(--prism-success)/10 px-3 py-1.5 text-xs font-black text-(--prism-success)" : tone === "blue" ? "w-fit rounded-full bg-[#40A0D0]/10 px-3 py-1.5 text-xs font-black text-[#40A0D0]" : "w-fit rounded-full bg-[#F06030]/10 px-3 py-1.5 text-xs font-black text-[#F06030]"}>
                  {meta}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-md border border-border bg-background p-4">
            <div className="mb-3 flex items-center gap-3">
              <Radio className="size-5 text-primary" />
              <p className="font-black text-foreground">Event-day status</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["Arrived", "Onsite", "success"],
                ["Setup ongoing", "In progress", "warning"],
                ["Completed", "All done", "neutral"],
              ].map(([title, detail, tone]) => (
                <button key={title} className={tone === "success" ? "rounded-md border border-(--prism-success)/35 bg-(--prism-success)/8 px-4 py-3 text-left" : tone === "warning" ? "rounded-md border border-[#F06030]/35 bg-[#F06030]/8 px-4 py-3 text-left" : "rounded-md border border-border bg-card px-4 py-3 text-left"}>
                  <span className="block font-black text-foreground">{title}</span>
                  <span className="text-sm text-muted-foreground">{detail}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ icon: Icon, title, text }: { icon: typeof Target; title: string; text: string }) {
  return (
    <div className="rounded-lg border border-primary/12 bg-card p-5 shadow-sm">
      <span className="grid size-11 place-items-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <p className="mt-4 text-lg font-black text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}

export default function SupplierHome() {
  return (
    <main className="h-full overflow-y-auto bg-background text-foreground">
      <section className="relative min-h-screen overflow-hidden border-b border-primary/10 px-5 py-5 sm:px-8 lg:px-10">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,248,242,0.98),rgba(233,247,251,0.68)_58%,rgba(255,248,242,0.96))]" />
        <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(#CCECF4_1px,transparent_1px),linear-gradient(90deg,#CCECF4_1px,transparent_1px)] [background-size:42px_42px]" />
        <div className="relative mx-auto max-w-[1320px]">
          <header className="flex items-center justify-between gap-4 bg-background/80 py-6 backdrop-blur-xl">
            <BrandMark />
            <nav className="hidden items-center gap-10 text-sm font-black text-foreground lg:flex" aria-label="Supplier sections">
              {[
                ["Quotes", "#quotes"],
                ["Assignments", "#assignments"],
                ["Readiness", "#readiness"],
                ["Event day", "#event-day"],
              ].map(([label, href]) => (
                <a key={label} href={href} className="rounded-md px-2 py-2 transition hover:text-primary">{label}</a>
              ))}
            </nav>
            <a href="/sign-in" className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-black text-primary-foreground shadow-[0_16px_36px_rgba(192,24,103,0.22)]">
              <LockKeyhole className="size-4" />
              Supplier sign in
            </a>
          </header>

          <div className="grid min-h-[calc(100vh-5.5rem)] items-start gap-10 py-14 lg:grid-cols-[0.78fr_1.22fr] xl:py-20">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#F06030]/30 bg-[#F06030]/8 px-5 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#F06030]">
                <Target className="size-4" />
                Assigned suppliers only
              </span>
              <h1
                className="mt-7 max-w-4xl prism-serif text-5xl font-black leading-[0.93] tracking-normal text-(--prism-ink) sm:text-6xl xl:text-[4.6rem]"
              >
                Know what is due, what is locked, and what PMCM needs next
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
                See quote deadlines, revision windows, selected assignments, contract details, readiness notes, and onsite status without chasing messages.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="/sign-in" className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-6 text-base font-black text-primary-foreground shadow-[0_18px_40px_rgba(192,24,103,0.22)]">
                  Supplier sign in <ArrowRight className="size-5" />
                </a>
                <a href="#quotes" className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-border bg-card px-6 text-base font-black text-foreground">
                  See how it works
                </a>
              </div>
              <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-4">
                {[
                  [Target, "Scoped requests"],
                  [CalendarClock, "Clear deadlines"],
                  [LockKeyhole, "Locked assignments"],
                  [Smartphone, "Onsite updates"],
                ].map(([Icon, label]) => {
                  const IconComponent = Icon as typeof Target;
                  return (
                    <div key={label as string} className="text-center">
                      <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary/8 text-primary">
                        <IconComponent className="size-6" />
                      </span>
                      <p className="mt-3 text-sm font-black text-foreground">{label as string}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <SupplierActionBoard />
          </div>
        </div>
      </section>

      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1320px] gap-5 rounded-lg border border-primary/12 bg-card p-7 shadow-[0_20px_70px_rgba(23,18,22,0.08)] md:grid-cols-4">
          {[
            [ShieldCheck, "Scoped requests", "Clear scopes reduce back-and-forth."],
            [CalendarClock, "Clear deadlines", "Dates and windows are always visible."],
            [LockKeyhole, "Locked assignments", "Selected work is confirmed and protected."],
            [Radio, "Onsite updates", "Real-time status keeps everyone aligned."],
          ].map(([Icon, title, text]) => {
            const IconComponent = Icon as typeof Target;
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

      <section id="quotes" className="px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1320px] gap-8 rounded-lg border border-primary/10 bg-card p-8 lg:grid-cols-[0.3fr_0.7fr] lg:items-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Quote clarity</p>
            <h2 className="mt-4 prism-serif text-4xl font-black leading-[0.98] text-(--prism-ink) sm:text-5xl">Quote deadlines you can trust</h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">See what is due, what is open for revision, and what has been locked at a glance.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Quote due", "Lighting package", "Due May 14, 2026", "3 days left", "Submit quote"],
              ["Revision window", "Branding setup", "Closes May 18, 2026", "Action needed", "Review changes"],
              ["Quote locked", "AV & Staging", "Locked May 6, 2026", "Confirmed", "View details"],
            ].map(([label, title, date, status, action]) => (
              <div key={label} className="rounded-lg border border-primary/12 bg-background p-6">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">{label}</p>
                <p className="mt-4 text-lg font-black text-foreground">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{date}</p>
                <p className="mt-4 text-sm font-black text-[#F06030]">{status}</p>
                <div className="mt-4 h-2 rounded-full bg-secondary"><div className="h-2 w-2/5 rounded-full bg-[#F06030]" /></div>
                <a href="/sign-in" className="mt-5 inline-flex items-center gap-2 text-sm font-black text-primary">{action}<ArrowRight className="size-4" /></a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="assignments" className="px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1320px] gap-8 rounded-lg border border-primary/10 bg-card p-8 lg:grid-cols-[0.3fr_0.7fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-(--prism-amber)">Assignment handoff</p>
            <h2 className="mt-4 prism-serif text-4xl font-black leading-[0.98] text-(--prism-ink) sm:text-5xl">Assignments and handoffs, all in one place</h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">Access contracts, confirm readiness, and see ingress details so your team arrives prepared and on time.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { title: "Contract details", line1: "PO number", line2: "PMCM-52817", action: "Download contract" },
              { title: "Readiness checklist", line1: "Power requirements", line2: "Load-in access", action: "View all notes" },
              { title: "Ingress schedule", line1: "Load-in", line2: "May 14, 7:00 AM", action: "View schedule" },
            ].map(({ title, line1, line2, action }) => (
              <div key={title} className="rounded-lg border border-border bg-background p-6">
                <p className="font-black text-foreground">{title}</p>
                <div className="mt-5 grid gap-3 text-sm text-muted-foreground">
                  <span>{line1}</span>
                  <span>{line2}</span>
                </div>
                <a href="/sign-in" className="mt-6 inline-flex items-center gap-2 text-sm font-black text-primary">{action}<ArrowRight className="size-4" /></a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="event-day" className="px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1320px] gap-8 rounded-lg border border-primary/10 bg-primary/5 p-8 lg:grid-cols-[0.32fr_0.34fr_0.34fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Mobile event day</p>
            <h2 className="mt-4 prism-serif text-4xl font-black leading-[0.98] text-(--prism-ink) sm:text-5xl">Mobile-ready on event day</h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">Arrival, setup, and completion states are sized for phone use when teams are already onsite.</p>
          </div>
          <div className="mx-auto w-full max-w-[260px] rounded-[2rem] border-8 border-(--prism-ink) bg-card p-4 shadow-[0_28px_80px_rgba(23,18,22,0.22)]">
            <p className="text-center text-sm font-black text-foreground">Event-day status</p>
            <div className="mt-5 grid gap-3">
              {[
                [CheckCircle2, "Arrived", "Confirm onsite"],
                [Radio, "Setup ongoing", "Update PMCM"],
                [BadgeCheck, "Completed", "Mark all done"],
              ].map(([Icon, title, text]) => {
                const IconComponent = Icon as typeof Target;
                return (
                  <button key={title as string} className="rounded-md border border-border bg-background p-4 text-left">
                    <IconComponent className="size-5 text-primary" />
                    <span className="mt-3 block font-black text-foreground">{title as string}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">{text as string}</span>
                  </button>
                );
              })}
              <button className="h-11 rounded-md border border-border bg-background text-sm font-black text-foreground">Add onsite note</button>
            </div>
          </div>
          <div className="rounded-lg border border-primary/12 bg-card p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Status timeline</p>
            {[
              ["Arrived onsite", "May 14, 7:25 AM"],
              ["Setup in progress", "May 14, 8:10 AM"],
              ["Setup completed", "May 14, 11:45 AM"],
              ["Event day complete", ""],
            ].map(([title, time], index) => (
              <div key={title} className="flex gap-4 py-4">
                <span className={index < 3 ? "mt-1 size-3 rounded-full bg-(--prism-success)" : "mt-1 size-3 rounded-full border border-border"} />
                <span><span className="block font-black text-foreground">{title}</span><span className="text-sm text-muted-foreground">{time}</span></span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1320px] gap-8 rounded-lg border border-primary/12 bg-secondary/55 p-8 md:grid-cols-[0.3fr_1fr_0.28fr] md:items-center">
          <h2 className="prism-serif text-3xl font-black leading-tight text-(--prism-ink)">Everything needed for the assigned work</h2>
          <div className="grid gap-4 sm:grid-cols-4">
            {["120+", "98%", "24/7", "All"].map((value, index) => (
              <div key={value} className="text-center">
                <span className="mx-auto grid size-12 place-items-center rounded-full bg-card text-primary">{index === 0 ? <ClipboardCheck className="size-5" /> : index === 1 ? <CheckCircle2 className="size-5" /> : index === 2 ? <MessageSquareText className="size-5" /> : <LayoutGrid className="size-5" />}</span>
                <p className="mt-3 text-2xl font-black text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{["Active assignments", "On-time readiness", "Support access", "In one place"][index]}</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg bg-card p-5">
            <p className="font-black text-foreground">Need something?</p>
            <p className="mt-2 text-sm text-muted-foreground">Your coordinator is ready to help.</p>
            <a href="/sign-in" className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-black text-primary-foreground">Contact coordinator</a>
          </div>
        </div>
        <div className="mx-auto mt-16 max-w-3xl text-center">
          <p className="font-display text-5xl font-black text-primary">“</p>
          <p className="text-xl leading-8 text-(--prism-ink)">The supplier portal keeps everything clear and easy to find. We know what is due, what is locked, and how to stay in sync onsite.</p>
          <p className="mt-5 text-sm font-black text-muted-foreground">PMCM Supplier Partner</p>
        </div>
      </section>

      <section className="px-5 pb-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-[1320px] rounded-lg border border-primary/12 bg-(--prism-ink) p-8 text-sidebar-foreground shadow-[0_24px_80px_rgba(23,18,22,0.08)] sm:p-10 lg:flex lg:items-center lg:justify-between">
          <div>
            <h2 className="max-w-2xl prism-serif text-4xl font-black leading-tight">Return to your supplier workspace</h2>
            <p className="mt-3 text-sidebar-foreground/70">Sign in to view assignments, deadlines, contracts, and event-day updates.</p>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-0">
            <a href="/sign-in" className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 font-black text-primary-foreground">Supplier sign in</a>
            <a href="#quotes" className="inline-flex h-12 items-center justify-center rounded-md border border-white/20 bg-white px-6 font-black text-foreground">See how it works</a>
          </div>
        </div>
      </section>
      <footer className="border-t border-primary/10 bg-background px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1320px] gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <BrandMark />
          {[
            ["Portal", "Quotes", "Assignments", "Readiness", "Event day"],
            ["Support", "Help center", "Contact coordinator", "Resources"],
            ["Company", "About PMCM", "Careers", "Privacy"],
          ].map(([title, ...items]) => (
            <div key={title}><p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{title}</p><div className="mt-3 grid gap-2 text-sm text-muted-foreground">{items.map((item) => <span key={item}>{item}</span>)}</div></div>
          ))}
        </div>
      </footer>
    </main>
  );
}
