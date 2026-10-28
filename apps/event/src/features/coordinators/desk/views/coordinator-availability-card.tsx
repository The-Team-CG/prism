import { useState, type FormEvent } from "react";

import {
  createCoordinatorAvailabilitySchema,
  parseContract,
  type CreateCoordinatorAvailabilityInput,
  type PrismCoordinator,
  type PrismCoordinatorAssignment,
  type PrismCoordinatorAvailability,
} from "@prism/types";
import { Button } from "@/app/components/ui/button";
import { DatePicker } from "@prism/ui/components/date-picker";
import { availabilityRangeFromDates, formatAvailabilityRange, isCoordinatorAssignmentActive } from "../model/coordinators-desk-rules";
import { Card, CardBody, CardHeader } from "./coordinator-desk-primitives";

const FIELD_CLASS = "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm";
const DAY_MS = 24 * 60 * 60 * 1000;

/** True when the coordinator is working this event on a day they have declared unavailable. */
function hasUnavailableAssignmentConflict(
  eventId: string,
  eventDate: string,
  coordinatorId: string,
  assignments: PrismCoordinatorAssignment[],
  availability: PrismCoordinatorAvailability[],
) {
  const eventDateStart = new Date(eventDate + "T00:00:00.000Z").getTime();
  const eventDateEnd = eventDateStart + DAY_MS;
  const activelyAssigned = assignments.some((assignment) =>
    assignment.eventId === eventId &&
    assignment.coordinatorId === coordinatorId &&
    isCoordinatorAssignmentActive(assignment),
  );
  return activelyAssigned && availability.some((item) =>
    item.coordinatorId === coordinatorId &&
    item.kind === "unavailable" &&
    Date.parse(item.startsAt) < eventDateEnd &&
    Date.parse(item.endsAt) > eventDateStart,
  );
}

function AvailabilityEntryList({ entries, showEmptyState, busy, onRemove }: {
  entries: PrismCoordinatorAvailability[];
  showEmptyState: boolean;
  busy: boolean;
  onRemove: (item: PrismCoordinatorAvailability) => void;
}) {
  return (
    <div className="max-h-28 space-y-2 overflow-y-auto">
      {entries.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2 py-1.5 text-xs">
          <span>{formatAvailabilityRange(item)}{item.note ? " · " + item.note : ""}</span>
          <button type="button" className="text-destructive" disabled={busy} onClick={() => onRemove(item)}>Remove</button>
        </div>
      ))}
      {showEmptyState && entries.length === 0 && <p className="text-xs text-muted-foreground">No unavailable dates recorded.</p>}
    </div>
  );
}

export function CoordinatorAvailabilityCard({ eventId, eventDate, coordinators, assignments, busy, onLoad, onCreate, onDelete }: {
  eventId: string;
  eventDate: string;
  coordinators: PrismCoordinator[];
  assignments: PrismCoordinatorAssignment[];
  busy: boolean;
  onLoad: (coordinatorId: string) => Promise<PrismCoordinatorAvailability[]>;
  onCreate: (coordinatorId: string, input: CreateCoordinatorAvailabilityInput) => Promise<boolean>;
  onDelete: (coordinatorId: string, availabilityId: string) => Promise<boolean>;
}) {
  const [coordinatorId, setCoordinatorId] = useState("");
  const [entries, setEntries] = useState<PrismCoordinatorAvailability[]>([]);
  const [firstDay, setFirstDay] = useState("");
  const [lastDay, setLastDay] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function select(id: string) {
    setCoordinatorId(id);
    setError(null);
    if (!id) { setEntries([]); return; }
    setLoading(true);
    try { setEntries(await onLoad(id)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load unavailable dates."); }
    finally { setLoading(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!coordinatorId) return;
    setError(null);
    try {
      const input = parseContract(createCoordinatorAvailabilitySchema, {
        ...availabilityRangeFromDates(firstDay, lastDay),
        kind: "unavailable",
        note,
      }, "Coordinator unavailable dates");
      if (!(await onCreate(coordinatorId, input))) return;
      setFirstDay("");
      setLastDay("");
      setNote("");
      await select(coordinatorId);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save unavailable dates."); }
  }

  async function remove(item: PrismCoordinatorAvailability) {
    if (await onDelete(item.coordinatorId, item.id)) await select(item.coordinatorId);
  }

  return (
    <Card>
      <CardHeader><h2 className="text-sm font-bold text-foreground">Coordinator unavailability</h2></CardHeader>
      <CardBody className="space-y-3">
        <select aria-label="Coordinator availability" value={coordinatorId} onChange={(event) => void select(event.target.value)} className={FIELD_CLASS}>
          <option value="">Select coordinator</option>
          {coordinators.filter((coordinator) => coordinator.active).map((coordinator) => <option key={coordinator.id} value={coordinator.id}>{coordinator.name}</option>)}
        </select>
        {loading && <p className="text-xs text-muted-foreground">Loading dates…</p>}
        {coordinatorId && hasUnavailableAssignmentConflict(eventId, eventDate, coordinatorId, assignments, entries) && (
          <p role="alert" className="rounded-lg border border-attention/25 bg-attention/8 px-3 py-2 text-xs font-semibold text-attention">
            An unavailable date overlaps this event assignment. Review coordinator coverage for {eventDate}.
          </p>
        )}
        <AvailabilityEntryList entries={entries} showEmptyState={Boolean(coordinatorId) && !loading} busy={busy} onRemove={(item) => void remove(item)} />
        <form className="space-y-2" onSubmit={(event) => void save(event)}>
          <div className="grid gap-1 text-xs font-semibold text-muted-foreground">
            <span>First unavailable day</span>
            <DatePicker aria-label="First unavailable day" required value={firstDay} onValueChange={setFirstDay} className={FIELD_CLASS} />
          </div>
          <div className="grid gap-1 text-xs font-semibold text-muted-foreground">
            <span>Last unavailable day</span>
            <DatePicker aria-label="Last unavailable day" required min={firstDay || undefined} value={lastDay} onValueChange={setLastDay} className={FIELD_CLASS} />
          </div>
          <input aria-label="Availability note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" className={FIELD_CLASS} />
          <Button type="submit" size="sm" disabled={busy || loading || !coordinatorId}>Add unavailable dates</Button>
        </form>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </CardBody>
    </Card>
  );
}
