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
      <div role="tablist" aria-label="Inquiry views" className="flex flex-wrap gap-1">
        {VIEWS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            id={`inquiry-tab-${entry.id}`}
            aria-selected={view === entry.id}
            aria-controls={`inquiry-panel-${entry.id}`}
            onClick={() => setView(entry.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              view === entry.id ? "bg-card text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`inquiry-panel-${view}`} aria-labelledby={`inquiry-tab-${view}`}>
        {view === "intake" ? intake : view === "onboarding" ? onboarding : followUp}
      </div>
    </div>
  );
}
