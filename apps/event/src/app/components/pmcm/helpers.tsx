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
  if (status === "opened") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (status === "expired") return "bg-rose-50 text-rose-700 ring-rose-100";
  if (status === "sent") return "bg-blue-50 text-blue-700 ring-blue-100";
  return "bg-muted text-muted-foreground ring-border";
}

export function tierLabel(tier: string) {
  if (tier === "tier_1") return "Tier 1";
  if (tier === "tier_2") return "Tier 2";
  if (tier === "pending_first_event") return "Pending First Event";
  return label(tier);
}

export function tierTone(tier: string) {
  if (tier === "tier_1") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tier === "tier_2") return "border-[#40A0D0]/30 bg-secondary text-[#40A0D0]";
  return "border-[#F06030]/30 bg-accent text-(--prism-amber)";
}

export function SupplierTierBadge({ tier }: { tier: string }) {
  return (
    <span className={cx("inline-flex rounded-full border px-2.5 py-1 text-xs font-black", tierTone(tier))}>
      {tierLabel(tier)}
    </span>
  );
}

export function RatingStars({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-xs font-semibold text-muted-foreground">Unrated</span>;
  const rounded = Math.round(rating);

  return (
    <span className="inline-flex items-center gap-1" aria-label={`${rating.toFixed(1)} out of 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={cx(
            "size-3.5",
            index < rounded ? "fill-(--prism-amber) text-(--prism-amber)" : "text-border",
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
  if (category === "finance") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (category === "suppliers") return "bg-pink-50 text-pink-700 ring-pink-100";
  if (category === "access") return "bg-amber-50 text-amber-800 ring-amber-100";
  if (category === "documents") return "bg-violet-50 text-violet-700 ring-violet-100";
  return "bg-secondary text-foreground ring-primary/15";
}

export function severityTone(severity: string) {
  if (severity === "critical") return "bg-rose-50 text-rose-700 ring-rose-100";
  if (severity === "warning") return "bg-amber-50 text-amber-800 ring-amber-100";
  return "bg-emerald-50 text-emerald-700 ring-emerald-100";
}

export function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}
