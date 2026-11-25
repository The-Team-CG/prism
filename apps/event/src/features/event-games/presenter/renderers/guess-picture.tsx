import { answersClosedForRoom, type PresenterRenderer } from "../presenter-types";
import { PresenterLeaderboard, PresenterPrompt, PresenterRevealedAnswer } from "../presenter-blocks";

function PictureStage({ url, stage, totalStages }: { url: string | null | undefined; stage: number; totalStages: number }) {
  const stages = Math.max(1, totalStages);
  const visibleWidth = Math.min(100, Math.max(1, Math.round((stage / stages) * 100)));
  return (
    <figure className="mx-auto grid w-full max-w-5xl gap-4">
      <div className="overflow-hidden rounded-3xl bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.06),rgba(255,255,255,0.06)_16px,transparent_16px,transparent_32px)] shadow-2xl">
        {url ? (
          <img src={url} alt="The picture so far" style={{ clipPath: `inset(0 ${100 - visibleWidth}% 0 0)` }} className="block max-h-[55vh] w-full object-contain transition-[clip-path] duration-1000" />
        ) : <div className="aspect-video" aria-hidden="true" />}
      </div>
      <figcaption className="flex items-center gap-4 text-2xl font-semibold text-white/75">
        <span className="shrink-0">Stage {stage} of {stages}</span>
        <span className="flex flex-1 gap-2" aria-hidden="true">
          {Array.from({ length: stages }, (_, index) => <span key={index} className={`h-3 flex-1 rounded-full ${index < stage ? "bg-[var(--prism-magenta)]" : "bg-white/15"}`} />)}
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * Guess the Picture slides: the hint, and the picture uncovering stage by stage, as guests see it on their phones.
 * Once paused, the answer and the standings.
 */
const GuessPictureRenderer: PresenterRenderer = ({ state, pictureUrl }) => {
  const round = state.currentRound;
  if (!round) return null;
  const closed = answersClosedForRoom(state);
  const revealedAnswer = closed ? round.revealedAnswer : undefined;
  const picture = round.picture;

  return (
    <div className="space-y-10">
      {closed
        ? <PresenterPrompt prompt={round.prompt} compact />
        : <PresenterPrompt prompt={round.prompt} participantCount={state.participantCount} answeredCount={round.answeredCount} action={state.status === "live" ? "Guess on your phone" : null} compact />}
      {picture ? <PictureStage url={pictureUrl} stage={closed ? picture.totalStages : picture.stage} totalStages={picture.totalStages} /> : null}
      {revealedAnswer ? <PresenterRevealedAnswer answer={revealedAnswer} /> : null}
      {state.status === "paused" && state.leaderboard.length ? <PresenterLeaderboard entries={state.leaderboard} title="Standings" /> : null}
    </div>
  );
};

export default GuessPictureRenderer;
