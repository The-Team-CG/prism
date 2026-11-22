"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { PrismAssignEventGameAwardInput, PrismGameHostState, PrismGameLeaderboardEntry } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Input } from "@prism/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";

/** Radix Select items cannot be empty strings, so a recipient-less entry uses this sentinel and maps back to "". */
const NO_AWARD_RECIPIENT = "none";

function awardRecipientOptionValue(recipient: PrismGameLeaderboardEntry["awardRecipient"]): string {
  return awardRecipientValue(recipient) || NO_AWARD_RECIPIENT;
}

function awardRecipientValue(recipient: PrismGameLeaderboardEntry["awardRecipient"]): string {
  if (!recipient) return "";
  return recipient.type === "participant"
    ? "participant:" + recipient.participationGrantId
    : "team:" + recipient.teamId;
}

export type HostAwardInput = Omit<PrismAssignEventGameAwardInput, "idempotencyKey">;

function buildHostAwardInput(
  kind: "points" | "badge" | "prize",
  recipient: PrismGameLeaderboardEntry["awardRecipient"],
  label: string,
  points: string,
  prizeReference: string,
): HostAwardInput | null {
  if (!recipient || !label.trim()) return null;
  const normalizedLabel = label.trim();
  if (kind === "points") {
    const parsedPoints = points === "" ? Number.NaN : Number(points);
    if (!Number.isInteger(parsedPoints) || parsedPoints < 0 || parsedPoints > 100_000) return null;
    return { recipient, awardKind: kind, label: normalizedLabel, points: parsedPoints };
  }
  if (kind === "prize") {
    const normalizedReference = prizeReference.trim();
    if (!normalizedReference) return null;
    return { recipient, awardKind: kind, label: normalizedLabel, prizeReference: normalizedReference };
  }
  return { recipient, awardKind: kind, label: normalizedLabel };
}

export function AwardAssignmentSection({
  hostState,
  busy,
  onAssign,
}: {
  hostState: PrismGameHostState;
  busy: boolean;
  onAssign: (sessionId: string, input: HostAwardInput) => Promise<unknown>;
}) {
  const [recipientKey, setRecipientKey] = useState("");
  const [kind, setKind] = useState<"points" | "badge" | "prize">("points");
  const [label, setLabel] = useState("");
  const [points, setPoints] = useState("");
  const [prizeReference, setPrizeReference] = useState("");
  useEffect(() => {
    setRecipientKey("");
    setLabel("");
    setPoints("");
    setPrizeReference("");
  }, [hostState.sessionId]);
  const recipients = hostState.leaderboard.filter((entry) => entry.awardRecipient);
  const selected = recipients.find((entry) => awardRecipientValue(entry.awardRecipient) === recipientKey) ?? recipients[0];
  const input = buildHostAwardInput(kind, selected?.awardRecipient, label, points, prizeReference);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input) return;
    void onAssign(hostState.sessionId, input).then((result) => {
      if (!result) return;
      setLabel("");
      setPoints("");
      setPrizeReference("");
    });
  }

  return (
    <section className="mt-5 border-t border-border pt-4" aria-label="Assign an award">
      <h4 className="text-sm font-bold text-foreground">Assign an award</h4>
      <p className="mt-1 text-xs text-muted-foreground">
        Prize assignments are event records; organizers handle fulfillment.
      </p>
      {recipients.length ? (
        <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={submit}>
          <label className="grid gap-1 text-sm font-semibold text-foreground">
            Award recipient
            <Select value={awardRecipientOptionValue(selected?.awardRecipient)} onValueChange={(value) => setRecipientKey(value === NO_AWARD_RECIPIENT ? "" : value)}>
              <SelectTrigger aria-label="Award recipient" className="min-h-10 w-full min-w-0 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {recipients.map((entry) => (
                  <SelectItem key={awardRecipientOptionValue(entry.awardRecipient)} value={awardRecipientOptionValue(entry.awardRecipient)}>
                    {entry.label}{entry.teamLabel && entry.teamLabel !== entry.label ? " · " + entry.teamLabel : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-foreground">
            Award type
            <Select value={kind} onValueChange={(value) => setKind(value as typeof kind)}>
              <SelectTrigger aria-label="Award type" className="min-h-10 w-full min-w-0 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="points">Points</SelectItem>
                <SelectItem value="badge">Badge</SelectItem>
                <SelectItem value="prize">Prize</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-foreground sm:col-span-2">
            Award label
            <Input aria-label="Award label" value={label} maxLength={120} onChange={(event) => setLabel(event.target.value)} />
          </label>
          {kind === "points" ? (
            <label className="grid gap-1 text-sm font-semibold text-foreground">
              Points
              <Input aria-label="Points" type="number" min={0} max={100_000} step={1} value={points} onChange={(event) => setPoints(event.target.value)} />
            </label>
          ) : null}
          {kind === "prize" ? (
            <label className="grid gap-1 text-sm font-semibold text-foreground">
              Prize reference
              <Input aria-label="Prize reference" value={prizeReference} maxLength={200} onChange={(event) => setPrizeReference(event.target.value)} />
            </label>
          ) : null}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={!input || busy}>Assign award</Button>
          </div>
        </form>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">An award can be assigned after a participant or team appears on the leaderboard.</p>
      )}
    </section>
  );
}
