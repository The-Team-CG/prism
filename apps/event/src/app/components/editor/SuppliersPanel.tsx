import { useMemo, useState } from "react";
import { Plus, Search, Trash2, GripVertical, Utensils, Music2, Flower2, Theater, ShieldCheck, Package, Camera, Wrench } from "lucide-react";
import { useEditor } from "./store";
import type { Supplier, SupplierKind, SupplierStatus } from "./types";
import { uid } from "./assetLibrary";

const KIND_META: Record<SupplierKind, { label: string; Icon: typeof Utensils; color: string }> = {
  catering: { label: "Catering", Icon: Utensils, color: "#F06030" },
  av: { label: "AV / Sound", Icon: Music2, color: "#7080C0" },
  floral: { label: "Floral", Icon: Flower2, color: "#F02080" },
  staging: { label: "Staging", Icon: Theater, color: "#9060A0" },
  security: { label: "Security", Icon: ShieldCheck, color: "#9060A0" },
  rental: { label: "Rental", Icon: Package, color: "#C01867" },
  photography: { label: "Photo / Video", Icon: Camera, color: "#62535C" },
  other: { label: "Other", Icon: Wrench, color: "#62535C" },
};

const STATUS_COLOR: Record<SupplierStatus, string> = {
  confirmed: "#1F7A4B",
  booked: "#7080C0",
  proposed: "#F06030",
  cancelled: "#B4233A",
};

export function SuppliersPanel() {
  const { state, dispatch } = useEditor();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | SupplierKind>("all");

  const assignedMap = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const o of state.project.objects) {
      for (const sid of o.assignedSupplierIds ?? []) {
        if (!m.has(sid)) m.set(sid, []);
        m.get(sid)!.push(o.label ?? o.name);
      }
    }
    return m;
  }, [state.project.objects]);

  const suppliers = state.project.suppliers;
  const stats = useMemo(() => {
    const by: Record<SupplierStatus, number> = { confirmed: 0, booked: 0, proposed: 0, cancelled: 0 };
    for (const s of suppliers) by[s.status]++;
    return { total: suppliers.length, ...by };
  }, [suppliers]);

  const filtered = suppliers.filter((s) => {
    if (q && !s.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter !== "all" && s.kind !== filter) return false;
    return true;
  });

  function addSupplier() {
    dispatch({
      type: "ADD_SUPPLIER",
      supplier: { id: uid("s"), name: "New supplier", kind: "other", status: "proposed" },
    });
  }

  function onDragStart(e: React.DragEvent, s: Supplier) {
    e.dataTransfer.setData("application/x-prism-supplier", s.id);
    e.dataTransfer.effectAllowed = "move";
  }

  return (
    <div className="flex flex-col">
      <div className="px-3 pb-2 pt-3">
        <div className="text-[10px] uppercase tracking-wider text-neutral-400">Production</div>
        <div className="mt-0.5 text-sm text-neutral-900" style={{ fontWeight: 500 }}>
          Suppliers & vendors
        </div>
      </div>

      <div className="mx-3 mb-2 grid grid-cols-3 gap-1 rounded-md bg-muted p-1.5 text-center text-[10px]">
        <div>
          <div className="tabular-nums" style={{ fontWeight: 600 }}>{stats.total}</div>
          <div className="text-neutral-500">Total</div>
        </div>
        <div>
          <div className="tabular-nums text-[#1F7A4B]" style={{ fontWeight: 600 }}>{stats.confirmed}</div>
          <div className="text-neutral-500">Confirmed</div>
        </div>
        <div>
          <div className="tabular-nums text-[#F06030]" style={{ fontWeight: 600 }}>{stats.proposed}</div>
          <div className="text-neutral-500">Proposed</div>
        </div>
      </div>

      <div className="px-2 pb-1.5">
        <div className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1.5 focus-within:bg-white focus-within:ring-1 focus-within:ring-primary/30">
          <Search size={12} className="text-neutral-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search suppliers"
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-neutral-400"
          />
        </div>
      </div>

      <div className="mb-1 flex flex-wrap gap-1 px-2">
        {(["all", "catering", "av", "floral", "staging", "security", "rental", "photography"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={[
              "rounded-full px-2 py-0.5 text-[10px] capitalize",
              filter === f ? "bg-[var(--prism-ink)] text-white" : "bg-muted text-neutral-600 hover:bg-white hover:ring-1 hover:ring-neutral-200",
            ].join(" ")}
          >
            {f === "all" ? "All" : KIND_META[f].label}
          </button>
        ))}
      </div>

      <div className="px-2 pb-1.5">
        <button
          onClick={addSupplier}
          className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-neutral-300 py-1.5 text-[11px] text-neutral-600 hover:border-primary hover:text-foreground"
        >
          <Plus size={12} /> Add supplier
        </button>
      </div>

      <div className="flex flex-col gap-0.5 px-1.5 pb-3">
        {filtered.map((s) => {
          const meta = KIND_META[s.kind];
          const Icon = meta.Icon;
          const attached = assignedMap.get(s.id) ?? [];
          return (
            <div
              key={s.id}
              draggable
              onDragStart={(e) => onDragStart(e, s)}
              className="group flex items-start gap-1.5 rounded-md bg-white px-1.5 py-1.5 hover:bg-muted ring-1 ring-transparent hover:ring-neutral-200 cursor-grab active:cursor-grabbing"
              title={`${s.name} — drag onto an element`}
            >
              <GripVertical size={11} className="mt-1 shrink-0 text-neutral-300 group-hover:text-neutral-500" />
              <div
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-white"
                style={{ backgroundColor: meta.color }}
              >
                <Icon size={12} />
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <input
                  value={s.name}
                  onChange={(e) => dispatch({ type: "UPDATE_SUPPLIER", id: s.id, patch: { name: e.target.value } })}
                  className="w-full truncate bg-transparent text-[11px] text-neutral-900 outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 rounded px-0.5"
                />
                <div className="flex items-center gap-1 text-[9px] text-neutral-500">
                  <select
                    value={s.kind}
                    onChange={(e) => dispatch({ type: "UPDATE_SUPPLIER", id: s.id, patch: { kind: e.target.value as SupplierKind } })}
                    className="bg-transparent outline-none"
                  >
                    {(Object.keys(KIND_META) as SupplierKind[]).map((k) => (
                      <option key={k} value={k}>{KIND_META[k].label}</option>
                    ))}
                  </select>
                  <span className="text-neutral-300">·</span>
                  <select
                    value={s.status}
                    onChange={(e) => dispatch({ type: "UPDATE_SUPPLIER", id: s.id, patch: { status: e.target.value as SupplierStatus } })}
                    className="bg-transparent outline-none"
                    style={{ color: STATUS_COLOR[s.status] }}
                  >
                    <option value="proposed">Proposed</option>
                    <option value="booked">Booked</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                {attached.length > 0 ? (
                  <div className="mt-0.5 truncate text-[9px] text-foreground">
                    @ {attached.join(", ")}
                  </div>
                ) : (
                  <div className="mt-0.5 text-[9px] text-neutral-400">Unassigned</div>
                )}
              </div>
              <button
                onClick={() => dispatch({ type: "DELETE_SUPPLIER", id: s.id })}
                className="hidden size-5 shrink-0 items-center justify-center rounded text-neutral-400 hover:bg-rose-50 hover:text-rose-600 group-hover:flex"
                title="Remove"
              >
                <Trash2 size={11} />
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-3 py-6 text-center text-[11px] text-neutral-400">No suppliers match.</div>
        )}
      </div>
    </div>
  );
}

export { KIND_META as SUPPLIER_KIND_META, STATUS_COLOR as SUPPLIER_STATUS_COLOR };
