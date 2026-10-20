"use client";

import { Database } from "lucide-react";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { PrivacyRetentionPanel as RetentionReviewPanel } from "@/features/privacy/retention/views/privacy-retention-panel";
import { Panel } from "@/features/pmcm-kit";
import { usePrivacyConsoleViewModel } from "../view-models/use-privacy-console-view-model";
import {
  PrivacyFilterBar,
  PrivacyLegalHoldControls,
  PrivacyLogRequestForm,
  PrivacyQueuePager,
  PrivacyRequestCard,
  PrivacyRetentionPanel,
} from "./privacy-console-sections";

/** PMCM privacy operations console: filtered, paged request queue with deadlines, ownership, and execution. */
export function PrivacyConsoleView() {
  const vm = usePrivacyConsoleViewModel();

  if (!vm.session) {
    return <div className="p-6 text-sm text-muted-foreground">Loading privacy console...</div>;
  }

  return (
    <div className="space-y-5">
      {vm.error ? (
        <Alert variant="destructive" className="rounded-md">
          <AlertDescription>{vm.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Panel title="Privacy request queue" icon={Database}>
            <div className="space-y-3">
              <PrivacyFilterBar vm={vm} />
              <PrivacyQueuePager vm={vm} />
              {vm.requests.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {vm.filters.assignment === "mine" && !vm.operatorId
                    ? "Sign in as a PMCM operator to filter by your assignments."
                    : "No privacy requests match these filters."}
                </p>
              ) : null}
              {vm.requests.map((request) => (
                <PrivacyRequestCard key={request.id} request={request} vm={vm} />
              ))}
              <PrivacyQueuePager vm={vm} />
            </div>
          </Panel>
          <Panel title="Log a privacy request" icon={Database}>
            <PrivacyLogRequestForm vm={vm} />
          </Panel>
        </div>
        <div className="space-y-5">
          {vm.isPmcmAdmin ? <PrivacyLegalHoldControls vm={vm} /> : null}
          <PrivacyRetentionPanel vm={vm} />
          {vm.isPmcmAdmin ? <RetentionReviewPanel /> : null}
        </div>
      </div>
    </div>
  );
}
