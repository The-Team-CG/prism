"use client";

import { PRISM_PRIVACY_NOTICE } from "@prism/types";
import { PrismAuthShell } from "@prism/ui/auth-shell";
import { PrismPrivacyNoticeContent } from "@prism/ui/privacy-notice";
import { Button } from "@/app/components/ui/button";
import { EVENT_PORTAL_POINTS, EVENT_PORTAL_STATEMENT } from "../../sign-in/model/event-portal-copy";
import { usePrivacyNoticeViewModel } from "../view-models/use-privacy-notice-view-model";

export function PrivacyNoticeView() {
  const vm = usePrivacyNoticeViewModel();
  const acknowledging = vm.mode.kind === "acknowledge";

  return (
    <PrismAuthShell
      portal="event"
      portalName="Event command"
      statement={EVENT_PORTAL_STATEMENT}
      points={EVENT_PORTAL_POINTS}
      homeHref="/"
      title={PRISM_PRIVACY_NOTICE.title}
      description={acknowledging ? "Read this once before you continue to your portal." : undefined}
    >
      <div className="flex flex-col gap-6">
        <PrismPrivacyNoticeContent notice={PRISM_PRIVACY_NOTICE} />
        {acknowledging && (
          <div className="flex flex-col gap-3">
            {vm.error && (
              <p role="alert" className="text-sm text-destructive">
                {vm.error}
              </p>
            )}
            <Button
              className="h-12 w-full rounded-lg text-base font-semibold shadow-none hover:shadow-none sm:text-sm"
              disabled={vm.busy}
              onClick={() => void vm.acknowledge()}
            >
              {vm.busy ? "Saving…" : "I've read this notice"}
            </Button>
          </div>
        )}
      </div>
    </PrismAuthShell>
  );
}
