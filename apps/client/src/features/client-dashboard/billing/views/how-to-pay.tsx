"use client";

import { useState } from "react";
import { Check, Copy, Landmark } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@prism/ui/components/popover";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-primary-soft"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? <Check className="size-3" aria-hidden /> : <Copy className="size-3" aria-hidden />} {copied ? "Copied" : "Copy"}
    </button>
  );
}

/** Where to send the money, as printed on the billing statement, and what to write as the reference. */
export function HowToPay({ methods, statementNumber }: { methods: Array<{ label: string; details: string }>; statementNumber: string | null }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline"><Landmark className="size-4" aria-hidden /> How to pay</Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
        <p className="text-sm font-semibold text-foreground">How to pay</p>
        {methods.length === 0 ? (
          <p className="text-sm text-muted-foreground">PMCM has not listed payment details on this statement. Ask PMCM where to send the payment.</p>
        ) : (
          <ul className="space-y-2">
            {methods.map((method) => (
              <li key={method.label} className="rounded-md bg-muted/50 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{method.label}</p>
                  {method.details ? <CopyButton text={method.details} label={`${method.label} details`} /> : null}
                </div>
                {method.details ? <p className="mt-0.5 whitespace-pre-line text-xs text-muted-foreground">{method.details}</p> : null}
              </li>
            ))}
          </ul>
        )}
        {statementNumber ? (
          <p className="flex items-center justify-between gap-2 rounded-md border border-dashed border-border p-2 text-xs text-muted-foreground">
            <span>Write <span className="font-semibold text-foreground">{statementNumber}</span> as the reference so PMCM can match your payment.</span>
            <CopyButton text={statementNumber} label="statement number" />
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">After paying, choose “I&apos;ve paid” and add a screenshot or PDF of the transfer.</p>
      </PopoverContent>
    </Popover>
  );
}
