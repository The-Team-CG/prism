"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BadgeCheck, Eye, EyeOff, Handshake, Send, Shield } from "lucide-react";
import { toast } from "sonner";
import { PrismBrandLogo } from "@prism/ui";
import { MOCK_AUTH_SESSION_KEY } from "@/mock/auth-users";
import { mvpApi, type MvpUser } from "@/lib/mvp-api";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type SignInState = { email: string; password: string };

const initialState: SignInState = { email: "ana@ayala.test", password: "prism-client" };
const PRIVACY_NOTICE_VERSION = "2026-05-01";
const demoPasswords: Record<string, string> = { "ana@ayala.test": "prism-client" };

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
  if (role === "pmcm-admin" || role === "coordinator")
    return "Event team accounts sign in through the event operations portal at http://localhost:3004.";
  if (role === "supplier")
    return "Supplier accounts sign in through the supplier portal at http://localhost:3002.";
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

  function update<K extends keyof SignInState>(key: K, value: SignInState[K]) {
    setForm((c) => ({ ...c, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPendingUser(null);
    setBusy(true);
    try {
      const session = await mvpApi.login(form);
      if (session.role !== "client") { setError(portalMessage(session.role)); return; }
      window.localStorage.setItem(MOCK_AUTH_SESSION_KEY, JSON.stringify(session));
      setSignedInUser(session);
      toast.success("Signed in", { description: `${session.name} is now signed in.` });
      const next = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("next") : null;
      router.replace(next?.startsWith("/") ? next : "/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed";
      const user = clientDemoUsers.find(
        (u) => u.email.toLowerCase() === form.email.trim().toLowerCase(),
      );
      if (user && user.role !== "client") setError(portalMessage(user.role));
      else if (user && user.approvalStatus !== "approved") {
        setPendingUser(user);
        setError("This client account is waiting for approval.");
      } else {
        setError(message.includes("Invalid")
          ? "Use the approved client account issued by PMCM for this portal."
          : message);
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
    <main className="min-h-screen bg-[#f6f6f6]">
      <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <section className="mx-auto mt-6 w-full max-w-lg sm:mt-8">
          <div className="flex justify-center">
            <PrismBrandLogo
              detail="Client Portal"
              className="justify-center"
              markClassName="size-16 bg-transparent ring-0 sm:size-20"
            />
          </div>

          {/* Card */}
          <div className="mt-6 overflow-hidden rounded-xl border border-[#d9d9d9] shadow-[0_8px_22px_rgba(17,24,39,0.12)] sm:mt-8">
            {/* Header band */}
            <div className="flex items-center gap-3 bg-[#c01867] px-5 py-5 sm:px-6 sm:py-6">
              <div className="inline-flex size-10 items-center justify-center rounded-lg border border-white/20 bg-white/10">
                <Handshake className="size-5 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-white sm:text-[24px]">Welcome Back</h2>
                <p className="text-base text-white/90 sm:text-sm">Sign in to continue</p>
              </div>
            </div>

            {/* Form body */}
            <div className="bg-[#f6f6f6] px-4 py-6 sm:px-8 sm:py-8">
              {signedInUser ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3 rounded-lg border border-[#d9d9d9] bg-white px-4 py-3">
                    <BadgeCheck className="size-5 shrink-0 text-[#c01867]" />
                    <div>
                      <p className="text-sm font-semibold text-[#171216]">{signedInUser.name}</p>
                      <p className="text-xs text-[#888888]">{signedInUser.organization}</p>
                    </div>
                  </div>
                  <a
                    href="/dashboard"
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-[#c01867] text-lg font-semibold text-white transition hover:bg-[#a81459] sm:h-12 sm:text-base"
                  >
                    Continue to dashboard <ArrowRight className="size-4" />
                  </a>
                </div>
              ) : (
                <form className="space-y-5" onSubmit={submit}>
                  <div>
                    <label htmlFor="email" className="mb-2 block text-base font-medium text-[#171216] sm:text-sm">
                      Email address
                    </label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      placeholder="ana@ayala.test"
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
                        required
                        value={form.password}
                        onChange={(e) => update("password", e.target.value)}
                        placeholder="Enter your password"
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

                  {error && !pendingUser && (
                    <p className="text-sm text-[#b4233a]" role="alert">{error}</p>
                  )}

                  {pendingUser && (
                    <div className="rounded-lg border border-[#f06030]/30 bg-[#fff0e6] p-4">
                      <p className="text-sm font-semibold text-[#f06030]">Approval required</p>
                      <p className="mt-1 text-sm leading-5 text-[#888888]">
                        {pendingUser.name} exists but your event team must approve access before sign-in.
                      </p>
                      <label className="mt-3 flex items-start gap-2.5 text-sm leading-5 text-[#888888]">
                        <input
                          type="checkbox"
                          checked={approvalConsentAccepted}
                          onChange={(e) => setApprovalConsentAccepted(e.target.checked)}
                          className="mt-0.5 size-4 accent-[#c01867]"
                        />
                        <span>I consent to this account request being processed for portal access review.</span>
                      </label>
                      <button
                        type="button"
                        disabled={!approvalConsentAccepted}
                        onClick={() => requestApproval(pendingUser)}
                        className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#d9d9d9] bg-white text-sm font-medium text-[#171216] transition hover:border-[#c01867]/40 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Send className="size-4" /> Request approval
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={busy}
                    className="flex h-14 w-full items-center justify-center rounded-lg bg-[#c01867] text-lg font-semibold text-white transition hover:bg-[#a81459] disabled:cursor-not-allowed disabled:opacity-70 sm:h-12 sm:text-base"
                  >
                    {busy ? "Signing in…" : "Sign in"}
                  </button>

                  <div className="flex items-center justify-between gap-3 text-sm">
                    <a href="/sign-up" className="text-[#c01867] transition hover:text-[#a81459]">
                      Need access? Request here
                    </a>
                    <a href="/inquiry" className="text-[#888888] transition hover:text-[#171216]">
                      No inquiry yet?
                    </a>
                  </div>
                </form>
              )}

              {/* Demo accounts */}
              <div className="mt-6 border-t border-[#d9d9d9] pt-5">
                <p className="mb-3 text-sm font-medium text-[#888888]">Demo accounts</p>
                <div className="flex flex-col gap-2">
                  {clientDemoUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        update("email", user.email);
                        update("password", demoPasswords[user.email] ?? "prism-client");
                      }}
                      className="flex items-center justify-between rounded-lg border border-[#d9d9d9] bg-white px-4 py-3 text-left transition hover:border-[#c01867]/40 hover:bg-white/80"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[#171216]">{user.name}</p>
                        <p className="text-xs text-[#888888]">{user.organization}</p>
                      </div>
                      <ArrowRight className="size-4 text-[#a7a7a7]" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center sm:mt-10">
            <p className="inline-flex items-center gap-2 text-base text-[#888888] sm:text-sm">
              <Shield className="size-4" />
              Approved clients only. Access requires a signed conforme.
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
