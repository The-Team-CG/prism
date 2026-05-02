"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { mvpApi } from "@/lib/mvp-api";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Separator } from "../ui/separator";
import { Textarea } from "../ui/textarea";

type InquiryForm = {
  clientName: string;
  companyName: string;
  email: string;
  eventName: string;
  eventType: string;
  eventDate: string;
  clientType: string;
  source: string;
  message: string;
  privacyConsentAccepted: boolean;
  privacyNoticeVersion: string;
  marketingConsentAccepted: boolean;
};

const PRIVACY_NOTICE_VERSION = "2026-05-01";

const initialForm: InquiryForm = {
  clientName: "",
  companyName: "",
  email: "",
  eventName: "",
  eventType: "",
  eventDate: "",
  clientType: "Corporate",
  source: "Website",
  message: "",
  privacyConsentAccepted: false,
  privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
  marketingConsentAccepted: false,
};

const proofPoints = [
  { label: "Conforme gating", value: "Locked until approved" },
  { label: "Vendor visibility", value: "Quotes and requests tracked" },
  { label: "Event readiness", value: "Compliance before launch" },
];

const steps = [
  { title: "Inquiry Review", text: "We classify scope, date risk, and service needs before planning begins." },
  { title: "Conforme Gate", text: "Signed approval unlocks the client portal, billing, briefing, and operations flow." },
  { title: "Live Coordination", text: "Supplier quotes, coordinators, compliance, payment, and closure move in one command center." },
];

const assuranceItems = [
  { icon: ShieldCheck, label: "Gate" },
  { icon: Phone, label: "Call" },
  { icon: CheckCircle2, label: "Track" },
];

export function PublicInquiryPage() {
  const [form, setForm] = useState<InquiryForm>(initialForm);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  function update<K extends keyof InquiryForm>(key: K, value: InquiryForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submitInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await mvpApi.createInquiry(form);
      setSubmitted(true);
      setForm(initialForm);
      toast.success("Inquiry received", {
        description: "Your inquiry has been added to the local P.R.I.S.M intake queue.",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit inquiry");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen overflow-auto bg-background text-foreground">
      <section className="relative min-h-screen px-5 py-6 sm:px-8 lg:px-10">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,248,242,0.95)_0%,rgba(255,248,242,0.82)_42%,rgba(233,247,251,0.76)_100%)]" />
        <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(#9060A0_1px,transparent_1px),linear-gradient(90deg,#9060A0_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="absolute right-[-12rem] top-[-10rem] h-[34rem] w-[34rem] rounded-full border border-[#9060A0]/20" />
        <div className="absolute bottom-[-18rem] left-[-14rem] h-[40rem] w-[40rem] rounded-full border border-[#F06030]/30" />

        <div className="relative z-10 mx-auto grid min-h-[calc(100vh-3rem)] max-w-[1320px] grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,1fr)_460px]">
          <Card className="flex min-h-[760px] flex-col justify-between rounded-[0.4rem] border-[#9060A0]/18 bg-card/70 p-5 shadow-[0_24px_80px_rgba(192,24,103,0.13)] backdrop-blur-md sm:p-7 lg:p-9">
            <header className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-36 items-center justify-center rounded-md border border-[#9060A0]/18 bg-white px-3 shadow-sm">
                  <img src="/pmcm-logo.png" alt="PMCM logo" className="h-9 w-full object-contain" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-primary">P.R.I.S.M</p>
                  <p className="text-sm text-muted-foreground">Public inquiry desk</p>
                </div>
              </div>
              <Button asChild variant="outline" className="hidden h-10 rounded-sm font-semibold sm:inline-flex">
                <a href="/">
                  Home <ArrowRight data-icon="inline-end" />
                </a>
              </Button>
            </header>

            <div className="max-w-4xl py-10 sm:py-14 lg:py-16">
              <Badge variant="outline" className="mb-6 rounded-full border-[#F06030]/35 bg-accent/75 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-(--prism-amber)">
                <Sparkles size={14} />
                Event planning intake for serious briefs
              </Badge>
              <h1 className="max-w-5xl text-5xl font-black leading-[0.94] tracking-normal text-foreground sm:text-6xl lg:text-7xl xl:text-[5.6rem]">
                Turn your event brief into an operating plan.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
                Submit the first details for a P.R.I.S.M-managed event. The inquiry becomes a structured planning record for approvals, supplier coordination, compliance, billing, and post-event closure.
              </p>

              <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
                {proofPoints.map((item) => (
                  <Card key={item.label} className="gap-0 rounded-sm border-l-2 border-[#F06030] bg-white/45 shadow-none">
                    <CardContent className="px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{item.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <Separator className="bg-[#9060A0]/15" />
            <div className="grid gap-4 pt-5 sm:grid-cols-3">
              {steps.map((step, index) => (
                <div key={step.title} className="group">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="grid size-7 place-items-center rounded-sm bg-[#9060A0] text-xs font-black text-white">
                      {index + 1}
                    </span>
                    <h2 className="text-sm font-bold text-foreground">{step.title}</h2>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{step.text}</p>
                </div>
              ))}
            </div>
          </Card>

          <aside className="flex items-center">
            <Card className="w-full rounded-[0.45rem] border-[#171216]/12 bg-card shadow-[0_28px_90px_rgba(23,18,22,0.18)]">
              <CardHeader className="flex-row items-start justify-between gap-5 px-5 pb-4 pt-5 sm:px-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-(--prism-amber)">Start here</p>
                  <CardTitle className="mt-2 text-2xl font-black text-foreground">Public Inquiry</CardTitle>
                  <CardDescription className="mt-1 leading-5">Send the first brief into the P.R.I.S.M intake queue.</CardDescription>
                </div>
                <div className="grid size-10 shrink-0 place-items-center rounded-sm bg-secondary text-primary">
                  <ClipboardList size={22} />
                </div>
              </CardHeader>

              <CardContent className="px-5 pb-5 sm:px-6">
              {submitted ? (
                <Alert className="rounded-sm border-[#9060A0]/18 bg-secondary">
                  <CheckCircle2 className="text-primary" size={28} />
                  <AlertTitle className="text-xl font-black text-foreground">Inquiry received</AlertTitle>
                  <AlertDescription className="text-muted-foreground">
                    Your inquiry has been added to the local P.R.I.S.M demo intake queue. The planning team can now review and accept it.
                  </AlertDescription>
                  <Button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="col-start-2 mt-5 h-11 rounded-sm font-bold"
                  >
                    Submit another inquiry <ArrowRight data-icon="inline-end" />
                  </Button>
                </Alert>
              ) : (
                <form onSubmit={submitInquiry}>
                  <FieldGroup className="gap-3.5">
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="clientName" className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-primary">
                        <Users size={14} /> Your name
                      </FieldLabel>
                      <Input
                        id="clientName"
                        required
                        value={form.clientName}
                        onChange={(event) => update("clientName", event.target.value)}
                        className="h-11 rounded-sm border-border bg-card"
                        placeholder="Ana Reyes"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="email" className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-primary">
                        <Mail size={14} /> Email
                      </FieldLabel>
                      <Input
                        id="email"
                        required
                        type="email"
                        value={form.email}
                        onChange={(event) => update("email", event.target.value)}
                        className="h-11 rounded-sm border-border bg-card"
                        placeholder="you@company.com"
                      />
                    </Field>
                  </div>

                  <Field>
                    <FieldLabel htmlFor="companyName" className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-primary">
                      <BadgeCheck size={14} /> Company or organization
                    </FieldLabel>
                    <Input
                      id="companyName"
                      value={form.companyName}
                      onChange={(event) => update("companyName", event.target.value)}
                      className="h-11 rounded-sm border-border bg-card"
                      placeholder="SampleCorp"
                    />
                  </Field>

                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="eventName" className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-primary">
                        <BadgeCheck size={14} /> Event name
                      </FieldLabel>
                      <Input
                        id="eventName"
                        required
                        value={form.eventName}
                        onChange={(event) => update("eventName", event.target.value)}
                        className="h-11 rounded-sm border-border bg-card"
                        placeholder="Leadership Forum 2026"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="eventType" className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-primary">
                        <ClipboardList size={14} /> Event type
                      </FieldLabel>
                      <Input
                        id="eventType"
                        required
                        value={form.eventType}
                        onChange={(event) => update("eventType", event.target.value)}
                        className="h-11 rounded-sm border-border bg-card"
                        placeholder="Conference, gala, launch"
                      />
                    </Field>
                  </div>

                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="eventDate" className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-primary">
                        <CalendarDays size={14} /> Event date
                      </FieldLabel>
                      <Input
                        id="eventDate"
                        required
                        type="date"
                        min={minDate}
                        value={form.eventDate}
                        onChange={(event) => update("eventDate", event.target.value)}
                        className="h-11 rounded-sm border-border bg-card"
                      />
                    </Field>
                    <Field>
                      <FieldLabel className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-primary">
                        <MapPin size={14} /> Client type
                      </FieldLabel>
                      <Select
                        value={form.clientType}
                        onValueChange={(value) => update("clientType", value)}
                      >
                        <SelectTrigger className="h-11 rounded-sm border-border bg-card">
                          <SelectValue placeholder="Select client type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="Corporate">Corporate</SelectItem>
                            <SelectItem value="Government">Government</SelectItem>
                            <SelectItem value="Association">Association</SelectItem>
                            <SelectItem value="Private">Private</SelectItem>
                            <SelectItem value="Non-profit">Non-profit</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <Field>
                    <FieldLabel className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-primary">
                      <Phone size={14} /> How did this reach PMCM?
                    </FieldLabel>
                    <Select
                      value={form.source}
                      onValueChange={(value) => update("source", value)}
                    >
                      <SelectTrigger className="h-11 rounded-sm border-border bg-card">
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="Website">Website</SelectItem>
                          <SelectItem value="Facebook">Facebook</SelectItem>
                          <SelectItem value="BNI">BNI</SelectItem>
                          <SelectItem value="Walk-In">Walk-In</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="message" className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-primary">
                      <MessageSquareText size={14} /> Brief
                    </FieldLabel>
                    <Textarea
                      id="message"
                      required
                      rows={5}
                      value={form.message}
                      onChange={(event) => update("message", event.target.value)}
                      className="min-h-28 rounded-sm border-border bg-card"
                      placeholder="Tell us about the audience, venue, scope, vendors, risks, and services you need."
                    />
                    <FieldDescription className="text-xs leading-5">Include venue, audience size, services, timeline, and risks if known.</FieldDescription>
                  </Field>

                  <div className="rounded-sm border border-border bg-background p-3">
                    <label className="flex items-start gap-3 text-sm leading-6 text-muted-foreground">
                      <input
                        type="checkbox"
                        required
                        checked={form.privacyConsentAccepted}
                        onChange={(event) => update("privacyConsentAccepted", event.target.checked)}
                        className="mt-1 size-4 accent-primary"
                      />
                      <span>
                        I consent to PMCM processing these inquiry details for event planning review and follow-up under the current demo privacy notice.
                      </span>
                    </label>
                    <label className="mt-3 flex items-start gap-3 text-sm leading-6 text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={form.marketingConsentAccepted}
                        onChange={(event) => update("marketingConsentAccepted", event.target.checked)}
                        className="mt-1 size-4 accent-primary"
                      />
                      <span>PMCM may also send optional event planning updates and announcements.</span>
                    </label>
                  </div>

                  {error && (
                    <Alert variant="destructive" className="rounded-sm">
                      <AlertTitle>Submission failed</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    disabled={busy || !form.privacyConsentAccepted}
                    className="h-12 w-full rounded-sm text-sm font-black uppercase tracking-[0.16em]"
                  >
                    {busy ? "Submitting" : "Submit inquiry"}
                    <ArrowRight data-icon="inline-end" />
                  </Button>
                  </FieldGroup>
                </form>
              )}

              <Separator className="my-4 bg-[#9060A0]/12" />
              <div className="grid grid-cols-3 gap-2 text-center">
                {assuranceItems.map(({ icon: Icon, label }) => (
                  <div key={label} className="rounded-sm bg-background px-2 py-2.5 text-primary">
                    <Icon className="mx-auto" size={17} />
                    <p className="mt-1 text-xs font-bold">{label}</p>
                  </div>
                ))}
              </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </section>
    </main>
  );
}
