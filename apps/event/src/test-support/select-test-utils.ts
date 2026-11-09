import { fireEvent, screen } from "@testing-library/react";

/**
 * Chooses an option from a shared Radix Select the way a mouse user does: pointer-down opens the list,
 * then the option is clicked. jsdom does not implement the pointer-capture and scroll methods Radix calls,
 * so they are stubbed once here.
 */
export function chooseSelectOption(trigger: HTMLElement, option: string | RegExp) {
  const prototype = HTMLElement.prototype as Partial<Record<"hasPointerCapture" | "releasePointerCapture" | "scrollIntoView", unknown>>;
  if (!prototype.hasPointerCapture) prototype.hasPointerCapture = () => false;
  if (!prototype.releasePointerCapture) prototype.releasePointerCapture = () => {};
  if (!prototype.scrollIntoView) prototype.scrollIntoView = () => {};
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
  fireEvent.click(screen.getByRole("option", { name: option }));
}
