"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Eye,
  EyeOff,
  KeyRound,
  Radio,
  ShieldCheck,
  Users,
} from "lucide-react";
import { mvpApi } from "@/lib/mvp-api";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { saveEventSession, type EventSession } from "@/app/lib/session";

const benefits = [
  { icon: CalendarDays, label: "End-to-end event management", detail: "Track every inquiry, conforme, and milestone from one command view." },
  { icon: Users, label: "Coordinator and supplier desk", detail: "Assign coordinators, manage quotes, confirm readiness." },
  { icon: Radio, label: "Live operations", detail: "Event-day status, urgent issues, and check-in feed in real time." },
];

const demoAccounts = [
  { name: "Ms. Mys (PMCM Admin)", email: "mys@pmcm.test", password: "prism-admin", role: "pmcm-admin" },
  { name: "Marco (Coordinator)", email: "marco@pmcm.test", password: "prism-coordinator", role: "coordinator" },
];

export default function EventSignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("mys@pmcm.test");
  const [password, setPassword] = useState("prism-admin");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showDemos, setShowDemos] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await mvpApi.login({ email, password });
      if (session.role !== "pmcm-admin" && session.role !== "coordinator") {
        setError(
          session.role === "client"
            ? "Client accounts sign in through the client portal at http://localhost:3001."
            : "Supplier accounts sign in through the supplier portal at http://localhost:3002.",
        );
        return;
      }
      const full: EventSession = { ...session, signedInAt: new Date().toISOString() };
      saveEventSession(full);
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next?.startsWith("/") ? next : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-background">
      {/* Top signal bar */}
      <div className="fixed inset-x-0 top-0 z-50 h-0.75 bg-(--prism-signal)" />

      <div className="grid min-h-screen md:grid-cols-2">
        {/* Left panel - brand */}
        <div className="relative hidden flex-col justify-between bg-[#171216] p-10 md:flex">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-md bg-white text-xl font-black text-[#171216]">
                P
              </span>
              <span>
                <span className="block text-xs font-black uppercase tracking-[0.18em] text-(--prism-signal)">
                  P.R.I.S.M
                </span>
                <span className="block text-xs text-white/60">Event Command</span>
              </span>
            </div>

            <h1 className="mt-14 text-3xl font-black leading-tight text-white">
              One command center for every PMCM event handoff.
            </h1>
            <p className="mt-4 text-sm leading-7 text-white/60">
              Inquiries, floorplans, suppliers, coordinators, billing, live ops, and closure - all scoped to your role.
            </p>

            <div className="mt-10 flex flex-col gap-5">
              {benefits.map((b) => (
                <div key={b.label} className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-white/8 text-(--prism-signal)">
                    <b.icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-black text-white">{b.label}</p>
                    <p className="mt-0.5 text-xs leading-5 text-white/50">{b.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-white/30">(c) 2026 PMCM Events. Authorized team access only.</p>
        </div>

        {/* Right panel - form */}
        <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16 md:px-12">
          <div className="w-full max-w-sm">
            {/* Mobile brand mark */}
            <div className="mb-8 flex items-center gap-3 md:hidden">
              <span className="grid size-10 place-items-center rounded-md bg-foreground text-sm font-black text-background">
                P
              </span>
              <span className="text-sm font-black uppercase tracking-widest text-foreground">
                P.R.I.S.M
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-md bg-secondary text-primary">
                <KeyRound className="size-5" />
              </span>
              <div>
                <h2 className="text-2xl font-black text-foreground">Command access</h2>
                <p className="text-sm text-muted-foreground">PMCM admin and coordinator accounts only.</p>
              </div>
            </div>

            <form onSubmit={submit} className="mt-7 flex flex-col gap-4">
              <label className="grid gap-1.5">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Email</span>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 bg-card"
                  placeholder="mys@pmcm.test"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Password
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </span>
                <Input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 bg-card"
                />
              </label>

              {error && (
                <Alert variant="destructive" className="rounded-md">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={busy}
                className="h-12 w-full rounded-md font-black"
              >
                {busy ? "Opening command..." : "Enter command"} <ArrowRight className="size-4" />
              </Button>
            </form>

            <div className="mt-4 flex items-start gap-2 rounded-md border border-border bg-secondary/50 p-3 text-xs leading-5 text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                This portal is for the PMCM event team only. Client and supplier accounts have separate portals.
              </span>
            </div>

            {/* Demo accounts */}
            <details
              className="mt-5 rounded-lg border border-border"
              open={showDemos}
              onToggle={(e) => setShowDemos((e.currentTarget as HTMLDetailsElement).open)}
            >
              <summary className="cursor-pointer px-4 py-3 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground">
                Demo accounts
              </summary>
              <div className="flex flex-col gap-2 px-4 pb-4">
                {demoAccounts.map((demo) => (
                  <button
                    key={demo.email}
                    type="button"
                    onClick={() => {
                      setEmail(demo.email);
                      setPassword(demo.password);
                      setShowDemos(false);
                    }}
                    className="rounded-md border border-border bg-card p-3 text-left transition hover:border-primary/30 hover:bg-secondary"
                  >
                    <p className="text-xs font-black text-foreground">{demo.name}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{demo.email}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{demo.password}</p>
                  </button>
                ))}
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
