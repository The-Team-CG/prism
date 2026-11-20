/** @vitest-environment jsdom */
import { createElement, type ReactElement } from "react";
import { cleanup, fireEvent, render as renderPlain, screen, within } from "@testing-library/react";
import { PortalQueryProvider } from "@prism/portal-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismClientActionItem, PrismEvent } from "@prism/types";
import { ClientEventCards } from "./client-event-cards";

/** Cards read a cover through the portal cache; none of these events has a chosen cover, so nothing is fetched. */
const render = (ui: ReactElement) => renderPlain(createElement(PortalQueryProvider, { actorKey: "ana@ayala.test", children: ui }));

afterEach(cleanup);

const event = (id: string, eventDate: string, status = "planning") => ({ id, eventName: `Event ${id}`, eventDate, status, archived: false, venue: "" }) as PrismEvent;
const action = (eventId: string, priority: PrismClientActionItem["priority"], label: string, stage: PrismClientActionItem["stage"] = "needs_client"): PrismClientActionItem =>
  ({ id: `${eventId}:${label}`, stage, kind: "approval", priority, label, description: "", status: "open", eventId, eventName: "", href: `/dashboard/events/${eventId}/proposal` });

const events = [event("next", "2026-11-23"), event("later", "2026-12-12"), event("done", "2026-10-01", "completed")];
const actions = [
  action("next", "warning", "Review and approve the proposal"),
  action("later", "info", "Read the briefing notes", "to_review"),
  { ...action("next", "attention", "Downpayment due"), dueAt: "2026-11-18T00:00:00.000Z" },
  { ...action("next", "info", "Confirm the walk-through"), dueAt: "2026-11-20T00:00:00.000Z" },
];

describe("client events as cards", () => {
  it("shows the nearest event large with days to go and the client's next step, and the rest as cards", () => {
    const onOpen = vi.fn();
    render(createElement(ClientEventCards, { events, actions, todayKey: "2026-11-16", onOpen, featureFirst: true }));

    const hero = screen.getByText(/^Your next event/).closest("article") as HTMLElement;
    expect(within(hero).getByText("7")).toBeTruthy();
    expect(within(hero).getByText("days to go")).toBeTruthy();
    expect(within(hero).getByText("Review and approve the proposal")).toBeTruthy();
    expect(within(hero).getByRole("link", { name: "Open" }).getAttribute("href")).toBe("/dashboard/events/next/proposal");
    // The next dated things on the event, soonest first.
    const comingUp = within(hero).getByRole("region", { name: "Coming up" });
    expect(within(comingUp).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Nov 18Downpayment due", "Nov 20Confirm the walk-through"]);
    fireEvent.click(within(hero).getByRole("link", { name: "Event next" }));
    expect(onOpen).toHaveBeenCalledWith("next");

    // News to read is not a step for the client, so the later event says nothing waits on them.
    const later = screen.getByRole("link", { name: "Event later" }).closest("article") as HTMLElement;
    expect(within(later).getByText("in 26 days")).toBeTruthy();
    expect(within(later).getByText("Nothing waiting on you")).toBeTruthy();
    expect(within(screen.getByRole("link", { name: "Event done" }).closest("article") as HTMLElement).getByText(/View summary/)).toBeTruthy();
  });

  it("never calls an open event whose date has passed the next one, and shows a finished event's open step", () => {
    const overdue = event("overdue", "2026-10-26");
    const finished = event("finished", "2026-10-01", "completed");
    render(createElement(ClientEventCards, {
      events: [overdue, events[0], finished], actions: [action("finished", "critical", "Share your feedback")], todayKey: "2026-11-16", onOpen: () => undefined, featureFirst: true,
    }));
    const hero = screen.getByText(/^Your next event/).closest("article") as HTMLElement;
    expect(within(hero).getByRole("link", { name: "Event next" })).toBeTruthy();
    expect(within(screen.getByRole("link", { name: "Event overdue" }).closest("article") as HTMLElement).getByText("21 days ago")).toBeTruthy();
    expect(within(screen.getByRole("link", { name: "Event finished" }).closest("article") as HTMLElement).getByRole("link", { name: "Share your feedback" })).toBeTruthy();
  });

  it("keeps every result the same size while searching", () => {
    render(createElement(ClientEventCards, { events, actions, todayKey: "2026-11-16", onOpen: () => undefined, featureFirst: false }));
    expect(screen.queryByText("Your next event")).toBeNull();
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });
});
