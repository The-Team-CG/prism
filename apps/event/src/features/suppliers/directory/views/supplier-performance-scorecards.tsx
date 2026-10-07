import type { PrismPmcmSupplierProfile } from "@prism/types";

export function SupplierPerformanceScorecards({
  profile,
  period,
  onPeriodChange,
}: {
  profile: PrismPmcmSupplierProfile;
  period: PrismPmcmSupplierProfile["period"];
  onPeriodChange: (period: PrismPmcmSupplierProfile["period"]) => void;
}) {
  return (
    <section aria-labelledby="supplier-scorecards-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 id="supplier-scorecards-heading" className="text-sm font-semibold">Performance scorecards</h3>
        <label className="text-xs text-muted-foreground">
          <span className="sr-only">Scorecard period</span>
          <select value={period} onChange={(event) => onPeriodChange(event.target.value as typeof period)} className="h-8 rounded-md border border-input bg-background px-2">
            <option value="all">All time</option>
            <option value="90d">Last 90 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </label>
      </div>
      <div className="space-y-2">
        {profile.scorecards.map((scorecard) => (
          <article key={scorecard.dimensionId} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="truncate text-sm font-medium">{scorecard.dimensionName}</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  {scorecard.average === null ? "No ratings in this period" : `${scorecard.average.toFixed(1)} out of 5 · ${scorecard.sampleCount} rating${scorecard.sampleCount === 1 ? "" : "s"}`}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold">{scorecard.average === null ? "—" : `${scorecard.average.toFixed(1)} / 5`}</span>
            </div>
            {scorecard.latest ? <p className="mt-2 text-xs text-muted-foreground">Latest: {scorecard.latest.rating}/5 by {scorecard.latest.reviewedBy} · {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(scorecard.latest.createdAt))}</p> : null}
          </article>
        ))}
        {!profile.scorecards.length ? <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No active review dimensions for this supplier category.</p> : null}
      </div>
    </section>
  );
}
