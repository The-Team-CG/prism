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
import { PrismPublicShell } from "@prism/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";
import { Separator } from "../ui/separator";
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

const requiredCopy = [
  "This request is reviewed by PMCM before activation.",
  "Workspace access opens after inquiry acceptance and signed conforme.",
  "Official floorplans stay read-only for client users.",
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
    <PrismPublicShell
      productDetail="Client portal"
      eyebrow="Start your request"
      badgeIcon={ShieldCheck}
      badgeText="Inquiry-first access, not instant onboarding"
      title="Request PMCM client portal access."
      description="Tell us who you are and which event this request is for. PMCM reviews your request, then activates your client access after the gate checks."
      aside={
        <Card className="rounded-lg border-[#171216]/12 bg-card shadow-[0_28px_90px_rgba(23,18,22,0.18)]">
          <CardHeader className="gap-2">
            <div className="mb-2 grid size-11 place-items-center rounded-md bg-primary/10 text-primary">
              <Mail size={20} />
            </div>
            <CardTitle className="text-2xl font-black text-foreground">Request access</CardTitle>
            <CardDescription>No account exists yet. Ask PMCM to onboard this event-facing client role.</CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="rounded-md border border-(--prism-success)/35 bg-(--prism-success)/8 p-4 text-sm text-(--prism-success)">
                <p className="font-black">Request sent.</p>
                <p className="mt-2">
                  PMCM has your details. You will be able to sign in from this page after your inquiry is accepted and signed.
                </p>
              </div>
            ) : (
              <form onSubmit={submit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="fullName" className="text-xs font-black uppercase tracking-[0.16em] text-primary">
                      Full name
                    </FieldLabel>
                    <Input
                      id="fullName"
                      value={form.fullName}
                      onChange={(event) => update("fullName", event.target.value)}
                      placeholder="Client contact name"
                      required
                      className="h-12 rounded-md border-border bg-card"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="email" className="text-xs font-black uppercase tracking-[0.16em] text-primary">
                      Email
                    </FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(event) => update("email", event.target.value)}
                      placeholder="you@organization.com"
                      required
                      className="h-12 rounded-md border-border bg-card"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="organization" className="text-xs font-black uppercase tracking-[0.16em] text-primary">
                      Organization
                    </FieldLabel>
                    <Input
                      id="organization"
                      value={form.organization}
                      onChange={(event) => update("organization", event.target.value)}
                      placeholder="Company or team name"
                      required
                      className="h-12 rounded-md border-border bg-card"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="eventName" className="text-xs font-black uppercase tracking-[0.16em] text-primary">
                      Event name
                    </FieldLabel>
                    <Input
                      id="eventName"
                      value={form.eventName}
                      onChange={(event) => update("eventName", event.target.value)}
                      placeholder="Event title"
                      required
                      className="h-12 rounded-md border-border bg-card"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="inquiryCode" className="text-xs font-black uppercase tracking-[0.16em] text-primary">
                      Inquiry code (if known)
                    </FieldLabel>
                    <Input
                      id="inquiryCode"
                      value={form.inquiryCode}
                      onChange={(event) => update("inquiryCode", event.target.value)}
                      placeholder="INQ-2026-..."
                      className="h-12 rounded-md border-border bg-card"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="message">Additional notes</FieldLabel>
                    <Textarea
                      id="message"
                      value={form.message}
                      onChange={(event) => update("message", event.target.value)}
                      placeholder="Anything PMCM should know before activation."
                      rows={3}
                      className="rounded-md border-border bg-card"
                    />
                  </Field>
                  <button
                    type="submit"
                    className="grid h-12 place-items-center rounded-md bg-primary text-sm font-black uppercase tracking-[0.16em] text-primary-foreground transition hover:bg-primary/90"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Send size={16} />
                      Send request
                    </span>
                  </button>
                </FieldGroup>
              </form>
            )}

            <Separator className="my-5 bg-primary/12" />
            <p className="text-sm text-muted-foreground">
              Already requested access?{" "}
              <a href="/sign-in" className="font-bold text-foreground underline-offset-4 hover:underline">
                Sign in
              </a>
            </p>
          </CardContent>
        </Card>
      }
    >
      <div className="grid max-w-2xl gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-primary/15 bg-card/75 p-4">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-primary">
            <CalendarDays size={14} /> Gate status
          </p>
          <p className="mt-2 text-sm text-muted-foreground">Review after inquiry → accepted → signed conforme.</p>
        </div>
        <div className="rounded-lg border border-primary/15 bg-card/75 p-4">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-primary">
            <LockKeyhole size={14} /> Security
          </p>
          <p className="mt-2 text-sm text-muted-foreground">Only the PMCM team can activate client access roles.</p>
        </div>
        <div className="rounded-lg border border-primary/15 bg-card/75 p-4">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-primary">
            <MapPin size={14} /> Workspace content
          </p>
          <p className="mt-2 text-sm text-muted-foreground">Read-only approved layout, documents, billing, and activity updates.</p>
        </div>
      </div>
      <div className="mt-6 grid gap-3 rounded-lg border border-primary/12 bg-card/90 p-4">
        {requiredCopy.map((item) => (
          <p key={item} className="text-sm text-muted-foreground">
            {item}
          </p>
        ))}
      </div>
    </PrismPublicShell>
  );
}

