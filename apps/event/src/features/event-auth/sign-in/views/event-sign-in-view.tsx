"use client";

import { FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff, Handshake, Shield } from "lucide-react";
import { PrismBrandLogo } from "@prism/ui";
import { Input } from "@/app/components/ui/input";
import { signInSubmitLabel, twoFactorCopy } from "../model/event-sign-in-copy";
import { useEventSignInViewModel } from "../view-models/use-event-sign-in-view-model";

function EventSignInPasswordFields({
  email,
  password,
  showPassword,
  required,
  onEmail,
  onPassword,
  onTogglePassword,
}: {
  email: string;
  password: string;
  showPassword: boolean;
  required: boolean;
  onEmail: (value: string) => void;
  onPassword: (value: string) => void;
  onTogglePassword: () => void;
}) {
  return (
    <>
      <div>
        <label htmlFor="email" className="mb-2 block text-base font-medium text-[#171216] sm:text-sm">
          Email address
        </label>
        <Input
          id="email"
          type="email"
          required={required}
          value={email}
          onChange={(e) => onEmail(e.target.value)}
          placeholder="name@company.com"
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
            required={required}
            value={password}
            onChange={(e) => onPassword(e.target.value)}
            placeholder="Enter your password"
            className="h-13 rounded-lg border-[#d9d9d9] bg-white pr-11 text-base text-[#444] placeholder:text-[#a7a7a7] focus-visible:ring-1 focus-visible:ring-[#c01867] sm:h-12 sm:text-sm"
          />
          <button
            type="button"
            onClick={onTogglePassword}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a7a7a7] transition hover:text-[#171216]"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
      </div>
    </>
  );
}

function EventSignInTwoFactorFields({
  phase,
  setupSecret,
  code,
  onCode,
}: {
  phase: string;
  setupSecret: string | null;
  code: string;
  onCode: (value: string) => void;
}) {
  const copy = twoFactorCopy(phase);
  return (
    <div className="space-y-3">
      <div>
        <p className="text-base font-semibold text-[#171216]">{copy.title}</p>
        <p className="mt-1 text-sm text-[#666]">{copy.detail}</p>
        {setupSecret ? (
          <p className="mt-2 break-all text-xs text-[#666]">
            Setup key: <code className="font-mono text-[#171216]">{setupSecret}</code>
          </p>
        ) : null}
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
          value={code}
          onChange={(e) => onCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          className="h-13 rounded-lg border-[#d9d9d9] bg-white text-base tracking-[0.3em] text-[#444] placeholder:text-[#a7a7a7] focus-visible:ring-1 focus-visible:ring-[#c01867] sm:h-12 sm:text-sm"
        />
      </div>
    </div>
  );
}

export function EventSignInView() {
  const vm = useEventSignInViewModel();
  const passwordPhase = vm.phase === "password";

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
              <form className="space-y-5" onSubmit={onSubmit}>
                <div hidden={!passwordPhase}>
                  <EventSignInPasswordFields
                    email={vm.email}
                    password={vm.password}
                    showPassword={vm.showPassword}
                    required={passwordPhase}
                    onEmail={vm.setEmail}
                    onPassword={vm.setPassword}
                    onTogglePassword={() => vm.setShowPassword(!vm.showPassword)}
                  />
                </div>

                {passwordPhase ? null : (
                  <EventSignInTwoFactorFields
                    phase={vm.phase}
                    setupSecret={vm.setupSecret}
                    code={vm.code}
                    onCode={vm.setCode}
                  />
                )}

                {vm.error ? (
                  <p className="text-sm text-[#b4233a]" role="alert">{vm.error}</p>
                ) : null}

                <button
                  type="submit"
                  disabled={vm.busy}
                  className="flex h-14 w-full items-center justify-center rounded-lg bg-[#c01867] text-lg font-semibold text-white transition hover:bg-[#a81459] disabled:cursor-not-allowed disabled:opacity-70 sm:h-12 sm:text-base"
                >
                  {signInSubmitLabel(vm.busy, vm.phase)}
                </button>
                <a hidden={!passwordPhase} href="/password-reset" className="block text-center text-sm text-[#c01867] transition hover:text-[#a81459]">
                  Forgot password?
                </a>
              </form>

            </div>
          </div>

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
