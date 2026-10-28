import { useEffect, useState } from "react";

import type { PrismCoordinatorAssignment, PrismEventOperatorDesignation } from "@prism/types";
import { Button } from "@/app/components/ui/button";
import { Card, CardBody, CardHeader } from "./coordinator-desk-primitives";

type Operator = PrismEventOperatorDesignation["operator"];

function currentOperatorText(current: Operator | undefined) {
  if (current === undefined) return "Loading the current operator…";
  return current ? "Current operator: " + (current.coordinatorName ?? "Unavailable coordinator") + "." : "No operator designated yet.";
}

export function OperatorDesignationCard({ eventId, candidates, busy, onLoadOperator, onDesignate, onRevoke }: {
  eventId: string;
  candidates: PrismCoordinatorAssignment[];
  busy: boolean;
  onLoadOperator: () => Promise<Operator>;
  onDesignate: (coordinatorId: string) => Promise<boolean>;
  onRevoke?: () => Promise<boolean>;
}) {
  // undefined while the current operator is loading, null when nobody is designated.
  const [current, setCurrent] = useState<Operator | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const options = Array.from(new Map(candidates.map((item) => [item.coordinatorId, item])).values());
  const departed = departedOperator(current, candidates);

  useEffect(() => {
    let alive = true;
    setCurrent(undefined);
    setLoadError(false);
    onLoadOperator().then(
      (operator) => { if (alive) setCurrent(operator); },
      () => { if (alive) setLoadError(true); },
    );
    return () => { alive = false; };
  }, [eventId]);

  async function designate() {
    setMessage(null);
    if (!(await onDesignate(selected))) {
      setMessage("The operator was not changed. Check the PMCM status message.");
      return;
    }
    setSelected("");
    onLoadOperator().then(setCurrent, () => setMessage("Operator designated. Reload to see the current operator."));
  }

  async function revoke() {
    setMessage(null);
    if (!onRevoke || !(await onRevoke())) { setMessage("The operator was not revoked. Check the PMCM status message."); return; }
    setSelected("");
    try {
      const operator = await onLoadOperator();
      setCurrent(operator);
      setMessage(operator ? "Revocation saved. Another operator is now designated." : "Operator authority revoked.");
    } catch { setMessage("Revocation saved. Reload to see the current operator."); }

  }

  return (
    <Card>
      <CardHeader><h2 className="text-sm font-bold text-foreground">Event Day System Operator</h2></CardHeader>
      <CardBody className="space-y-3">
        <p className="text-sm text-muted-foreground">Choose the coordinator working this event who will control delegated attendance and operator actions. Designating someone replaces the current operator.</p>
        <p role="status" className="text-sm font-semibold text-foreground">{loadError ? "Could not load the current operator. Reload the page to try again." : currentOperatorText(current)}</p>
        {departed ? <p className="text-xs font-semibold text-attention">{departed.coordinatorName ?? "The designated coordinator"} is no longer assigned to this event. Designate a new operator.</p> : null}
        <select aria-label="Event Day System Operator" value={selected} onChange={(event) => setSelected(event.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
          <option value="">Select a coordinator</option>
          {options.map((item) => <option key={item.id} value={item.coordinatorId ?? ""}>{item.coordinatorName} · {item.role}</option>)}
        </select>
        {options.length === 0 ? <p className="text-xs text-muted-foreground">Assign a coordinator to this event before designating an operator.</p> : null}
        <Button type="button" size="sm" disabled={busy || current === undefined || !selected || selected === current?.coordinatorId} onClick={() => void designate()}>Designate operator</Button>
        {current && onRevoke ? <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void revoke()}>Revoke operator</Button> : null}
        {message ? <p role="status" className="text-xs text-muted-foreground">{message}</p> : null}
      </CardBody>
    </Card>
  );
}

function departedOperator(current: Operator | undefined, candidates: PrismCoordinatorAssignment[]) {
  return current && !candidates.some((item) => item.coordinatorId === current.coordinatorId) ? current : null;
}
