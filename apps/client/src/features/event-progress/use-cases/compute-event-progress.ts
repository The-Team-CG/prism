import type { PrismClientWorkspace, PrismEvent } from "@prism/types";
import { computeEventProgress } from "../model/event-progress-rules";
import type { EventProgressSnapshot } from "../model/event-progress-types";

export function computeEventProgressUseCase(
  event: PrismEvent,
  workspace: PrismClientWorkspace,
): EventProgressSnapshot {
  return computeEventProgress(event, workspace);
}
