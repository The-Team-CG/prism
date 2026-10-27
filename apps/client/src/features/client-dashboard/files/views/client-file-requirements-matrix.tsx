"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PrismFileRequirementsMatrix, PrismUser } from "@prism/types";
import { FileCheck2 } from "lucide-react";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { clientFileRequirementsRepository } from "../data/client-file-requirements-repository";
import { fileRequirementDueSummary } from "../model/file-requirement-due-summary";
import { clientFileRequirementDetail, clientFileRequirementDestination } from "../model/client-file-requirement-copy";

const STORAGE_HELP_COPY =
  "See what is required, who provides it and whether PMCM has reviewed it.";

export function ClientFileRequirementsMatrix({
  eventId,
  session,
}: {
  eventId?: string;
  session: Pick<PrismUser, "name" | "email">;
}) {
  const [matrix, setMatrix] = useState<PrismFileRequirementsMatrix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!eventId) {
      setMatrix(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    setMatrix(null);
    clientFileRequirementsRepository
      .load(eventId)
      .then((next) => {
        if (alive) {
          setMatrix(next);
          setError(null);
        }
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : "Unable to load file requirements.");
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => {
      alive = false;
    };
  }, [eventId, session.email, session.name, attempt]);

  if (!eventId) return null;
  const items = matrix?.items ?? [];

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold text-foreground">Required records</h2>
      <p className="mt-1 text-sm text-muted-foreground">{STORAGE_HELP_COPY}</p>
      {error ? (
        <div className="mt-4"><p role="alert" className="text-sm text-attention">{error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-2 min-h-11 rounded-md px-2 text-sm font-semibold text-primary focus-visible:ring-2 focus-visible:ring-primary">Try loading requirements again</button></div>
      ) : loading ? (
        <p role="status" className="mt-4 text-sm text-muted-foreground">Loading requirements…</p>
      ) : items.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={FileCheck2} title="No required files yet" description="Client-visible requirements appear after PMCM requests documents for this event." />
        </div>
      ) : (
        <div className="mt-4 divide-y divide-border">
          {items.map((item) => {
            const destination = clientFileRequirementDestination(item, eventId);
            return (
            <div key={item.key} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">{item.key === "client_feedback" ? "Event feedback" : item.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">Responsible: {item.ownerRole === "client" ? "You" : item.ownerRole === "pmcm-admin" ? "PMCM" : item.ownerRole.replaceAll("_", " ")}</p>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{clientFileRequirementDetail(item)}</p>
                <p className={`mt-1 text-2xs font-semibold ${item.overdue ? "text-destructive" : "text-muted-foreground"}`}>
                  {fileRequirementDueSummary(item)}
                </p>
                {!["approved", "complete"].includes(item.status) ? <Link href={destination.href} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-primary focus-visible:ring-2 focus-visible:ring-primary">{destination.label}</Link> : null}
              </div>
              <StatusBadge status={item.status} />
            </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
