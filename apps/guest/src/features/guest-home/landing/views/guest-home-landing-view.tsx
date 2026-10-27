"use client";

import { portalHref } from "@prism/ui/portal-path";

import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  DoorOpen,
  HelpCircle,
  LockKeyhole,
  MessageCircleHeart,
  ShieldCheck,
  TicketCheck,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import { PrismBrandLogo } from "@prism/ui";

function BrandMark() {
  return (
    <PrismBrandLogo href="/" detail="Guest Portal" markClassName="size-12 bg-transparent ring-0" />
  );
}

function GuestPassPanel() {
  return (
    <section className="rounded-lg border border-primary/12 bg-card p-4 shadow-[0_30px_110px_rgba(23,18,22,0.14)]">
      <div className="relative overflow-hidden rounded-lg bg-[linear-gradient(135deg,#171216,#40122b_58%,#F06030)] p-6 text-sidebar-foreground">
        <div className="absolute right-10 top-8 hidden size-36 rounded-t-full border border-primary/55 bg-[linear-gradient(180deg,#FFB256,#F06030_62%,#C01867)] shadow-[0_0_70px_rgba(192,24,103,0.42)] md:block" />
        <div className="absolute right-5 top-20 hidden h-28 w-16 rotate-12 rounded-t-full border border-success/35 bg-ink md:block" />
        <div className="absolute right-40 top-24 hidden h-20 w-10 -rotate-12 rounded-t-full border border-success/35 bg-ink md:block" />
        <p className="relative text-xs font-black uppercase tracking-[0.2em] text-attention">Your event pass</p>
        <h2 className="relative mt-4 text-3xl font-black leading-tight">You're invited.</h2>
        <p className="relative mt-3 max-w-lg text-base leading-7 text-sidebar-foreground/72">Use your private code to open your pass and get ready for a seamless event experience.</p>
        <div className="mt-8 grid gap-4 rounded-lg bg-white p-4 text-foreground lg:grid-cols-[1fr_0.82fr]">
          <div>
            <p className="text-xl font-black text-foreground">Enter event code</p>
            <p className="mt-1 text-sm text-muted-foreground">Use the code provided by your host.</p>
            <div className="mt-5 grid grid-cols-6 gap-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <span key={index} className={index === 0 ? "grid aspect-square place-items-center rounded-md border-2 border-primary text-xl font-black text-primary" : "aspect-square rounded-md border border-border bg-background"}>{index === 0 ? "I" : ""}</span>
              ))}
            </div>
            <a href={portalHref("/open")} className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary font-black text-primary-foreground">
              <LockKeyhole className="size-5" />
              Open pass
            </a>
            <div className="mt-4 flex items-start gap-3 rounded-md bg-secondary p-3 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 text-foreground" />
              Your information stays private and secure. Only event access is shared with the organizer.
            </div>
          </div>
          <div className="grid gap-2 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
            {[
              [ShieldCheck, "Consent", "Confirmed", "success"],
              [UserCheck, "Check-in", "Ready to check in", "warning"],
              [Users, "Walk-in review", "Name or walk-in review", "info"],
              [MessageCircleHeart, "Feedback", "Review after the event", "primary"],
            ].map(([Icon, title, detail, tone]) => {
              const IconComponent = Icon as typeof ShieldCheck;
              return (
                <div key={title as string} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className={tone === "success" ? "grid size-10 place-items-center rounded-full bg-success/10 text-success" : tone === "warning" ? "grid size-10 place-items-center rounded-full bg-brand-orange/10 text-brand-orange" : tone === "info" ? "grid size-10 place-items-center rounded-full bg-brand-blue/10 text-brand-blue" : "grid size-10 place-items-center rounded-full bg-primary/10 text-primary"}>
                      <IconComponent className="size-5" />
                    </span>
                    <span>
                      <span className="block font-black text-foreground">{title as string}</span>
                      <span className="text-sm text-muted-foreground">{detail as string}</span>
                    </span>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ icon: Icon, title, text }: { icon: typeof ShieldCheck; title: string; text: string }) {
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

export function GuestHomeLandingView() {
  return (
    <main className="h-full overflow-y-auto bg-background text-foreground">
      <section className="relative min-h-screen overflow-hidden border-b border-primary/10 px-5 py-5 sm:px-8 lg:px-10">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,248,242,0.98),rgba(233,247,251,0.62)_58%,rgba(255,240,230,0.94))]" />
        <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(#CCECF4_1px,transparent_1px),linear-gradient(90deg,#CCECF4_1px,transparent_1px)] [background-size:42px_42px]" />
        <div className="relative mx-auto max-w-[1320px]">
          <header className="flex items-center justify-between gap-4 bg-background/80 py-6 backdrop-blur-xl">
            <BrandMark />
            <nav className="hidden items-center gap-10 text-sm font-black text-foreground lg:flex" aria-label="Guest sections">
              {[
                ["Access", "#access"],
                ["Check-in", "#check-in"],
                ["Feedback", "#feedback"],
                ["Help", "#help"],
              ].map(([label, href]) => (
                <a key={label} href={href} className="rounded-md px-2 py-2 transition hover:text-primary">{label}</a>
              ))}
            </nav>
            <a href={portalHref("/open")} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-black text-primary-foreground shadow-[0_16px_36px_rgba(192,24,103,0.22)]">
              <DoorOpen className="size-4" />
              Open with code
            </a>
          </header>

          <div className="grid min-h-[calc(100vh-5.5rem)] items-start gap-10 py-14 lg:grid-cols-[0.78fr_1.22fr] xl:py-20">
            <div className="max-w-3xl">
              <h1 className="max-w-4xl prism-serif text-5xl font-black leading-[0.93] tracking-normal text-ink sm:text-6xl xl:text-[4.65rem]">
                Fast event access for check-in, consent, and <span className="text-primary">feedback</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
                Open your private event pass with a code, confirm consent, check in quickly, and share feedback after the event.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href={portalHref("/open")} className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-6 text-base font-black text-primary-foreground shadow-[0_18px_40px_rgba(192,24,103,0.22)]">
                  Open with code <ArrowRight className="size-5" />
                </a>
                <a href="#access" className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-border bg-card px-6 text-base font-black text-foreground">
                  See how it works
                </a>
              </div>
              <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-4">
                {[
                  [TicketCheck, "Access code"],
                  [ShieldCheck, "Consent first"],
                  [Zap, "Fast check-in"],
                  [MessageCircleHeart, "Feedback reviewed"],
                ].map(([Icon, label]) => {
                  const IconComponent = Icon as typeof ShieldCheck;
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

            <GuestPassPanel />
          </div>
        </div>
      </section>

      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1320px] gap-5 rounded-lg border border-primary/12 bg-card p-7 shadow-[0_20px_70px_rgba(23,18,22,0.08)] md:grid-cols-4">
          {[
            [TicketCheck, "Access code", "A valid access code is required before your pass opens. Camera QR check-in is not enabled."],
            [ShieldCheck, "Consent first", "We ask for consent before check-in."],
            [Zap, "Fast check-in", "Arrive, confirm, and check in quickly."],
            [MessageCircleHeart, "Feedback reviewed", "Your feedback helps improve future events."],
          ].map(([Icon, title, text]) => {
            const IconComponent = Icon as typeof ShieldCheck;
            return (
              <div key={title as string} className="flex items-start gap-4 border-border md:not-last:border-r md:not-last:pr-5">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/8 text-primary"><IconComponent className="size-5" /></span>
                <span><span className="block font-black text-foreground">{title as string}</span><span className="mt-1 block text-sm leading-5 text-muted-foreground">{text as string}</span></span>
              </div>
            );
          })}
        </div>
      </section>

      <section id="access" className="px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1320px] gap-8 lg:grid-cols-[0.3fr_0.7fr] lg:items-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Open. Confirm. Check in.</p>
            <h2 className="mt-4 prism-serif text-4xl font-black leading-[0.98] text-ink sm:text-5xl">Your event pass is your easy access point</h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">A few simple steps get you in, keep you informed, and make your experience smooth from start to finish.</p>
            <div className="mt-6 grid gap-2 text-sm text-muted-foreground">
              {["Use the code from your host", "Confirm consent and preferences", "Check in quickly at the venue", "Share feedback after the event"].map((item) => (
                <span key={item} className="flex items-center gap-2"><CheckCircle2 className="size-4 text-success" />{item}</span>
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              [TicketCheck, "Event pass", "Private access, just for you."],
              [ShieldCheck, "Consent", "We value your privacy."],
              [UserCheck, "Check-in ready", "Show this screen at the venue."],
            ].map(([Icon, title, text]) => (
              <FeatureCard key={title as string} icon={Icon as typeof ShieldCheck} title={title as string} text={text as string} />
            ))}
          </div>
        </div>
      </section>

      <section id="check-in" className="border-y border-primary/10 bg-card px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-[1320px] rounded-lg border border-primary/12 bg-background p-8">
          <h2 className="text-center prism-serif text-4xl font-black leading-[0.98] text-ink">A simple flow from arrival to feedback</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-4">
            {[
              [TicketCheck, "Enter code", "Open your event pass with the code from your host."],
              [ShieldCheck, "Confirm consent", "Review and confirm consent before checking in."],
              [UserCheck, "Check in", "Arrive at the venue and check in with our team."],
              [MessageCircleHeart, "Share feedback", "After the event, tell us about your experience."],
            ].map(([Icon, title, text], index) => {
              const IconComponent = Icon as typeof ShieldCheck;
              return (
                <div key={title as string} className="text-center">
                  <span className="mx-auto grid size-16 place-items-center rounded-full bg-primary/8 text-primary"><IconComponent className="size-6" /></span>
                  <p className="mt-4 font-black text-foreground">{index + 1}. {title as string}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{text as string}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="feedback" className="px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1320px] gap-8 lg:grid-cols-[0.3fr_0.7fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Your privacy. Your comfort.</p>
            <h2 className="mt-4 prism-serif text-4xl font-black leading-[0.98] text-ink sm:text-5xl">We protect your information and support a smooth experience</h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">We keep things simple, secure, and respectful so you can focus on the experience ahead.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <FeatureCard icon={LockKeyhole} title="Your data stays private" text="We collect only what we need for event access and safety." />
            <FeatureCard icon={ShieldCheck} title="Clear use, clear purpose" text="Your information is used solely to manage access and check-in." />
            <FeatureCard icon={MessageCircleHeart} title="A welcoming experience" text="Our team helps you arrive, enjoy, and leave with a great impression." />
          </div>
        </div>
      </section>

      <section className="px-5 pb-16 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1320px] gap-8 rounded-lg border border-primary/12 bg-card p-8 lg:grid-cols-[0.3fr_0.7fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">After the event</p>
            <h2 className="mt-4 prism-serif text-4xl font-black leading-[0.98] text-ink sm:text-5xl">Your feedback makes a difference</h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">Share your thoughts to help us create even better events in the future.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_0.8fr]">
            <div className="rounded-lg border border-border bg-background p-6">
              <p className="font-black text-foreground">How was your experience?</p>
              <div className="mt-4 flex gap-2 text-brand-orange">☆ ☆ ☆ ☆ ☆</div>
              <div className="mt-4 rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">Share any additional comments...</div>
              <button className="mt-4 h-11 w-full rounded-md bg-primary font-black text-primary-foreground">Send feedback</button>
            </div>
            <div className="rounded-lg border border-border bg-background p-6">
              <p className="font-black text-foreground">Thank you.</p>
              {["Feedback received", "Under review", "Used to improve"].map((item) => (
                <p key={item} className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="size-4 text-success" />{item}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="help" className="px-5 pb-20 sm:px-8 lg:px-10">
        <div className="mx-auto rounded-lg border border-primary/12 bg-card p-8 shadow-[0_24px_80px_rgba(23,18,22,0.08)] sm:p-10 lg:flex lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Guest access</p>
            <h2 className="mt-3 max-w-2xl prism-serif text-4xl font-black leading-tight text-ink">Open your event pass</h2>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-0">
            <a href={portalHref("/open")} className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 font-black text-primary-foreground">Open with code</a>
            <a href="#access" className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-border bg-background px-6 font-black text-foreground"><HelpCircle className="size-4" /> Help</a>
          </div>
        </div>
      </section>
      <footer className="border-t border-primary/10 bg-background px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1320px] gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <BrandMark />
          {[
            ["Portal", "Access", "Check-in", "Feedback", "Help"],
            ["Information", "Privacy policy", "Terms of service", "Event guidelines"],
            ["Support", "Help center", "Contact us", "Hours and location"],
          ].map(([title, ...items]) => (
            <div key={title}><p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{title}</p><div className="mt-3 grid gap-2 text-sm text-muted-foreground">{items.map((item) => <span key={item}>{item}</span>)}</div></div>
          ))}
        </div>
      </footer>
    </main>
  );
}
