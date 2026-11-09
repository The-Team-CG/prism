import type { PrismPmcmSupplierProfile } from "@prism/types";
import { Clock3 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { RatingStars, SupplierAvatar } from "./supplier-visuals";
import styles from "./supplier-workspace.module.css";

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
        <h3 id="supplier-scorecards-heading" className="text-xs font-semibold">Performance scorecards</h3>
        <Select value={period} onValueChange={(next) => onPeriodChange(next as typeof period)}>
          <SelectTrigger aria-label="Scorecard period" className="h-8 w-40 min-w-0 bg-background text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        {profile.scorecards.map((scorecard) => (
          <article key={scorecard.dimensionId} className={styles.scorecard}>
            <h4 className="text-sm font-medium">{scorecard.dimensionName}</h4>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{scorecard.average === null ? "No assessment recorded in this period." : `Based on ${scorecard.sampleCount} PMCM assessment${scorecard.sampleCount === 1 ? "" : "s"} in the selected period.`}</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-3xs">
              {scorecard.latest ? <span className="flex flex-wrap items-center gap-1.5"><SupplierAvatar name={scorecard.latest.reviewedBy} /><span>{scorecard.latest.reviewedBy}</span><Clock3 aria-hidden="true" className="ml-1 size-3 text-muted-foreground" /><time className="text-muted-foreground" dateTime={scorecard.latest.createdAt}>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(scorecard.latest.createdAt))}</time></span> : <span className="text-muted-foreground">Awaiting assessment</span>}
              <span className="flex items-center gap-2 font-semibold">{scorecard.average === null ? "Not rated" : `${scorecard.average.toFixed(1)} / 5`}<RatingStars rating={scorecard.average} /></span>
            </div>
          </article>
        ))}
        {!profile.scorecards.length ? <article className={styles.scorecard}><h4 className="text-sm font-medium">Overall performance</h4><p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{profile.rating.count ? `Based on ${profile.rating.count} private PMCM review${profile.rating.count === 1 ? "" : "s"}.` : "No supplier assessments recorded yet."} Category-specific assessment criteria have not been configured.</p><div className="mt-3 flex items-center justify-between gap-3 text-xs"><span className="text-muted-foreground">All recorded reviews</span><span className="flex items-center gap-2 font-semibold">{profile.rating.average === null ? "Not rated" : `${profile.rating.average.toFixed(1)} / 5`}<RatingStars rating={profile.rating.average} /></span></div></article> : null}
      </div>
    </section>
  );
}
