"use client";

import { formatPortalDate } from "@prism/ui/format-date";
import { Button } from "@prism/ui/components/button";
import { Checkbox } from "@prism/ui/components/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@prism/ui/components/dialog";
import { FieldLabel } from "@prism/ui/components/field";
import { LoadingState } from "@prism/ui/components/loading-state";
import { cn } from "@/app/components/ui/utils";
import { addendumAmountLabel, addendumAwaitsClient, addendumConformeStatusLabel, addendumStatusLabel } from "../model/client-addenda-rules";
import { useClientAddendaViewModel } from "../view-models/use-client-addenda-view-model";

/**
 * One addendum, opened from its row (or a `?addendum=` link): what it changes, what it costs, and where it stands.
 * While it waits for the client, the dialog is where they read the full text and sign it.
 */
export function ClientAddendumDialog({ eventId, addendumId, onClose }: { eventId: string; addendumId: string; onClose: () => void }) {
  const vm = useClientAddendaViewModel(eventId);
  const addendum = vm.addenda.find((item) => item.id === addendumId);
  const awaiting = addendum ? addendumAwaitsClient(addendum) : false;
  const consent = addendum ? vm.consentAccepted(addendum.id) : false;
  const signing = vm.signingAddendumId === addendumId;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        {vm.status === "loading" ? <LoadingState label="Loading addendum…" /> : null}
        {vm.status === "ready" && !addendum ? (
          <DialogHeader>
            <DialogTitle>This addendum is no longer available</DialogTitle>
            <DialogDescription>PMCM may have withdrawn or replaced it. Your Actions list shows what still needs you.</DialogDescription>
          </DialogHeader>
        ) : null}
        {addendum ? (
          <>
            <DialogHeader>
              <DialogTitle>Addendum {addendum.versionNumber}: {addendum.title}</DialogTitle>
              <DialogDescription>Issued {formatPortalDate(addendum.issuedAt)} · {awaiting ? "Takes effect once PMCM countersigns after you." : addendumStatusLabel(addendum)}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p className={cn("text-base font-semibold", addendum.financialDelta === 0 ? "text-foreground" : "text-attention")}>
                {addendumAmountLabel(addendum.financialDelta)}
              </p>
              {addendum.summary ? <p className="text-foreground">{addendum.summary}</p> : null}
              {!awaiting ? <p className="text-muted-foreground">{addendumConformeStatusLabel(addendum.conforme)}</p> : null}
              {addendum.conforme ? (
                <details open={awaiting}>
                  <summary className="cursor-pointer font-medium text-primary">Full addendum text</summary>
                  <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 font-sans text-xs leading-5 text-foreground">{addendum.conforme.documentContent}</pre>
                </details>
              ) : null}
              {awaiting ? (
                <div className="flex items-start gap-3">
                  <Checkbox id={`addendum-consent-${addendum.id}`} checked={consent} onCheckedChange={(checked) => vm.setConsentAccepted(addendum.id, checked === true)} className="mt-0.5" />
                  <FieldLabel htmlFor={`addendum-consent-${addendum.id}`} className="font-normal leading-5">
                    I have read this addendum and agree to the scope and amount changes it describes.
                  </FieldLabel>
                </div>
              ) : null}
              {vm.error ? <p role="alert" className="text-destructive">{vm.error}</p> : null}
            </div>
            <DialogFooter>
              {awaiting ? (
                <>
                  <Button type="button" variant="outline" onClick={onClose} disabled={signing}>Not yet</Button>
                  <Button type="button" disabled={!consent || signing} onClick={() => void vm.acknowledge(addendum).then((signed) => { if (signed) onClose(); })}>
                    {signing ? "Signing…" : "Sign addendum"}
                  </Button>
                </>
              ) : (
                <Button type="button" onClick={onClose}>Close</Button>
              )}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
