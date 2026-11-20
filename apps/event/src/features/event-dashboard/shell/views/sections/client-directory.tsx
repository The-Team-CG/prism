"use client";

import Link from "next/link";
import { formatPortalDate, manilaDateKey } from "@prism/ui/format-date";
import { ArrowLeft, ChevronRight, CircleUserRound, Search } from "lucide-react";
import { PRISM_LIFECYCLE_STAGE_LABELS, derivePrismLifecycleStage, type PrismEvent, type PrismInquiry } from "@prism/types";
import { dateTileParts } from "@prism/ui/event-cards";
import { PrismEmptyLine, PrismHero, PrismSection, PrismStatRow } from "@prism/ui/page-blocks";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@prism/ui/components/empty";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { RouteLink, cx, label, useListFilter } from "@/features/pmcm-kit";
import { isOpenClientEvent, summarizeClientDossier, type ClientDossierSummary, type ClientLifetime } from "../../model/client-dossier";
import type { EventClientRecord } from "../../model/event-dashboard-selectors";
import { CLIENT_DOSSIER_VIEWS, clientDossierHref, eventWorkspaceHref, type DetailTab } from "../../model/event-dashboard-routing";
import { WorkspaceRouteTabs } from "./workspace-sub-tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@prism/ui/components/tooltip";
import type { ReactElement } from "react";
import { Card } from "@prism/ui/components/card";

/** One line that never wraps mid-word: the value is truncated, and the full text shows on hover and focus. */
function FullValueTooltip({ value, children }: { value: string; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="max-w-80 break-all">{value}</TooltipContent>
    </Tooltip>
  );
}

const STATUS_ORDER: Record<string, number> = { active: 0, prospect: 1, "past client": 2 };
const php = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

function clientStatus(client: EventClientRecord) {
  return client.events.some(isOpenClientEvent) ? "active" : client.events.length ? "past client" : "prospect";
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "?";
}

/** The soonest open event, or the most recent one when every event is finished. */
function nextEvent(client: EventClientRecord) {
  const byDate = [...client.events].sort((left, right) => String(left.eventDate).localeCompare(String(right.eventDate)));
  const open = byDate.find(isOpenClientEvent);
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

const ROW_GRID = "sm:grid sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_minmax(0,1fr)_7rem_8rem_1rem] sm:items-center sm:gap-4";

const SEGMENTS = [
  { id: "active", label: "Active" },
  { id: "prospect", label: "Prospects" },
  { id: "past client", label: "Past" },
  { id: "all", label: "All" },
] as const;

/** Every client contact PMCM works with, one row each, narrowed to active clients, prospects or past clients. */
export function ClientDirectory({
  clients,
  balances,
  lastActive,
  onOpenClient,
}: {
  clients: EventClientRecord[];
  balances: ReadonlyMap<string, number>;
  /** Each client's latest portal sign-in, once the client facts load. */
  lastActive?: ReadonlyMap<string, string | null>;
  onOpenClient: (id: string) => void;
}) {
  const [query, setQuery] = useListFilter("q");
  const counts = Object.fromEntries(SEGMENTS.map((segment) => [segment.id, segment.id === "all" ? clients.length : clients.filter((client) => clientStatus(client) === segment.id).length]));
  const [segment, setSegment] = useListFilter("segment", counts.active > 0 ? "active" : "all");
  const needle = query.trim().toLowerCase();
  const rows = clients
    .filter((client) => segment === "all" || clientStatus(client) === segment)
    .filter((client) => `${client.name} ${client.contact ?? ""} ${client.inquiries.map((inquiry) => inquiry.email).join(" ")}`.toLowerCase().includes(needle))
    .sort(directoryOrder);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Which clients" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {SEGMENTS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-pressed={segment === entry.id}
              onClick={() => setSegment(entry.id)}
              className={cx("rounded-md px-3 py-1.5 text-sm transition-colors", segment === entry.id ? "bg-card font-medium text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}
            >
              {entry.label}<span className="ml-1.5 tabular-nums text-muted-foreground">{counts[entry.id]}</span>
            </button>
          ))}
        </div>
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
      <Card className="gap-0 block overflow-hidden rounded-lg border border-border bg-card">
        {rows.length === 0 ? (
          <Empty className="border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CircleUserRound />
              </EmptyMedia>
              <EmptyTitle>{needle ? "No client matches" : "No clients yet"}</EmptyTitle>
              <EmptyDescription>{needle ? "Try a company, a contact's name or an email address." : "Clients appear here once PMCM logs or receives an inquiry."}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <div aria-hidden="true" className={`hidden border-b border-border px-4 py-2.5 text-xs text-muted-foreground ${ROW_GRID}`}>
              <span>Client</span>
              <span>Next event</span>
              <span>With PMCM</span>
              <span>Last active</span>
              <span className="text-right">Balance due</span>
              <span />
            </div>
            <ul className="divide-y divide-border">
              {rows.map((client) => (
                <ClientDirectoryRow key={client.id} client={client} balance={balances.get(client.id) ?? 0} lastActiveAt={lastActive?.get(client.id)} onOpenClient={onOpenClient} />
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}

function ClientDirectoryRow({ client, balance, lastActiveAt, onOpenClient }: { client: EventClientRecord; balance: number; lastActiveAt: string | null | undefined; onOpenClient: (id: string) => void }) {
  const email = client.inquiries.find((inquiry) => inquiry.email)?.email;
  const contact = client.contact !== client.name ? client.contact : undefined;
  const next = nextEvent(client);
  const reviewCount = toReview(client);
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
      <ClientHistoryCount client={client} reviewCount={reviewCount} />
      <p className="min-w-0 pl-12 text-sm text-muted-foreground sm:pl-0">
        <span className="sm:hidden">Last active </span>
        {lastActiveAt === undefined ? "—" : lastActiveAt ? formatPortalDate(lastActiveAt) : client.events.length ? "Not signed in" : "—"}
      </p>
      <ClientBalance balance={balance} />
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

/** How much business the client has brought: events, how many are in progress, and inquiries waiting on PMCM. */
function ClientHistoryCount({ client, reviewCount }: { client: EventClientRecord; reviewCount: number }) {
  const events = client.events.length;
  const open = client.events.filter(isOpenClientEvent).length;
  return (
    <div className="min-w-0 pl-12 text-sm sm:pl-0">
      <p className="truncate text-foreground">{events ? `${events} ${events === 1 ? "event" : "events"}${open ? ` · ${open} in progress` : ""}` : "No events yet"}</p>
      {reviewCount > 0 ? <p className="text-xs font-medium text-attention">{reviewCount} {reviewCount === 1 ? "inquiry" : "inquiries"} to review</p> : <p className="text-xs text-muted-foreground">{client.inquiries.length} {client.inquiries.length === 1 ? "inquiry" : "inquiries"}</p>}
    </div>
  );
}

function ClientBalance({ balance }: { balance: number }) {
  return (
    <p className={`pl-12 text-sm tabular-nums sm:pl-0 sm:text-right ${balance > 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}>
      <span className="sm:hidden">Balance due </span>
      {balance > 0 ? php.format(balance) : "—"}
    </p>
  );
}

function DossierEventRow({ event, onOpenEvent }: { event: PrismEvent; onOpenEvent: (id: string, tab?: DetailTab) => void }) {
  const tile = dateTileParts(event.eventDate);
  return (
    <li className="relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-raised has-[a:focus-visible]:bg-surface-raised">
      <span className="w-10 shrink-0 text-center">
        <span className="block text-[11px] font-medium text-primary">{tile?.month ?? "TBC"}</span>
        <span className="block text-base font-semibold leading-none tabular-nums text-foreground">{tile?.day ?? "–"}</span>
      </span>
      <span className="min-w-0 flex-1">
        <RouteLink href={eventWorkspaceHref(event.id)} onNavigate={() => onOpenEvent(event.id)} className="block truncate text-sm font-semibold text-foreground outline-none after:absolute after:inset-0">
          {event.eventName}
        </RouteLink>
        <span className="block truncate text-xs text-muted-foreground">{[formatPortalDate(event.eventDate), PRISM_LIFECYCLE_STAGE_LABELS[derivePrismLifecycleStage(event)]].join(" · ")}</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
    </li>
  );
}

function DossierInquiryRow({ inquiry }: { inquiry: PrismInquiry }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-foreground">{inquiry.eventName}</span>
        <span className="block text-xs text-muted-foreground">
          {formatPortalDate(inquiry.eventDate, "Date pending")} · {inquiry.source || "Source not recorded"}
        </span>
      </span>
      <StatusBadge status={inquiry.status} label={label(inquiry.status)} />
    </li>
  );
}

/** What is going on with the client now: events still being worked, then inquiries waiting on a decision. */
function DossierOverview({ summary, clientId, onOpenEvent }: { summary: ClientDossierSummary; clientId: string; onOpenEvent: (id: string, tab?: DetailTab) => void }) {
  const earlier = summary.history.reduce((sum, year) => sum + year.events.length + year.inquiries.length, 0);
  return (
    <div className="grid gap-6">
      <PrismSection id="client-active-events" title="Active and upcoming" count={summary.active.length} headerOutside flush>
        {summary.active.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">Nothing in progress. An accepted inquiry with a signed conforme becomes an event.</p>
        ) : (
          <ul className="divide-y divide-border">{summary.active.map((event) => <DossierEventRow key={event.id} event={event} onOpenEvent={onOpenEvent} />)}</ul>
        )}
      </PrismSection>
      {summary.openInquiries.length > 0 ? (
        <PrismSection id="client-open-inquiries" title="Open inquiries" count={summary.openInquiries.length} headerOutside flush>
          <ul className="divide-y divide-border">{summary.openInquiries.map((inquiry) => <DossierInquiryRow key={inquiry.id} inquiry={inquiry} />)}</ul>
        </PrismSection>
      ) : null}
      {earlier > 0 ? (
        <Link href={clientDossierHref(clientId, "history")} className="justify-self-start text-sm font-medium text-primary hover:underline">
          {earlier} earlier {earlier === 1 ? "event or inquiry" : "events and inquiries"} in History
        </Link>
      ) : null}
    </div>
  );
}

/** Everything settled, one fold per year, newest first; the latest year starts open. */
function DossierHistory({ summary, onOpenEvent }: { summary: ClientDossierSummary; onOpenEvent: (id: string, tab?: DetailTab) => void }) {
  if (summary.history.length === 0) {
    return <PrismEmptyLine className="rounded-lg border border-dashed border-border px-4 py-3">No past events or settled inquiries yet.</PrismEmptyLine>;
  }
  return (
    <section aria-labelledby="client-history-title" className="grid gap-3">
      <h2 id="client-history-title" className="text-base font-semibold text-foreground">History</h2>
      <Card className="gap-0 block overflow-hidden rounded-lg border border-border bg-card py-0">
        {summary.history.map((year, index) => (
          <details key={year.year} open={index === 0} className="group border-t border-border first:border-t-0">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 hover:bg-surface-raised">
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ChevronRight aria-hidden className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
                {year.year}
              </span>
              <span className="text-xs text-muted-foreground">
                {[year.events.length ? `${year.events.length} ${year.events.length === 1 ? "event" : "events"}` : null, year.inquiries.length ? `${year.inquiries.length} ${year.inquiries.length === 1 ? "inquiry" : "inquiries"}` : null].filter(Boolean).join(" · ")}
              </span>
            </summary>
            <ul className="divide-y divide-border border-t border-border bg-muted/20">
              {year.events.map((event) => <DossierEventRow key={event.id} event={event} onOpenEvent={onOpenEvent} />)}
              {year.inquiries.map((inquiry) => <DossierInquiryRow key={inquiry.id} inquiry={inquiry} />)}
            </ul>
          </details>
        ))}
      </Card>
    </section>
  );
}

/**
 * One client's relationship with PMCM: a lead block with who they are and what they owe, four figures, then what is
 * active now, their history folded by year, and their contacts. Each event opens its own workspace.
 */
export function ClientDossier({
  client,
  balance,
  lifetime,
  view = "overview",
  onBack,
  onOpenEvent,
}: {
  client: EventClientRecord;
  balance: string;
  /** Lifetime billed, average rating and last sign-in, once the client facts load. */
  lifetime?: ClientLifetime;
  view?: string;
  onBack: () => void;
  onOpenEvent: (id: string, tab?: DetailTab) => void;
}) {
  const summary = summarizeClientDossier(client, manilaDateKey());
  const email = client.inquiries.find((inquiry) => inquiry.email)?.email;
  const contact = client.contact && client.contact !== client.name ? client.contact : undefined;
  const rawType = client.inquiries.find((inquiry) => inquiry.clientType)?.clientType;
  const type = rawType ? rawType.charAt(0).toUpperCase() + rawType.slice(1) : undefined;
  return (
    <div className="grid min-w-0 gap-6">
      <button type="button" onClick={onBack} className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden="true" className="size-4" />
        All clients
      </button>
      <PrismHero
        label={[type, contact, email].filter(Boolean).join(" · ") || "Client"}
        title={client.name}
        meta={[summary.since ? `With PMCM since ${formatPortalDate(summary.since)}` : null, lifetime?.lastActiveAt ? `Last active ${formatPortalDate(lifetime.lastActiveAt)}` : null].filter(Boolean).join(" · ") || undefined}
        figure={{ value: balance, label: "balance due" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-foreground/70">{clientStatusLine(client)}</p>
          {email ? (
            <a href={`mailto:${email}`} className="rounded-md bg-ink-foreground px-3 py-2 text-sm font-semibold text-ink hover:opacity-90">Email {contact ?? client.name}</a>
          ) : null}
        </div>
      </PrismHero>
      <PrismStatRow
        label="Client figures"
        stats={[
          { label: "Events with PMCM", value: summary.figures.events, detail: `${summary.figures.upcoming} upcoming · ${summary.figures.completed} completed` },
          { label: "Lifetime billed", value: lifetime ? php.format(lifetime.billed) : "—" },
          { label: "Average rating", value: lifetime?.averageRating ? `${lifetime.averageRating.toFixed(1)} / 5` : "—", detail: lifetime ? (lifetime.ratings ? `From ${lifetime.ratings} closeout ${lifetime.ratings === 1 ? "survey" : "surveys"}` : "No closeout survey yet") : undefined },
          { label: "Inquiries", value: summary.figures.inquiries },
        ]}
      />
      <WorkspaceRouteTabs
        label="Client views"
        tabs={CLIENT_DOSSIER_VIEWS.map((item) => ({ id: item.view, label: item.label, href: clientDossierHref(client.id, item.view) }))}
        activeId={CLIENT_DOSSIER_VIEWS.some((item) => item.view === view) ? view : "overview"}
      />
      {view === "history" ? <DossierHistory summary={summary} onOpenEvent={onOpenEvent} /> : null}
      {view === "contacts" ? <DossierContacts client={client} /> : null}
      {view !== "history" && view !== "contacts" ? <DossierOverview summary={summary} clientId={client.id} onOpenEvent={onOpenEvent} /> : null}
    </div>
  );
}

/** One line for the hero's footer: what the client has going on. */
function clientStatusLine(client: EventClientRecord) {
  const open = client.events.filter(isOpenClientEvent).length;
  const review = toReview(client);
  const parts = [open ? `${open} ${open === 1 ? "event" : "events"} in progress` : "No event in progress", review ? `${review} ${review === 1 ? "inquiry" : "inquiries"} to review` : null];
  return parts.filter(Boolean).join(" · ");
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
              <FullValueTooltip value={contact.email}>
                <a href={`mailto:${contact.email}`} className="block break-all text-foreground hover:underline">{contact.email}</a>
              </FullValueTooltip>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

