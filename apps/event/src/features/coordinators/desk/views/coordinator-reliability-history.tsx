"use client";

import { useMemo, useRef, useState } from "react";
import type { PrismCoordinatorAssignment, PrismCoordinator, PrismCoordinatorReliabilityHistoryEntry } from "@prism/types";
import { Button } from "@/app/components/ui/button";
import { Card, CardBody, CardHeader } from "./coordinator-desk-primitives";

type HistoryStatus = "idle" | "loading" | "loaded" | "error";

export function CoordinatorReliabilityHistory({
  coordinators,
  assignments,
  onLoad,
}: {
  coordinators: Pick<PrismCoordinator, "id" | "name">[];
  assignments: Pick<PrismCoordinatorAssignment, "coordinatorId" | "coordinatorName">[];
  onLoad: (coordinatorId: string) => Promise<PrismCoordinatorReliabilityHistoryEntry[]>;
}) {
  const [coordinatorId, setCoordinatorId] = useState("");
  const [entries, setEntries] = useState<PrismCoordinatorReliabilityHistoryEntry[]>([]);
  const [status, setStatus] = useState<HistoryStatus>("idle");
  const requestId = useRef(0);
  const options = useMemo(() => {
    const names = new Map(coordinators.map((coordinator) => [coordinator.id, coordinator.name]));
    assignments.forEach((assignment) => {
      if (assignment.coordinatorId && !names.has(assignment.coordinatorId)) {
        names.set(assignment.coordinatorId, assignment.coordinatorName);
      }
    });
    return [...names].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [coordinators, assignments]);

  async function loadHistory() {
    if (!coordinatorId) return;
    const currentRequest = ++requestId.current;
    setStatus("loading");
    setEntries([]);
    try {
      const nextEntries = await onLoad(coordinatorId);
      if (requestId.current !== currentRequest) return;
      setEntries(nextEntries);
      setStatus("loaded");
    } catch {
      if (requestId.current !== currentRequest) return;
      setStatus("error");
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-bold text-foreground">Coordinator reliability history</h2>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-60 flex-1 text-sm font-semibold text-foreground">
            Coordinator
            <select
              aria-label="Coordinator reliability profile"
              value={coordinatorId}
              onChange={(event) => {
                requestId.current += 1;
                setCoordinatorId(event.target.value);
                setEntries([]);
                setStatus("idle");
              }}
              className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3"
            >
              <option value="">Choose a coordinator</option>
              {options.map((coordinator) => <option key={coordinator.id} value={coordinator.id}>{coordinator.name}</option>)}
            </select>
          </label>
          <Button type="button" disabled={!coordinatorId || status === "loading"} onClick={() => void loadHistory()}>
            {status === "loading" ? "Loading history…" : "Load history"}
          </Button>
        </div>
        {status === "loading" && <p role="status" className="text-sm text-muted-foreground">Loading coordinator history…</p>}
        {status === "error" && <p role="status" className="text-sm text-destructive">Could not load coordinator history. Try again.</p>}
        {status === "loaded" && entries.length === 0 && (
          <p role="status" className="text-sm text-muted-foreground">No reliability history recorded.</p>
        )}
        {entries.length > 0 && (
          <ol aria-label="Reliability notes" className="divide-y divide-border rounded-xl border border-border">
            {entries.map((entry) => (
              <li key={entry.id} className="space-y-1.5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{entry.eventName ?? "Event no longer available"}</p>
                  <span className="text-xs text-muted-foreground">{entry.createdAt.slice(0, 10)} · {entry.severity}</span>
                </div>
                <p className="text-sm leading-6 text-foreground">{entry.note}</p>
                {(entry.assignmentRole || entry.eventDate) && (
                  <p className="text-xs text-muted-foreground">
                    {[entry.assignmentRole, entry.eventDate].filter(Boolean).join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}
