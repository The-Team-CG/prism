"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Send,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  MOCK_AUTH_SESSION_KEY,
} from "@/mock/auth-users";
import { mvpApi, type MvpUser } from "@/lib/mvp-api";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";
import { Separator } from "../ui/separator";

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

function portalMessage(role: string) {
  if (role === "pmcm-admin" || role === "coordinator") {
    return "PMCM and coordinator accounts sign in through prism-event at http://localhost:3004.";
  }
  if (role === "supplier") return "Supplier accounts sign in through prism-supplier at http://localhost:3002.";
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
      toast.success("Signed in", {
        description: `${session.name} is now signed in.`,
      });
      const next = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("next")
        : null;
      router.replace(next?.startsWith("/") ? next : "/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed";
      const user = users.find((candidate) => candidate.email.toLowerCase() === form.email.trim().toLowerCase());
      if (user && user.role !== "client") {
        setError(portalMessage(user.role));
      } else if (user && user.approvalStatus !== "approved") {
        setPendingUser(user);
        setError("This client account is waiting for approval.");
      } else {
        setError(message.includes("Invalid") ? "Use one of the mock credentials listed on this page." : message);
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

  return (
    <main className="min-h-screen overflow-auto bg-background text-foreground">
      <section className="relative min-h-screen px-5 py-6 sm:px-8 lg:px-10">
        <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_1px_1px,#C01867_1px,transparent_0)] [background-size:30px_30px]" />
        <div className="absolute inset-0 bg-[linear-gradient(125deg,rgba(255,248,242,0.92),rgba(233,247,251,0.78)_58%,rgba(255,248,242,0.95))]" />

        <div className="relative mx-auto grid min-h-[calc(100vh-3rem)] max-w-[1180px] grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,0.9fr)_420px]">
          <div className="max-w-3xl">
            <a href="/" className="mb-10 inline-flex items-center gap-3">
              <span className="flex h-12 w-36 items-center justify-center rounded-md border border-primary/12 bg-white px-3 shadow-sm">
                <img src="/pmcm-logo.png" alt="PMCM logo" className="h-9 w-full object-contain" />
              </span>
              <span>
                <span className="block text-xs font-black uppercase tracking-[0.24em] text-foreground">P.R.I.S.M</span>
                <span className="block text-sm text-muted-foreground">Secure mock access</span>
              </span>
            </a>

            <Badge variant="outline" className="mb-6 rounded-full border-[#F06030]/30 bg-accent/75 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-(--prism-amber)">
              <ShieldCheck size={14} />
              Admin approval required
            </Badge>
            <h1 className="text-5xl font-black leading-[0.94] tracking-normal text-foreground sm:text-6xl lg:text-7xl">
              Sign in to P.R.I.S.M.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              Client access opens only after PMCM approves the account in the event command app.
            </p>

            <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
              {(users.length ? users.filter((user) => user.role === "client") : [
                { id: "usr_client", name: "Ana Reyes", role: "client", email: "ana@ayala.test", organization: "Ayala Corp", approvalStatus: "approved" },
              ] as MvpUser[]).map((user) => (
                <Card key={user.id} className="gap-0 rounded-sm border-primary/15 bg-card/65 shadow-none">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-foreground">{user.role}</p>
                      <Badge variant={user.approvalStatus === "approved" ? "secondary" : "outline"} className="rounded-full">
                        {user.approvalStatus}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm font-bold text-foreground">{user.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{demoPasswords[user.email] ?? "configured in API"}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Card className="rounded-[0.45rem] border-[#171216]/12 bg-card shadow-[0_28px_90px_rgba(23,18,22,0.18)]">
            <CardHeader className="gap-2">
              <div className="mb-2 grid size-11 place-items-center rounded-sm bg-secondary text-primary">
                <LockKeyhole size={20} />
              </div>
              <CardTitle className="text-2xl font-black text-foreground">Sign in</CardTitle>
              <CardDescription>Approved client accounts can continue. Pending accounts must request PMCM approval.</CardDescription>
            </CardHeader>
            <CardContent>
              {signedInUser ? (
                <Alert className="rounded-sm border-[#9060A0]/18 bg-secondary">
                  <BadgeCheck className="text-primary" />
                  <AlertTitle>{signedInUser.name}</AlertTitle>
                  <AlertDescription>
                    Signed in as {signedInUser.role} for {signedInUser.organization}.
                  </AlertDescription>
                  <Button asChild className="col-start-2 mt-4 h-11 rounded-sm font-bold">
                    <a href="/dashboard">
                      Continue <ArrowRight data-icon="inline-end" />
                    </a>
                  </Button>
                </Alert>
              ) : (
                <form onSubmit={submit}>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="email" className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-primary">
                        <Mail size={14} /> Email
                      </FieldLabel>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={form.email}
                        onChange={(event) => update("email", event.target.value)}
                        className="h-11 rounded-sm border-border bg-card"
                        placeholder="ana@ayala.test"
                      />
                    </Field>

                    <Field>
                      <div className="flex items-center justify-between gap-3">
                        <FieldLabel htmlFor="password" className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-primary">
                          <LockKeyhole size={14} /> Password
                        </FieldLabel>
                        <button
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        required
                        value={form.password}
                        onChange={(event) => update("password", event.target.value)}
                        className="h-11 rounded-sm border-border bg-card"
                      />
                      <FieldDescription className="text-xs leading-5">
                        Credentials and approval status are checked against local mock data only.
                      </FieldDescription>
                    </Field>

                    {error && (
                      <Alert variant="destructive" className="rounded-sm">
                        <AlertTitle>Sign in failed</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    {pendingUser && (
                      <Alert className="rounded-sm border-[#F06030]/30 bg-accent">
                        <ShieldCheck className="text-(--prism-amber)" />
                        <AlertTitle>Approval required</AlertTitle>
                      <AlertDescription>
                        {pendingUser.name} exists, but PMCM must approve access in prism-event before sign-in.
                      </AlertDescription>
                      <label className="col-start-2 mt-3 flex items-start gap-2 text-sm leading-5 text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={approvalConsentAccepted}
                          onChange={(event) => setApprovalConsentAccepted(event.target.checked)}
                          className="mt-1 size-4 accent-primary"
                        />
                        <span>I consent to PMCM processing this account request for portal access review.</span>
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!approvalConsentAccepted}
                        onClick={() => requestApproval(pendingUser)}
                        className="col-start-2 mt-4 h-11 rounded-sm font-bold"
                      >
                          <Send data-icon="inline-start" />
                          Request approval
                        </Button>
                      </Alert>
                    )}

                    <Button type="submit" disabled={busy} className="h-12 rounded-sm text-sm font-black uppercase tracking-[0.16em]">
                      {busy ? "Signing in" : "Sign in"} <ArrowRight data-icon="inline-end" />
                    </Button>
                  </FieldGroup>
                </form>
              )}

              <Separator className="my-5 bg-[#9060A0]/12" />
              <p className="text-center text-sm text-muted-foreground">
                Need to start an event?{" "}
                <a href="/inquiry" className="font-bold text-foreground underline-offset-4 hover:underline">
                  Submit an inquiry
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
