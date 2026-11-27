"use client";

import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";
import type { PrismAuthenticatedSession, PrismSupplier } from "@prism/types";
import { formatPortalDate, manilaCalendarKey, manilaDateKey } from "@prism/ui/format-date";
import { PrismEmptyLine, PrismHero, PrismPageColumn, PrismSection, PrismStatRow } from "@prism/ui/page-blocks";
import { pmcmSupportContactFromEnvironment } from "@/lib/portal-urls";
import { serviceInclusionList, supplierContactPerson, supplierTrackRecord } from "../../model/supplier-profile";
import type { PrismSupplierQuote, PrismSupplierQuoteRequest, PrismSupplierReadinessBoard } from "../../model/supplier-workspace-types";
import { PmcmContactButtons } from "./pmcm-contact";

function Field({ label, value, missing, children }: { label: string; value: string | null; missing: string; children?: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 py-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm">
        {value ? <span className="break-words font-medium text-foreground">{value}</span> : <span className="text-muted-foreground">{missing}</span>}
        {children}
      </dd>
    </div>
  );
}

/**
 * The supplier's record as PMCM keeps it: who they are and their bookings, how PMCM reaches them,
 * and what they offer. PMCM owns the record, so every gap says so and the way to ask for a change is on the page.
 */
export function ProfilePage({ supplier, session, quotes, bookings, readinessBoard }: {
  supplier: PrismSupplier;
  session: PrismAuthenticatedSession;
  quotes: PrismSupplierQuote[];
  bookings: PrismSupplierQuoteRequest[];
  readinessBoard: PrismSupplierReadinessBoard | null;
}) {
  const record = supplierTrackRecord({ quotes, bookings, readiness: readinessBoard?.items ?? [] });
  const inclusions = serviceInclusionList(supplier.serviceInclusions);
  const contact = pmcmSupportContactFromEnvironment();
  const askToUpdate = (
    <PmcmContactButtons contact={contact} canMessage={bookings.length > 0} subject={`Supplier record update: ${supplier.name}`} size="sm" />
  );
  return (
    <PrismPageColumn>
      <PrismHero
        label={supplier.categoryName}
        title={supplier.name}
        meta={<p>On PMCM&apos;s roster since {formatPortalDate(supplier.applicationDate)}.</p>}
        figure={{ value: record.bookings, label: record.bookings === 1 ? "booking with PMCM" : "bookings with PMCM" }}
      />
      <PrismStatRow
        label="Your work with PMCM"
        stats={[
          { label: "Quotes sent", value: record.quotesSent },
          { label: "Events completed", value: record.completed, empty: record.bookings === 0 },
          { label: "Last event", value: record.lastEvent ? formatPortalDate(record.lastEvent) : "—", empty: !record.lastEvent },
          { label: "Next event", value: !record.nextEvent ? "—" : manilaCalendarKey(record.nextEvent) === manilaDateKey() ? "Today" : formatPortalDate(record.nextEvent), empty: !record.nextEvent },
        ]}
      />
      <PrismSection id="profile-contact" title="How PMCM reaches you" description="PMCM keeps these details. Ask PMCM to change anything that is out of date." action={askToUpdate}>
        <dl className="divide-y divide-border">
          <Field label="Contact person" value={supplierContactPerson(supplier)} missing="No contact person on file" />
          <Field label="Business email" value={supplier.email || null} missing="No email on file" />
          <Field label="Phone" value={supplier.phone || null} missing="No phone number on file" />
          <Field label="Signs in as" value={session.email} missing="—">
            <Link href="/dashboard/account" className="mt-0.5 flex w-fit items-center gap-0.5 text-xs font-medium text-primary hover:text-primary/80">
              Password and sign-in in Account<ChevronRight className="size-3.5" aria-hidden />
            </Link>
          </Field>
        </dl>
      </PrismSection>
      <PrismSection id="profile-services" title="What you offer" description={`What PMCM has on file for your ${supplier.categoryName} services.`}>
        {inclusions.length ? (
          <ul aria-label="Service inclusions" className="flex flex-wrap gap-2">
            {inclusions.map((item) => <li key={item} className="rounded-lg bg-muted px-3 py-1.5 text-sm text-foreground">{item}</li>)}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">PMCM has not recorded what your services include yet. Send them your package (setup, equipment, staffing) to add it.</p>
        )}
      </PrismSection>
      <PrismEmptyLine icon={ShieldCheck}>
        You see only the requests PMCM sends you and your own quotes. Other suppliers&apos; quotes and PMCM&apos;s internal reviews are never shown here, and your quotes are never shown to other suppliers.
      </PrismEmptyLine>
    </PrismPageColumn>
  );
}
