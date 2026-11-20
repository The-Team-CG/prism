"use client";

import { FormEvent } from "react";
import { ClipboardList } from "lucide-react";
import { formatPortalDate } from "@prism/ui/format-date";
import { Button } from "@prism/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@prism/ui/components/empty";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@prism/ui/components/sheet";
import { EventCard, EventCardFooter, EventCardGrid, EventCardHeader, EventCover } from "@prism/ui/event-cards";
import { PrismHero } from "@prism/ui/page-blocks";
import { cn } from "@/app/components/ui/utils";
import { formatMoney, initialForm, requestsForQuoting } from "../../model/supplier-workspace-rules";
import { orderRequestCards, requestCardFacts, type DeadlineTone, type RequestCardFacts } from "../../model/request-cards";
import type { PrismSupplierQuote, PrismSupplierQuoteRequest, PrismSupplierReadinessBoard, QuoteFormState, SupplierWorkspace } from "../../model/supplier-workspace-types";
import { useEventCoverUrl } from "../../view-models/use-event-cover-url";
import { supplierWorkTargetHash, useSupplierWorkTarget } from "../../view-models/use-supplier-work-target";
import { RequestQuoteCard } from "./request-quote-card";
import { Card, CardBody } from "./shell-ui";

const DEADLINE_TONE: Record<DeadlineTone, string> = {
  overdue: "bg-danger text-white",
  soon: "bg-attention-soft text-attention",
  later: "bg-white/90 text-neutral-800",
};

/** The quote deadline on the cover's corner, coloured by how close it is. */
function DeadlinePill({ deadline }: { deadline: NonNullable<RequestCardFacts["deadline"]> }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", DEADLINE_TONE[deadline.tone])}>{deadline.label}</span>;
}

function RequestCover({ card, small = false }: { card: RequestCardFacts; small?: boolean }) {
  const coverUrl = useEventCoverUrl(card.request.eventId, card.coverObjectId);
  return (
    <div className="relative">
      <EventCover eventType={card.eventType} imageUrl={coverUrl} small={small} />
      {card.deadline ? <span className="absolute right-3 top-3"><DeadlinePill deadline={card.deadline} /></span> : null}
    </div>
  );
}

/** One request: the event, the service asked for, how long is left, where the quote stands and the one thing to do. */
function RequestCard({ card, onOpen }: { card: RequestCardFacts; onOpen: () => void }) {
  const closed = card.stage === "closed";
  const yours = card.stage === "to-quote";
  return (
    <EventCard urgent={card.deadline?.tone === "overdue" && yours} compact={closed} cover={<RequestCover card={card} small={closed} />}>
      <EventCardHeader
        onCover
        date={card.eventDate ?? ""}
        title={card.eventName}
        href={supplierWorkTargetHash(card.request.id)}
        onNavigate={onOpen}
        details={card.request.category}
        muted={closed}
      />
      {card.request.message && !closed ? <p className="line-clamp-2 text-sm text-muted-foreground">{card.request.message}</p> : null}
      <div className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5", yours ? "bg-primary-soft" : "bg-muted")}>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">{card.status.owner}</p>
          <p className="font-semibold text-foreground">{card.status.title}</p>
        </div>
        <Button type="button" size="sm" variant={yours ? "default" : "outline"} className="relative z-10 ml-auto shrink-0 rounded-md" onClick={onOpen}>
          {card.action}
        </Button>
      </div>
      <EventCardFooter>
        {card.quote ? (
          <>
            <span className="font-semibold tabular-nums text-foreground">{formatMoney(card.quote.amount)}</span>
            <span className="min-w-0 truncate text-muted-foreground">{card.quote.paymentTerms || "No payment terms given"}</span>
          </>
        ) : (
          <span className="text-muted-foreground">{card.request.dueDate ? `Quote due ${formatPortalDate(card.request.dueDate)}` : "No quote deadline"}</span>
        )}
      </EventCardFooter>
    </EventCard>
  );
}

function RequestSection({ id, title, description, cards, onOpen }: { id: string; title: string; description?: string; cards: RequestCardFacts[]; onOpen: (id: string) => void }) {
  if (cards.length === 0) return null;
  return (
    <section aria-labelledby={id} className="grid gap-3">
      <div>
        <h2 id={id} className="flex items-baseline gap-2 text-base font-semibold text-foreground">{title}<span className="text-sm font-normal tabular-nums text-muted-foreground">{cards.length}</span></h2>
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <EventCardGrid>{cards.map((card) => <RequestCard key={card.request.id} card={card} onOpen={() => onOpen(card.request.id)} />)}</EventCardGrid>
    </section>
  );
}

/** "8 / days left" while the deadline is ahead; the event countdown takes over once the quote is sent. */
function leadFigure(card: RequestCardFacts) {
  if (!card.deadline) return undefined;
  if (card.deadline.days < 0) return { value: String(-card.deadline.days), label: card.deadline.days === -1 ? "day overdue" : "days overdue" };
  if (card.deadline.days === 0) return { value: "Today", label: "Quote due" };
  return { value: String(card.deadline.days), label: card.deadline.days === 1 ? "day left to quote" : "days left to quote" };
}

function RequestLead({ card }: { card: RequestCardFacts }) {
  const coverUrl = useEventCoverUrl(card.request.eventId, card.coverObjectId);
  return (
    <div className="px-4 pb-4 pt-12 sm:px-5">
      <PrismHero
        label={`${card.request.category} request`}
        title={card.eventName}
        meta={<p>{[card.eventDate ? `Event ${formatPortalDate(card.eventDate)}` : "Event date to be confirmed", card.request.dueDate ? `Quote due ${formatPortalDate(card.request.dueDate)}` : null].filter(Boolean).join(" · ")}</p>}
        figure={card.stage === "to-quote" ? leadFigure(card) : undefined}
        backdrop={<EventCover eventType={card.eventType} imageUrl={coverUrl} tag={false} className="h-full" />}
      >
        <p className="text-sm text-ink-foreground/70">{card.status.owner}</p>
        <p className="mt-0.5 text-base font-semibold">{card.status.title}</p>
      </PrismHero>
    </div>
  );
}

/**
 * Every request PMCM sent, as cards in three groups: to price, sent and with PMCM, and closed. Each card leads with
 * the deadline and the next step; the request's brief and the quote form open in a side panel, full screen on a
 * phone. Requests PMCM selected move to Bookings.
 */
export function RequestsPage({
  workspace, quoteByRequest, readinessBoard, forms, busy,
  onUpdateForm, onSubmitQuote,
}: {
  workspace: SupplierWorkspace;
  quoteByRequest: Map<string, PrismSupplierQuote>;
  readinessBoard: PrismSupplierReadinessBoard | null;
  forms: Record<string, QuoteFormState>;
  busy: string | null;
  onUpdateForm: (id: string, patch: Partial<QuoteFormState>) => void;
  onSubmitQuote: (ev: FormEvent<HTMLFormElement>, req: PrismSupplierQuoteRequest) => void;
}) {
  const requests = requestsForQuoting(workspace.quoteRequests, quoteByRequest);
  const target = useSupplierWorkTarget(requests.map((request) => request.id));
  if (!requests.length) {
    return (
      <Card><CardBody>
        <Empty className="border-0 p-6 md:p-8">
          <EmptyHeader>
            <EmptyMedia variant="icon"><ClipboardList /></EmptyMedia>
            <EmptyTitle>{workspace.quoteRequests.length ? "No open quote requests." : "No quote requests yet."}</EmptyTitle>
            <EmptyDescription>{workspace.quoteRequests.length ? "Selected quotes are in Bookings. New requests from PMCM will appear here." : "PMCM will send scoped quote requests when events are ready."}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </CardBody></Card>
    );
  }
  const cards = requests.map((request) => requestCardFacts(request, quoteByRequest.get(request.id), readinessBoard?.items.find((item) => item.requestId === request.id)));
  const groups = orderRequestCards(cards);
  const open = cards.find((card) => card.request.id === target.openId);
  return (
    <div className="grid gap-6">
      <RequestSection id="requests-to-quote" title="Needs your quote" cards={groups["to-quote"]} onOpen={target.open} />
      <RequestSection id="requests-sent" title="Sent to PMCM" description="PMCM is reviewing these. Selected quotes move to Bookings." cards={groups.sent} onOpen={target.open} />
      <RequestSection id="requests-closed" title="Closed" cards={groups.closed} onOpen={target.open} />
      <Sheet open={Boolean(open)} onOpenChange={(next) => { if (!next) target.open(null); }}>
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
          {open ? (
            <>
              <SheetHeader className="sr-only">
                <SheetTitle>{open.eventName}</SheetTitle>
                <SheetDescription>{open.request.category} · {open.status.title}</SheetDescription>
              </SheetHeader>
              <RequestLead card={open} />
              <div className="px-4 pb-6 sm:px-6">
                <RequestQuoteCard
                  req={open.request}
                  quote={open.quote}
                  form={forms[open.request.id] ?? initialForm(open.quote)}
                  busy={busy}
                  deadline={open.deadline?.label}
                  onUpdateForm={onUpdateForm}
                  onSubmitQuote={onSubmitQuote}
                />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
