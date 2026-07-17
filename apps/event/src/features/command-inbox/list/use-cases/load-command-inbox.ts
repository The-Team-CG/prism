import type { PrismPmcmCommandInbox } from "@prism/types";
import { commandInboxRepository } from "../data/command-inbox-repository";

export function loadCommandInbox(force = false): Promise<PrismPmcmCommandInbox> {
  return commandInboxRepository.load(force);
}

export function getCachedCommandInbox() {
  return commandInboxRepository.getCached();
}
