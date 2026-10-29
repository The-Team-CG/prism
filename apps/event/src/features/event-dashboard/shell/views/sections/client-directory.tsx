"use client";

import { formatPortalDate } from "@prism/ui/format-date";
import { ArrowLeft, ChevronRight, CircleUserRound, Search } from "lucide-react";
import { EmptyState } from "@/app/components/ui/empty-state";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { RouteLink, label, useListFilter } from "@/features/pmcm-kit";
import type { EventClientRecord } from "../../model/event-dashboard-selectors";
import { clientDossierHref, eventWorkspaceHref, type DetailTab } from "../../model/event-dashboard-routing";
import { portalHref } from "@prism/ui/portal-path";

const CLOSED_EVENT_STATUSES = ["completed", "cancelled", "closed"];
const STATUS_ORDER: Record<string, number> = { active: 0, prospect: 1, "past client": 2 };
const php = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

function isOpenEvent(event: EventClientRecord["events"][number]) {
  return !event.archived && !CLOSED_EVENT_STATUSES.includes(event.status);
}

function clientStatus(client: EventClientRecord) {
  return client.events.some(isOpenEvent) ? "active" : client.events.length ? "past client" : "prospect";
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "?";
}

/** The soonest open event, or the most recent one when every event is finished. */
function nextEvent(client: EventClientRecord) {
  const byDate = [...client.events].sort((left, right) => String(left.eventDate).localeCompare(String(right.eventDate)));
  const open = byDate.find(isOpenEvent);
  if (open) return { event: open, upcoming: true };
  const last = byDate.at(-1);
  return last ? { event: last, upcoming: false } : null;
}

function toReview(client: EventClientRecord) {
  return client.inquiries.filter((inquiry) => inquiry.status === "new").length;
}

/** Clients waiting on PMCM first, then active clients by their next event date, then prospects and past clients. */
function directoryOrder(left: EventClientRecord, right: EventClientRecord) {
  const review = Number(toReview(right) > 0) - Number(toReview(left) > 0);
  if (review) return review;
  const status = STATUS_ORDER[clientStatus(left)] - STATUS_ORDER[clientStatus(right)];
  if (status) return status;
  const dates = String(nextEvent(left)?.event.eventDate ?? "").localeCompare(String(nextEvent(right)?.event.eventDate ?? ""));
  return dates || left.name.localeCompare(right.name);
}

const ROW_GRID = "sm:grid sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_7.5rem_8rem_6.5rem_1rem] sm:items-center sm:gap-4";

/** Every client contact PMCM works with, one row each. */
export function ClientDirectory({
  clients,
  balances,
  onOpenClient,
}: {
  clients: EventClientRecord[];
  balances: ReadonlyMap<string, number>;
  onOpenClient: (id: string) => void;
}) {
  const [query, setQuery] = useListFilter("q");
  const needle = query.trim().toLowerCase();
  const rows = clients
    .filter((client) => `${client.name} ${client.contact ?? ""} ${client.inquiries.map((inquiry) => inquiry.email).join(" ")}`.toLowerCase().includes(needle))
    .sort(directoryOrder);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="relative w-full sm:max-w-80">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by client, contact or email"
            aria-label="Search by client, contact or email"
            className="h-10 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </label>
        <p role="status" className="text-sm text-muted-foreground">
          {rows.length} {rows.length === 1 ? "client" : "clients"}
        </p>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={CircleUserRound} title={needle ? "No client matches" : "No clients yet"} description={needle ? "Try a company, a contact's name or an email address." : "Clients appear here once PMCM logs or receives an inquiry."} />
          </div>
        ) : (
          <>
            <div aria-hidden="true" className={`hidden border-b border-border px-4 py-2.5 text-xs text-muted-foreground ${ROW_GRID}`}>
              <span>Client</span>
              <span>Next event</span>
              <span>Inquiries</span>
              <span className="text-right">Balance due</span>
              <span>Status</span>
              <span />
            </div>
            <ul className="divide-y divide-border">
              {rows.map((client) => (
                <ClientDirectoryRow key={client.id} client={client} balance={balances.get(client.id) ?? 0} onOpenClient={onOpenClient} />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function ClientDirectoryRow({ client, balance, onOpenClient }: { client: EventClientRecord; balance: number; onOpenClient: (id: string) => void }) {
  const email = client.inquiries.find((inquiry) => inquiry.email)?.email;
  const contact = client.contact !== client.name ? client.contact : undefined;
  const next = nextEvent(client);
  const reviewCount = toReview(client);
  const status = clientStatus(client);
  return (
    <li className={`relative grid gap-2 px-4 py-3.5 transition-colors hover:bg-surface-raised has-[a:focus-visible]:bg-surface-raised has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-inset has-[a:focus-visible]:ring-ring ${ROW_GRID}`}>
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {initials(client.name)}
        </span>
        <div className="min-w-0">
          <RouteLink
            href={clientDossierHref(client.id)}
            onNavigate={() => onOpenClient(client.id)}
            className="block truncate font-semibold text-foreground outline-none after:absolute after:inset-0"
          >
            {client.name}
          </RouteLink>
          <p className="truncate text-xs text-muted-foreground">{[contact, email].filter(Boolean).join(" · ") || "No contact details"}</p>
        </div>
      </div>
      <ClientNextEvent next={next} />
      <ClientInquiryCount reviewCount={reviewCount} total={client.inquiries.length} />
      <ClientBalance balance={balance} />
      <div className="pl-12 sm:pl-0">
        <StatusBadge status={status} label={label(status)} />
      </div>
      <ChevronRight aria-hidden="true" className="hidden size-4 text-muted-foreground sm:block" />
    </li>
  );
}

function ClientNextEvent({ next }: { next: ReturnType<typeof nextEvent> }) {
  if (!next) return <p className="min-w-0 pl-12 text-sm text-muted-foreground sm:pl-0">No event yet</p>;
  return (
    <div className="min-w-0 pl-12 text-sm sm:pl-0">
      <p className={`truncate ${next.upcoming ? "text-foreground" : "text-muted-foreground"}`}>{next.upcoming ? next.event.eventName : `Last: ${next.event.eventName}`}</p>
      <p className="text-xs text-muted-foreground">{formatPortalDate(next.event.eventDate)}</p>
    </div>
  );
}

function ClientInquiryCount({ reviewCount, total }: { reviewCount: number; total: number }) {
  if (reviewCount > 0) return <p className="pl-12 text-sm font-medium text-attention sm:pl-0">{reviewCount} to review</p>;
  return <p className="pl-12 text-sm text-muted-foreground sm:pl-0">{total} {total === 1 ? "inquiry" : "inquiries"}</p>;
}

function ClientBalance({ balance }: { balance: number }) {
  return (
    <p className={`pl-12 text-sm tabular-nums sm:pl-0 sm:text-right ${balance > 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}>
      <span className="sm:hidden">Balance due </span>
      {balance > 0 ? php.format(balance) : "—"}
    </p>
  );
}

/** One client: who they are, their events and their inquiries, each opening the work it belongs to. */
/** Each dossier route shows its own content; records that live per event link into that event's section. */
const DOSSIER_EVENT_SECTIONS: Record<string, { title: string; tab: DetailTab; note: string }> = {
  files: { title: "Files", tab: "files", note: "Files are kept in each event's workspace." },
  contracts: { title: "Contracts", tab: "files", note: "Conforme and contract files are kept in each event's files." },
  invoices: { title: "Invoices", tab: "billing", note: "Statements and payments are kept in each event's billing." },
  messages: { title: "Messages", tab: "activity", note: "Client conversations are kept in each event's activity." },
};

export function ClientDossier({
  client,
  balance,
  view = "overview",
  onBack,
  onOpenEvent,
}: {
  client: EventClientRecord;
  balance: string;
  view?: string;
  onBack: () => void;
  onOpenEvent: (id: string, tab?: DetailTab) => void;
}) {
  const eventSection = DOSSIER_EVENT_SECTIONS[view];
  const showEvents = view === "overview" || view === "events";
  const showInquiries = view === "overview";
  const facts = [
    { label: "Contact", value: client.contact ?? "Not recorded" },
    { label: "Company", value: client.company ?? client.name },
    { label: "Email", value: client.inquiries[0]?.email ?? "Not recorded" },
    { label: "Balance due", value: balance },
  ];
  return (
    <div className="grid gap-6">
      <button type="button" onClick={onBack} className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden="true" className="size-4" />
        All clients
      </button>
      <section aria-labelledby="client-dossier-title" className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="client-dossier-title" className="font-heading text-xl font-bold text-foreground">{client.name}</h2>
          <StatusBadge status={clientStatus(client)} />
        </div>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt className="text-xs text-muted-foreground">{fact.label}</dt>
              <dd className="mt-0.5 break-words font-semibold text-foreground">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {eventSection ? <DossierEventLinks client={client} section={eventSection} onOpenEvent={onOpenEvent} /> : null}
      {view === "contacts" ? <DossierContacts client={client} /> : null}
      {view === "notes" ? (
        <DossierNotice title="Notes">Client notes aren&apos;t recorded in P.R.I.S.M yet. Decisions about this client&apos;s events are in each event&apos;s decision log.</DossierNotice>
      ) : null}
      {view === "activity-log" ? (
        <DossierNotice title="Activity log">
          Actions on this client&apos;s records are in the{" "}
          <a href={portalHref("/dashboard/audit")} className="font-medium text-primary hover:text-primary/80">audit trail</a>.
        </DossierNotice>
      ) : null}

      {showEvents ? (
      <section aria-labelledby="client-events-title" className="grid gap-3">
        <h3 id="client-events-title" className="text-base font-semibold text-foreground">Events</h3>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {client.events.length === 0 ? (
            <p className="px-4 py-5 text-sm text-muted-foreground">No events yet. An accepted inquiry with a signed conforme becomes an event.</p>
          ) : (
            <ul className="divide-y divide-border">
              {client.events.map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-foreground">{event.eventName}</span>
                    <span className="block text-xs text-muted-foreground">{formatPortalDate(event.eventDate)}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <StatusBadge status={event.status} />
                    <RouteLink href={eventWorkspaceHref(event.id)} onNavigate={() => onOpenEvent(event.id)} className="text-sm font-semibold text-primary hover:text-primary-strong">
                      Open<span className="sr-only"> {event.eventName}</span>
                    </RouteLink>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      ) : null}

      {showInquiries ? (
      <section aria-labelledby="client-inquiries-title" className="grid gap-3">
        <h3 id="client-inquiries-title" className="text-base font-semibold text-foreground">Inquiries</h3>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {client.inquiries.length === 0 ? (
            <p className="px-4 py-5 text-sm text-muted-foreground">No inquiries on record for this client.</p>
          ) : (
            <ul className="divide-y divide-border">
              {client.inquiries.map((inquiry) => (
                <li key={inquiry.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-foreground">{inquiry.eventName}</span>
                    <span className="block text-xs text-muted-foreground">
                      {inquiry.eventDate || "Date pending"} · {inquiry.source || "Source not recorded"}
                    </span>
                  </span>
                  <StatusBadge status={inquiry.status} label={label(inquiry.status)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      ) : null}
    </div>
  );
}

function DossierNotice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">{children}</p>
    </section>
  );
}

function DossierEventLinks({
  client,
  section,
  onOpenEvent,
}: {
  client: EventClientRecord;
  section: { title: string; tab: DetailTab; note: string };
  onOpenEvent: (id: string, tab?: DetailTab) => void;
}) {
  return (
    <section aria-labelledby="client-dossier-section-title" className="grid gap-3">
      <div>
        <h3 id="client-dossier-section-title" className="text-base font-semibold text-foreground">{section.title}</h3>
        <p className="text-sm text-muted-foreground">{section.note}</p>
      </div>
      {client.events.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">This client has no events yet, so there are no {section.title.toLowerCase()} on record.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {client.events.map((event) => (
            <li key={event.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block break-words font-semibold text-foreground">{event.eventName}</span>
                <span className="block text-xs text-muted-foreground">{formatPortalDate(event.eventDate)}</span>
              </span>
              <RouteLink href={eventWorkspaceHref(event.id, section.tab)} onNavigate={() => onOpenEvent(event.id, section.tab)} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:text-primary-strong">
                Open {section.title.toLowerCase()}<span className="sr-only"> for {event.eventName}</span>
              </RouteLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DossierContacts({ client }: { client: EventClientRecord }) {
  const contacts = Array.from(
    new Map(
      client.inquiries
        .filter((inquiry) => inquiry.email)
        .map((inquiry) => [inquiry.email.toLowerCase(), { name: inquiry.clientName || client.contact || client.name, email: inquiry.email }]),
    ).values(),
  );
  return (
    <section className="grid gap-3">
      <h3 className="text-base font-semibold text-foreground">Contacts</h3>
      {contacts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">No contact details on record. Contacts come from this client&apos;s inquiries.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {contacts.map((contact) => (
            <li key={contact.email} className="px-4 py-3 text-sm">
              <span className="block font-semibold text-foreground">{contact.name}</span>
              <a href={`mailto:${contact.email}`} className="break-all text-primary hover:text-primary/80">{contact.email}</a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

