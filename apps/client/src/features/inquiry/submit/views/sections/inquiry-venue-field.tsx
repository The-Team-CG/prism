"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Input } from "@/app/components/ui/input";
import { cn } from "@/app/components/ui/utils";
import { INQUIRY_CITY_SUGGESTIONS } from "../../model/inquiry-submit-types";

export function InquiryVenueField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeOptionRef = useRef<HTMLButtonElement>(null);
  const cities = INQUIRY_CITY_SUGGESTIONS.filter((city) => city.toLowerCase().includes(value.trim().toLowerCase()));
  const expanded = open && cities.length > 0;
  const activeCity = expanded ? cities[activeIndex] : undefined;

  useEffect(() => {
    activeOptionRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeCity]);

  function close() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function select(city: string) {
    onChange(city);
    inputRef.current?.focus();
    close();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => {
        if (!expanded || index < 0) return event.key === "ArrowDown" ? 0 : cities.length - 1;
        return Math.max(0, Math.min(cities.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)));
      });
    } else if (event.key === "Enter" && activeCity) {
      event.preventDefault();
      select(activeCity);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      close();
    }
  }

  return (
    <div className="grid content-start gap-2">
      <label htmlFor="venueCity" className="text-sm font-semibold text-foreground">
        Venue or city <span className="font-normal text-muted-foreground">(optional)</span>
      </label>
      <div className="relative" onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}>
        <Input
          ref={inputRef}
          id="venueCity"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? "inquiry-city-suggestions" : undefined}
          aria-activedescendant={activeCity ? `inquiry-city-${activeIndex}` : undefined}
          aria-describedby="venueCity-hint"
          autoComplete="off"
          value={value}
          placeholder="For example, Makati"
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            onChange(event.target.value);
            setActiveIndex(-1);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className="h-11 rounded-lg border-border-strong bg-white pl-3.5 pr-11 text-base md:text-base"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Toggle city suggestions"
          aria-expanded={expanded}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            inputRef.current?.focus();
            setOpen(!open);
            setActiveIndex(-1);
          }}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground hover:text-foreground"
        >
          <ChevronDown aria-hidden="true" className="size-4" />
        </button>
        {expanded ? (
          <ul id="inquiry-city-suggestions" role="listbox" aria-label="City suggestions" className="absolute left-0 top-full z-50 mt-1 max-h-60 w-full overflow-y-auto overscroll-contain rounded-lg border border-border-strong bg-white p-1 text-base text-foreground shadow-md">
            {cities.map((city, index) => (
              <li key={city} role="none">
                <button
                  ref={index === activeIndex ? activeOptionRef : undefined}
                  id={`inquiry-city-${index}`}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={city === value}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => select(city)}
                  className={cn("flex min-h-11 w-full items-center justify-between rounded-md px-3 py-2 text-left hover:bg-primary-soft focus-visible:bg-primary-soft focus-visible:outline-none", index === activeIndex && "bg-primary-soft")}
                >
                  {city}
                  {city === value ? <Check aria-hidden="true" className="size-4 text-primary" /> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <p id="venueCity-hint" className="text-sm text-muted-foreground">
        Pick a city or type the venue name. A city is enough if the venue is not final.
      </p>
    </div>
  );
}
