"use client";

import { useId, type ReactNode } from "react";
import { Check, type LucideIcon } from "lucide-react";
import { cn } from "@/app/components/ui/utils";

export function InquiryChoiceGroup({
  label,
  options,
  value,
  onChange,
  required = false,
  hint,
  icons,
  children,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  hint?: string;
  /** Optional icon per option; options without one show a check mark instead. */
  icons?: Partial<Record<string, LucideIcon>>;
  /** Follow-up shown under the options, such as the detail field for "Other". */
  children?: ReactNode;
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
        {options.map((option) => {
          const selected = value === option;
          const Icon = icons?.[option];
          return (
            <label key={option} className="relative">
              <input
                type="radio"
                name={name}
                value={option}
                checked={selected}
                onChange={() => onChange(option)}
                required={required}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "flex h-11 cursor-pointer select-none items-center gap-2.5 rounded-xl border bg-white pl-2 pr-4 text-sm font-medium transition-[border-color,background-color,box-shadow,transform] duration-150 active:scale-[0.97]",
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-orange",
                  selected
                    ? "border-primary bg-primary-soft text-foreground shadow-[inset_0_0_0_1px_var(--color-primary)]"
                    : "border-border-strong text-foreground hover:border-primary/50 hover:bg-primary-soft/40",
                )}
              >
                {Icon ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid size-7 place-items-center rounded-lg transition-colors",
                      selected ? "bg-primary text-primary-foreground" : "bg-surface-raised text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                ) : (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "ml-1 grid size-[18px] place-items-center rounded-full border transition-colors",
                      selected ? "border-primary bg-primary text-primary-foreground" : "border-border-strong bg-white",
                    )}
                  >
                    {selected ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>
                )}
                {option}
              </span>
            </label>
          );
        })}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </fieldset>
  );
}
