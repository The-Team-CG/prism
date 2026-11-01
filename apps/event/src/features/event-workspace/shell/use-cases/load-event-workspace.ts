import type { PrismApprovalRequest, PrismDefenseReadiness, PrismEventDayStatusFeed, PrismLiveOps, PrismPmcmEventWorkspace } from "@prism/types";
import {
  eventWorkspaceRepository,
  type EventCommandData,
  type EventCommandDataErrors,
  type EventCommandPart,
} from "../data/event-workspace-repository";

export type { EventCommandData, EventCommandDataErrors, EventCommandPart };

/** The event command data a screen renders: live ops on the live desk, registration on registration and games, readiness elsewhere. */
export function eventCommandPartsFor(section: string, tab: string): EventCommandPart[] {
  if (section === "events" && tab === "live-ops") return ["liveOps"];
  if (section === "events" && (tab === "registration" || tab === "games")) return ["registration"];
  return ["readiness"];
}

export function loadEventWorkspace(eventId: string): Promise<PrismPmcmEventWorkspace> {
  return eventWorkspaceRepository.loadWorkspace(eventId);
}

export function loadApprovalRequests(force = false): Promise<PrismApprovalRequest[]> {
  return eventWorkspaceRepository.loadApprovalRequests(force);
}

export function getCachedApprovalRequests() {
  return eventWorkspaceRepository.getCachedApprovalRequests();
}

export function loadEventCommandData(eventId: string, parts: readonly EventCommandPart[], force = false) {
  return eventWorkspaceRepository.loadEventCommandData(eventId, parts, force);
}

export function getCachedEventCommandData(eventId: string, parts: readonly EventCommandPart[]) {
  return eventWorkspaceRepository.getCachedEventCommandData(eventId, parts);
}

export function loadLiveOps(eventId: string): Promise<PrismLiveOps> {
  return eventWorkspaceRepository.loadLiveOps(eventId);
}

export function loadStatusFeed(eventId: string): Promise<PrismEventDayStatusFeed> {
  return eventWorkspaceRepository.loadStatusFeed(eventId);
}

export function loadDefenseReadiness(eventId: string): Promise<PrismDefenseReadiness> {
  return eventWorkspaceRepository.loadDefenseReadiness(eventId);
}
