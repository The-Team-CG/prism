"use client";

import { useEffect, useState } from "react";
import type { PrismFileRequirementsMatrix, PrismUser } from "@prism/types";
import { FileCheck2 } from "lucide-react";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { clientFileRequirementsRepository } from "../data/client-file-requirements-repository";
import { fileRequirementDueSummary } from "../model/file-requirement-due-summary";

const STORAGE_HELP_COPY =
  "Track required documents here. Uploads and PMCM-shared files are available in the event files panel.";

export function ClientFileRequirementsMatrix({
  eventId,
  session,
}: {
  eventId?: string;
  session: Pick<PrismUser, "name" | "email">;
}) {
  const [matrix, setMatrix] = useState<PrismFileRequirementsMatrix | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setMatrix(null);
      return;
    }
    let alive = true;
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
      });
    return () => {
      alive = false;
    };
  }, [eventId, session.email, session.name]);

  if (!eventId) return null;
  const items = matrix?.items ?? [];

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-base font-black text-foreground">File requirements</h2>
      <p className="mt-1 text-xs text-muted-foreground">{STORAGE_HELP_COPY}</p>
      {error ? (
        <p className="mt-4 text-sm text-muted-foreground">{error}</p>
      ) : items.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={FileCheck2} title="No required files yet" description="Client-visible requirements appear after PMCM requests documents for this event." />
        </div>
      ) : (
        <div className="mt-4 divide-y divide-border">
          {items.map((item) => (
            <div key={item.key} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">{item.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                <p className={`mt-1 text-2xs font-semibold ${item.overdue ? "text-destructive" : "text-muted-foreground"}`}>
                  {fileRequirementDueSummary(item)}
                </p>
              </div>
              <StatusBadge status={item.status} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
