import { Star } from "lucide-react";
import styles from "./supplier-workspace.module.css";

export function supplierTierLabel(tier: string) {
  if (tier === "tier_1") return "Tier 1";
  if (tier === "tier_2") return "Tier 2";
  if (tier === "pending_first_event") return "First event pending";
  return tier.replaceAll("_", " ");
}

export function SupplierAvatar({ name, identity = false }: { name: string; identity?: boolean }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <span aria-hidden="true" className={`${styles.avatar} ${identity ? styles.identityMark : ""}`}>{initials || "?"}</span>;
}

export function SupplierTags({ category, tier, bniMember = false }: { category?: string; tier?: string; bniMember?: boolean }) {
  return <div className="flex flex-wrap items-center gap-1.5">
    {category ? <span title={category} className={styles.tag}>{category}</span> : null}
    {tier ? <span title={supplierTierLabel(tier)} className={`${styles.tag} ${tier === "pending_first_event" ? styles.pending : styles.tier}`}>{supplierTierLabel(tier)}</span> : null}
    {bniMember ? <span className={`${styles.tag} ${styles.network}`}>BNI member</span> : null}
  </div>;
}

export function SegmentedMeter({ value, max = 5, tone = "green", segments = 40 }: { value: number | null; max?: number; tone?: "green" | "amber" | "pink" | "red"; segments?: number }) {
  const filled = value === null || max <= 0 ? 0 : Math.round(Math.max(0, Math.min(1, value / max)) * segments);
  return <div aria-hidden="true" className={styles.meter} data-tone={tone}>{Array.from({ length: segments }, (_, index) => <span key={index} data-filled={index < filled} />)}</div>;
}

export function RatingStars({ rating }: { rating: number | null }) {
  return <span aria-hidden="true" className={styles.stars}>{Array.from({ length: 5 }, (_, index) => <Star key={index} className="size-3" fill={rating !== null && index < Math.round(rating) ? "currentColor" : "none"} />)}</span>;
}
