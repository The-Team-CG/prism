"use client";

import { FormEvent } from "react";
import {
  ArrowRight,
  CalendarDays,
  LockKeyhole,
  Mail,
  MapPin,
  Send,
  Shield,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { PrismBrandLogo } from "@prism/ui";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import { useSignUpViewModel } from "../view-models/use-sign-up-view-model";

const gateIcons = {
  "inquiry-gated": CalendarDays,
  "pmcm-activated": LockKeyhole,
  "event-scoped": MapPin,
} as const;

export function SignUpView() {
  const vm = useSignUpViewModel();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    vm.submit();
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

          <div className="mt-6 overflow-hidden rounded-xl border border-[#d9d9d9] shadow-[0_8px_22px_rgba(17,24,39,0.12)] sm:mt-8">
            <div className="flex items-center gap-3 bg-[#c01867] px-5 py-5 sm:px-6 sm:py-6">
              <div className="inline-flex size-10 items-center justify-center rounded-lg border border-white/20 bg-white/10">
                <UserPlus className="size-5 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-white sm:text-[24px]">Request Access</h2>
                <p className="text-base text-white/90 sm:text-sm">Join your event workspace</p>
              </div>
            </div>

            <div className="bg-[#f6f6f6] px-4 py-6 sm:px-8 sm:py-8">
              {vm.sent ? (
                <div className="flex flex-col items-center gap-5 py-4 text-center">
                  <div className="grid size-16 place-items-center rounded-2xl border border-[#d9d9d9] bg-white shadow-sm">
                    <ShieldCheck className="size-8 text-[#1f7a4b]" />
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-[#171216]">Request sent</p>
                    <p className="mt-2 text-base leading-6 text-[#888888] sm:text-sm">
                      PMCM has your details. You'll be able to sign in after your inquiry is accepted and your conforme is signed.
                    </p>
                  </div>
                  <a
                    href="/sign-in"
                    className="inline-flex items-center gap-1.5 text-base font-medium text-[#c01867] transition hover:text-[#a81459] sm:text-sm"
                  >
                    Back to sign in <ArrowRight className="size-4" />
                  </a>
                </div>
              ) : (
                <form className="space-y-5" onSubmit={onSubmit}>
                  <div>
                    <label htmlFor="fullName" className="mb-2 block text-base font-medium text-[#171216] sm:text-sm">
                      Full name
                    </label>
                    <Input
                      id="fullName"
                      value={vm.draft.fullName}
                      onChange={(e) => vm.update("fullName", e.target.value)}
                      placeholder="Client contact name"
                      required
                      className="h-13 rounded-lg border-[#d9d9d9] bg-white text-base text-[#444] placeholder:text-[#a7a7a7] focus-visible:ring-1 focus-visible:ring-[#c01867] sm:h-12 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="mb-2 flex items-center gap-1.5 text-base font-medium text-[#171216] sm:text-sm">
                      <Mail className="size-3.5" /> Email address
                    </label>
                    <Input
                      id="email"
                      type="email"
                      value={vm.draft.email}
                      onChange={(e) => vm.update("email", e.target.value)}
                      placeholder="you@organization.com"
                      required
                      className="h-13 rounded-lg border-[#d9d9d9] bg-white text-base text-[#444] placeholder:text-[#a7a7a7] focus-visible:ring-1 focus-visible:ring-[#c01867] sm:h-12 sm:text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="organization" className="mb-2 block text-base font-medium text-[#171216] sm:text-sm">
                        Organization
                      </label>
                      <Input
                        id="organization"
                        value={vm.draft.organization}
                        onChange={(e) => vm.update("organization", e.target.value)}
                        placeholder="Company name"
                        required
                        className="h-13 rounded-lg border-[#d9d9d9] bg-white text-base text-[#444] placeholder:text-[#a7a7a7] focus-visible:ring-1 focus-visible:ring-[#c01867] sm:h-12 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="eventName" className="mb-2 block text-base font-medium text-[#171216] sm:text-sm">
                        Event name
                      </label>
                      <Input
                        id="eventName"
                        value={vm.draft.eventName}
                        onChange={(e) => vm.update("eventName", e.target.value)}
                        placeholder="Event title"
                        required
                        className="h-13 rounded-lg border-[#d9d9d9] bg-white text-base text-[#444] placeholder:text-[#a7a7a7] focus-visible:ring-1 focus-visible:ring-[#c01867] sm:h-12 sm:text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="inquiryCode" className="mb-2 block text-base font-medium text-[#171216] sm:text-sm">
                      Inquiry code{" "}
                      <span className="font-normal text-[#888888]">(if known)</span>
                    </label>
                    <Input
                      id="inquiryCode"
                      value={vm.draft.inquiryCode}
                      onChange={(e) => vm.update("inquiryCode", e.target.value)}
                      placeholder="INQ-2026-…"
                      className="h-13 rounded-lg border-[#d9d9d9] bg-white text-base text-[#444] placeholder:text-[#a7a7a7] focus-visible:ring-1 focus-visible:ring-[#c01867] sm:h-12 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="message" className="mb-2 block text-base font-medium text-[#171216] sm:text-sm">
                      Additional notes
                    </label>
                    <Textarea
                      id="message"
                      value={vm.draft.message}
                      onChange={(e) => vm.update("message", e.target.value)}
                      placeholder="Anything PMCM should know before activation."
                      rows={3}
                      className="resize-none rounded-lg border-[#d9d9d9] bg-white text-base text-[#444] placeholder:text-[#a7a7a7] focus-visible:ring-1 focus-visible:ring-[#c01867] sm:text-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-[#c01867] text-lg font-semibold text-white transition hover:bg-[#a81459] sm:h-12 sm:text-base"
                  >
                    <Send className="size-4" /> Send request
                  </button>

                  <div className="text-center">
                    <a href="/sign-in" className="text-sm text-[#c01867] transition hover:text-[#a81459]">
                      Already requested? Sign in
                    </a>
                  </div>
                </form>
              )}
            </div>
          </div>

          {!vm.sent && (
            <div className="mt-8 flex flex-col gap-4">
              {vm.gatePoints.map((point) => {
                const Icon = gateIcons[point.id];
                return (
                  <div key={point.id} className="flex items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-[#d9d9d9] bg-white shadow-sm text-[#888888]">
                      <Icon className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[#171216]">{point.label}</p>
                      <p className="text-sm leading-5 text-[#888888]">{point.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

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
