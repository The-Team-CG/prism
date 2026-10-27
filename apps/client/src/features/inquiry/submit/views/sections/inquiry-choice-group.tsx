"use client";

import { useId } from "react";
import { cn } from "@/app/components/ui/utils";

export function InquiryChoiceGroup({
  label,
  options,
  value,
  onChange,
  required = false,
  hint,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  hint?: string;
}) {
  const name = useId();
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-semibold text-foreground">
        {label}
        {required ? null : <span className="font-normal text-muted-foreground"> (optional)</span>}
      </legend>
      {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option} className="relative">
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              required={required}
              className="peer sr-only"
            />
            <span
              className={cn(
                "inline-flex h-10 cursor-pointer items-center rounded-full border border-border-strong bg-card px-4 text-sm font-medium text-foreground transition-colors",
                "hover:border-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-orange",
                "peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white",
              )}
            >
              {option}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
