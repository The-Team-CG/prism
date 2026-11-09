import { fireEvent, screen } from "@testing-library/react";

// jsdom has no ResizeObserver, and Radix Select measures its popper with one.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

/** Opens a Radix Select trigger from the keyboard, as an assistive-technology user does. */
export function openSelect(trigger: HTMLElement): void {
  fireEvent.keyDown(trigger, { key: "Enter" });
}

/** Chooses an option of a Radix Select by its visible name. */
export function chooseSelectOption(trigger: HTMLElement, option: string | RegExp): void {
  openSelect(trigger);
  fireEvent.click(screen.getByRole("option", { name: option }));
}
