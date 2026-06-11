"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, PackageCheck, Shield, ShieldCheck } from "lucide-react";
import { PrismBrandLogo } from "@prism/ui";
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
const API_OFFLINE_MESSAGE =
  "P.R.I.S.M API is offline. Start `prism-api` on port 4000, then try again.";
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
  try { return JSON.parse(raw) as SupplierSession; }
  catch { window.localStorage.removeItem(SESSION_KEY); return null; }
}

const sampleAccounts = [
  { email: "ops@xperto.test", password: "prism-supplier", label: "Xperto Events", tier: "Tier 1 supplier" },
  { email: "flowers@bloom.test", password: "prism-supplier", label: "Bloom Florals", tier: "Tier 2 supplier" },
];

export default function SupplierSignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("ops@xperto.test");
  const [password, setPassword] = useState("prism-supplier");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [approvalConsentAccepted, setApprovalConsentAccepted] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
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
      setShowApproval(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to request approval");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f6f6]">
      <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <section className="mx-auto mt-6 w-full max-w-lg sm:mt-8">
          <div className="flex justify-center">
            <PrismBrandLogo
              detail="Supplier Portal"
              className="justify-center"
              markClassName="size-16 bg-transparent ring-0 sm:size-20"
            />
          </div>

          {/* Resume session banner */}
          {existing && (
            <a
              href="/dashboard"
              className="mt-6 flex items-center justify-between rounded-xl border border-[#d9d9d9] bg-white px-5 py-4 shadow-sm transition hover:border-[#c01867]/40 sm:mt-8"
            >
              <div>
                <p className="text-sm font-semibold text-[#171216]">Continue as {existing.name}</p>
                <p className="text-xs text-[#888888]">{existing.organization}</p>
              </div>
              <ArrowRight className="size-4 text-[#a7a7a7]" />
            </a>
          )}

          {/* Card */}
          <div className="mt-6 overflow-hidden rounded-xl border border-[#d9d9d9] shadow-[0_8px_22px_rgba(17,24,39,0.12)] sm:mt-8">
            {/* Header band */}
            <div className="flex items-center gap-3 bg-[#c01867] px-5 py-5 sm:px-6 sm:py-6">
              <div className="inline-flex size-10 items-center justify-center rounded-lg border border-white/20 bg-white/10">
                <PackageCheck className="size-5 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-white sm:text-[24px]">Welcome Back</h2>
                <p className="text-base text-white/90 sm:text-sm">Sign in to continue</p>
              </div>
            </div>

            {/* Form body */}
            <div className="bg-[#f6f6f6] px-4 py-6 sm:px-8 sm:py-8">
              <form className="space-y-5" onSubmit={submit}>
                <div>
                  <label htmlFor="email" className="mb-2 block text-base font-medium text-[#171216] sm:text-sm">
                    Email address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="supplier@example.com"
                    required
                    className="h-13 rounded-lg border-[#d9d9d9] bg-white text-base text-[#444] placeholder:text-[#a7a7a7] focus-visible:ring-1 focus-visible:ring-[#c01867] sm:h-12 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-base font-medium text-[#171216] sm:text-sm">
                    Password
                  </label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="h-13 rounded-lg border-[#d9d9d9] bg-white pr-11 text-base text-[#444] placeholder:text-[#a7a7a7] focus-visible:ring-1 focus-visible:ring-[#c01867] sm:h-12 sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a7a7a7] transition hover:text-[#171216]"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </button>
                  </div>
                </div>

                {error && <p className="text-sm text-[#b4233a]" role="alert">{error}</p>}
                {notice && <p className="text-sm text-[#1f7a4b]" role="status">{notice}</p>}

                <button
                  type="submit"
                  disabled={busy}
                  className="flex h-14 w-full items-center justify-center rounded-lg bg-[#c01867] text-lg font-semibold text-white transition hover:bg-[#a81459] disabled:cursor-not-allowed disabled:opacity-70 sm:h-12 sm:text-base"
                >
                  {busy ? "Signing in…" : "Sign in"}
                </button>
              </form>

              {/* Sample accounts */}
              <div className="mt-6 border-t border-[#d9d9d9] pt-5">
                <p className="mb-3 text-sm font-medium text-[#888888]">Sample accounts</p>
                <div className="flex flex-col gap-2">
                  {sampleAccounts.map((sample) => (
                    <button
                      key={sample.email}
                      type="button"
                      onClick={() => { setEmail(sample.email); setPassword(sample.password); }}
                      className="flex items-center justify-between rounded-lg border border-[#d9d9d9] bg-white px-4 py-3 text-left transition hover:border-[#c01867]/40 hover:bg-white/80"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[#171216]">{sample.label}</p>
                        <p className="text-xs text-[#888888]">{sample.tier}</p>
                      </div>
                      <ArrowRight className="size-4 text-[#a7a7a7]" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Request access */}
              <div className="mt-5 border-t border-[#d9d9d9] pt-5">
                <button
                  type="button"
                  onClick={() => setShowApproval((v) => !v)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <p className="text-sm font-medium text-[#171216]">Need supplier access?</p>
                  <span className="text-xs text-[#888888]">{showApproval ? "Close ↑" : "Request ↓"}</span>
                </button>
                {showApproval && (
                  <div className="mt-3 flex flex-col gap-3">
                    <p className="text-sm leading-5 text-[#888888]">
                      Request PMCM approval for a new supplier account. A coordinator will review and activate your access.
                    </p>
                    <label className="flex items-start gap-2.5 text-sm leading-5 text-[#888888]">
                      <input
                        type="checkbox"
                        checked={approvalConsentAccepted}
                        onChange={(e) => setApprovalConsentAccepted(e.target.checked)}
                        className="mt-0.5 size-4 accent-[#c01867]"
                      />
                      <span>I consent to PMCM processing this request for supplier portal access review.</span>
                    </label>
                    <button
                      type="button"
                      disabled={busy || !approvalConsentAccepted}
                      onClick={requestApproval}
                      className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#d9d9d9] bg-white text-sm font-medium text-[#171216] transition hover:border-[#c01867]/40 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ShieldCheck className="size-4" /> Request PMCM approval
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center sm:mt-10">
            <p className="inline-flex items-center gap-2 text-base text-[#888888] sm:text-sm">
              <Shield className="size-4" />
              Approved supplier accounts only
            </p>
            <p className="mt-2 text-sm text-[#a0a0a0] sm:text-xs">
              Contact PMCM for account issues or access requests.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
