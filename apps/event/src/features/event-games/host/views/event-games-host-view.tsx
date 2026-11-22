"use client";

import { useState } from "react";
import { AlertCircle, Gamepad2 } from "lucide-react";
import type { PrismUserRole } from "@prism/types";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@prism/ui/components/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@prism/ui/components/tabs";
import { Card, CardBody } from "@/features/event-dashboard/shell/views/sections/shell-ui";
import { useEventGamesHostViewModel } from "../view-models/use-event-games-host-view-model";
import {
  EventGameAnalyticsCard,
  EventGameCatalogCard,
  EventGameCreateSheet,
  EventGamesHeaderCard,
  GuestGameLobbyCard,
} from "./event-games-host-sections";
import { GameDefinitionRow } from "./event-game-setup-list";
import { RunLivePanel } from "./event-game-live-session";
import { ResponseReviewSection } from "./event-game-response-review";

type Props = {
  eventId: string | null;
  role: PrismUserRole;
  eventStatus: string;
  archived: boolean;
  actualEndedAt?: string | null;
};

type HostTab = "setup" | "live" | "results";
type HostViewModel = ReturnType<typeof useEventGamesHostViewModel>;

/** Shown to coordinators once the event closes: PMCM keeps the game results. */
export const COORDINATOR_GAMES_CLOSED_COPY = "Games closed with the event. PMCM keeps the results.";

export function EventGamesHostView({ eventId, role, eventStatus, archived, actualEndedAt }: Props) {
  const vm = useEventGamesHostViewModel({ eventId, role, eventStatus, archived, actualEndedAt });
  // Local state, not the URL: the parent workspace tabs already own `?part=`.
  const [tab, setTab] = useState<HostTab>(vm.canManage ? "setup" : "results");

  if (!eventId) {
    return (
      <Card>
        <CardBody>
          <Empty><EmptyHeader><EmptyMedia variant="icon"><Gamepad2 /></EmptyMedia><EmptyTitle>Select an event</EmptyTitle><EmptyDescription>Open an event workspace to create and host games.</EmptyDescription></EmptyHeader></Empty>
        </CardBody>
      </Card>
    );
  }

  if (!vm.hostRole) {
    return (
      <Card>
        <CardBody>
          <Empty><EmptyHeader><EmptyMedia variant="icon"><AlertCircle /></EmptyMedia><EmptyTitle>Host access unavailable</EmptyTitle><EmptyDescription>Game host controls are available to PMCM Admins and event-assigned Coordinators.</EmptyDescription></EmptyHeader></Empty>
        </CardBody>
      </Card>
    );
  }

  // A coordinator after the event closes: no workspace is loaded and PMCM keeps the results.
  const coordinatorClosed = !vm.canManage && !vm.canReviewResponses;
  const closedCopy = coordinatorClosed
    ? COORDINATOR_GAMES_CLOSED_COPY
    : "This event has ended. Games can no longer be changed or run. Results stay available under Results.";

  return (
    <div className="space-y-5" aria-label="Event games host workspace">
      <EventGamesHeaderCard
        loading={vm.loading}
        busy={Boolean(vm.busy)}
        error={vm.errorTarget ? null : vm.error}
        onRefresh={() => void vm.load()}
      />
      <Tabs value={tab} onValueChange={(value) => setTab(value as HostTab)} className="gap-4">
        <TabsList aria-label="Event games" className="h-auto max-w-full flex-wrap justify-start overflow-x-auto">
          <TabsTrigger value="setup" className="flex-none">Set up</TabsTrigger>
          <TabsTrigger value="live" className="flex-none">Run live</TabsTrigger>
          <TabsTrigger value="results" className="flex-none">Results</TabsTrigger>
        </TabsList>
        <TabsContent value="setup" className="space-y-5">
          {vm.canManage ? <SetUpTab vm={vm} onScheduled={() => setTab("live")} /> : <ClosedNotice copy={closedCopy} />}
        </TabsContent>
        <TabsContent value="live">
          {vm.canManage ? <RunLivePanel vm={vm} /> : <ClosedNotice copy={closedCopy} />}
        </TabsContent>
        <TabsContent value="results" className="space-y-5">
          {coordinatorClosed ? <ClosedNotice copy={COORDINATOR_GAMES_CLOSED_COPY} /> : (
            <ResultsTab vm={vm} onOpenSession={(sessionId) => {
              void vm.selectSession(sessionId);
              setTab("live");
            }} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ClosedNotice({ copy }: { copy: string }) {
  return <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">{copy}</p>;
}

function SetUpTab({ vm, onScheduled }: { vm: HostViewModel; onScheduled: () => void }) {
  const [creating, setCreating] = useState(false);
  const busy = Boolean(vm.busy);
  const errorFor = (target: NonNullable<HostViewModel["errorTarget"]>) => vm.errorTarget === target ? vm.error : null;

  return (
    <>
      <EventGameCatalogCard
        games={vm.games}
        onCreate={() => setCreating(true)}
        renderGame={(game) => (
          <GameDefinitionRow
            key={game.id}
            game={game}
            busy={busy}
            error={errorFor(`game:${game.id}`)}
            onUpdate={vm.updateDraft}
            onArchive={vm.archiveGame}
            onPublish={vm.publishDraft}
            onSchedule={async (gameId, scheduledStartAt) => {
              const created = await vm.scheduleSession(gameId, scheduledStartAt);
              if (created) onScheduled();
              return created;
            }}
            onUploadMedia={vm.uploadGameMedia}
          />
        )}
      />
      <EventGameCreateSheet
        open={creating}
        busy={busy}
        error={errorFor("create")}
        onOpenChange={setCreating}
        onCreate={vm.createDraft}
      />
      <GuestGameLobbyCard
        lobbySlug={vm.lobbySlug}
        branding={vm.lobbyBranding}
        busy={busy}
        canBrand={vm.canBrandLobby}
        error={errorFor("lobby")}
        onProvision={() => void vm.provisionLobby()}
        onSaveBranding={(settings) => void vm.updateLobbyBranding(settings)}
        onUploadLogo={(file) => vm.uploadLobbyLogo(file)}
      />
    </>
  );
}

function ResultsTab({ vm, onOpenSession }: { vm: HostViewModel; onOpenSession: (sessionId: string) => void }) {
  const [responseSessionId, setResponseSessionId] = useState("");
  return (
    <>
      <EventGameAnalyticsCard
        analytics={vm.analytics}
        onSelectSession={vm.canManage ? onOpenSession : undefined}
      />
      {vm.canReviewResponses ? (
        <ResponseReviewSection
          sessionId={responseSessionId}
          sessions={vm.analytics?.sessions ?? []}
          responses={vm.responses}
          hasMore={vm.responsesHaveMore}
          busy={Boolean(vm.busy)}
          onSessionChange={setResponseSessionId}
          onLoad={(sessionId) => void vm.loadResponses(sessionId)}
          onLoadMore={() => void vm.loadMoreResponses()}
          readOnly={!vm.canManage}
          onModerate={vm.canManage ? vm.moderateSubmission : undefined}
          error={vm.errorTarget === "responses" ? vm.error : null}
        />
      ) : null}
    </>
  );
}
