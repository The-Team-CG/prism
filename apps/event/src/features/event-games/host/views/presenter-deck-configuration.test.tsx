/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PresenterDeckFields, type PresenterDeckDraft, type PresenterDeckRoundDraft } from "./presenter-deck-configuration";

function choiceRound(key: string, options: string): PresenterDeckRoundDraft {
  return { key, type: "choice", prompt: `Prompt ${key}`, options, scaleMax: "5", maxResponseLength: "30", durationSeconds: "30" };
}

describe("PresenterDeckFields layout", () => {
  afterEach(cleanup);

  it("keeps each multiple-choice prompt's fields top-aligned, with Options on its own full-width row", () => {
    const draft: PresenterDeckDraft = { kind: "presenter-deck", rounds: [choiceRound("prompt-1", "Tea\nCoffee"), choiceRound("prompt-2", "Yes\nNo\nMaybe")] };
    render(<PresenterDeckFields draft={draft} onChange={vi.fn()} />);

    const fieldsets = screen.getAllByRole("group");
    expect(fieldsets).toHaveLength(2);
    for (const fieldset of fieldsets) {
      // Without items-start, the grid stretches the Prompt type select to the textarea's height.
      expect(fieldset.className).toContain("items-start");
      expect(fieldset.className).toContain("sm:grid-cols-2");

      const labels = Array.from(fieldset.querySelectorAll(":scope > label"));
      const optionsLabel = labels.find((label) => label.textContent?.startsWith("Options"));
      expect(optionsLabel?.className).toContain("sm:col-span-2");
      // Options comes after Prompt type and Seconds open, so it never sits beside the select.
      expect(labels.at(-1)).toBe(optionsLabel);
      expect(optionsLabel?.querySelector("textarea")?.getAttribute("data-slot")).toBe("textarea");
    }

    const optionFields = screen.getAllByRole("textbox", { name: /options/i }) as HTMLTextAreaElement[];
    expect(optionFields.map((field) => field.value)).toEqual(["Tea\nCoffee", "Yes\nNo\nMaybe"]);
    const promptTypes = screen.getAllByRole("combobox", { name: /prompt type/i }) as HTMLSelectElement[];
    expect(promptTypes.map((select) => select.value)).toEqual(["choice", "choice"]);
  });

  it("shows Options only for multiple-choice prompts", () => {
    const draft: PresenterDeckDraft = {
      kind: "presenter-deck",
      rounds: [{ ...choiceRound("prompt-1", ""), type: "scale" }, choiceRound("prompt-2", "A\nB")],
    };
    render(<PresenterDeckFields draft={draft} onChange={vi.fn()} />);

    expect(screen.getAllByRole("textbox", { name: /options/i })).toHaveLength(1);
    expect(screen.getByRole("combobox", { name: /rating scale maximum/i })).toBeTruthy();
  });
});
