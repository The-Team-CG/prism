"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import type { PrismSupplierReadinessItem } from "@prism/types";
import {
  fmt,
  groupReadinessItemsByEvent,
  readinessConcernLabel,
  readinessSetupLabel,
  readinessTone,
  supplierReadinessSection,
} from "../../model/supplier-workspace-rules";
import type { PrismSupplierReadinessBoard, SupplierDashboardSection } from "../../model/supplier-workspace-types";
import { Card, CardBody, CardHeader } from "./shell-ui";

function ReadinessItem({ item, onNavigate }: {
  item: PrismSupplierReadinessItem;
  onNavigate: (section: SupplierDashboardSection) => void;
}) {
  const section = supplierReadinessSection(item);
  return (
    <button
      type="button"
      onClick={() => onNavigate(section)}
      aria-label={`${item.category}: open ${section === "bookings" ? "bookings" : "quote requests"}`}
      className="flex w-full items-start justify-between gap-4 rounded-lg px-3 py-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{item.category}</span>
        <span className="mt-1 block text-xs text-muted-foreground">Request {item.requestId}</span>
        <span className="mt-1 block text-sm leading-5 text-muted-foreground">
          Quote {fmt(item.quoteStatus)} · assignment {fmt(item.assignmentStatus ?? "pending")} · readiness {fmt(item.readinessStatus ?? "not confirmed")} · contract {fmt(item.contractStatus)} · {readinessSetupLabel(item.setupStatus)}
        </span>
        {item.schedule ? (
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
            Ingress {new Date(item.schedule.ingressAt).toLocaleString()} · Egress {new Date(item.schedule.egressAt).toLocaleString()} · {item.schedule.acknowledged ? "schedule acknowledged" : "schedule needs your acknowledgment"}
          </span>
        ) : null}
        {item.ingressLate ? <span className="mt-1 block text-xs font-semibold text-danger">Ingress time has passed without an arrival report.</span> : null}
        {item.concerns.map((concern) => (
          <span key={`${concern.kind}:${concern.at ?? ""}`} className="mt-1 block text-xs text-attention">
            {readinessConcernLabel(concern.kind)}: {concern.message}
          </span>
        ))}
      </span>
      <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${readinessTone(item.priority)}`}>{fmt(item.priority)}</span>
    </button>
  );
}

export function DashboardPage({ readinessBoard, quoteNeedingSubmission, handoffPending, onNavigate }: {
  readinessBoard: PrismSupplierReadinessBoard | null;
  quoteNeedingSubmission: number;
  handoffPending: number;
  onNavigate: (section: SupplierDashboardSection) => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-foreground">Your work</h2>
          <p className="mt-1 text-sm text-muted-foreground">Quotes and booking updates, grouped by event.</p>
        </CardHeader>
        <CardBody>
          {!readinessBoard ? (
            <p role="status" className="text-sm text-muted-foreground">Your work could not be loaded. Refresh to try again.</p>
          ) : readinessBoard.items.length ? (
            <div className="space-y-5">
              {groupReadinessItemsByEvent(readinessBoard.items).map((group) => (
                <section key={group.eventId} aria-label={`${group.eventName} work`}>
                  <h3 className="px-3 text-sm font-semibold text-foreground">{group.eventName}</h3>
                  <div className="mt-1 divide-y divide-border">
                    {group.items.map((item) => <ReadinessItem key={item.id} item={item} onNavigate={onNavigate} />)}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">There are no quote or booking updates to review.</p>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader><h2 className="text-lg font-semibold text-foreground">Quick access</h2></CardHeader>
        <CardBody className="space-y-3">
          <Button variant="outline" className="h-auto w-full justify-between py-3 text-left" onClick={() => onNavigate("requests")}>
            <span><span className="block">Requests & quotes</span><span className="block text-xs font-normal text-muted-foreground">{quoteNeedingSubmission} awaiting a quote</span></span>
            <ArrowRight className="size-4" />
          </Button>
          <Button variant="outline" className="h-auto w-full justify-between py-3 text-left" onClick={() => onNavigate("bookings")}>
            <span><span className="block">Bookings</span><span className="block text-xs font-normal text-muted-foreground">{handoffPending} with steps to complete</span></span>
            <ArrowRight className="size-4" />
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
