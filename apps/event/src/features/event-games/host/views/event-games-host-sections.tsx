"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { RefreshCw, Trophy } from "lucide-react";
import type {
  PrismCreateEventGameInput,
  PrismEventGameAnalytics,
  PrismEventGameBrandTheme,
  PrismEventGameDefinition,
  PrismEventGameHostLobbyBranding,
  UpdateEventGameLobbyBrandingInput,
} from "@prism/types";
import { portalUrlFor } from "@prism/types";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { Card, CardBody, CardHeader } from "@/features/event-dashboard/shell/views/sections/shell-ui";
import { EVENT_GAME_OPTIONS, eventGameModeLabel } from "../model/event-game-catalog";
import { resolveGuestGameLobbyUrl } from "../model/guest-lobby-url";
import { portalUrlsFromEnvironment } from "@/lib/portal-urls";

const LOBBY_THEME_LABELS: Record<PrismEventGameBrandTheme, string> = {
  prism: "Prism",
  ocean: "Ocean",
  sunset: "Sunset",
  forest: "Forest",
};

export function EventGamesHeaderCard({
  loading,
  busy,
  error,
  onRefresh,
}: {
  loading: boolean;
  busy: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">Event games</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Create event game drafts, host ready Active (Multiplayer) sessions, and review event-level engagement.
            </p>
          </div>
          <Button type="button" variant="outline" disabled={loading || busy} onClick={onRefresh}>
            <RefreshCw className="mr-2 size-4" aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardBody>
        {error ? <p role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}
        {loading ? <p role="status" className="text-sm text-muted-foreground">Loading event games…</p> : null}
      </CardBody>
    </Card>
  );
}

export function EventGameDraftCard({
  busy,
  onCreate,
}: {
  busy: boolean;
  onCreate: (input: PrismCreateEventGameInput) => Promise<unknown>;
}) {
  const [kind, setKind] = useState<PrismCreateEventGameInput["kind"]>("live-trivia");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [availableFrom, setAvailableFrom] = useState("");
  const [availableUntil, setAvailableUntil] = useState("");

  function toIsoDateTime(value: string): string | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedTitle = title.trim();
    if (!normalizedTitle) return;
    const from = toIsoDateTime(availableFrom);
    const until = toIsoDateTime(availableUntil);
    void onCreate({
      kind,
      title: normalizedTitle,
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
      ...(from ? { availableFrom: from } : {}),
      ...(until ? { availableUntil: until } : {}),
    }).then((created) => {
      if (!created) return;
      setTitle("");
      setDescription("");
      setInstructions("");
      setAvailableFrom("");
      setAvailableUntil("");
    });
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-bold text-foreground">Create a game draft</h3>
        <p className="mt-1 text-sm text-muted-foreground">The selected template determines whether the game is Active (Multiplayer) or Independent (Singleplayer).</p>
      </CardHeader>
      <CardBody>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
          <label className="grid gap-1.5 text-sm font-semibold text-foreground">
            Game template
            <select aria-label="Game template" value={kind} onChange={(event) => setKind(event.target.value as PrismCreateEventGameInput["kind"])} className="min-h-10 rounded-lg border border-border bg-background px-3">
              {EVENT_GAME_OPTIONS.map((option) => <option key={option.kind} value={option.kind}>{option.label} — {eventGameModeLabel(option.entryMode)}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-foreground">
            Game title
            <input aria-label="Game title" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} className="min-h-10 rounded-lg border border-border bg-background px-3" />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-foreground md:col-span-2">
            Description
            <textarea aria-label="Game description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={2} className="rounded-lg border border-border bg-background px-3 py-2" />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-foreground md:col-span-2">
            Instructions
            <textarea aria-label="Game instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={2000} rows={3} className="rounded-lg border border-border bg-background px-3 py-2" />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-foreground">
            Available from
            <input aria-label="Available from" type="datetime-local" value={availableFrom} onChange={(event) => setAvailableFrom(event.target.value)} className="min-h-10 rounded-lg border border-border bg-background px-3" />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-foreground">
            Available until
            <input aria-label="Available until" type="datetime-local" value={availableUntil} onChange={(event) => setAvailableUntil(event.target.value)} className="min-h-10 rounded-lg border border-border bg-background px-3" />
          </label>
          <div className="md:col-span-2">
            <Button type="submit" disabled={!title.trim() || busy}>Create game</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

export function EventGameCatalogCard({
  games,
  renderGame,
}: {
  games: PrismEventGameDefinition[];
  renderGame: (game: PrismEventGameDefinition) => ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-foreground">Game catalog</h3>
          <span className="text-sm text-muted-foreground">{games.length} configured</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Drafts stay unpublished until their template rules and configuration are implemented.</p>
      </CardHeader>
      <CardBody>
        {games.length ? <div className="space-y-3">{games.map(renderGame)}</div> : <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No game drafts exist for this event yet.</p>}
      </CardBody>
    </Card>
  );
}

export function GuestGameLobbyCard({
  lobbySlug,
  branding,
  busy,
  onProvision,
  onSaveBranding,
  onUploadLogo,
}: {
  lobbySlug: string | null;
  branding: PrismEventGameHostLobbyBranding | null;
  busy: boolean;
  onProvision: () => void;
  onSaveBranding: (settings: Omit<UpdateEventGameLobbyBrandingInput, "idempotencyKey">) => void;
  onUploadLogo: (file: File) => Promise<unknown> | unknown;
}) {
  const [theme, setTheme] = useState<PrismEventGameBrandTheme>("prism");
  const [primaryColor, setPrimaryColor] = useState("#312E81");
  const [secondaryColor, setSecondaryColor] = useState("#0F766E");
  useEffect(() => {
    if (branding) {
      setTheme(branding.theme);
      setPrimaryColor(branding.primaryColor);
      setSecondaryColor(branding.secondaryColor);
    }
  }, [branding]);

  const lobbyUrl = lobbySlug && typeof window !== "undefined"
    ? resolveGuestGameLobbyUrl(
      lobbySlug,
      portalUrlFor("guest", portalUrlsFromEnvironment()),
      window.location.origin,
    )
    : null;

  async function copyUrl() {
    if (!lobbyUrl || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(lobbyUrl);
    } catch {
      // The visible URL remains available for manual copying.
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-foreground">Guest games lobby</h3>
            <p className="mt-1 text-sm text-muted-foreground">Independent (Singleplayer) games start from this lobby without a PIN.</p>
          </div>
          <Button type="button" variant="outline" disabled={busy} onClick={onProvision}>{lobbySlug ? "Refresh lobby link" : "Create lobby link"}</Button>
        </div>
      </CardHeader>
      <CardBody>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="event-game-lobby-theme" className="mb-1 block text-sm font-semibold text-foreground">Guest lobby theme</label>
            <select id="event-game-lobby-theme" aria-label="Guest lobby theme" value={theme} onChange={(event) => setTheme(event.target.value as PrismEventGameBrandTheme)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
              {Object.entries(LOBBY_THEME_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">Choose an event-wide theme, then adjust its colors.</p>
          </div>
          <label className="grid gap-1 text-sm font-semibold text-foreground" htmlFor="event-game-lobby-primary-color">
            Primary brand color
            <input id="event-game-lobby-primary-color" aria-label="Primary brand color" type="color" value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value.toUpperCase())} disabled={busy} className="h-10 w-full rounded-md border border-border bg-background p-1" />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-foreground" htmlFor="event-game-lobby-secondary-color">
            Secondary brand color
            <input id="event-game-lobby-secondary-color" aria-label="Secondary brand color" type="color" value={secondaryColor} onChange={(event) => setSecondaryColor(event.target.value.toUpperCase())} disabled={busy} className="h-10 w-full rounded-md border border-border bg-background p-1" />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => onSaveBranding({ theme, primaryColor, secondaryColor, logoObjectId: branding?.logoObjectId ?? null })}>Save branding</Button>
          </div>
        </div>
        <div className="mt-4 border-t border-border pt-4">
          <label htmlFor="event-game-lobby-logo" className="block text-sm font-semibold text-foreground">Guest lobby logo</label>
          <input
            id="event-game-lobby-logo"
            aria-label="Guest lobby logo"
            type="file"
            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
            disabled={busy}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void onUploadLogo(file);
            }}
            className="mt-2 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:font-semibold"
          />
          <p className="mt-1 text-xs text-muted-foreground">PNG, JPEG, or WebP; maximum 1 MB. Brand colors must keep accessible contrast against white text.</p>
        </div>
        {branding ? <LobbyThemePreview branding={branding} /> : null}
        {lobbyUrl ? <div className="mt-5 border-t border-border pt-4">
          <p className="text-xs font-semibold text-muted-foreground">Share this guest app lobby URL</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-muted px-2 py-1 text-sm">{lobbyUrl}</code>
            <Button type="button" variant="outline" onClick={() => void copyUrl()}>Copy lobby URL</Button>
          </div>
        </div> : null}
      </CardBody>
    </Card>
  );
}

export function EventGameAnalyticsCard({
  analytics,
  onSelectSession,
}: {
  analytics: PrismEventGameAnalytics | null;
  onSelectSession?: (sessionId: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-primary" aria-hidden="true" />
          <h3 className="text-base font-bold text-foreground">Event analytics</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Participation counts event-scoped browser credentials, not verified people.</p>
      </CardHeader>
      <CardBody>
        {analytics ? <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Games created" value={analytics.totals.gamesCreated} />
            <Metric label="Sessions started" value={analytics.totals.sessionsStarted} />
            <Metric label="Participant joins" value={analytics.totals.participantJoins} />
            <Metric label="Completion rate" value={Math.round(analytics.totals.completionRate * 100) + "%"} />
          </div>
          <div className="mt-4 space-y-2">
            {analytics.sessions.map((session) => {
              const content = <>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">{session.gameTitle}</span>
                  <span className="text-xs text-muted-foreground">{session.participantJoins} joins · {session.roundsAnswered} answers</span>
                </span>
                <StatusBadge status={session.status} />
              </>;
              return onSelectSession ? (
                <button type="button" key={session.sessionId} onClick={() => onSelectSession(session.sessionId)} className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-left hover:bg-muted/40">
                  {content}
                </button>
              ) : (
                <div key={session.sessionId} className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-left">
                  {content}
                </div>
              );
            })}
            {analytics.sessions.length === 0 ? <p className="text-sm text-muted-foreground">No game sessions yet.</p> : null}
          </div>
        </> : <p className="text-sm text-muted-foreground">Analytics are not available until the event game workspace loads.</p>}
      </CardBody>
    </Card>
  );
}

function LobbyThemePreview({ branding }: { branding: PrismEventGameHostLobbyBranding }) {
  return (
    <div className="mt-4 flex items-center gap-2" aria-label={`${LOBBY_THEME_LABELS[branding.theme]} theme preview`}>
      <span className="size-5 rounded-full border border-border" style={{ backgroundColor: branding.primaryColor }} aria-hidden="true" />
      <span className="size-5 rounded-full border border-border" style={{ backgroundColor: branding.secondaryColor }} aria-hidden="true" />
      <span className="text-xs text-muted-foreground">{LOBBY_THEME_LABELS[branding.theme]} theme preview</span>
      {branding.logoUrl ? <img src={branding.logoUrl} alt="Current guest lobby logo" className="ml-2 max-h-10 max-w-36 object-contain" /> : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}
