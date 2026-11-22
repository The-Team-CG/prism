"use client";
import { DateTimePicker } from "@prism/ui/components/date-time-picker";

import { useEffect, useState } from "react";
import type { PrismEventGameDefinition, PrismUpdateEventGameInput } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@prism/ui/components/dialog";
import { Input } from "@prism/ui/components/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@prism/ui/components/sheet";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { eventGameModeLabel, eventGameOption } from "../model/event-game-catalog";
import { EventGameTemplateConfigurationEditor, hasPublishableTemplateConfiguration } from "./event-game-template-configuration-editor";
import { InlineError } from "./event-games-host-sections";

function isoDateTime(value: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function editableBeforeStart(game: PrismEventGameDefinition): boolean {
  return game.status === "draft" || (game.status === "published" && !game.hasStartedSession);
}

/** One game in the Set up list: title, kind and status, with its row actions. Editing happens in a side sheet. */
export function GameDefinitionRow({
  game,
  busy,
  error,
  onUpdate,
  onArchive,
  onPublish,
  onSchedule,
  onUploadMedia,
}: {
  game: PrismEventGameDefinition;
  busy: boolean;
  /** The last error from an action on this game, shown beside it. */
  error: string | null;
  onUpdate: (gameId: string, input: PrismUpdateEventGameInput) => Promise<unknown>;
  onArchive: (gameId: string) => Promise<unknown>;
  onPublish: (gameId: string) => Promise<unknown>;
  onSchedule: (gameId: string, scheduledStartAt?: string) => Promise<unknown>;
  onUploadMedia: (gameId: string, file: File) => Promise<{ objectId: string }>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");

  return (
    <li className="p-4">
      <GameDefinitionSummary game={game} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <GameDraftActions game={game} busy={busy} onEdit={() => setEditing(true)} onPublish={onPublish} />
        {game.status !== "removed" ? <Button type="button" size="sm" variant="outline" onClick={() => setConfirmingArchive(true)} disabled={busy}>Archive</Button> : null}
        <GameScheduleAction game={game} busy={busy} scheduleAt={scheduleAt} setScheduleAt={setScheduleAt} onSchedule={onSchedule} />
      </div>
      {!editing ? <InlineError message={error} /> : null}
      <GameEditSheet
        game={game}
        open={editing}
        busy={busy}
        error={error}
        onOpenChange={setEditing}
        onUpdate={onUpdate}
        onUploadMedia={onUploadMedia}
      />
      <ArchiveGameDialog
        game={game}
        open={confirmingArchive}
        busy={busy}
        onOpenChange={setConfirmingArchive}
        onConfirm={() => {
          setConfirmingArchive(false);
          void onArchive(game.id);
        }}
      />
    </li>
  );
}

function GameDefinitionSummary({ game }: { game: PrismEventGameDefinition }) {
  const option = eventGameOption(game.kind);
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h4 className="truncate text-sm font-bold text-foreground">{game.title}</h4>
        <p className="mt-1 text-xs text-muted-foreground">{option?.label ?? game.kind} · {eventGameModeLabel(game.entryMode)} · v{game.version}</p>
        {game.description ? <p className="mt-2 text-sm text-muted-foreground">{game.description}</p> : null}
      </div>
      <StatusBadge status={game.status} />
    </div>
  );
}

function GameDraftActions({
  game, busy, onEdit, onPublish,
}: {
  game: PrismEventGameDefinition; busy: boolean; onEdit: () => void; onPublish: (gameId: string) => Promise<unknown>;
}) {
  if (!editableBeforeStart(game)) return null;
  if (hasPublishableTemplateConfiguration(game)) {
    return <>
      <Button type="button" size="sm" variant="outline" onClick={onEdit} disabled={busy}>Edit</Button>
      {game.status === "draft" ? <Button type="button" size="sm" onClick={() => void onPublish(game.id)} disabled={busy}>Publish game</Button> : null}
    </>;
  }
  return <>
    {game.status === "draft" ? <span className="text-xs text-muted-foreground">Save a complete template configuration before publishing.</span> : null}
    <Button type="button" size="sm" variant="outline" onClick={onEdit} disabled={busy}>Edit</Button>
  </>;
}

function GameScheduleAction({
  game, busy, scheduleAt, setScheduleAt, onSchedule,
}: {
  game: PrismEventGameDefinition; busy: boolean; scheduleAt: string; setScheduleAt: (value: string) => void;
  onSchedule: (gameId: string, scheduledStartAt?: string) => Promise<unknown>;
}) {
  if (game.entryMode !== "active" || game.status !== "published") return null;
  return <>
    <label className="sr-only" htmlFor={"session-start-" + game.id}>Scheduled session start</label>
    <DateTimePicker value={scheduleAt} onValueChange={(next) => setScheduleAt(next)} id={"session-start-" + game.id} />
    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void onSchedule(game.id, isoDateTime(scheduleAt))}>
      {scheduleAt ? "Schedule session" : "Create host session"}
    </Button>
  </>;
}

/** The one place to edit a game: its title and its template configuration. */
function GameEditSheet({
  game,
  open,
  busy,
  error,
  onOpenChange,
  onUpdate,
  onUploadMedia,
}: {
  game: PrismEventGameDefinition;
  open: boolean;
  busy: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onUpdate: (gameId: string, input: PrismUpdateEventGameInput) => Promise<unknown>;
  onUploadMedia: (gameId: string, file: File) => Promise<{ objectId: string }>;
}) {
  const [editedTitle, setEditedTitle] = useState(game.title);
  useEffect(() => {
    if (open) setEditedTitle(game.title);
  }, [game.title, open]);
  const titleId = "edit-game-" + game.id;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Edit {game.title}</SheetTitle>
          <SheetDescription>Change the title and the game's questions or settings. Changes apply before the first session starts.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => {
            event.preventDefault();
            const title = editedTitle.trim();
            if (title) void onUpdate(game.id, { title });
          }}>
            <label className="grid min-w-48 flex-1 gap-1.5 text-sm font-semibold text-foreground" htmlFor={titleId}>
              Game title
              <Input id={titleId} value={editedTitle} maxLength={120} onChange={(event) => setEditedTitle(event.target.value)} />
            </label>
            <Button type="submit" disabled={!editedTitle.trim() || editedTitle.trim() === game.title || busy}>Save title</Button>
          </form>
          {editableBeforeStart(game) ? (
            <EventGameTemplateConfigurationEditor
              game={game}
              busy={busy}
              onSave={(configuration) => onUpdate(game.id, { configuration })}
              onUploadMedia={(file) => onUploadMedia(game.id, file)}
            />
          ) : null}
          {game.instructions ? (
            <details className="mt-4 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-semibold">Game instructions</summary>
              <p className="mt-2 whitespace-pre-wrap">{game.instructions}</p>
            </details>
          ) : null}
          <InlineError message={error} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ArchiveGameDialog({
  game,
  open,
  busy,
  onOpenChange,
  onConfirm,
}: {
  game: PrismEventGameDefinition;
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive {game.title}?</DialogTitle>
          <DialogDescription>Guests and hosts can no longer use this game, and it cannot be scheduled again.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" variant="destructive" disabled={busy} onClick={onConfirm}>Archive game</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
