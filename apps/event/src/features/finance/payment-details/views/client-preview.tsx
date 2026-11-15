"use client";

import { paymentMethodLine, type PaymentMethod } from "@prism/types";
import { Card } from "@prism/ui/components/card";
import { formatPeso } from "@prism/ui/payment-track";
import { QrPicture } from "./qr-field";

const SAMPLE_AMOUNT = 50000;

/** What a client sees under "How to pay", with a sample amount, so PMCM can check it reads right before saving. */
export function ClientPreview({ methods }: { methods: PaymentMethod[] }) {
  const shown = methods.filter((method) => method.enabled);
  return (
    <Card className="gap-4 p-4 sm:p-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">What the client sees</h2>
        <p className="text-xs text-muted-foreground">Under How to pay on their billing page.</p>
      </div>
      <p className="rounded-md bg-primary-soft/60 p-2.5 text-xs text-muted-foreground">
        Amount to send<span className="block text-base font-semibold tabular-nums text-foreground">{formatPeso(SAMPLE_AMOUNT)}</span>
      </p>
      {shown.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
          Nothing is turned on, so clients are told to message PMCM before sending money, and statements cannot be issued.
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map((method) => {
            const line = paymentMethodLine(method);
            return (
              <li key={method.id} className="flex items-start justify-between gap-3 rounded-md bg-muted/50 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{line.label}</p>
                  <p className="mt-0.5 whitespace-pre-line break-words text-xs text-muted-foreground">{line.details}</p>
                </div>
                {"qrImageId" in method && method.qrImageId ? <QrPicture imageId={method.qrImageId} size={88} /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
