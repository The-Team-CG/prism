"use client";

import { FormEvent } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Handshake, Shield } from "lucide-react";
import { PrismBrandLogo } from "@prism/ui";
import { Input } from "@/app/components/ui/input";
import { useEventSignInViewModel } from "../view-models/use-event-sign-in-view-model";

export function EventSignInView() {
  const vm = useEventSignInViewModel();

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
              detail="Event Command Portal"
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
              <form className="space-y-5" onSubmit={onSubmit}>
                <div hidden={vm.phase !== "password"}>
                  <label htmlFor="email" className="mb-2 block text-base font-medium text-[#171216] sm:text-sm">
                    Email address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    required={vm.phase === "password"}
                    value={vm.email}
                    onChange={(e) => vm.setEmail(e.target.value)}
                    placeholder="mys@pmcm.test"
                    className="h-13 rounded-lg border-[#d9d9d9] bg-white text-base text-[#444] placeholder:text-[#a7a7a7] focus-visible:ring-1 focus-visible:ring-[#c01867] sm:h-12 sm:text-sm"
                  />
                </div>

                <div hidden={vm.phase !== "password"}>
                  <label htmlFor="password" className="mb-2 block text-base font-medium text-[#171216] sm:text-sm">
                    Password
                  </label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={vm.showPassword ? "text" : "password"}
                      required={vm.phase === "password"}
                      value={vm.password}
                      onChange={(e) => vm.setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="h-13 rounded-lg border-[#d9d9d9] bg-white pr-11 text-base text-[#444] placeholder:text-[#a7a7a7] focus-visible:ring-1 focus-visible:ring-[#c01867] sm:h-12 sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => vm.setShowPassword(!vm.showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a7a7a7] transition hover:text-[#171216]"
                      aria-label={vm.showPassword ? "Hide password" : "Show password"}
                    >
                      {vm.showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </button>
                  </div>
                </div>

                {vm.phase !== "password" && (
                  <div className="space-y-3">
                    <div>
                      <p className="text-base font-semibold text-[#171216]">
                        {vm.phase === "setup" ? "Set up two-factor authentication" : "Enter your authenticator code"}
                      </p>
                      <p className="mt-1 text-sm text-[#666]">
                        {vm.phase === "setup"
                          ? "Add this account to an authenticator app, then enter the generated six-digit code."
                          : "Enter the current six-digit code from your authenticator app to finish signing in."}
                      </p>
                      {vm.setupSecret && (
                        <p className="mt-2 break-all text-xs text-[#666]">
                          Setup key: <code className="font-mono text-[#171216]">{vm.setupSecret}</code>
                        </p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="two-factor-code" className="mb-2 block text-base font-medium text-[#171216] sm:text-sm">
                        Authenticator code
                      </label>
                      <Input
                        id="two-factor-code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        required
                        value={vm.code}
                        onChange={(e) => vm.setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="000000"
                        className="h-13 rounded-lg border-[#d9d9d9] bg-white text-base tracking-[0.3em] text-[#444] placeholder:text-[#a7a7a7] focus-visible:ring-1 focus-visible:ring-[#c01867] sm:h-12 sm:text-sm"
                      />
                    </div>
                  </div>
                )}

                {vm.error && (
                  <p className="text-sm text-[#b4233a]" role="alert">{vm.error}</p>
                )}

                <button
                  type="submit"
                  disabled={vm.busy}
                  className="flex h-14 w-full items-center justify-center rounded-lg bg-[#c01867] text-lg font-semibold text-white transition hover:bg-[#a81459] disabled:cursor-not-allowed disabled:opacity-70 sm:h-12 sm:text-base"
                >
                  {vm.busy ? "Checking..." : vm.phase === "password" ? "Sign in" : "Verify code"}
                </button>
              </form>

              {/* Sample accounts */}
              <div hidden={vm.phase !== "password"} className="mt-6 border-t border-[#d9d9d9] pt-5">
                <p className="mb-3 text-sm font-medium text-[#888888]">Sample accounts</p>
                <div className="flex flex-col gap-2">
                  {vm.sampleAccounts.map((sample) => (
                    <button
                      key={sample.email}
                      type="button"
                      onClick={() => vm.applySample(sample)}
                      className="flex items-center justify-between rounded-lg border border-[#d9d9d9] bg-white px-4 py-3 text-left transition hover:border-[#c01867]/40 hover:bg-white/80"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[#171216]">{sample.name}</p>
                        <p className="text-xs text-[#888888]">{sample.role}</p>
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
              Authorized PMCM team access only
            </p>
            <p className="mt-2 text-sm text-[#a0a0a0] sm:text-xs">
              Admin and coordinator accounts only. Other roles have separate portals.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
