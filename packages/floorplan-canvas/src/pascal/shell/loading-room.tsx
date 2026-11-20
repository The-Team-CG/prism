/** A room outline that stands in for the plan while the editor and the scene load. */
export function LoadingRoom() {
  return (
    <div role="status" aria-label="Loading the floor plan" className="grid size-full place-items-center bg-muted/40">
      <div className="relative aspect-[3/2] w-[min(60%,40rem)] animate-pulse rounded-sm border-4 border-border">
        <div className="absolute left-[12%] top-[18%] size-[14%] rounded-full bg-border" />
        <div className="absolute left-[38%] top-[18%] size-[14%] rounded-full bg-border" />
        <div className="absolute left-[64%] top-[18%] size-[14%] rounded-full bg-border" />
        <div className="absolute bottom-[14%] left-[30%] h-[22%] w-[40%] rounded-sm bg-border" />
      </div>
    </div>
  );
}
