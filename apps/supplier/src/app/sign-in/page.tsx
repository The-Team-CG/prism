"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, ShieldCheck, Truck } from "lucide-react";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { PrismPublicShell } from "@prism/ui";

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

export default function SupplierSignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("ops@xperto.test");
  const [password, setPassword] = useState("prism-supplier");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [approvalConsentAccepted, setApprovalConsentAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<SupplierSession | null>(null);

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
        setError(user.role === "client" ? "Client accounts belong in prism-client." : "PMCM accounts belong in prism-event.");
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
      setNotice("Approval request sent. PMCM can approve it in prism-event.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to request approval");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PrismPublicShell
      productDetail="Supplier portal"
      eyebrow="Supplier access"
      badgeIcon={Truck}
      badgeText="Supplier sign in"
      title="Quote requests, readiness, and event-day handoffs."
      description="Supplier accounts require PMCM approval before portal access. The dashboard keeps quote status and operational expectations separate from public pages."
      aside={
        <Card className="rounded-lg border-primary/12 bg-card shadow-[0_24px_80px_rgba(23,18,22,0.12)]">
          <form onSubmit={submit}>
            <CardHeader>
              <div className="grid size-11 place-items-center rounded-md bg-secondary text-primary">
                <LockKeyhole className="size-5" />
              </div>
              <CardTitle className="mt-2 text-2xl font-black">Sign in</CardTitle>
              <p className="text-sm text-muted-foreground">Approved supplier accounts only.</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Input value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 bg-white" />
              <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" className="h-11 bg-white" />
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
              <Button disabled={busy} className="h-11 w-full rounded-md font-black">
                {busy ? "Working" : "Sign in"} <ArrowRight className="size-4" />
              </Button>
              <label className="flex items-start gap-2 rounded-md border border-border bg-background p-3 text-sm leading-5 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={approvalConsentAccepted}
                  onChange={(event) => setApprovalConsentAccepted(event.target.checked)}
                  className="mt-1 size-4 accent-primary"
                />
                <span>I consent to PMCM processing this supplier approval request for portal access review.</span>
              </label>
              <Button type="button" variant="outline" disabled={busy || !approvalConsentAccepted} onClick={requestApproval} className="h-11 w-full rounded-md font-black">
                <ShieldCheck className="size-4" /> Request PMCM approval
              </Button>
            </CardContent>
          </form>
          {existing && (
            <a href="/dashboard" className="mx-5 mb-4 inline-flex h-10 w-[calc(100%-2.5rem)] items-center justify-center rounded-md bg-secondary text-sm font-black text-foreground">
              Continue as {existing.name}
            </a>
          )}
          <p className="px-5 pb-5 text-xs leading-5 text-muted-foreground">
            Demo supplier: ops@xperto.test / prism-supplier
          </p>
        </Card>
      }
    />
  );
}
