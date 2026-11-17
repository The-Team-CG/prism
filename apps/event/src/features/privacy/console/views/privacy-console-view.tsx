"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@prism/ui/components/alert";
import { LoadingState } from "@prism/ui/components/loading-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@prism/ui/components/tabs";
import { PrivacyRetentionPanel as RetentionReviewPanel } from "@/features/privacy/retention/views/privacy-retention-panel";
import { usePrivacyConsoleViewModel, type PrivacyConsoleViewModel } from "../view-models/use-privacy-console-view-model";
import {
  PrivacyFilterBar,
  PrivacyLegalHoldControls,
  PrivacyLogRequestForm,
  PrivacyQueuePager,
  PrivacyRequestCard,
} from "./privacy-console-sections";

type ConsoleTab = "queue" | "log" | "holds" | "retention";

function Count({ value }: { value: number }) {
  return value > 0 ? <span className="ml-1.5 tabular-nums text-muted-foreground">{value}</span> : null;
}

function QueueTab({ vm }: { vm: PrivacyConsoleViewModel }) {
  const empty = vm.filters.assignment === "mine" && !vm.operatorId
    ? "Sign in as a PMCM operator to filter by your assignments."
    : "No privacy requests match these filters.";
  return (
    <section aria-label="Privacy request queue" className="space-y-3">
      <PrivacyFilterBar vm={vm} />
      <PrivacyQueuePager vm={vm} />
      {vm.requests.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : null}
      {vm.requests.map((request) => <PrivacyRequestCard key={request.id} request={request} vm={vm} />)}
      {vm.requests.length > 0 ? <PrivacyQueuePager vm={vm} /> : null}
    </section>
  );
}

/**
 * PMCM privacy operations console. One tab at a time: the request queue, logging a request on someone's behalf, and,
 * for PMCM admins, legal holds and retention rules.
 */
export function PrivacyConsoleView() {
  const vm = usePrivacyConsoleViewModel();
  const [tab, setTab] = useState<ConsoleTab>("queue");

  if (!vm.session) {
    return <LoadingState label="Loading privacy console..." className="p-6" />;
  }

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as ConsoleTab)} className="space-y-4">
      <TabsList aria-label="Privacy sections">
        <TabsTrigger value="queue">Queue<Count value={vm.total} /></TabsTrigger>
        <TabsTrigger value="log">Log a request</TabsTrigger>
        {vm.isPmcmAdmin ? <TabsTrigger value="holds">Legal holds<Count value={vm.legalHolds.length} /></TabsTrigger> : null}
        {vm.isPmcmAdmin ? <TabsTrigger value="retention">Retention</TabsTrigger> : null}
      </TabsList>
      {vm.error ? (
        <Alert variant="destructive" className="rounded-md">
          <AlertDescription>{vm.error}</AlertDescription>
        </Alert>
      ) : null}
      <TabsContent value="queue"><QueueTab vm={vm} /></TabsContent>
      <TabsContent value="log">
        <section aria-label="Log a privacy request" className="max-w-2xl rounded-xl border border-border bg-card p-4 sm:p-5">
          <PrivacyLogRequestForm vm={vm} />
        </section>
      </TabsContent>
      {vm.isPmcmAdmin ? <TabsContent value="holds"><div className="max-w-2xl"><PrivacyLegalHoldControls vm={vm} /></div></TabsContent> : null}
      {vm.isPmcmAdmin ? (
        <TabsContent value="retention">
          <section aria-label="Retention policies"><RetentionReviewPanel /></section>
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
