import { ArrowRight, Hash, Ticket } from "lucide-react";
import { PrismGuestShell } from "@prism/ui";
import { Button } from "@prism/ui/components/button";
import { portalHref } from "@prism/ui/portal-path";

export function GuestHomeLandingView() {
  return (
    <PrismGuestShell
      eventName="Guest portal"
      layout="narrow"
      lead={
        <div className="grid gap-3 pt-4">
          <h1 className="font-heading text-3xl font-semibold leading-tight text-foreground">Your event pass</h1>
          <p className="text-sm leading-6 text-muted-foreground">Open the link or scan the QR on your invitation to see event details and check in.</p>
        </div>
      }
    >
      <div className="grid gap-3">
        <Button asChild className="h-12 justify-between px-4 text-base">
          <a href={portalHref("/open")}><span className="flex items-center gap-2"><Ticket aria-hidden="true" /> Open my pass</span><ArrowRight aria-hidden="true" /></a>
        </Button>
        <Button asChild variant="outline" className="h-12 justify-between bg-card px-4 text-base">
          <a href={portalHref("/games/join")}><span className="flex items-center gap-2"><Hash aria-hidden="true" /> Join with PIN</span><ArrowRight aria-hidden="true" /></a>
        </Button>
        <p className="px-1 text-sm text-muted-foreground">Need a pass? Ask the event organizer or registration team.</p>
        <a href={portalHref("/privacy")} className="w-fit px-1 py-2 text-sm font-medium text-primary">Privacy notice</a>
      </div>
    </PrismGuestShell>
  );
}
