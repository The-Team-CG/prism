"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Eye,
  EyeOff,
  Handshake,
  Mail,
  MapPinned,
  Send,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { MOCK_AUTH_SESSION_KEY } from "@/mock/auth-users";
import { mvpApi, type MvpUser } from "@/lib/mvp-api";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type SignInState = {
  email: string;
  password: string;
};

const initialState: SignInState = {
  email: "ana@ayala.test",
  password: "prism-client",
};

const PRIVACY_NOTICE_VERSION = "2026-05-01";

const demoPasswords: Record<string, string> = {
  "ana@ayala.test": "prism-client",
};

const clientDemoUsers: MvpUser[] = [
  {
    id: "usr_client",
    name: "Ana Reyes",
    email: "ana@ayala.test",
    role: "client",
    organization: "Ayala Corp",
    approvalStatus: "approved",
  },
];

const trustPoints = [
  { icon: Handshake, label: "Conforme-gated access", detail: "Your workspace opens only after the signed conforme is on file." },
  { icon: MapPinned, label: "Live event progress", detail: "Briefings, documents, billing, and floorplan updates in one place." },
  { icon: ShieldCheck, label: "Direct PMCM coordination", detail: "Your account is issued and controlled by your event team." },
];

function portalMessage(role: string) {
  if (role === "pmcm-admin" || role === "coordinator") {
    return "Event team and coordinator accounts sign in through the event operations portal at http://localhost:3004.";
  }
  if (role === "supplier") return "Supplier accounts sign in through the supplier portal at http://localhost:3002.";
  return "This portal only accepts approved client accounts.";
}

export function SignInPage() {
  const router = useRouter();
  const [form, setForm] = useState(initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<MvpUser | null>(null);
  const [signedInUser, setSignedInUser] = useState<(MvpUser & { signedInAt: string }) | null>(null);
  const [approvalConsentAccepted, setApprovalConsentAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showDemos, setShowDemos] = useState(false);
  const users = clientDemoUsers;

  function update<K extends keyof SignInState>(key: K, value: SignInState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPendingUser(null);
    setBusy(true);

    try {
      const session = await mvpApi.login(form);
      if (session.role !== "client") {
        setError(portalMessage(session.role));
        return;
      }
      window.localStorage.setItem(MOCK_AUTH_SESSION_KEY, JSON.stringify(session));
      setSignedInUser(session);
      toast.success("Signed in", { description: `${session.name} is now signed in.` });
      const next =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("next")
          : null;
      router.replace(next?.startsWith("/") ? next : "/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed";
      const user = users.find(
        (candidate) => candidate.email.toLowerCase() === form.email.trim().toLowerCase(),
      );
      if (user && user.role !== "client") {
        setError(portalMessage(user.role));
      } else if (user && user.approvalStatus !== "approved") {
        setPendingUser(user);
        setError("This client account is waiting for approval.");
      } else {
        setError(
          message.includes("Invalid")
            ? "Use the approved client account issued by PMCM for this portal."
            : message,
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function requestApproval(user: MvpUser) {
    try {
      await mvpApi.requestApproval(user.email, {
        privacyConsentAccepted: approvalConsentAccepted,
        privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
        marketingConsentAccepted: false,
      });
      toast.success("Approval requested", {
        description: "A backend approval request has been saved for portal review.",
      });
    } catch (err) {
      toast.error("Approval request failed", {
        description: err instanceof Error ? err.message : "Unable to request approval.",
      });
    }
  }

  const demoUsers =
    users.length
      ? users.filter((user) => user.role === "client")
      : ([
          {
            id: "usr_client",
            name: "Ana Reyes",
            role: "client",
            email: "ana@ayala.test",
            organization: "Ayala Corp",
            approvalStatus: "approved",
          },
        ] as MvpUser[]);

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
                <span className="block text-xs text-white/60">Client portal</span>
              </span>
            </div>

            <h1 className="mt-14 text-3xl font-black leading-tight text-white">
              Your event, in one place.
            </h1>
            <p className="mt-4 text-sm leading-7 text-white/60">
              Access briefings, documents, billing milestones, and the official floorplan - all scoped to your event.
            </p>

            <div className="mt-10 flex flex-col gap-5">
              {trustPoints.map((p) => (
                <div key={p.label} className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-white/8 text-(--prism-signal)">
                    <p.icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-black text-white">{p.label}</p>
                    <p className="mt-0.5 text-xs leading-5 text-white/50">{p.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-white/30">(c) 2026 PMCM Events. Inquiry required before access.</p>
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

            <h2 className="text-2xl font-black text-foreground">Sign in to your portal</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Approved clients only. Access requires a signed conforme.
            </p>

            {signedInUser ? (
              <div className="mt-6 rounded-lg border border-primary/20 bg-secondary p-4">
                <div className="flex items-center gap-3">
                  <BadgeCheck className="size-5 text-primary" />
                  <div>
                    <p className="text-sm font-black text-foreground">{signedInUser.name}</p>
                    <p className="text-xs text-muted-foreground">{signedInUser.organization}</p>
                  </div>
                </div>
                <Button asChild className="mt-4 h-11 w-full rounded-md font-black">
                  <a href="/dashboard">
                    Continue to dashboard <ArrowRight className="size-4" />
                  </a>
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
                <label className="grid gap-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-muted-foreground">
                    <Mail className="size-3.5" /> Email
                  </span>
                  <Input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    className="h-12 bg-card"
                    placeholder="ana@ayala.test"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-muted-foreground">
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
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    className="h-12 bg-card"
                  />
                </label>

                {error && (
                  <Alert variant="destructive" className="rounded-md">
                    <AlertTitle>Sign in failed</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {pendingUser && (
                  <Alert className="rounded-md border-(--prism-amber)/30 bg-accent">
                    <ShieldCheck className="text-(--prism-amber)" />
                    <AlertTitle>Approval required</AlertTitle>
                    <AlertDescription>
                      {pendingUser.name} exists, but your event team must approve access before sign-in.
                    </AlertDescription>
                    <label className="col-start-2 mt-3 flex items-start gap-2 text-sm leading-5 text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={approvalConsentAccepted}
                        onChange={(e) => setApprovalConsentAccepted(e.target.checked)}
                        className="mt-1 size-4 accent-primary"
                      />
                      <span>I consent to this account request being processed for portal access review.</span>
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!approvalConsentAccepted}
                      onClick={() => requestApproval(pendingUser)}
                      className="col-start-2 mt-4 h-11 rounded-md font-bold"
                    >
                      <Send className="size-4" /> Request approval
                    </Button>
                  </Alert>
                )}

                <Button type="submit" disabled={busy} className="h-12 w-full rounded-md font-black">
                  {busy ? "Signing in..." : "Sign in"} <ArrowRight className="size-4" />
                </Button>

                <a
                  href="/sign-up"
                  className="text-center text-sm text-muted-foreground hover:text-foreground"
                >
                  Need access?{" "}
                  <span className="font-bold text-foreground underline-offset-4 hover:underline">
                    Request here →
                  </span>
                </a>

                <a
                  href="/inquiry"
                  className="text-center text-xs text-muted-foreground hover:text-foreground"
                >
                  No inquiry yet?{" "}
                  <span className="underline-offset-4 hover:underline">Start with an inquiry</span>
                </a>
              </form>
            )}

            {/* Demo accounts */}
            <details
              className="mt-6 rounded-lg border border-border"
              open={showDemos}
              onToggle={(e) => setShowDemos((e.currentTarget as HTMLDetailsElement).open)}
            >
              <summary className="cursor-pointer px-4 py-3 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground">
                Demo accounts
              </summary>
              <div className="flex flex-col gap-2 px-4 pb-4">
                {demoUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => {
                      update("email", user.email);
                      update("password", demoPasswords[user.email] ?? "prism-client");
                      setShowDemos(false);
                    }}
                    className="rounded-md border border-border bg-card p-3 text-left transition hover:border-primary/30 hover:bg-secondary"
                  >
                    <p className="text-xs font-black text-foreground">{user.name}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{user.email}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {demoPasswords[user.email] ?? "configured in API"}
                    </p>
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
