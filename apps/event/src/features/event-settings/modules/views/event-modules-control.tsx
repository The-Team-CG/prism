"use client";

import { useEffect, useState } from "react";
import { EVENT_MODULE_LABELS, EVENT_MODULES, type EventModule, type PrismEvent } from "@prism/types";

/** FR-24: PMCM switches optional modules off for a simpler event; switching one back on restores its screens and data. */
export function EventModulesControl({ selectedEvent, onSave }: { selectedEvent?: PrismEvent; onSave: (disabled: EventModule[]) => Promise<boolean> }) {
  const [disabled, setDisabled] = useState<EventModule[]>(selectedEvent?.disabledModules ?? []);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setDisabled(selectedEvent?.disabledModules ?? []); setFailed(false); }, [selectedEvent?.id, selectedEvent?.disabledModules]);
  if (!selectedEvent || selectedEvent.archived) return null;

  async function toggle(module: EventModule, on: boolean) {
    const next = on ? disabled.filter((item) => item !== module) : [...disabled, module];
    setSaving(true);
    setFailed(false);
    try {
      if (await onSave(next)) setDisabled(next);
      else setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <fieldset className="rounded-md border border-border bg-muted/20 px-4 py-3" disabled={saving}>
      <legend className="sr-only">Event modules</legend>
      <p className="text-sm font-black text-foreground">Modules</p>
      <p className="mt-1 text-xs text-muted-foreground">Switch off what this event does not need. Nothing is deleted; switching a module back on brings its screens back.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {EVENT_MODULES.map((module) => (
          <label key={module} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!disabled.includes(module)} onChange={(event) => void toggle(module, event.target.checked)} />
            {EVENT_MODULE_LABELS[module]}
          </label>
        ))}
      </div>
      {failed ? <p role="alert" className="mt-2 text-xs text-destructive">Could not save the modules. Try again.</p> : null}
    </fieldset>
  );
}
