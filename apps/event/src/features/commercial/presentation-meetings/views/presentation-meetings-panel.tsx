"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPortalDateTime } from "@prism/ui/format-date";
import { presentationMeetingIcs, type PrismPresentationMeeting, type PrismPresentationMeetings } from "@prism/types";
import { presentationMeetingsRepository } from "../data/presentation-meetings-repository";

const field = "mt-1 block w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm";

export function downloadIcs(meeting: PrismPresentationMeeting) {
  const ics = presentationMeetingIcs(meeting);
  if (!ics) return;
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "presentation.ics";
  link.click();
  URL.revokeObjectURL(url);
}

/** FR-61: PMCM offers two to four presentation times, the client picks one, and PMCM records attendance. */
export function PresentationMeetingsPanel({ eventId }: { eventId: string }) {
  const [data, setData] = useState<PrismPresentationMeetings>({ meetings: [], atRisk: false });
  const [title, setTitle] = useState("Proposal presentation");
  const [link, setLink] = useState("");
  const [slots, setSlots] = useState<string[]>(["", ""]);
  const [minutes, setMinutes] = useState("60");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await presentationMeetingsRepository.list(eventId)); } catch { setData({ meetings: [], atRisk: false }); }
  }, [eventId]);
  useEffect(() => { void load(); }, [load]);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try { await action(); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save."); }
  }

  const propose = () => run(() => presentationMeetingsRepository.propose(eventId, {
    title, ...(link.trim() ? { meetingLink: link.trim() } : {}),
    slots: slots.filter(Boolean).map((start) => {
      const startsAt = new Date(start);
      return { startsAt: startsAt.toISOString(), endsAt: new Date(startsAt.getTime() + Number(minutes) * 60_000).toISOString() };
    }),
  }));

  return (
    <section className="rounded-lg border border-border bg-card p-5 text-sm">
      <h2 className="text-lg font-bold">Presentation meeting</h2>
      {data.atRisk ? <p role="alert" className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-destructive">At risk: the client missed the last two presentations.</p> : null}
      {error ? <p role="alert" className="mt-2 text-destructive">{error}</p> : null}
      <ul className="mt-3 space-y-2">
        {data.meetings.map((meeting) => (
          <li key={meeting.id} className="rounded-md border border-border p-3">
            <p className="font-semibold">{meeting.title} · {meeting.status.replace("_", " ")}</p>
            <p className="text-xs text-muted-foreground">{meeting.chosen ? `Booked for ${formatPortalDateTime(meeting.chosen.startsAt)}` : `Offered: ${meeting.slots.map((slot) => formatPortalDateTime(slot.startsAt)).join(" · ")}`}</p>
            {meeting.status === "scheduled" ? (
              <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
                <button type="button" onClick={() => downloadIcs(meeting)} className="text-primary">Calendar file</button>
                <button type="button" onClick={() => void run(() => presentationMeetingsRepository.outcome(eventId, meeting.id, { outcome: "attended" }))} className="text-primary">Held</button>
                <button type="button" onClick={() => void run(() => presentationMeetingsRepository.outcome(eventId, meeting.id, { outcome: "no_show" }))} className="text-destructive">Client did not attend</button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} className={field} /></label>
        <label>Meeting link (Zoom, Meet or Teams)<input value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://" className={field} /></label>
        {slots.map((slot, index) => (
          <label key={index}>Time option {index + 1}<input type="datetime-local" value={slot} onChange={(event) => setSlots(slots.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} className={field} /></label>
        ))}
        <label>Length (minutes)<input type="number" min={15} max={240} value={minutes} onChange={(event) => setMinutes(event.target.value)} className={field} /></label>
      </div>
      <div className="mt-3 flex gap-2">
        {slots.length < 4 ? <button type="button" onClick={() => setSlots([...slots, ""])} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold">Add a time</button> : null}
        <button type="button" disabled={slots.filter(Boolean).length < 2} onClick={() => void propose()} className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">{data.meetings.length ? "Send new times" : "Send times to the client"}</button>
      </div>
    </section>
  );
}
