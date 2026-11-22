"use client";
import { DateTimePicker } from "@prism/ui/components/date-time-picker";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ChevronDown, RefreshCw, Trophy } from "lucide-react";
import type {
  PrismCreateEventGameInput,
  PrismEventGameAnalytics,
  PrismEventGameBrandTheme,
  PrismEventGameDefinition,
  PrismEventGameHostLobbyBranding,
  UpdateEventGameLobbyBrandingInput,
} from "@prism/types";
import { portalUrlFor } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@prism/ui/components/collapsible";
import { Empty, EmptyDescription, EmptyHeader } from "@prism/ui/components/empty";
import { Input } from "@prism/ui/components/input";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@prism/ui/components/sheet";
import { Textarea } from "@prism/ui/components/textarea";
import { Card, CardBody, CardHeader } from "@/features/event-dashboard/shell/views/sections/shell-ui";
import { EVENT_GAME_OPTIONS, eventGameModeLabel } from "../model/event-game-catalog";
import { resolveGuestGameLobbyUrl } from "../model/guest-lobby-url";
import { portalUrlsFromEnvironment } from "@/lib/portal-urls";
import { LoadingState } from "@prism/ui/components/loading-state";

const LOBBY_THEME_LABELS: Record<PrismEventGameBrandTheme, string> = {
  prism: "Prism",
  ocean: "Ocean",
  sunset: "Sunset",
  forest: "Forest",
};

/** An error shown beside the row or action that failed. */
export function InlineError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return <p role="alert" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{message}</p>;
}

export function EventGamesHeaderCard({
  loading,
  busy,
  error,
  onRefresh,
}: {
  loading: boolean;
  busy: boolean;
  /** Only errors that no row or action owns, such as a failed load. */
  error: string | null;
  onRefresh: () => void;
}) {
  // A plain page header: the section's content (catalog, forms, analytics) carries the cards.
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Event games</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Set up games, run live sessions, and review how guests took part.
          </p>
        </div>
        <Button type="button" variant="outline" disabled={loading || busy} onClick={onRefresh}>
          <RefreshCw className="mr-2 size-4" aria-hidden="true" />
          Refresh
        </Button>
      </div>
      {error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      {loading ? <LoadingState label="Loading event games…" /> : null}
    </header>
  );
}

/** Create game, in a side sheet opened from the game list. */
export function EventGameCreateSheet({
  open,
  busy,
  error,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  busy: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: PrismCreateEventGameInput) => Promise<unknown>;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Create a game</SheetTitle>
          <SheetDescription>The template you pick decides whether the game is Active (Multiplayer) or Independent (Singleplayer).</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <EventGameDraftForm busy={busy} onCreate={async (input) => {
            const created = await onCreate(input);
            if (created) onOpenChange(false);
            return created;
          }} />
          <InlineError message={error} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EventGameDraftForm({
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
    <form className="grid gap-4" onSubmit={submit}>
      <label className="grid gap-1.5 text-sm font-semibold text-foreground">
        Game template
        <Select value={kind} onValueChange={(value) => setKind(value as PrismCreateEventGameInput["kind"])}>
          <SelectTrigger aria-label="Game template" className="min-h-10 w-full min-w-0 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EVENT_GAME_OPTIONS.map((option) => <SelectItem key={option.kind} value={option.kind}>{option.label} — {eventGameModeLabel(option.entryMode)}</SelectItem>)}
          </SelectContent>
        </Select>
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-foreground">
        Game title
        <Input aria-label="Game title" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-foreground">
        Description
        <Textarea aria-label="Game description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={2} />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-foreground">
        Instructions
        <Textarea aria-label="Game instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={2000} rows={3} />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-foreground">
        Available from
        <DateTimePicker value={availableFrom} onValueChange={(next) => setAvailableFrom(next)} aria-label="Available from" />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-foreground">
        Available until
        <DateTimePicker value={availableUntil} onValueChange={(next) => setAvailableUntil(next)} aria-label="Available until" />
      </label>
      <div>
        <Button type="submit" disabled={!title.trim() || busy}>Create game</Button>
      </div>
    </form>
  );
}

export function EventGameCatalogCard({
  games,
  renderGame,
  onCreate,
}: {
  games: PrismEventGameDefinition[];
  renderGame: (game: PrismEventGameDefinition) => ReactNode;
  onCreate: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h3 className="text-base font-bold text-foreground">Games</h3>
            <span className="text-sm text-muted-foreground">{games.length} configured</span>
          </div>
          <Button type="button" size="sm" onClick={onCreate}>Create game</Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">A new game stays a draft until its questions or settings are complete and you publish it.</p>
      </CardHeader>
      <CardBody>
        {games.length ? <ul className="divide-y divide-border rounded-lg border border-border">{games.map(renderGame)}</ul> : (
          <Empty className="border-0 p-4 md:p-4">
            <EmptyHeader>
              <EmptyDescription>No games exist for this event yet.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardBody>
    </Card>
  );
}

export function GuestGameLobbyCard({
  lobbySlug,
  branding,
  busy,
  canBrand,
  error,
  onProvision,
  onSaveBranding,
  onUploadLogo,
}: {
  lobbySlug: string | null;
  branding: PrismEventGameHostLobbyBranding | null;
  busy: boolean;
  /** Branding and the logo are PMCM Admin settings; coordinators see only the lobby link. */
  canBrand: boolean;
  error: string | null;
  onProvision: () => void;
  onSaveBranding: (settings: Omit<UpdateEventGameLobbyBrandingInput, "idempotencyKey">) => void;
  onUploadLogo: (file: File) => Promise<unknown> | unknown;
}) {
  const [open, setOpen] = useState(false);
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
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader>
          <CollapsibleTrigger asChild>
            <button type="button" className="flex w-full items-center justify-between gap-3 text-left">
              <span>
                <span className="block text-base font-bold text-foreground">Guest games lobby</span>
                <span className="mt-1 block text-sm font-normal text-muted-foreground">Independent (Singleplayer) games start from this lobby without a PIN.</span>
              </span>
              <ChevronDown className={"size-4 shrink-0 transition-transform " + (open ? "rotate-180" : "")} aria-hidden="true" />
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardBody>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Share this guest app lobby URL</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {lobbyUrl ? <>
                  <code className="break-all rounded bg-muted px-2 py-1 text-sm">{lobbyUrl}</code>
                  <Button type="button" variant="outline" onClick={() => void copyUrl()}>Copy lobby URL</Button>
                </> : null}
                <Button type="button" variant="outline" disabled={busy} onClick={onProvision}>{lobbySlug ? "Refresh lobby link" : "Create lobby link"}</Button>
              </div>
            </div>
            {canBrand ? <>
              <div className="mt-5 grid gap-4 border-t border-border pt-4 md:grid-cols-2">
                <div>
                  <label htmlFor="event-game-lobby-theme" className="mb-1 block text-sm font-semibold text-foreground">Guest lobby theme</label>
                  <Select value={theme} onValueChange={(value) => setTheme(value as PrismEventGameBrandTheme)}>
                    <SelectTrigger id="event-game-lobby-theme" aria-label="Guest lobby theme" className="w-full min-w-0 bg-background text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(LOBBY_THEME_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">Choose an event-wide theme, then adjust its colors.</p>
                </div>
                <label className="grid gap-1 text-sm font-semibold text-foreground" htmlFor="event-game-lobby-primary-color">
                  Primary brand color
                  <Input id="event-game-lobby-primary-color" aria-label="Primary brand color" type="color" value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value.toUpperCase())} disabled={busy} className="p-1" />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-foreground" htmlFor="event-game-lobby-secondary-color">
                  Secondary brand color
                  <Input id="event-game-lobby-secondary-color" aria-label="Secondary brand color" type="color" value={secondaryColor} onChange={(event) => setSecondaryColor(event.target.value.toUpperCase())} disabled={busy} className="p-1" />
                </label>
                <div className="flex flex-wrap items-end gap-2">
                  <Button type="button" variant="outline" disabled={busy} onClick={() => onSaveBranding({ theme, primaryColor, secondaryColor, logoObjectId: branding?.logoObjectId ?? null })}>Save branding</Button>
                </div>
              </div>
              <div className="mt-4 border-t border-border pt-4">
                <label htmlFor="event-game-lobby-logo" className="block text-sm font-semibold text-foreground">Guest lobby logo</label>
                <Input
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
                  className="mt-2"
                />
                <p className="mt-1 text-xs text-muted-foreground">PNG, JPEG, or WebP; maximum 1 MB. Brand colors must keep accessible contrast against white text.</p>
              </div>
              {branding ? <LobbyThemePreview branding={branding} /> : null}
            </> : null}
            <InlineError message={error} />
          </CardBody>
        </CollapsibleContent>
      </Collapsible>
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
