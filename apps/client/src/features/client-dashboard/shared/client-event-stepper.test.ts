/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { ClientEventStepper, type ClientStepperStep } from "./client-event-stepper";

const steps: ClientStepperStep[] = [
  { key: "inquiry", label: "Inquiry", state: "done" },
  { key: "briefing", label: "Briefing & proposal", state: "done" },
  { key: "planning", label: "Planning", state: "current" },
  { key: "event", label: "Event day", state: "upcoming" },
];

function render(input: ClientStepperStep[]) {
  const markup = renderToStaticMarkup(createElement(ClientEventStepper, { steps: input, label: "Event lifecycle" }));
  const container = new DOMParser().parseFromString(markup, "text/html");
  return container;
}

describe("client event stepper", () => {
  it("names the current stage and gives every stage the one colour for its state", () => {
    const doc = render(steps);
    const items = [...doc.querySelectorAll("ol[aria-label='Event lifecycle'] > li")];

    expect(items.map((item) => item.textContent?.trim())).toEqual([
      "Inquiry: done",
      "Briefing & proposal: done",
      "Planning: current stage",
      "Event day: not started",
    ]);
    expect(items.filter((item) => item.className.includes("text-success")).length).toBe(2);
    expect(items.find((item) => item.getAttribute("aria-current") === "step")?.textContent).toContain("Planning");
  });

  it("tells the progress bar which stage is current", () => {
    const doc = render(steps);
    const bar = doc.querySelector("[role='progressbar']");
    expect(bar?.getAttribute("aria-label")).toBe("Event lifecycle: stage 3 of 4");
  });
});
