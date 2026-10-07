import type { PrismPmcmSupplierRecordsPage } from "@prism/types";

function recordKindLabel(kind: string) {
  if (kind === "reliability_note") return "Reliability note";
  if (kind === "certification") return "Certification";
  return "Review";
}

export function SupplierRecentRecords({
  records,
  period,
  loading,
  error,
  onPeriodChange,
  onRetry,
}: {
  records: PrismPmcmSupplierRecordsPage | null;
  period: PrismPmcmSupplierRecordsPage["period"];
  loading: boolean;
  error: string | null;
  onPeriodChange: (period: PrismPmcmSupplierRecordsPage["period"]) => void;
  onRetry: () => void;
}) {
  const maxCount = Math.max(1, ...(records?.dailyBuckets.map((bucket) => bucket.count) ?? []));
  const chartDescription = records
    ? `${records.counts.total} records in ${period === "all" ? `the full history; chart shows ${records.chartStartDate} through ${records.chartEndDate}` : period === "90d" ? "the last 90 days" : "the last 30 days"}.`
    : "Record counts are loading.";

  return (
    <section aria-labelledby="supplier-records-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 id="supplier-records-heading" className="text-sm font-semibold">Recent records</h3>
        <label className="text-xs text-muted-foreground">
          <span className="sr-only">Recent records period</span>
          <select value={period} onChange={(event) => onPeriodChange(event.target.value as typeof period)} className="h-8 rounded-md border border-input bg-background px-2">
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </label>
      </div>
      {error ? <div role="alert" className="flex items-center justify-between gap-3 rounded-md bg-destructive/5 p-3 text-sm"><span>{error}</span><button type="button" onClick={onRetry} className="font-medium text-primary">Retry</button></div> : null}
      {loading && !records ? <p className="text-sm text-muted-foreground">Loading supplier records…</p> : null}
      {records ? (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Total records", records.counts.total],
              ["Reviews", records.counts.reviews],
              ["Reliability notes", records.counts.reliabilityNotes],
              ["Certifications", records.counts.certifications],
            ].map(([label, value]) => <div key={label} className="rounded-md border border-border p-2.5"><dt className="text-[11px] text-muted-foreground">{label}</dt><dd className="mt-1 text-base font-semibold">{value}</dd></div>)}
          </dl>
          {records.counts.total ? (
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="sr-only" role="img" aria-label={chartDescription}>{chartDescription}</p>
              <div aria-hidden="true" className="flex h-12 items-end gap-px">
                {records.dailyBuckets.map((bucket) => <span key={bucket.date} title={`${bucket.date}: ${bucket.count}`} className="min-w-0 flex-1 rounded-t-[1px] bg-emerald-600/80" style={{ height: `${Math.max(bucket.count ? 10 : 0, Math.round(bucket.count / maxCount * 100))}%` }} />)}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{chartDescription}</p>
            </div>
          ) : <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No reviews, reliability notes or certification records yet.</p>}
          <div className="space-y-2">
            {records.items.map((record) => (
              <article key={`${record.kind}:${record.id}`} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{recordKindLabel(record.kind)}</span>
                  <time dateTime={record.occurredAt}>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(record.occurredAt))}</time>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{record.text}</p>
                {record.actorName ? <p className="mt-2 text-xs text-muted-foreground">Recorded by {record.actorName}</p> : null}
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
