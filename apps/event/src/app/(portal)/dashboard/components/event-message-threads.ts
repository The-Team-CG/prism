import type { PrismAuditLog, PrismEvent, PrismNotificationLog } from "@prism/types";

export type EventMessage = {
  id: string;
  author: string;
  initials: string;
  body: string;
  time: string;
  mine: boolean;
  status?: string;
};

export type EventMessageThread = {
  id: string;
  title: string;
  detail: string;
  tag: string;
  status: string;
  messages: EventMessage[];
};

export function lbl(value: string) {
  return value.replaceAll("_", " ");
}

export function initialsFrom(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "PM";
}

export function messageTime(value?: string) {
  if (!value) return "Now";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function auditMessage(item: PrismAuditLog): EventMessage {
  const author = item.actor || "PMCM Team";
  return {
    id: `audit-${item.id}`,
    author,
    initials: initialsFrom(author),
    body: item.action,
    time: messageTime(item.createdAt),
    mine: item.actorRole === "pmcm-admin",
    status: lbl(item.category || item.actionType || "update"),
  };
}

export function outboundMessage(item: PrismNotificationLog): EventMessage {
  const channel = lbl(item.channel);
  return {
    id: `outbound-${item.id}`,
    author: "PMCM Team",
    initials: "PM",
    body: item.message,
    time: messageTime(item.createdAt),
    mine: true,
    status: `${channel} to ${item.recipient}`,
  };
}

export function threadItemStatus(count: number) {
  const n = count || 1;
  return `${n} item${n === 1 ? "" : "s"}`;
}

export function withFallbackMessages(messages: EventMessage[], fallback: EventMessage) {
  return messages.length ? messages : [fallback];
}

function filterByPattern<T>(items: T[], pattern: RegExp, haystack: (item: T) => string) {
  return items.filter((item) => pattern.test(haystack(item)));
}

function emptyThreadMessage(id: string, body: string): EventMessage {
  return {
    id: `${id}-empty`,
    author: "PMCM Team",
    initials: "PM",
    body,
    time: "Now",
    mine: true,
    status: "ready",
  };
}

function threadFrom(
  id: string,
  title: string,
  detail: string,
  tag: string,
  messages: EventMessage[],
  fallback: string,
): EventMessageThread {
  return {
    id,
    title,
    detail,
    tag,
    status: threadItemStatus(messages.length),
    messages: withFallbackMessages(messages, emptyThreadMessage(id, fallback)),
  };
}

export function buildEventMessageThreads({
  audit,
  event,
  notificationLogs,
}: {
  audit: PrismAuditLog[];
  event: PrismEvent;
  notificationLogs: PrismNotificationLog[];
}): EventMessageThread[] {
  const clientAudit = filterByPattern(audit, /client|briefing|conforme|proposal|billing|floor/i, (item) => `${item.actorRole} ${item.action} ${item.category}`);
  const coordinatorAudit = filterByPattern(audit, /coordinator|assignment|event day/i, (item) => `${item.action} ${item.category}`);
  const supplierAudit = filterByPattern(audit, /supplier|quote|Supplier/i, (item) => `${item.action} ${item.category}`);
  const clientOutbound = filterByPattern(notificationLogs, /client|briefing|billing|proposal|floor/i, (item) => item.message);
  const coordinatorOutbound = filterByPattern(notificationLogs, /coordinator|assignment/i, (item) => item.message);
  const supplierOutbound = filterByPattern(notificationLogs, /supplier|quote|menu|setup|contract/i, (item) => item.message);

  const clientMessages = [...clientAudit.slice(0, 4).map(auditMessage), ...clientOutbound.slice(0, 4).map(outboundMessage)];
  const coordinatorMessages = [...coordinatorAudit.slice(0, 4).map(auditMessage), ...coordinatorOutbound.slice(0, 5).map(outboundMessage)];
  const supplierMessages = [...supplierAudit.slice(0, 4).map(auditMessage), ...supplierOutbound.slice(0, 4).map(outboundMessage)];
  const internalMessages = audit.slice(0, 6).map(auditMessage);

  return [
    threadFrom("client", event.clientName, `${event.eventName} client thread`, "Client", clientMessages, `Client coordination thread for ${event.eventName}.`),
    threadFrom("coordinators", "Coordinator Team", "Assignments, call times, and day-of updates", "Team", coordinatorMessages, "Coordinator thread is ready for assignment confirmations and day-of status replies."),
    threadFrom("suppliers", "Supplier Desk", "Quotes, setup notes, attachments, and confirmations", "Supplier", supplierMessages, "Supplier thread is ready for quote follow-ups, call times, contracts, and setup confirmations."),
    threadFrom("internal", "PMCM Internal", "Team-only operational updates", "Internal", internalMessages, "Internal thread is ready for PMCM coordination notes."),
  ];
}
