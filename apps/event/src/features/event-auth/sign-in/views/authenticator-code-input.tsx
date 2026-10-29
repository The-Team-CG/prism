"use client";

import { useRef, useState } from "react";
import { cn } from "@/app/components/ui/utils";

const CODE_LENGTH = 6;

export function AuthenticatorCodeInput({
  value,
  onChange,
  disabled = false,
  invalid = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="relative w-full max-w-[25rem]">
      <input
        ref={inputRef}
        id="two-factor-code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        spellCheck={false}
        maxLength={CODE_LENGTH}
        required
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={invalid ? "event-sign-in-error" : undefined}
        value={value}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH);
          onChange(digits);
          setActiveIndex(Math.min(event.target.selectionStart ?? digits.length, CODE_LENGTH - 1));
        }}
        onPaste={(event) => {
          event.preventDefault();
          const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
          if (!digits) return;
          onChange(digits);
          setActiveIndex(Math.min(digits.length, CODE_LENGTH - 1));
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSelect={(event) => setActiveIndex(Math.min(event.currentTarget.selectionStart ?? 0, CODE_LENGTH - 1))}
        onPointerDown={(event) => {
          event.preventDefault();
          const bounds = event.currentTarget.getBoundingClientRect();
          const index = Math.min(CODE_LENGTH - 1, Math.max(0, Math.floor((event.clientX - bounds.left) / (bounds.width / CODE_LENGTH))));
          const start = Math.min(index, value.length);
          event.currentTarget.focus();
          event.currentTarget.setSelectionRange(start, Math.min(start + 1, value.length));
          setActiveIndex(start);
        }}
        className="absolute inset-0 z-10 size-full cursor-text opacity-0 disabled:cursor-not-allowed"
      />
      <div aria-hidden="true" className={cn("grid grid-cols-6 gap-2 sm:gap-3", disabled && "opacity-50")}>
        {Array.from({ length: CODE_LENGTH }, (_, index) => (
          <span
            key={index}
            className={cn(
              "flex h-12 min-w-0 items-center justify-center rounded-md border border-foreground/[0.46] bg-muted/60 text-xl font-semibold tabular-nums text-foreground transition-[border-color,box-shadow] sm:h-14",
              invalid && "border-destructive",
              focused && index === activeIndex && "border-primary ring-2 ring-primary/25",
            )}
          >
            {value[index] ?? ""}
          </span>
        ))}
      </div>
    </div>
  );
}
