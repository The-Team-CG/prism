"use client";

import { FormEvent } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck, Eye, EyeOff, Handshake, Send, Shield } from "lucide-react";
import { PrismBrandLogo } from "@prism/ui";
import { Input } from "@/app/components/ui/input";
import { useSignInViewModel } from "../view-models/use-sign-in-view-model";

export function SignInView() {
  const vm = useSignInViewModel();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void vm.submit();
  }

  return (
    <main className="min-h-screen bg-[#f6f6f6]">
      <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <a
          href="/"
          aria-label="Back to P.R.I.S.M. home"
          className="inline-flex size-10 items-center justify-center rounded-full text-[#444] transition hover:bg-white hover:text-[#c01867] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c01867]/40"
        >
          <ArrowLeft className="size-5" />
        </a>

        <section className="mx-auto mt-6 w-full max-w-lg sm:mt-8">
          <div className="flex justify-center">
            <PrismBrandLogo
              detail="Client Portal"
              className="justify-center"
              markClassName="size-16 bg-transparent ring-0 sm:size-20"
            />
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-[#d9d9d9] shadow-[0_8px_22px_rgba(17,24,39,0.12)] sm:mt-8">
            <div className="flex items-center gap-3 bg-[#c01867] px-5 py-5 sm:px-6 sm:py-6">
              <div className="inline-flex size-10 items-center justify-center rounded-lg border border-white/20 bg-white/10">
                <Handshake className="size-5 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-white sm:text-[24px]">Welcome Back</h2>
                <p className="text-base text-white/90 sm:text-sm">Sign in to continue</p>
              </div>
            </div>

            <div className="bg-[#f6f6f6] px-4 py-6 sm:px-8 sm:py-8">
              {vm.signedInUser ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3 rounded-lg border border-[#d9d9d9] bg-white px-4 py-3">
                    <BadgeCheck className="size-5 shrink-0 text-[#c01867]" />
                    <div>
                      <p className="text-sm font-semibold text-[#171216]">{vm.signedInUser.name}</p>
                      <p className="text-xs text-[#888888]">{vm.signedInUser.organization}</p>
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
                <form className="space-y-5" onSubmit={onSubmit}>
                  <div>
                    <label htmlFor="email" className="mb-2 block text-base font-medium text-[#171216] sm:text-sm">
                      Email address
                    </label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={vm.draft.email}
                      onChange={(e) => vm.update("email", e.target.value)}
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
                        type={vm.showPassword ? "text" : "password"}
                        required
                        value={vm.draft.password}
                        onChange={(e) => vm.update("password", e.target.value)}
                        placeholder="Enter your password"
                        className="h-13 rounded-lg border-[#d9d9d9] bg-white pr-11 text-base text-[#444] placeholder:text-[#a7a7a7] focus-visible:ring-1 focus-visible:ring-[#c01867] sm:h-12 sm:text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => vm.setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a7a7a7] transition hover:text-[#171216]"
                        aria-label={vm.showPassword ? "Hide password" : "Show password"}
                      >
                        {vm.showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                      </button>
                    </div>
                  </div>

                  {vm.error && !vm.pendingUser && (
                    <p className="text-sm text-[#b4233a]" role="alert">{vm.error}</p>
                  )}

                  {vm.pendingUser && (
                    <div className="rounded-lg border border-[#f06030]/30 bg-[#fff0e6] p-4">
                      <p className="text-sm font-semibold text-[#f06030]">Approval required</p>
                      <p className="mt-1 text-sm leading-5 text-[#888888]">
                        {vm.pendingUser.name} exists but your event team must approve access before sign-in.
                      </p>
                      <label className="mt-3 flex items-start gap-2.5 text-sm leading-5 text-[#888888]">
                        <input
                          type="checkbox"
                          checked={vm.approvalConsentAccepted}
                          onChange={(e) => vm.setApprovalConsentAccepted(e.target.checked)}
                          className="mt-0.5 size-4 accent-[#c01867]"
                        />
                        <span>I consent to this account request being processed for portal access review.</span>
                      </label>
                      <button
                        type="button"
                        disabled={!vm.approvalConsentAccepted}
                        onClick={() => void vm.requestApproval(vm.pendingUser!)}
                        className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#d9d9d9] bg-white text-sm font-medium text-[#171216] transition hover:border-[#c01867]/40 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Send className="size-4" /> Request approval
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={vm.busy}
                    className="flex h-14 w-full items-center justify-center rounded-lg bg-[#c01867] text-lg font-semibold text-white transition hover:bg-[#a81459] disabled:cursor-not-allowed disabled:opacity-70 sm:h-12 sm:text-base"
                  >
                    {vm.busy ? "Signing in…" : "Sign in"}
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

              <div className="mt-6 border-t border-[#d9d9d9] pt-5">
                <p className="mb-3 text-sm font-medium text-[#888888]">Sample accounts</p>
                <div className="flex flex-col gap-2">
                  {vm.sampleUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => vm.applySampleUser(user)}
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
