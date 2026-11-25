import type { PresenterRenderer } from "../presenter-types";
import { PresenterLeaderboard, PresenterSection } from "../presenter-blocks";

const COLUMNS = ["B", "I", "N", "G", "O"] as const;

/** The latest call as a big ball, so the back of the room can read it. */
function LatestCall({ latest, count, participantCount }: { latest: number | undefined; count: number; participantCount: number }) {
  return (
    <section aria-label="Latest number" className="flex flex-col items-center gap-5 text-center">
      <div className="grid size-56 place-items-center rounded-full bg-white text-[var(--prism-ink)] shadow-[0_0_80px_rgba(242,177,52,0.45)] ring-[14px] ring-[var(--prism-magenta)] md:size-72">
        <span className="text-[7rem] font-black leading-none tabular-nums md:text-[9rem]">{latest ?? "–"}</span>
      </div>
      <p className="text-3xl text-white/75">
        <span className="font-bold tabular-nums text-[#f2b134]">{count}</span> called ·{" "}
        <span className="font-bold tabular-nums text-[#f2b134]">{participantCount}</span> {participantCount === 1 ? "person" : "people"} playing
      </p>
    </section>
  );
}

/** Every number from 1 to 75 in its column, with the called ones lit and the latest one ringed. */
function CalledBoard({ called, latest }: { called: ReadonlySet<number>; latest: number | undefined }) {
  return (
    <PresenterSection title="Called numbers">
      <div className="grid gap-2">
        {COLUMNS.map((letter, row) => (
          <div key={letter} className="grid grid-cols-[3rem_repeat(15,minmax(0,1fr))] gap-1.5 md:grid-cols-[4rem_repeat(15,minmax(0,1fr))]">
            <span className="grid place-items-center rounded-lg bg-[var(--prism-magenta)] text-2xl font-black md:text-3xl">{letter}</span>
            {Array.from({ length: 15 }, (_, index) => {
              const number = row * 15 + index + 1;
              const lit = called.has(number);
              return (
                <span
                  key={number}
                  className={`grid aspect-square place-items-center rounded-lg text-lg font-bold tabular-nums transition-colors duration-500 md:text-2xl ${lit ? "bg-[#f2b134] text-[var(--prism-ink)]" : "bg-white/5 text-white/25"} ${number === latest ? "ring-4 ring-white" : ""}`}
                >
                  {number}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </PresenterSection>
  );
}

/** Bingo slides: the latest call and the full call board, then standings once the host pauses or the game ends. */
const BingoRenderer: PresenterRenderer = ({ state }) => {
  const round = state.currentRound;
  const calledNumbers = round?.calledNumbers ?? [];
  const showStandings = (state.status === "paused" || state.status === "completed") && state.leaderboard.length > 0;
  if (!round && !showStandings) return null;
  const latest = calledNumbers[calledNumbers.length - 1];

  return (
    <div className="space-y-10">
      {round ? (
        <div className="grid items-center gap-10 xl:grid-cols-[auto_1fr]">
          <LatestCall latest={latest} count={calledNumbers.length} participantCount={state.participantCount} />
          <CalledBoard called={new Set(calledNumbers)} latest={latest} />
        </div>
      ) : null}
      {showStandings ? <PresenterLeaderboard entries={state.leaderboard} title="Standings" /> : null}
    </div>
  );
};

export default BingoRenderer;
