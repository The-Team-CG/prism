"use client";

import { portalHref } from "@prism/ui/portal-path";

import { ArrowRight, Eye, EyeOff, PackageCheck, Shield, ShieldCheck } from "lucide-react";
import { PrismBrandLogo } from "@prism/ui";
import { Input } from "@/app/components/ui/input";
import { useSupplierSignInViewModel } from "../view-models/use-supplier-sign-in-view-model";

function ExistingSessionBanner({ name, organization }: { name: string; organization: string }) {
  return (
    <a
      href={portalHref("/dashboard")}
      className="mt-6 flex items-center justify-between rounded-xl border border-[#d9d9d9] bg-white px-5 py-4 shadow-sm transition hover:border-[#c01867]/40 sm:mt-8"
    >
      <div>
        <p className="text-sm font-semibold text-[#171216]">Continue as {name}</p>
        <p className="text-xs text-[#888888]">{organization}</p>
      </div>
      <ArrowRight className="size-4 text-[#a7a7a7]" />
    </a>
  );
}

function PasswordField({
  showPassword,
  password,
  onChange,
  onToggle,
}: {
  showPassword: boolean;
  password: string;
  onChange: (value: string) => void;
  onToggle: () => void;
}) {
  return (
    <div>
      <label htmlFor="password" className="mb-2 block text-base font-medium text-[#171216] sm:text-sm">
        Password
      </label>
      <div className="relative">
        <Input
          id="password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter your password"
          required
          className="h-13 rounded-lg border-[#d9d9d9] bg-white pr-11 text-base text-[#444] placeholder:text-[#a7a7a7] focus-visible:ring-1 focus-visible:ring-[#c01867] sm:h-12 sm:text-sm"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a7a7a7] transition hover:text-[#171216]"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      </div>
    </div>
  );
}

function ApprovalRequestPanel({
  showApproval,
  busy,
  consentAccepted,
  onToggle,
  onConsentChange,
  onRequest,
}: {
  showApproval: boolean;
  busy: boolean;
  consentAccepted: boolean;
  onToggle: () => void;
  onConsentChange: (accepted: boolean) => void;
  onRequest: () => void;
}) {
  return (
    <div className="mt-5 border-t border-[#d9d9d9] pt-5">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between text-left">
        <p className="text-sm font-medium text-[#171216]">Need supplier access?</p>
        <span className="text-xs text-[#888888]">{showApproval ? "Close ↑" : "Request ↓"}</span>
      </button>
      {showApproval ? (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-sm leading-5 text-[#888888]">
            Request PMCM approval for a new supplier account. A coordinator will review and activate your access.
          </p>
          <label className="flex items-start gap-2.5 text-sm leading-5 text-[#888888]">
            <input
              type="checkbox"
              checked={consentAccepted}
              onChange={(e) => onConsentChange(e.target.checked)}
              className="mt-0.5 size-4 accent-[#c01867]"
            />
            <span>I consent to PMCM processing this request for supplier portal access review.</span>
          </label>
          <button
            type="button"
            disabled={busy || !consentAccepted}
            onClick={onRequest}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#d9d9d9] bg-white text-sm font-medium text-[#171216] transition hover:border-[#c01867]/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ShieldCheck className="size-4" /> Request PMCM approval
          </button>
          <a href={portalHref("/password-reset")} className="block text-center text-sm text-[#c01867] transition hover:text-[#a81459]">Forgot password?</a>
        </div>
      ) : null}
    </div>
  );
}

export function SupplierSignInView() {
  const vm = useSupplierSignInViewModel();

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

          {vm.existing ? (
            <ExistingSessionBanner name={vm.existing.name} organization={vm.existing.organization} />
          ) : null}

          <div className="mt-6 overflow-hidden rounded-xl border border-[#d9d9d9] shadow-[0_8px_22px_rgba(17,24,39,0.12)] sm:mt-8">
            <div className="flex items-center gap-3 bg-[#c01867] px-5 py-5 sm:px-6 sm:py-6">
              <div className="inline-flex size-10 items-center justify-center rounded-lg border border-white/20 bg-white/10">
                <PackageCheck className="size-5 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-white sm:text-[24px]">Welcome Back</h2>
                <p className="text-base text-white/90 sm:text-sm">Sign in to continue</p>
              </div>
            </div>

            <div className="bg-[#f6f6f6] px-4 py-6 sm:px-8 sm:py-8">
              <form className="space-y-5" onSubmit={vm.submit}>
                <div>
                  <label htmlFor="email" className="mb-2 block text-base font-medium text-[#171216] sm:text-sm">
                    Email address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={vm.draft.email}
                    onChange={(e) => vm.updateEmail(e.target.value)}
                    placeholder="supplier@example.com"
                    required
                    className="h-13 rounded-lg border-[#d9d9d9] bg-white text-base text-[#444] placeholder:text-[#a7a7a7] focus-visible:ring-1 focus-visible:ring-[#c01867] sm:h-12 sm:text-sm"
                  />
                </div>

                <PasswordField
                  showPassword={vm.showPassword}
                  password={vm.draft.password}
                  onChange={vm.updatePassword}
                  onToggle={() => vm.setShowPassword((v) => !v)}
                />

                {vm.error ? <p className="text-sm text-[#b4233a]" role="alert">{vm.error}</p> : null}
                {vm.notice ? <p className="text-sm text-[#1f7a4b]" role="status">{vm.notice}</p> : null}

                <button
                  type="submit"
                  disabled={vm.busy}
                  className="flex h-14 w-full items-center justify-center rounded-lg bg-[#c01867] text-lg font-semibold text-white transition hover:bg-[#a81459] disabled:cursor-not-allowed disabled:opacity-70 sm:h-12 sm:text-base"
                >
                  {vm.busy ? "Signing in…" : "Sign in"}
                </button>
              </form>

              <ApprovalRequestPanel
                showApproval={vm.showApproval}
                busy={vm.busy}
                consentAccepted={vm.approvalConsentAccepted}
                onToggle={() => vm.setShowApproval((v) => !v)}
                onConsentChange={vm.setApprovalConsentAccepted}
                onRequest={() => void vm.requestApproval()}
              />
            </div>
          </div>

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
