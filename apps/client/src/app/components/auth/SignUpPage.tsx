"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
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
import { toast } from "sonner";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

type AccessRequest = {
  fullName: string;
  email: string;
  organization: string;
  eventName: string;
  inquiryCode: string;
  message: string;
};

const initialForm: AccessRequest = {
  fullName: "",
  email: "",
  organization: "",
  eventName: "",
  inquiryCode: "",
  message: "",
};

const gatePoints = [
  { icon: CalendarDays, label: "Inquiry gated", detail: "Review opens after inquiry → accepted → signed conforme." },
  { icon: LockKeyhole, label: "PMCM-activated", detail: "Only the PMCM team can activate client access roles." },
  { icon: MapPin, label: "Event-scoped", detail: "Approved layout, documents, billing, and activity updates." },
];

export function SignUpPage() {
  const [form, setForm] = useState<AccessRequest>(initialForm);
  const [sent, setSent] = useState(false);

  function update<K extends keyof AccessRequest>(key: K, value: AccessRequest[K]) {
    setForm((c) => ({ ...c, [key]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.fullName || !form.email) return;
    setSent(true);
    toast.success("Access request submitted", {
      description: "PMCM will review and notify you once your inquiry progresses.",
    });
  }

  return (
    <main className="min-h-screen bg-[#f6f6f6]">
      <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <section className="mx-auto mt-6 w-full max-w-lg sm:mt-8">
          {/* Logo + title */}
          <div className="flex flex-col items-center text-center">
            <Image
              src="/pmcm-logo.png"
              alt="PMCM Events"
              width={96}
              height={96}
              className="h-20 w-20 object-contain sm:h-24 sm:w-24"
            />
            <h1 className="mt-2 text-[40px] font-black leading-10 text-[#171216] sm:text-[36px] sm:leading-9">
              P.R.I.S.M
            </h1>
            <p className="mt-1 text-lg leading-7 text-[#888888] sm:text-base sm:leading-6">
              Client Portal
            </p>
          </div>

          {/* Card */}
          <div className="mt-6 overflow-hidden rounded-xl border border-[#d9d9d9] shadow-[0_8px_22px_rgba(17,24,39,0.12)] sm:mt-8">
            {/* Header band */}
            <div className="flex items-center gap-3 bg-[#c01867] px-5 py-5 sm:px-6 sm:py-6">
              <div className="inline-flex size-10 items-center justify-center rounded-lg border border-white/20 bg-white/10">
                <UserPlus className="size-5 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-white sm:text-[24px]">Request Access</h2>
                <p className="text-base text-white/90 sm:text-sm">Join your event workspace</p>
              </div>
            </div>

            {/* Form body */}
            <div className="bg-[#f6f6f6] px-4 py-6 sm:px-8 sm:py-8">
              {sent ? (
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
                <form className="space-y-5" onSubmit={submit}>
                  <div>
                    <label htmlFor="fullName" className="mb-2 block text-base font-medium text-[#171216] sm:text-sm">
                      Full name
                    </label>
                    <Input
                      id="fullName"
                      value={form.fullName}
                      onChange={(e) => update("fullName", e.target.value)}
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
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
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
                        value={form.organization}
                        onChange={(e) => update("organization", e.target.value)}
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
                        value={form.eventName}
                        onChange={(e) => update("eventName", e.target.value)}
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
                      value={form.inquiryCode}
                      onChange={(e) => update("inquiryCode", e.target.value)}
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
                      value={form.message}
                      onChange={(e) => update("message", e.target.value)}
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

          {/* Gate points */}
          {!sent && (
            <div className="mt-8 flex flex-col gap-4">
              {gatePoints.map((p) => (
                <div key={p.label} className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-[#d9d9d9] bg-white shadow-sm text-[#888888]">
                    <p.icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#171216]">{p.label}</p>
                    <p className="text-sm leading-5 text-[#888888]">{p.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

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
