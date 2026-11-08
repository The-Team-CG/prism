"use client";

import { formatPortalDateTime } from "@prism/ui/format-date";
import { useRoleBriefs } from "../view-models/use-role-briefs";

/** New-CO2: the signed-in coordinator's own role brief for the event. */
export function CoordinatorRoleBriefCard({ eventId }: { eventId: string }) {
  const vm = useRoleBriefs(eventId);
  const brief = vm.briefs[0];
  if (vm.loading) return <p className="text-sm text-muted-foreground">Loading your role brief…</p>;
  if (vm.error) return <p role="alert" className="text-sm text-destructive">{vm.error}</p>;
  if (!brief) return <p className="text-sm text-muted-foreground">PMCM has not shared a brief for your role yet.</p>;
  return (
    <div className="space-y-2 text-sm">
      <p className="font-semibold text-foreground">Call time: {brief.callTime ? <time dateTime={brief.callTime}>{formatPortalDateTime(brief.callTime)}</time> : "Not set"}</p>
      <p className="text-muted-foreground">Attire: {brief.attire || "Not set"}</p>
      {brief.instructions ? <p className="whitespace-pre-wrap leading-6 text-muted-foreground">{brief.instructions}</p> : null}
      {brief.script ? (
        <details className="rounded-md border border-border p-3">
          <summary className="cursor-pointer font-semibold text-foreground">Script and cues</summary>
          <p className="mt-2 whitespace-pre-wrap leading-6 text-muted-foreground">{brief.script}</p>
        </details>
      ) : null}
    </div>
  );
}
