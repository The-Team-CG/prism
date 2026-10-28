import { Star } from "lucide-react";

export const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

export function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function label(value: string) {
  return value.replaceAll("_", " ");
}

export function dateKey(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

export function compactTimestamp(value?: string | null) {
  if (!value) return "Pending";
  return new Date(value).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export function invitationTone(status?: string | null) {
  if (status === "opened") return "bg-success-soft text-success ring-success/20";
  if (status === "expired") return "bg-danger-soft text-danger ring-danger/20";
  if (status === "sent") return "bg-info-soft text-info ring-info/20";
  return "bg-muted text-muted-foreground ring-border";
}

export function tierLabel(tier: string) {
  if (tier === "tier_1") return "Tier 1";
  if (tier === "tier_2") return "Tier 2";
  if (tier === "pending_first_event") return "Pending First Event";
  return label(tier);
}

export function tierTone(tier: string) {
  if (tier === "tier_1") return "border-success/25 bg-success-soft text-success";
  if (tier === "tier_2") return "border-brand-blue/30 bg-secondary text-brand-blue";
  return "border-brand-orange/30 bg-accent text-attention";
}

export function SupplierTierBadge({ tier }: { tier: string }) {
  return (
    <span className={cx("inline-flex w-fit items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-black", tierTone(tier))}>
      {tierLabel(tier)}
    </span>
  );
}

export function RatingStars({ rating }: { rating?: number | null }) {
  if (typeof rating !== "number" || !Number.isFinite(rating)) {
    return <span className="text-xs font-semibold text-muted-foreground">Unrated</span>;
  }
  const rounded = Math.round(rating);

  return (
    <span className="inline-flex items-center gap-1" aria-label={`${rating.toFixed(1)} out of 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={cx(
            "size-3.5",
            index < rounded ? "fill-attention text-attention" : "text-border",
          )}
        />
      ))}
      <span className="ml-1 text-xs font-black text-foreground">{rating.toFixed(1)}</span>
    </span>
  );
}

export const auditCategories = ["all", "events", "finance", "suppliers", "access", "documents"];
export const auditActionTypes = ["all", "create", "update", "approve", "decline", "assign", "upload", "export", "login", "login_failed", "archive", "resolve"];
export const auditDateRanges = [
  ["30d", "Last 30 days"],
  ["7d", "Last 7 days"],
  ["today", "Today"],
  ["all", "All time"],
] as const;

export function auditTone(category: string) {
  if (category === "finance") return "bg-success-soft text-success ring-success/20";
  if (category === "suppliers") return "bg-muted text-foreground ring-border";
  if (category === "access") return "bg-attention-soft text-attention ring-attention/20";
  if (category === "documents") return "bg-muted text-foreground ring-border";
  return "bg-muted text-foreground ring-border";
}

export function severityTone(severity: string) {
  if (severity === "critical") return "bg-danger-soft text-danger ring-danger/20";
  if (severity === "warning") return "bg-attention-soft text-attention ring-attention/20";
  if (severity === "attention") return "bg-info-soft text-info ring-info/20";
  return "bg-success-soft text-success ring-success/20";
}

export function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}
