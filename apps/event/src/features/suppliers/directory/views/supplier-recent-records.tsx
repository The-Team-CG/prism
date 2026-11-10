import { formatPortalDateTime } from "@prism/ui/format-date";
import type { PrismPmcmSupplierRecordsPage } from "@prism/types";
import { Activity, FileCheck2, MessageSquareText, Star } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import styles from "./supplier-workspace.module.css";
import { LoadingState } from "@prism/ui/components/loading-state";

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
    ? `${records.counts.total} record${records.counts.total === 1 ? "" : "s"} in ${period === "all" ? `the full history; chart shows ${records.chartStartDate} through ${records.chartEndDate}` : period === "90d" ? "the last 90 days" : "the last 30 days"}.`
    : "Record counts are loading.";

  return (
    <section aria-labelledby="supplier-records-heading" className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 id="supplier-records-heading" className="text-xs font-semibold">Activity trend</h3>
        <Select value={period} onValueChange={(next) => onPeriodChange(next as typeof period)}>
          <SelectTrigger aria-label="Recent records period" className="h-7 w-36 min-w-0 bg-background text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error ? <div role="alert" className="flex items-center justify-between gap-3 rounded-md bg-destructive/5 p-3 text-sm"><span>{error}</span><button type="button" onClick={onRetry} className="font-medium text-primary">Retry</button></div> : null}
      {loading && !records ? <LoadingState label="Loading supplier records…" /> : null}
      {records ? (
        <>
          <div>
            <div className="flex items-end gap-2.5">
              <span className="text-[28px] font-semibold leading-none">{records.counts.total}</span>
              <div aria-hidden="true" className="flex h-7 w-32 items-end gap-[2px]">
                {records.dailyBuckets.map((bucket) => <span key={bucket.date} title={`${bucket.date}: ${bucket.count}`} className={`min-w-0 flex-1 ${bucket.count ? "bg-success/80" : "bg-muted"}`} style={{ height: `${bucket.count ? Math.max(12, Math.round(bucket.count / maxCount * 100)) : 8}%` }} />)}
              </div>
            </div>
            <p role="img" aria-label={chartDescription} className="mt-1 text-2xs leading-tight text-muted-foreground">{chartDescription}</p>
          </div>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Total records", value: records.counts.total, Icon: Activity },
              { label: "Reviews", value: records.counts.reviews, Icon: Star },
              { label: "Reliability notes", value: records.counts.reliabilityNotes, Icon: MessageSquareText },
              { label: "Certifications", value: records.counts.certifications, Icon: FileCheck2 },
            ].map(({ label, value, Icon }) => <div key={label} className={styles.metricCard}><dt className="flex items-start gap-1 text-3xs text-muted-foreground"><Icon aria-hidden="true" className="mt-0.5 size-3 shrink-0" />{label}</dt><dd className="mt-1.5 text-xs font-semibold">{value}</dd></div>)}
          </dl>
          {!records.counts.total ? <p className="text-xs text-muted-foreground">Activity will appear when a review, reliability note or certification is recorded.</p> : null}
        </>
      ) : null}
    </section>
  );
}

export function SupplierRecordHistory({ records }: { records: PrismPmcmSupplierRecordsPage | null }) {
  if (!records?.items.length) return null;
  return <section aria-label="Recent activity records"><details className="text-xs">
    <summary className="cursor-pointer font-medium">Recent activity records</summary>
    <div className="mt-3 space-y-2">
      {records.items.map((record) => (
              <article key={`${record.kind}:${record.id}`} className="border-l-2 border-border py-1 pl-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{recordKindLabel(record.kind)}</span>
                  <time dateTime={record.occurredAt}>{formatPortalDateTime(record.occurredAt)}</time>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-xs">{record.text}</p>
                {record.actorName ? <p className="mt-2 text-xs text-muted-foreground">Recorded by {record.actorName}</p> : null}
              </article>
      ))}
    </div>
  </details></section>;
}
