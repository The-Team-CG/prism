export function optionalNavBadge(count?: number | string) {
  return count || undefined;
}

export function eventWorkspaceSectionLabel(eventName?: string) {
  return eventName ? "Current event" : "Event workspace";
}
