"use client";

import { Database } from "lucide-react";
import { Alert, AlertDescription } from "@prism/ui/components/alert";
import { PrivacyRetentionPanel as RetentionReviewPanel } from "@/features/privacy/retention/views/privacy-retention-panel";
import { Panel } from "@/features/pmcm-kit";
import { usePrivacyConsoleViewModel } from "../view-models/use-privacy-console-view-model";
import { LoadingState } from "@prism/ui/components/loading-state";
import {
  PrivacyFilterBar,
  PrivacyLegalHoldControls,
  PrivacyLogRequestForm,
  PrivacyQueuePager,
  PrivacyRequestCard,
} from "./privacy-console-sections";

/** PMCM privacy operations console: filtered, paged request queue with deadlines, ownership, and execution. */
export function PrivacyConsoleView() {
  const vm = usePrivacyConsoleViewModel();

  if (!vm.session) {
    return <LoadingState label="Loading privacy console..." className="p-6" />;
  }

  return (
    <div className="space-y-5">
      <nav aria-label="Privacy sections" className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <a href="#privacy-requests" className="hover:text-foreground">Request queue</a>
        <a href="#privacy-log" className="hover:text-foreground">Log request</a>
        {vm.isPmcmAdmin ? <><a href="#privacy-legal-holds" className="hover:text-foreground">Legal holds</a><a href="#privacy-retention" className="hover:text-foreground">Retention policies</a></> : null}
      </nav>
      {vm.error ? (
        <Alert variant="destructive" className="rounded-md">
          <AlertDescription>{vm.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <section id="privacy-requests" className="scroll-mt-6"><Panel title="Privacy request queue" icon={Database}>
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
          </section><section id="privacy-log" className="scroll-mt-6"><Panel title="Log a privacy request" icon={Database}>
            <PrivacyLogRequestForm vm={vm} />
          </Panel></section>
        </div>
        <div id="privacy-legal-holds" className="scroll-mt-6 space-y-5">
          {vm.isPmcmAdmin ? <PrivacyLegalHoldControls vm={vm} /> : null}
        </div>
      </div>
      {vm.isPmcmAdmin ? (
        <section id="privacy-retention" aria-label="Retention policies" className="scroll-mt-6">
          <RetentionReviewPanel />
        </section>
      ) : null}
    </div>
  );
}
