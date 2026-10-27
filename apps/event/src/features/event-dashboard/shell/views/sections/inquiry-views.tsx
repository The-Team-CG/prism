"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/app/components/ui/utils";

const VIEWS = [
  { id: "intake", label: "All inquiries" },
  { id: "onboarding", label: "Onboarding" },
  { id: "follow-up", label: "Conforme follow-up" },
] as const;

type InquiryView = (typeof VIEWS)[number]["id"];

/** One inquiry queue shown through three views, instead of three lists stacked on one page. */
export function InquiryViews({ intake, onboarding, followUp }: { intake: ReactNode; onboarding: ReactNode; followUp: ReactNode }) {
  const [view, setView] = useState<InquiryView>("intake");
  return (
    <div className="grid gap-4">
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">Review new requests in All inquiries. After acceptance, track account activation in Onboarding and signatures in Conforme follow-up. An event workspace opens after the required conforme is signed.</p>
      <div role="group" aria-label="Inquiry views" className="flex flex-wrap gap-1">
        {VIEWS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            id={`inquiry-tab-${entry.id}`}
            aria-pressed={view === entry.id}
            aria-controls={`inquiry-panel-${entry.id}`}
            onClick={() => setView(entry.id)}
            className={cn(
              "min-h-11 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary",
              view === entry.id ? "bg-card text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <section id={`inquiry-panel-${view}`} aria-labelledby={`inquiry-tab-${view}`}>
        {view === "intake" ? intake : view === "onboarding" ? onboarding : followUp}
      </section>
    </div>
  );
}
