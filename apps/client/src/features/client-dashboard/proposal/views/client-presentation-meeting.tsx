"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { formatPortalDateTime } from "@prism/ui/format-date";
import { presentationMeetingIcs, type PrismPresentationMeeting } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Card, CardBody, CardHeader } from "../../shared/tab-ui";
import { presentationMeetingsRepository } from "../data/presentation-meetings-repository";

function downloadIcs(meeting: PrismPresentationMeeting) {
  const ics = presentationMeetingIcs(meeting);
  if (!ics) return;
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "presentation.ics";
  link.click();
  URL.revokeObjectURL(url);
}

/** FR-61: the client picks one of PMCM's presentation times and adds it to their calendar. */
export function ClientPresentationMeeting({ eventId }: { eventId: string }) {
  const [meeting, setMeeting] = useState<PrismPresentationMeeting | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setMeeting((await presentationMeetingsRepository.list(eventId)).meetings.find((item) => item.status === "proposed" || item.status === "scheduled") ?? null); } catch { setMeeting(null); }
  }, [eventId]);
  useEffect(() => { void load(); }, [load]);
  if (!meeting) return null;

  async function choose(startsAt: string) {
    if (!meeting) return;
    setBusy(true);
    setError(null);
    try { setMeeting(await presentationMeetingsRepository.choose(eventId, meeting.id, startsAt)); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not book that time."); } finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2"><CalendarClock className="size-4 text-primary" /><h2 className="text-sm font-semibold text-foreground">{meeting.title}</h2></div>
      </CardHeader>
      <CardBody>
        {error ? <p role="alert" className="mb-2 text-sm text-destructive">{error}</p> : null}
        {meeting.chosen ? (
          <div className="space-y-2 text-sm">
            <p>Booked for <span className="font-semibold">{formatPortalDateTime(meeting.chosen.startsAt)}</span>.</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => downloadIcs(meeting)}>Add to calendar</Button>
              {meeting.meetingLink ? <a href={meeting.meetingLink} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-lg border border-border px-3 text-sm font-semibold">Join link</a> : null}
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">Choose the time that works for you. PMCM will present the proposal then.</p>
            <div className="flex flex-wrap gap-2">
              {meeting.slots.map((slot) => <Button key={slot.startsAt} type="button" variant="outline" disabled={busy} onClick={() => void choose(slot.startsAt)}>{formatPortalDateTime(slot.startsAt)}</Button>)}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
