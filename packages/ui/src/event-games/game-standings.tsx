import { cn } from "../utils";

export interface GameStandingEntry {
  rank: number;
  label: string;
  score: number;
  teamLabel?: string;
}

export interface GameStandingsProps {
  entries: readonly GameStandingEntry[];
  size?: "phone" | "stage";
  /** The viewer's own label, highlighted so they can find themselves. */
  highlightLabel?: string | null;
  /** How many places to show; the viewer's own row is always kept. */
  limit?: number;
}

const PODIUM = ["bg-[#f2b134] text-[var(--prism-ink)]", "bg-[#cfd4dc] text-[var(--prism-ink)]", "bg-[#d98c5f] text-white"];

function visibleEntries(entries: readonly GameStandingEntry[], limit: number, highlightLabel?: string | null) {
  const top = entries.slice(0, limit);
  const own = highlightLabel ? entries.find((entry) => entry.label === highlightLabel) : undefined;
  return own && !top.includes(own) ? [...top, own] : top;
}

function RankBadge({ rank, stage }: { rank: number; stage: boolean }) {
  const fallback = stage ? "bg-white/15" : "bg-muted";
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full font-bold tabular-nums", stage ? "size-14" : "size-8 text-sm", PODIUM[rank - 1] ?? fallback)}>
      {rank}
    </span>
  );
}

function StandingRow({ entry, stage, own }: { entry: GameStandingEntry; stage: boolean; own: boolean }) {
  const rowStyle = stage ? "bg-white/10 px-6 py-4" : "border border-border bg-card px-3 py-2.5";
  const ownStyle = stage ? "ring-2 ring-white" : "border-primary bg-primary-soft";
  const showTeam = Boolean(entry.teamLabel && entry.teamLabel !== entry.label);
  return (
    <li className={cn("flex items-center gap-3 rounded-2xl", rowStyle, own && ownStyle)}>
      <RankBadge rank={entry.rank} stage={stage} />
      <span className="min-w-0 flex-1 truncate font-semibold">
        {own && !stage ? "You" : entry.label}
        {showTeam ? <span className={cn("ml-2 font-normal", stage ? "text-white/60" : "text-muted-foreground")}>{entry.teamLabel}</span> : null}
      </span>
      <span className="shrink-0 font-bold tabular-nums">{entry.score}</span>
    </li>
  );
}

/** Ranked standings with a podium for the top three, for phones and the room screen. */
export function GameStandings({ entries, size = "phone", highlightLabel, limit = 5 }: GameStandingsProps) {
  const stage = size === "stage";
  return (
    <ol className={cn("grid", stage ? "gap-3 text-3xl" : "gap-2 text-base")}>
      {visibleEntries(entries, limit, highlightLabel).map((entry) => (
        <StandingRow key={`${entry.rank}-${entry.label}`} entry={entry} stage={stage} own={entry.label === highlightLabel} />
      ))}
    </ol>
  );
}
