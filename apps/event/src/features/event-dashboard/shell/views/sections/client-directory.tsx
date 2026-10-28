"use client";

import { formatPortalDate } from "@prism/ui/format-date";
import { ArrowLeft, CircleUserRound, Search } from "lucide-react";
import { EmptyState } from "@/app/components/ui/empty-state";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { label, useListFilter } from "@/features/pmcm-kit";
import type { EventClientRecord } from "../../model/event-dashboard-selectors";
import type { DetailTab } from "../../model/event-dashboard-routing";
import { portalHref } from "@prism/ui/portal-path";

function clientStatus(client: EventClientRecord) {
  return client.events.some((event) => !["completed", "cancelled", "closed"].includes(event.status)) ? "active" : client.events.length ? "past client" : "prospect";
}

/** Every client contact PMCM works with, one row each. */
export function ClientDirectory({ clients, onOpenClient }: { clients: EventClientRecord[]; onOpenClient: (id: string) => void }) {
  const [query, setQuery] = useListFilter("q");
  const needle = query.trim().toLowerCase();
  const rows = clients.filter((client) => `${client.name} ${client.contact ?? ""}`.toLowerCase().includes(needle));
  return (
    <div className="grid gap-4">
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">Open a client to see their contact details, inquiries, events and recorded balance. A prospect has not yet had an event workspace.</p>
      <label className="relative w-full max-w-72">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a client or contact"
          aria-label="Find a client or contact"
          className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
      </label>
      <p role="status" className="text-xs text-muted-foreground">{rows.length} client{rows.length === 1 ? "" : "s"} shown</p>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={CircleUserRound} title={needle ? "No client matches" : "No clients yet"} description={needle ? "Try a company or a contact's name." : "Clients appear here once PMCM logs or receives an inquiry."} />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Client</th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">Contact</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Events</th>
                <th scope="col" className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Inquiries</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-4 py-2.5"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((client) => (
                <tr key={client.id} className="hover:bg-surface-raised">
                  <td className="px-4 py-3"><p className="font-semibold text-foreground">{client.name}</p>{client.contact ? <p className="mt-1 text-xs text-muted-foreground sm:hidden">{client.contact}</p> : null}<p className="mt-1 text-xs text-muted-foreground sm:hidden">{client.inquiries.length} inquiries</p></td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{client.contact ?? "–"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{client.events.length}</td>
                  <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">{client.inquiries.length}</td>
                  <td className="px-4 py-3"><StatusBadge status={clientStatus(client)} /></td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => onOpenClient(client.id)} className="text-sm font-semibold text-primary hover:text-primary-strong">
                      Open<span className="sr-only"> {client.name}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
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
                    <button type="button" onClick={() => onOpenEvent(event.id)} className="text-sm font-semibold text-primary hover:text-primary-strong">
                      Open<span className="sr-only"> {event.eventName}</span>
                    </button>
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
              <button type="button" onClick={() => onOpenEvent(event.id, section.tab)} className="min-h-11 text-sm font-semibold text-primary hover:text-primary-strong">
                Open {section.title.toLowerCase()}<span className="sr-only"> for {event.eventName}</span>
              </button>
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

