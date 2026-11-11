"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import { Input } from "@prism/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { emptyItem, type DraftItem, type DraftWhen } from "../model/template-draft";

/** Radix selects cannot hold an empty value, so "nothing chosen" is this stand-in. */
const NONE = "__none__";

function ItemRow({
  item,
  position,
  others,
  onChange,
  onRemove,
  removable,
}: {
  item: DraftItem;
  position: number;
  others: DraftItem[];
  onChange: (patch: Partial<DraftItem>) => void;
  onRemove: () => void;
  removable: boolean;
}) {
  const label = `Task ${position + 1}`;
  return (
    <li className="grid gap-2 rounded-lg border border-border p-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Input aria-label={`${label} title`} placeholder="What needs doing" value={item.title} onChange={(event) => onChange({ title: event.target.value })} />
        <Input aria-label={`${label} owner`} placeholder="Who owns it" value={item.ownerRole} onChange={(event) => onChange({ ownerRole: event.target.value })} />
      </div>
      <div className="grid gap-2 sm:grid-cols-[6rem_9rem_minmax(0,1fr)]">
        <Input aria-label={`${label} days`} inputMode="numeric" value={item.days} onChange={(event) => onChange({ days: event.target.value })} />
        <Select value={item.when} onValueChange={(when) => onChange({ when: when as DraftWhen })}>
          <SelectTrigger aria-label={`${label} before or after the event`} className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="before">days before</SelectItem>
            <SelectItem value="after">days after</SelectItem>
          </SelectContent>
        </Select>
        <Select value={item.dependsOn || NONE} onValueChange={(next) => onChange({ dependsOn: next === NONE ? "" : next })}>
          <SelectTrigger aria-label={`${label} waits for`} className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Waits for nothing</SelectItem>
            {others.map((other) => <SelectItem key={other.rowId} value={other.rowId}>Waits for: {other.title || "untitled task"}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Input aria-label={`${label} notes`} placeholder="Notes (optional)" value={item.notes} onChange={(event) => onChange({ notes: event.target.value })} />
        <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${label}`} disabled={!removable} onClick={onRemove}><Trash2 className="size-4" /></Button>
      </div>
    </li>
  );
}

/** The tasks of a template, one card each. The event date is the anchor: "30 days before" means 30 days before it. */
export function TemplateItemRows({ items, onChange }: { items: DraftItem[]; onChange: (items: DraftItem[]) => void }) {
  const patch = (rowId: string, change: Partial<DraftItem>) => onChange(items.map((item) => (item.rowId === rowId ? { ...item, ...change } : item)));
  // Removing a task also clears any task that waited for it, so nothing points at a row that is gone.
  const remove = (rowId: string) => onChange(items.filter((item) => item.rowId !== rowId).map((item) => (item.dependsOn === rowId ? { ...item, dependsOn: "" } : item)));
  return (
    <div className="grid gap-3">
      <ul className="grid gap-3">
        {items.map((item, position) => (
          <ItemRow
            key={item.rowId}
            item={item}
            position={position}
            others={items.filter((other) => other.rowId !== item.rowId)}
            onChange={(change) => patch(item.rowId, change)}
            onRemove={() => remove(item.rowId)}
            removable={items.length > 1}
          />
        ))}
      </ul>
      <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => onChange([...items, emptyItem()])}>
        <Plus className="size-4" /> Add a task
      </Button>
    </div>
  );
}
