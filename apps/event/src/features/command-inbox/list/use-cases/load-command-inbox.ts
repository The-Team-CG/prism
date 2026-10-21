import type { PrismPmcmCommandInbox } from "@prism/types";
import { commandInboxRepository } from "../data/command-inbox-repository";

export function loadCommandInbox(force = false, page = 0): Promise<PrismPmcmCommandInbox> {
  return commandInboxRepository.load(force, page);
}

export function getCachedCommandInbox(page = 0) {
  return commandInboxRepository.getCached(page);
}
