import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  MessageCircleHeart,
  PartyPopper,
  QrCode,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  TicketCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";

const moments = [
  "Invitation opened",
  "Registration checked",
  "Guest verified",
  "Activity joined",
  "Feedback moderated",
];

const guestFeatures: Array<{ icon: LucideIcon; title: string; text: string }> = [
  {
    icon: TicketCheck,
    title: "Registration options",
    text: "Support QR code invitations, name-based check-in, or lightweight headcount-only event modes.",
  },
  {
    icon: Search,
    title: "Name search check-in",
    text: "Give registration staff a laptop-friendly search flow when guests do not need app accounts.",
  },
  {
    icon: QrCode,
    title: "QR event access",
    text: "Use browser-based QR flows for invitations, engagement prompts, and post-event pages.",
  },
  {
    icon: PartyPopper,
    title: "In-event engagement",
    text: "Preview polls, Q&A, raffles, word clouds, and simple interactive moments for guests.",
  },
  {
    icon: Camera,
    title: "Post-event memories",
    text: "Collect ratings, short testimonials, photos, and videos after the event through a moderated page.",
  },
  {
    icon: ShieldCheck,
    title: "Moderated by PMCM",
    text: "Guest submissions never publish automatically. PMCM reviews and controls what is used publicly.",
  },
];

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

export default function GuestHome() {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <section className="relative px-5 py-5 sm:px-8 lg:px-10">
        <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_1px_1px,#C01867_1px,transparent_0)] [background-size:30px_30px]" />
        <div className="absolute inset-0 bg-[linear-gradient(125deg,rgba(255,248,242,0.97),rgba(255,240,230,0.78)_44%,rgba(253,232,243,0.72))]" />
        <div className="absolute -right-44 top-20 size-[34rem] rounded-full border border-(--prism-amber)/35" />

        <div className="relative mx-auto max-w-[1420px]">
          <header className="flex items-center justify-between gap-4 rounded-lg border border-primary/12 bg-card/82 px-4 py-3 shadow-[0_18px_60px_rgba(23,18,22,0.08)] backdrop-blur-xl">
            <a href="http://localhost:3001" className="flex items-center gap-3">
              <span className="flex h-12 w-36 items-center justify-center rounded-md border border-primary/12 bg-white px-3 shadow-sm">
                <img src="/pmcm-logo.png" alt="PMCM logo" className="h-9 w-full object-contain" />
              </span>
              <span>
                <span className="block text-xs font-black uppercase tracking-[0.24em] text-foreground">P.R.I.S.M</span>
                <span className="block text-sm text-muted-foreground">Guest Experience</span>
              </span>
            </a>
            <nav className="hidden items-center gap-6 text-sm font-bold text-muted-foreground md:flex">
              <a href="#guest-flow" className="hover:text-foreground">Flow</a>
              <a href="#moments" className="hover:text-foreground">Moments</a>
              <a href="#moderation" className="hover:text-foreground">Moderation</a>
            </nav>
            <Button asChild className="h-10 rounded-full font-black shadow-[0_16px_36px_rgba(23,18,22,0.2)]">
              <a href="/open">Open with code <ArrowRight className="size-4" /></a>
            </Button>
          </header>

          <div className="grid min-h-[calc(100vh-5rem)] items-center gap-12 py-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(480px,0.82fr)]">
            <div>
              <Badge variant="outline" className="rounded-full border-(--prism-amber)/40 bg-accent px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-(--prism-amber)">
                <Sparkles className="size-4" />
                Guest-facing web moments
              </Badge>
              <h1 className="mt-7 max-w-4xl text-5xl font-black leading-[0.9] text-foreground sm:text-7xl xl:text-[6.3rem]">
                Guest journeys opened by event code.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground">
                P.R.I.S.M guest pages are designed for event-day speed: PMCM generates a code from the event, and guests use it for check-in, engagement, and feedback without creating an account.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button asChild className="h-12 rounded-full px-5 text-sm font-black uppercase tracking-[0.14em] shadow-[0_18px_40px_rgba(23,18,22,0.24)]">
                  <a href="/open">Open with code <ArrowRight className="size-4" /></a>
                </Button>
                <Button asChild variant="outline" className="h-12 rounded-full px-5 text-sm font-black uppercase tracking-[0.14em]">
                  <a href="#guest-flow">Preview flow</a>
                </Button>
              </div>
            </div>

            <div className="relative min-h-[560px] overflow-hidden rounded-lg border border-primary/15 bg-secondary shadow-[0_34px_120px_rgba(23,18,22,0.22)]">
              <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(#CCECF4_1px,transparent_1px),linear-gradient(90deg,#CCECF4_1px,transparent_1px)] [background-size:34px_34px]" />
              <div className="absolute left-1/2 top-8 w-[min(22rem,calc(100%-3rem))] -translate-x-1/2 rounded-lg border border-primary/14 bg-card p-4 shadow-[0_30px_90px_rgba(23,18,22,0.22)]">
                <div className="rounded-lg bg-(--prism-ink) p-5 text-sidebar-foreground">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-(--prism-amber)">Guest pass</p>
                  <h2 className="mt-3 text-3xl font-black leading-tight">Leadership Forum 2026</h2>
                  <div className="mt-6 grid place-items-center rounded-lg bg-card p-8 text-foreground">
                    <QrCode className="size-28" />
                  </div>
                  <p className="mt-4 text-center text-sm text-sidebar-foreground/75">Scan at registration desk</p>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    [ScanLine, "Check in"],
                    [PartyPopper, "Poll"],
                    [Star, "Rate"],
                  ].map(([Icon, label]) => {
                    const GuestIcon = Icon as LucideIcon;
                    return (
                      <Card key={label as string} className="gap-0 rounded-lg border-0 bg-background p-3 text-center text-foreground shadow-none">
                        <GuestIcon className="mx-auto size-5" />
                        <p className="mt-2 text-[11px] font-black">{label as string}</p>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="guest-flow" className="border-y border-primary/12 bg-card px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-[1420px]">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-(--prism-amber)">Guest capabilities</p>
            <h2 className="mt-4 text-4xl font-black leading-[0.98] sm:text-5xl">Every guest touchpoint feeds the event record.</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {guestFeatures.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </section>

      <section id="moments" className="bg-(--prism-ink) px-5 py-20 text-sidebar-foreground sm:px-8 lg:px-10">
        <div className="mx-auto max-w-[1420px]">
          <div className="grid gap-10 lg:grid-cols-[0.65fr_1fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-(--prism-amber)">Event-day sequence</p>
              <h2 className="mt-4 text-4xl font-black leading-[0.98] sm:text-5xl">Designed for quick actions under venue pressure.</h2>
              <p className="mt-5 text-lg leading-8 text-sidebar-foreground/75">Guests and registration staff should not need training. The future flow stays browser-based and obvious.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {moments.map((step, index) => (
                <Card key={step} className="gap-0 rounded-lg border-white/15 bg-card/10 p-4 text-sidebar-foreground">
                  <span className="grid size-8 place-items-center rounded-full bg-[#F06030] text-sm font-black text-foreground">{index + 1}</span>
                  <p className="mt-4 text-lg font-black">{step}</p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="moderation" className="bg-background px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1420px] gap-5 rounded-lg border border-primary/12 bg-card p-6 shadow-[0_28px_90px_rgba(23,18,22,0.12)] lg:grid-cols-[0.9fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-(--prism-amber)">Controlled memory</p>
            <h2 className="mt-2 text-3xl font-black text-foreground">Feedback is collected, not auto-published.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Ratings, comments, photos, and videos are routed to PMCM moderation before any public or client-facing use.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              [MessageCircleHeart, "Review"],
              [ClipboardCheck, "Moderate"],
              [CheckCircle2, "Approve"],
            ].map(([Icon, label]) => {
              const GuestIcon = Icon as LucideIcon;
              return (
                <Card key={label as string} className="gap-0 rounded-lg border-0 bg-secondary px-5 py-4 text-center text-sm font-black text-foreground shadow-none">
                  <GuestIcon className="mx-auto mb-2 size-5" />
                  {label as string}
                </Card>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
