import type { PrismPmcmSupplierProfile } from "@prism/types";
import { SegmentedMeter } from "./supplier-visuals";

export function SupplierPerformanceSummary({ profile }: { profile: PrismPmcmSupplierProfile }) {
  const certifications = profile.certifications;
  const total = certifications.verified + certifications.submitted + certifications.expired + certifications.rejected + certifications.unknown;
  const metrics = [
    { label: "Verified certifications", count: certifications.verified, tone: "green" as const },
    { label: "Awaiting verification", count: certifications.submitted, tone: "amber" as const },
    { label: "Needs attention", count: certifications.expired + certifications.rejected + certifications.unknown, tone: "red" as const },
  ];

  return <section aria-labelledby="supplier-performance-heading" className="space-y-2">
    <h3 id="supplier-performance-heading" className="text-xs font-semibold">Supplier performance</h3>
    <div>
      <p className="text-[28px] font-semibold leading-none tracking-tight">{profile.rating.average === null ? <span className="text-xl">Not reviewed</span> : <>{profile.rating.average.toFixed(1)}<span className="ml-1 text-lg text-muted-foreground">/ 5</span></>}</p>
      <p className="mt-1 text-xs text-muted-foreground">{profile.rating.count ? `Overall rating from ${profile.rating.count} private PMCM review${profile.rating.count === 1 ? "" : "s"}.` : "A rating will appear after PMCM records a supplier review."}</p>
    </div>
    <div className="space-y-1.5">
      {metrics.map((metric) => <div key={metric.label}>
        <div className="mb-1 flex items-center justify-between gap-3 text-2xs"><span>{metric.label}</span><span className="font-semibold">{total ? `${metric.count} / ${total}` : "No records"}</span></div>
        <SegmentedMeter value={total ? metric.count : null} max={total} tone={metric.tone} segments={60} />
      </div>)}
    </div>
    {certifications.unknown ? <p className="text-2xs text-muted-foreground">Includes {certifications.unknown} document{certifications.unknown === 1 ? "" : "s"} with no verification status.</p> : null}
  </section>;
}
