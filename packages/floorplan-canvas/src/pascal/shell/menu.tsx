"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type MenuProps = {
  /** The button that opens the menu; it receives the open state for `aria-expanded`. */
  trigger(props: { open: boolean; toggle(): void }): ReactNode;
  /** The menu's content; `close` dismisses it after an item acts. */
  children(close: () => void): ReactNode;
  align?: "left" | "right" | "center";
};

const ALIGN = { left: "left-0", right: "right-0", center: "left-1/2 -translate-x-1/2" } as const;

/** A small dropdown the top bar's menus share; a click outside or Escape closes it. */
export function Menu({ trigger, children, align = "right" }: MenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", outside);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("pointerdown", outside);
      window.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div ref={root} className="relative">
      {trigger({ open, toggle: () => setOpen((shown) => !shown) })}
      {open ? (
        <div role="menu" className={`absolute top-full z-50 mt-1.5 min-w-44 rounded-[10px] border border-border bg-popover p-1 shadow-[0_8px_24px_rgb(24_19_26/0.12)] ${ALIGN[align]}`}>
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

export const menuItem = "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-foreground hover:bg-muted";
