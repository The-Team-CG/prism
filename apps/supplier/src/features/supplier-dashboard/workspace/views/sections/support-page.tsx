"use client";

import Link from "next/link";
import { BadgeCheck, ChevronRight, ReceiptText, Truck, Wallet, type LucideIcon } from "lucide-react";
import { PrismPageColumn, PrismSection } from "@prism/ui/page-blocks";
import { pmcmSupportContactFromEnvironment } from "@/lib/portal-urls";
import { supplierSectionHref, type SupplierDashboardSection } from "../../model/supplier-workspace-types";
import { PmcmContactButtons } from "./pmcm-contact";
import { Disclosure } from "./shell-ui";

type Stage = { icon: LucideIcon; title: string; body: string; section: SupplierDashboardSection; link: string };

/** The four stages every piece of supplier work goes through, each with the page where it happens. */
const STAGES: Stage[] = [
  { icon: ReceiptText, title: "Quote", body: "PMCM sends a request. Price it before the deadline; you can revise once.", section: "requests", link: "Requests & quotes" },
  { icon: BadgeCheck, title: "Booking", body: "If PMCM selects your quote, confirm the booking, upload your signed contract and confirm readiness.", section: "bookings", link: "Bookings" },
  { icon: Truck, title: "Event day", body: "Mark Arrived, Set up and ready, and Done and leaving from the booking as each happens.", section: "bookings", link: "Bookings" },
  { icon: Wallet, title: "Payment", body: "PMCM pays on the schedule it sets for the booking. Confirm each payout and send your official receipt.", section: "payments", link: "Payments" },
];

const QUESTIONS: Array<{ question: string; answer: string; section?: SupplierDashboardSection; link?: string }> = [
  { question: "Can I change a quote after sending it?", answer: "Yes, once. Open the request and send a revision before the deadline; it replaces your first quote as the one PMCM reviews. After the deadline, or once PMCM selects or closes the request, the quote is final.", section: "requests", link: "Open Requests & quotes" },
  { question: "Does sending a quote mean I'm booked?", answer: "No. A quote is an offer. You are booked only when PMCM selects it; the request then moves to Bookings, where you confirm it.", section: "bookings", link: "Open Bookings" },
  { question: "What happens if I'm running late on the event day?", answer: "Your booking shows a late arrival once the arrival time passes. Mark Arrived as soon as you are on site, and message PMCM so the coordinator knows.", section: "bookings", link: "Open Bookings" },
  { question: "When will I be paid?", answer: "Each booking shows its payments once PMCM sets the schedule, with due dates. Bookings still waiting for a schedule show what was agreed. If a payment should have arrived but has not, message PMCM from Payments.", section: "payments", link: "Open Payments" },
  { question: "Where are my contract and other documents?", answer: "Files lists every document for your bookings, and what PMCM still needs from you.", section: "files", link: "Open Files" },
  { question: "My details changed. How do I update them?", answer: "Your sign-in email and password are in Account. Your business details (contact person, phone, services) are kept by PMCM; ask them to update your record from Services & profile.", section: "account", link: "Open Account" },
];

/**
 * Help for suppliers: how to reach PMCM first (every channel this supplier can use right now), then how work moves
 * from quote to payment with the page for each stage, then answers to the questions suppliers ask most.
 */
export function SupportPage({ hasBookings }: { hasBookings: boolean }) {
  const contact = pmcmSupportContactFromEnvironment();
  const reachable = hasBookings || Boolean(contact.email || contact.phone);
  return (
    <PrismPageColumn>
      <PrismSection
        id="support-contact"
        title="Talk to PMCM"
        description={hasBookings
          ? "Questions about a booking are quickest in Messages, filed under the event they are about."
          : "Messages open once you have a booking. Until then, reach PMCM here."}
      >
        {reachable
          ? <PmcmContactButtons contact={contact} canMessage={hasBookings} subject="Supplier portal question" />
          : <p className="text-sm text-muted-foreground">Contact the PMCM coordinator who invited you; they can help with requests, quotes and portal access.</p>}
      </PrismSection>

      <section aria-labelledby="support-stages" className="grid gap-3">
        <h2 id="support-stages" className="text-base font-semibold text-foreground">How your work moves</h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STAGES.map((stage, index) => (
            <li key={stage.title} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-xs">
              <div className="flex items-center gap-2.5">
                <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-primary-soft text-primary"><stage.icon className="size-4" /></span>
                <span className="text-xs text-muted-foreground">Step {index + 1}</span>
              </div>
              <h3 className="font-semibold text-foreground">{stage.title}</h3>
              <p className="flex-1 text-sm text-muted-foreground">{stage.body}</p>
              <Link href={supplierSectionHref(stage.section)} className="flex w-fit items-center gap-0.5 text-sm font-medium text-primary hover:text-primary/80">
                {stage.link}<ChevronRight className="size-4" aria-hidden />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <PrismSection id="support-questions" title="Common questions" flush>
        <div className="divide-y divide-border">
          {QUESTIONS.map((item) => (
            <Disclosure key={item.question} trigger={<span className="font-medium text-foreground">{item.question}</span>}>
              <p className="pl-7 text-sm leading-6 text-muted-foreground">{item.answer}</p>
              {item.section ? (
                <Link href={supplierSectionHref(item.section)} className="mt-2 ml-7 flex w-fit items-center gap-0.5 text-sm font-medium text-primary hover:text-primary/80">
                  {item.link}<ChevronRight className="size-4" aria-hidden />
                </Link>
              ) : null}
            </Disclosure>
          ))}
        </div>
      </PrismSection>
    </PrismPageColumn>
  );
}
