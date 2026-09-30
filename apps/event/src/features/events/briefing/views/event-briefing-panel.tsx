import { FileCheck2 } from "lucide-react";

import type { PrismBriefing } from "@prism/types";
import { EmptyState } from "@/app/components/ui/empty-state";
import { Panel } from "@/features/pmcm-kit";

export function EventBriefingPanel({ briefing }: { briefing: PrismBriefing | null }) {
  return (
    <Panel title="Briefing" icon={FileCheck2}>
      {briefing ? (
        <div className="divide-y divide-border text-sm">
          {[
            { label: "Venue", value: briefing.venue },
            { label: "Guest count", value: briefing.guestCount },
            { label: "Budget range", value: briefing.budgetRange },
            { label: "Services", value: briefing.serviceRequirements.join(", ") },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-start justify-between gap-4 py-2.5 not-last:border-b not-last:border-border">
              <span className="shrink-0 font-semibold text-muted-foreground">{label}</span>
              <span className="text-right font-semibold text-foreground">{value}</span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FileCheck2}
          title="No briefing submitted yet"
          description="Use the quick action above to submit a briefing for this event."
        />
      )}
    </Panel>
  );
}
