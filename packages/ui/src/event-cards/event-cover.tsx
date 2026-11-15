import { Briefcase, CalendarHeart, GraduationCap, PartyPopper, Presentation, Rocket, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "../utils";

/** The drawn cover for one kind of event: its short name, a picture and two colours. */
type CoverLook = { label: string; icon: LucideIcon; from: string; to: string };

/**
 * One look per inquiry event type, matched loosely so older wording ("Corporate Event") and free text ("Wedding")
 * still land on a fitting cover. These are illustration colours, chosen to read under white text and a white tag.
 */
const COVER_LOOKS: Array<{ match: RegExp; look: CoverLook }> = [
  { match: /corporate|company|business/i, look: { label: "Corporate", icon: Briefcase, from: "#c7d4fb", to: "#4c67cf" } },
  { match: /conference|summit|forum|seminar/i, look: { label: "Conference", icon: Presentation, from: "#bfe9ef", to: "#1d8aa1" } },
  { match: /gala|ball|awards/i, look: { label: "Gala", icon: Sparkles, from: "#ecd3fb", to: "#8f49cc" } },
  { match: /launch/i, look: { label: "Product launch", icon: Rocket, from: "#ffd6bf", to: "#d95c33" } },
  { match: /celebration|wedding|birthday|debut|party|anniversary/i, look: { label: "Celebration", icon: PartyPopper, from: "#ffcfe0", to: "#d14a80" } },
  { match: /training|workshop|class/i, look: { label: "Workshop", icon: GraduationCap, from: "#cdeed5", to: "#2b9256" } },
];

const DEFAULT_LOOK: CoverLook = { label: "Event", icon: CalendarHeart, from: "#e7e2f3", to: "#8378ad" };

export function coverLook(eventType: string | null | undefined): CoverLook {
  const type = eventType?.trim();
  if (!type) return DEFAULT_LOOK;
  return COVER_LOOKS.find((entry) => entry.match.test(type))?.look ?? DEFAULT_LOOK;
}

/**
 * The picture at the top of an event card: PMCM's chosen photo when there is one, otherwise a cover drawn from the
 * event type, so every event is recognisable at a glance from its first day.
 */
export function EventCover({ eventType, imageUrl, small = false, className }: { eventType?: string | null; imageUrl?: string | null; small?: boolean; className?: string }) {
  const look = coverLook(eventType);
  const Icon = look.icon;
  return (
    <div aria-hidden className={cn("relative overflow-hidden", small ? "h-14" : "h-24", className)} style={{ background: `linear-gradient(135deg, ${look.from}, ${look.to})` }}>
      {imageUrl ? (
        <img src={imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <>
          <span className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle,rgba(255,255,255,.7)_1px,transparent_1.5px)] [background-size:14px_14px]" />
          <Icon className="absolute -bottom-4 -right-3 size-24 text-white/35" strokeWidth={1.5} />
        </>
      )}
      {small ? null : <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-neutral-800">{imageUrl ? "Event photo" : look.label}</span>}
    </div>
  );
}
