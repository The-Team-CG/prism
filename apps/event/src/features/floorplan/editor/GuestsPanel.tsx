import { useMemo, useState } from "react";
import { Plus, Search, Trash2, GripVertical, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useEditor } from "./store";
import type { Guest, RSVP } from "./types";
import { uid } from "./assetLibrary";

const RSVP_META: Record<RSVP, { label: string; color: string; Icon: typeof CheckCircle2 }> = {
  confirmed: { label: "Confirmed", color: "#1F7A4B", Icon: CheckCircle2 },
  pending: { label: "Pending", color: "#F06030", Icon: Clock },
  declined: { label: "Declined", color: "#B4233A", Icon: XCircle },
};

type Filter = "all" | RSVP | "unassigned";

export function GuestsPanel() {
  const { state, dispatch } = useEditor();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const assignedMap = useMemo(() => {
    const m = new Map<string, { objectId: string; label: string }>();
    for (const o of state.project.objects) {
      for (const gid of o.assignedGuestIds ?? []) {
        m.set(gid, { objectId: o.id, label: o.label ?? o.name });
      }
    }
    return m;
  }, [state.project.objects]);

  const guests = state.project.guests;
  const stats = useMemo(() => {
    const by: Record<RSVP, number> = { confirmed: 0, pending: 0, declined: 0 };
    for (const g of guests) by[g.rsvp]++;
    return { total: guests.length, assigned: assignedMap.size, ...by };
  }, [guests, assignedMap]);

  const filtered = guests.filter((g) => {
    if (q && !g.name.toLowerCase().includes(q.toLowerCase()) && !(g.group ?? "").toLowerCase().includes(q.toLowerCase())) {
      return false;
    }
    if (filter === "all") return true;
    if (filter === "unassigned") return !assignedMap.has(g.id);
    return g.rsvp === filter;
  });

  function addGuest() {
    dispatch({
      type: "ADD_GUEST",
      guest: { id: uid("g"), name: "New guest", rsvp: "pending" },
    });
  }

  function onDragStart(e: React.DragEvent, g: Guest) {
    e.dataTransfer.setData("application/x-prism-guest", g.id);
    e.dataTransfer.effectAllowed = "move";
  }

  return (
    <div className="flex flex-col">
      {/* Header summary */}
      <div className="px-3 pb-2 pt-3">
        <div className="text-[10px] uppercase tracking-wider text-neutral-400">Event</div>
        <div className="mt-0.5 text-sm text-neutral-900" style={{ fontWeight: 500 }}>
          Guest list
        </div>
      </div>
      <div className="mx-3 mb-2 grid grid-cols-3 gap-1 rounded-md bg-muted p-1.5 text-center text-[10px]">
        <div>
          <div className="tabular-nums text-neutral-900" style={{ fontWeight: 600 }}>{stats.total}</div>
          <div className="text-neutral-500">Invited</div>
        </div>
        <div>
          <div className="tabular-nums text-[#1F7A4B]" style={{ fontWeight: 600 }}>{stats.confirmed}</div>
          <div className="text-neutral-500">Confirmed</div>
        </div>
        <div>
          <div className="tabular-nums text-neutral-900" style={{ fontWeight: 600 }}>
            {stats.assigned}/{stats.total}
          </div>
          <div className="text-neutral-500">Seated</div>
        </div>
      </div>

      {/* Search */}
      <div className="px-2 pb-1.5">
        <div className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1.5 focus-within:bg-white focus-within:ring-1 focus-within:ring-primary/30">
          <Search size={12} className="text-neutral-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search guests"
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-neutral-400"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="mb-1 flex flex-wrap gap-1 px-2">
        {(["all", "confirmed", "pending", "declined", "unassigned"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={[
              "rounded-full px-2 py-0.5 text-[10px]",
              filter === f ? "bg-[var(--prism-ink)] text-white" : "bg-muted text-neutral-600 hover:bg-white hover:ring-1 hover:ring-neutral-200",
            ].join(" ")}
          >
            {f === "all" ? "All" : f === "unassigned" ? "Unassigned" : RSVP_META[f].label}
          </button>
        ))}
      </div>

      {/* Add */}
      <div className="px-2 pb-1.5">
        <button
          onClick={addGuest}
          className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-neutral-300 py-1.5 text-[11px] text-neutral-600 hover:border-primary hover:text-foreground"
        >
          <Plus size={12} /> Add guest
        </button>
      </div>

      {/* List */}
      <div className="flex flex-col gap-0.5 px-1.5 pb-3">
        {filtered.map((g) => {
          const seated = assignedMap.get(g.id);
          const meta = RSVP_META[g.rsvp];
          return (
            <div
              key={g.id}
              draggable
              onDragStart={(e) => onDragStart(e, g)}
              className="group flex items-center gap-1.5 rounded-md bg-white px-1.5 py-1 hover:bg-muted ring-1 ring-transparent hover:ring-neutral-200 cursor-grab active:cursor-grabbing"
              title={`${g.name} — drag onto a table`}
            >
              <GripVertical size={11} className="shrink-0 text-neutral-300 group-hover:text-neutral-500" />
              <div
                className="flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] text-white"
                style={{ backgroundColor: meta.color }}
                title={meta.label}
              >
                {initials(g.name)}
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <input
                  value={g.name}
                  onChange={(e) => dispatch({ type: "UPDATE_GUEST", id: g.id, patch: { name: e.target.value } })}
                  className="w-full truncate bg-transparent text-[11px] text-neutral-900 outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 rounded px-0.5"
                />
                <div className="flex items-center gap-1 text-[9px] text-neutral-500">
                  <select
                    value={g.rsvp}
                    onChange={(e) => dispatch({ type: "UPDATE_GUEST", id: g.id, patch: { rsvp: e.target.value as RSVP } })}
                    className="bg-transparent outline-none"
                    style={{ color: meta.color }}
                  >
                    <option value="confirmed">Confirmed</option>
                    <option value="pending">Pending</option>
                    <option value="declined">Declined</option>
                  </select>
                  <span className="text-neutral-300">·</span>
                  {seated ? (
                    <span className="truncate text-foreground">@ {seated.label}</span>
                  ) : (
                    <span className="text-neutral-400">Unassigned</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => dispatch({ type: "DELETE_GUEST", id: g.id })}
                className="hidden size-5 shrink-0 items-center justify-center rounded text-neutral-400 hover:bg-rose-50 hover:text-rose-600 group-hover:flex"
                title="Remove"
              >
                <Trash2 size={11} />
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-3 py-6 text-center text-[11px] text-neutral-400">No guests match.</div>
        )}
      </div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
