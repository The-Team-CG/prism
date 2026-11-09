"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@prism/ui/components/card";
import { Field, FieldDescription, FieldLabel } from "@prism/ui/components/field";
import { Input } from "@prism/ui/components/input";
import { useClientWorkspace } from "../../workspace/shared";

export function ClientGuestsView() {
  const { selectedEvent, briefing } = useClientWorkspace();

  return (
    <Card>
      <CardHeader>
        <CardDescription>Guests / attendees</CardDescription>
        <CardTitle className="text-xl font-black text-foreground">
          {briefing?.guestCount ? `${briefing.guestCount} expected guests` : "Guest count pending"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-muted-foreground">
          Guest registration details remain PMCM-managed. Client-visible attendee summaries will appear here once the event team publishes them.
        </p>
        {selectedEvent?.guestAccessCode ? <GuestAccessCode code={selectedEvent.guestAccessCode} /> : null}
      </CardContent>
    </Card>
  );
}

/** The code is read-only and copyable, since it is typed into guest devices elsewhere. */
function GuestAccessCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Field className="max-w-sm">
      <FieldLabel htmlFor="client-guest-access-code">Guest access code</FieldLabel>
      <div className="flex items-center gap-2">
        <Input id="client-guest-access-code" readOnly value={code} className="font-mono tabular-nums" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Copy guest access code"
          onClick={() => {
            void navigator.clipboard.writeText(code).then(() => setCopied(true), () => setCopied(false));
          }}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        </Button>
      </div>
      <FieldDescription>{copied ? "Copied to clipboard." : "Share this code with guests so they can open their pass."}</FieldDescription>
    </Field>
  );
}
