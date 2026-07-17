import type {
  PrismApprovalRequest,
  PrismDefenseReadiness,
  PrismEventDayStatusFeed,
  PrismLiveOps,
  PrismPmcmEventWorkspace,
} from "@prism/types";
import {
  eventWorkspaceRepository,
  type EventCommandData,
} from "../data/event-workspace-repository";

export type { EventCommandData };

export function loadEventWorkspace(eventId: string): Promise<PrismPmcmEventWorkspace> {
  return eventWorkspaceRepository.loadWorkspace(eventId);
}

export function loadApprovalRequests(force = false): Promise<PrismApprovalRequest[]> {
  return eventWorkspaceRepository.loadApprovalRequests(force);
}

export function getCachedApprovalRequests() {
  return eventWorkspaceRepository.getCachedApprovalRequests();
}

export function loadEventCommandData(eventId: string, force = false) {
  return eventWorkspaceRepository.loadEventCommandData(eventId, force);
}

export function getCachedEventCommandData(eventId: string) {
  return eventWorkspaceRepository.getCachedEventCommandData(eventId);
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
