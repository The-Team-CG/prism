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
import { MOCK_AUTH_SESSION_KEY } from "@/mock/auth-users";
import { mvpApi, type MvpUser } from "@/lib/mvp-api";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";
import { Separator } from "../ui/separator";
import { PrismPublicShell } from "@prism/ui";

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
        setError(message.includes("Invalid") ? "Use the approved client account issued by PMCM for this portal." : message);
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

  const demoUsers = users.length ? users.filter((user) => user.role === "client") : [
    { id: "usr_client", name: "Ana Reyes", role: "client", email: "ana@ayala.test", organization: "Ayala Corp", approvalStatus: "approved" },
  ] as MvpUser[];

  return (
    <PrismPublicShell
      productDetail="Client portal"
      eyebrow="Client access"
      badgeIcon={ShieldCheck}
      badgeText="Accepted inquiry and signed conforme required"
      title="Sign in to your confirmed event workspace."
      description="Client access opens only after your inquiry is accepted and the signed conforme is recorded. The portal shows briefing, documents, billing, activity, and official read-only floorplans."
      aside={
        <Card className="rounded-lg border-[#171216]/12 bg-card shadow-[0_28px_90px_rgba(23,18,22,0.18)]">
          <CardHeader className="gap-2">
            <div className="mb-2 grid size-11 place-items-center rounded-md bg-secondary text-primary">
              <LockKeyhole size={20} />
            </div>
            <CardTitle className="text-2xl font-black text-foreground">Sign in</CardTitle>
            <CardDescription>Approved client accounts can continue. Pending accounts must request event team approval.</CardDescription>
          </CardHeader>
          <CardContent>
            {signedInUser ? (
              <Alert className="rounded-md border-primary/18 bg-secondary">
                <BadgeCheck className="text-primary" />
                <AlertTitle>{signedInUser.name}</AlertTitle>
                <AlertDescription>
                  Signed in as {signedInUser.role} for {signedInUser.organization}.
                </AlertDescription>
                <Button asChild className="col-start-2 mt-4 h-11 rounded-md font-bold">
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
                      className="h-11 rounded-md border-border bg-card"
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
                      className="h-11 rounded-md border-border bg-card"
                    />
                    <FieldDescription className="text-xs leading-5">
                      Credentials and approval status are checked against the PMCM portal access list.
                    </FieldDescription>
                  </Field>

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
                          onChange={(event) => setApprovalConsentAccepted(event.target.checked)}
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
                        <Send data-icon="inline-start" />
                        Request approval
                      </Button>
                    </Alert>
                  )}

                  <Button type="submit" disabled={busy} className="h-12 rounded-md text-sm font-black uppercase tracking-[0.16em]">
                    {busy ? "Signing in" : "Sign in"} <ArrowRight data-icon="inline-end" />
                  </Button>
                </FieldGroup>
              </form>
            )}

            <Separator className="my-5 bg-primary/12" />
            <p className="text-center text-sm text-muted-foreground">
              Need to start an event?{" "}
              <a href="/inquiry" className="font-bold text-foreground underline-offset-4 hover:underline">
                Submit an inquiry
              </a>
            </p>
          </CardContent>
        </Card>
      }
    >
      <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
        {demoUsers.map((user) => (
          <Card key={user.id} className="gap-0 rounded-md border-primary/15 bg-card/70 shadow-none">
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
    </PrismPublicShell>
  );
}
