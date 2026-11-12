"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import { PrismSection } from "@prism/ui/page-blocks";
import { useClientWorkspace } from "../../workspace/shared";

export function ClientGuestsView() {
  const { selectedEvent, briefing } = useClientWorkspace();

  return (
    <div className="space-y-6">
      {selectedEvent?.guestAccessCode ? <GuestAccessCode code={selectedEvent.guestAccessCode} /> : null}
      <PrismSection
        id="client-guests"
        title={briefing?.guestCount ? `${briefing.guestCount} expected guests` : "Guest count pending"}
        description="Guest registration details remain PMCM-managed. Client-visible attendee summaries will appear here once the event team publishes them."
      >
        <p className="text-sm text-muted-foreground">Guests open their pass with the access code above. Their check-in and feedback go to the PMCM registration team, not to this page.</p>
      </PrismSection>
    </div>
  );
}

/** The code is read-only and copyable, since it is typed into guest devices elsewhere. */
function GuestAccessCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <section aria-label="Guest access code" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg bg-ink px-6 py-5 text-ink-foreground">
      <div className="min-w-0">
        <p className="text-sm text-ink-foreground/70">Guest access code</p>
        <p id="client-guest-access-code" className="mt-1 max-w-full overflow-x-auto whitespace-nowrap font-mono text-lg font-semibold tracking-wide tabular-nums sm:text-3xl">{code}</p>
        <p className="mt-1 text-sm text-ink-foreground/70">{copied ? "Copied to clipboard." : "Share this code with guests so they can open their pass."}</p>
      </div>
      <Button
        type="button"
        variant="secondary"
        aria-label="Copy guest access code"
        onClick={() => {
          void navigator.clipboard.writeText(code).then(() => setCopied(true), () => setCopied(false));
        }}
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        {copied ? "Copied" : "Copy code"}
      </Button>
    </section>
  );
}
