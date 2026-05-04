"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, PackageCheck, ShieldCheck, Truck, Zap } from "lucide-react";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

type SupplierSession = {
  id: string;
  name: string;
  email: string;
  role: string;
  organization: string;
  signedInAt: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const SESSION_KEY = "prism:supplier-session";
const API_OFFLINE_MESSAGE = "P.R.I.S.M API is offline. Start `prism-api` on port 4000, then try again.";
const PRIVACY_NOTICE_VERSION = "2026-05-01";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      ...init,
    });
  } catch (error) {
    if (error instanceof TypeError) throw new Error(API_OFFLINE_MESSAGE);
    throw error;
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    throw new Error(message || "Supplier sign in failed");
  }
  return body.data as T;
}

function readSession() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SupplierSession;
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

const demoAccounts = [
  { email: "ops@xperto.test", password: "prism-supplier", label: "Xperto Events (Tier 1)" },
  { email: "flowers@bloom.test", password: "prism-supplier", label: "Bloom Florals (Tier 2)" },
];

const benefits = [
  { icon: PackageCheck, label: "Quote submissions", detail: "Submit and revise quotes before deadlines" },
  { icon: Truck, label: "Assignment readiness", detail: "Confirm your event-day assignment and contract" },
  { icon: Zap, label: "Event-day status", detail: "Report arrival, setup, and egress in real time" },
];

export default function SupplierSignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("ops@xperto.test");
  const [password, setPassword] = useState("prism-supplier");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [approvalConsentAccepted, setApprovalConsentAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<SupplierSession | null>(null);
  const [showDemos, setShowDemos] = useState(false);

  useEffect(() => {
    const current = readSession();
    if (current?.role === "supplier") setExisting(current);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const user = await request<Omit<SupplierSession, "signedInAt">>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (user.role !== "supplier") {
        setError(
          user.role === "client"
            ? "Client accounts belong in the client portal."
            : "PMCM accounts belong in the event command portal.",
        );
        return;
      }
      const session = { ...user, signedInAt: new Date().toISOString() };
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next?.startsWith("/") ? next : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Supplier sign in failed");
    } finally {
      setBusy(false);
    }
  }

  async function requestApproval() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await request("/api/auth/approval-requests", {
        method: "POST",
        body: JSON.stringify({
          email,
          privacyConsentAccepted: approvalConsentAccepted,
          privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
          marketingConsentAccepted: false,
        }),
      });
      setNotice("Approval request saved for PMCM review in the event command portal.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to request approval");
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
                <span className="block text-xs text-white/60">Supplier portal</span>
              </span>
            </div>

            <h1 className="mt-14 text-3xl font-black leading-tight text-white">
              Manage your PMCM assignments.
            </h1>
            <p className="mt-4 text-sm leading-7 text-white/60">
              Quotes, readiness confirmation, and event-day reporting - all in one place, scoped to your account.
            </p>

            <div className="mt-10 flex flex-col gap-4">
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

          <p className="text-xs text-white/30">(c) 2026 PMCM Events. Supplier access only.</p>
        </div>

        {/* Right panel - form */}
        <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16 md:px-12">
          <div className="w-full max-w-sm">
            {/* Mobile brand mark */}
            <div className="mb-8 flex items-center gap-3 md:hidden">
              <span className="grid size-10 place-items-center rounded-md bg-foreground text-sm font-black text-background">P</span>
              <span className="text-sm font-black uppercase tracking-widest text-foreground">P.R.I.S.M</span>
            </div>

            <h2 className="text-2xl font-black text-foreground">Sign in to your portal</h2>
            <p className="mt-1 text-sm text-muted-foreground">Approved supplier accounts only.</p>

            {existing && (
              <a
                href="/dashboard"
                className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-secondary text-sm font-black text-foreground transition hover:bg-secondary/80"
              >
                Continue as {existing.name} →
              </a>
            )}

            <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
              <label className="grid gap-1.5">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Email</span>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 bg-card"
                  placeholder="supplier@example.com"
                  required
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Password</span>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 bg-card pr-11"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </label>

              {error && (
                <Alert variant="destructive" className="rounded-md">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {notice && (
                <Alert className="rounded-md border-(--prism-success)/20 bg-(--prism-success)/8 text-(--prism-success)">
                  <AlertDescription>{notice}</AlertDescription>
                </Alert>
              )}

              <Button disabled={busy} className="h-11 w-full rounded-md font-black" type="submit">
                {busy ? "Signing in..." : "Sign in"} <ArrowRight className="size-4" />
              </Button>
            </form>

            {/* Request access */}
            <div className="mt-6 rounded-lg border border-border bg-secondary/30 p-4">
              <p className="text-xs font-black text-foreground">Need access?</p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                Request PMCM approval for a new supplier account.
              </p>
              <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={approvalConsentAccepted}
                  onChange={(e) => setApprovalConsentAccepted(e.target.checked)}
                  className="mt-0.5 size-4 accent-(--prism-signal)"
                />
                <span>I consent to PMCM processing this approval request for supplier portal access review.</span>
              </label>
              <Button
                type="button"
                variant="outline"
                disabled={busy || !approvalConsentAccepted}
                onClick={requestApproval}
                className="mt-3 h-9 w-full rounded-md text-xs font-black"
              >
                <ShieldCheck className="size-4" /> Request PMCM approval
              </Button>
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
                    className="rounded-md border border-border bg-card p-3 text-left transition hover:border-(--prism-signal)/30 hover:bg-secondary"
                  >
                    <p className="text-xs font-black text-foreground">{demo.label}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{demo.email}</p>
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
