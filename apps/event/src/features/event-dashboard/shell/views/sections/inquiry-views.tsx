"use client";

import { useState, type ReactNode } from "react";
import { SegmentedControl } from "@/features/pmcm-kit";

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
      <SegmentedControl
        label="Inquiry views"
        options={VIEWS.map((entry) => ({ value: entry.id, label: entry.label }))}
        value={view}
        onChange={(next) => setView(next as InquiryView)}
      />
      <section id={`inquiry-panel-${view}`}>
        {view === "intake" ? intake : view === "onboarding" ? onboarding : followUp}
      </section>
    </div>
  );
}
