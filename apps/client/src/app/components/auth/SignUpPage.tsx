"use client";

import { FormEvent, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  LockKeyhole,
  Mail,
  MapPin,
  Send,
  ShieldCheck,
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
  {
    icon: CalendarDays,
    label: "Gate status",
    detail: "Review after inquiry → accepted → signed conforme.",
  },
  {
    icon: LockKeyhole,
    label: "Security",
    detail: "Only the PMCM team can activate client access roles.",
  },
  {
    icon: MapPin,
    label: "Workspace content",
    detail: "Read-only approved layout, documents, billing, and activity updates.",
  },
];

export function SignUpPage() {
  const [form, setForm] = useState<AccessRequest>(initialForm);
  const [sent, setSent] = useState(false);

  function update<K extends keyof AccessRequest>(key: K, value: AccessRequest[K]) {
    setForm((current) => ({ ...current, [key]: value }));
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
    <div className="relative min-h-screen bg-background">
      {/* Top signal bar */}
      <div className="fixed inset-x-0 top-0 z-50 h-0.75 bg-(--prism-signal)" />

      <div className="grid min-h-screen md:grid-cols-2">
        {/* Left panel - brand */}
        <div className="relative hidden flex-col justify-between bg-[#171216] p-10 md:flex">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-md bg-white text-xl font-black text-[#171216]">
                P
              </span>
              <span>
                <span className="block text-xs font-black uppercase tracking-[0.18em] text-(--prism-signal)">
                  P.R.I.S.M
                </span>
                <span className="block text-xs text-white/60">Client portal</span>
              </span>
            </div>

            <h1 className="mt-14 text-3xl font-black leading-tight text-white">Join your event.</h1>
            <p className="mt-4 text-sm leading-7 text-white/60">
              Submit your request and we'll be in touch once your inquiry has been reviewed and confirmed.
            </p>

            <div className="mt-10 flex flex-col gap-5">
              {gatePoints.map((p) => (
                <div key={p.label} className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-white/8 text-(--prism-signal)">
                    <p.icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-black text-white">{p.label}</p>
                    <p className="mt-0.5 text-xs leading-5 text-white/50">{p.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-white/30">(c) 2026 PMCM Events. Inquiry required before access.</p>
        </div>

        {/* Right panel - form */}
        <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16 md:px-12">
          <div className="w-full max-w-sm">
            {/* Mobile brand mark */}
            <div className="mb-8 flex items-center gap-3 md:hidden">
              <span className="grid size-10 place-items-center rounded-md bg-foreground text-sm font-black text-background">
                P
              </span>
              <span className="text-sm font-black uppercase tracking-widest text-foreground">
                P.R.I.S.M
              </span>
            </div>

            <h2 className="text-2xl font-black text-foreground">Request portal access</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              PMCM will review this request and activate your workspace once your inquiry is confirmed.
            </p>

            {sent ? (
              <div className="mt-6 rounded-lg border border-(--prism-success)/30 bg-(--prism-success)/8 p-5">
                <ShieldCheck className="size-5 text-(--prism-success)" />
                <p className="mt-3 text-sm font-black text-(--prism-success)">Request sent.</p>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  PMCM has your details. You will be able to sign in after your inquiry is accepted and your conforme is signed.
                </p>
                <a
                  href="/sign-in"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-black text-foreground hover:underline"
                >
                  Back to sign in <ArrowRight className="size-3.5" />
                </a>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
                <label className="grid gap-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Full name
                  </span>
                  <Input
                    value={form.fullName}
                    onChange={(e) => update("fullName", e.target.value)}
                    placeholder="Client contact name"
                    required
                    className="h-12 bg-card"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-muted-foreground">
                    <Mail className="size-3.5" /> Email
                  </span>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="you@organization.com"
                    required
                    className="h-12 bg-card"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Organization
                  </span>
                  <Input
                    value={form.organization}
                    onChange={(e) => update("organization", e.target.value)}
                    placeholder="Company or team name"
                    required
                    className="h-12 bg-card"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Event name
                  </span>
                  <Input
                    value={form.eventName}
                    onChange={(e) => update("eventName", e.target.value)}
                    placeholder="Event title"
                    required
                    className="h-12 bg-card"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Inquiry code (if known)
                  </span>
                  <Input
                    value={form.inquiryCode}
                    onChange={(e) => update("inquiryCode", e.target.value)}
                    placeholder="INQ-2026-..."
                    className="h-12 bg-card"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Additional notes
                  </span>
                  <Textarea
                    value={form.message}
                    onChange={(e) => update("message", e.target.value)}
                    placeholder="Anything PMCM should know before activation."
                    rows={3}
                    className="bg-card"
                  />
                </label>

                <button
                  type="submit"
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-black text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <Send className="size-4" /> Send request
                </button>

                <a
                  href="/sign-in"
                  className="text-center text-sm text-muted-foreground hover:text-foreground"
                >
                  Already requested?{" "}
                  <span className="font-bold text-foreground underline-offset-4 hover:underline">
                    Sign in →
                  </span>
                </a>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
