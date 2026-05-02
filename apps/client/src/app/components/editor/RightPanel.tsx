import { useState } from "react";
import { useEditor, useSelected } from "./store";
import type { CanvasObject, RSVP } from "./types";
import { FlipHorizontal2, RotateCw, Palette, Ruler, MoveHorizontal, Users, X, Truck, Plus } from "lucide-react";
import { SUPPLIER_KIND_META, SUPPLIER_STATUS_COLOR } from "./SuppliersPanel";

const RSVP_COLOR: Record<RSVP, string> = {
  confirmed: "#1F7A4B",
  pending: "#F06030",
  declined: "#B4233A",
};

function SeatingAssignments({ obj }: { obj: CanvasObject }) {
  const { state, dispatch } = useEditor();
  const assignedIds = obj.assignedGuestIds ?? [];
  const guests = state.project.guests;
  const assigned = assignedIds
    .map((id) => guests.find((g) => g.id === id))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));
  const cap = obj.seats ?? 0;
  const pct = cap > 0 ? Math.min(100, (assigned.length / cap) * 100) : 0;
  const full = cap > 0 && assigned.length >= cap;

  function onDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes("application/x-prism-guest")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = full ? "none" : "move";
    }
  }
  function onDrop(e: React.DragEvent) {
    const gid = e.dataTransfer.getData("application/x-prism-guest");
    if (!gid) return;
    e.preventDefault();
    dispatch({ type: "ASSIGN_GUEST", guestId: gid, objectId: obj.id });
  }

  return (
    <div className="flex flex-col gap-2 px-3">
      <div className="flex items-center justify-between text-[10px] text-neutral-500">
        <span>Capacity</span>
        <span className="tabular-nums">{assigned.length} / {cap}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: full ? "#B4233A" : "var(--prism-signal)" }}
        />
      </div>
      <div
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={[
          "rounded-md border border-dashed p-1.5 transition-colors",
          full ? "border-rose-300 bg-rose-50/40" : "border-neutral-300 bg-muted/60 hover:border-primary hover:bg-muted",
        ].join(" ")}
      >
        {assigned.length === 0 ? (
          <div className="py-3 text-center text-[10px] text-neutral-500">
            Drag guests from the Guests panel
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {assigned.map((g) => (
              <div key={g.id} className="group flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-white">
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: RSVP_COLOR[g.rsvp] }}
                  title={g.rsvp}
                />
                <span className="flex-1 truncate text-[11px] text-neutral-800">{g.name}</span>
                {g.dietary && (
                  <span className="rounded bg-amber-100 px-1 text-[9px] text-amber-800">
                    {g.dietary}
                  </span>
                )}
                <button
                  onClick={() => dispatch({ type: "UNASSIGN_GUEST", guestId: g.id })}
                  className="hidden size-4 items-center justify-center rounded text-neutral-400 hover:bg-neutral-200 group-hover:flex"
                  title="Unassign"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {full && (
        <div className="text-[10px] text-rose-600">Table at capacity. Increase seats to assign more guests.</div>
      )}
    </div>
  );
}

function SupplierAssignments({ obj }: { obj: CanvasObject }) {
  const { state, dispatch } = useEditor();
  const [picking, setPicking] = useState(false);
  const assignedIds = obj.assignedSupplierIds ?? [];
  const suppliers = state.project.suppliers;
  const assigned = assignedIds
    .map((id) => suppliers.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));
  const unassigned = suppliers.filter((s) => !assignedIds.includes(s.id));

  function onDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes("application/x-prism-supplier")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
  }
  function onDrop(e: React.DragEvent) {
    const sid = e.dataTransfer.getData("application/x-prism-supplier");
    if (!sid) return;
    e.preventDefault();
    dispatch({ type: "ASSIGN_SUPPLIER", supplierId: sid, objectId: obj.id });
  }

  return (
    <div className="flex flex-col gap-2 px-3">
      <div
        onDragOver={onDragOver}
        onDrop={onDrop}
        className="rounded-md border border-dashed border-neutral-300 bg-muted/60 p-1.5 transition-colors hover:border-primary hover:bg-muted"
      >
        {assigned.length === 0 ? (
          <div className="py-3 text-center text-[10px] text-neutral-500">
            Drag a supplier here or pick below
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {assigned.map((s) => {
              const meta = SUPPLIER_KIND_META[s.kind];
              const Icon = meta.Icon;
              return (
                <div key={s.id} className="group flex items-center gap-1.5 rounded px-1 py-1 hover:bg-white">
                  <div
                    className="flex size-5 shrink-0 items-center justify-center rounded text-white"
                    style={{ backgroundColor: meta.color }}
                  >
                    <Icon size={10} />
                  </div>
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="truncate text-[11px] text-neutral-800">{s.name}</div>
                    <div className="flex items-center gap-1 text-[9px]">
                      <span className="text-neutral-500">{meta.label}</span>
                      <span className="text-neutral-300">·</span>
                      <span style={{ color: SUPPLIER_STATUS_COLOR[s.status] }}>{s.status}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => dispatch({ type: "UNASSIGN_SUPPLIER", supplierId: s.id, objectId: obj.id })}
                    className="hidden size-4 items-center justify-center rounded text-neutral-400 hover:bg-neutral-200 group-hover:flex"
                    title="Unassign"
                  >
                    <X size={10} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <button
        onClick={() => setPicking((v) => !v)}
        className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-neutral-300 py-1 text-[10px] text-neutral-600 hover:border-primary hover:text-foreground"
      >
        <Plus size={11} /> {picking ? "Close" : "Attach supplier"}
      </button>
      {picking && (
        <div className="max-h-48 overflow-auto rounded-md bg-white ring-1 ring-neutral-200">
          {unassigned.length === 0 ? (
            <div className="px-2 py-2 text-[10px] text-neutral-400">All suppliers attached.</div>
          ) : (
            unassigned.map((s) => {
              const meta = SUPPLIER_KIND_META[s.kind];
              const Icon = meta.Icon;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    dispatch({ type: "ASSIGN_SUPPLIER", supplierId: s.id, objectId: obj.id });
                    setPicking(false);
                  }}
                  className="flex w-full items-center gap-1.5 px-1.5 py-1 text-left text-[11px] hover:bg-muted"
                >
                  <div
                    className="flex size-5 shrink-0 items-center justify-center rounded text-white"
                    style={{ backgroundColor: meta.color }}
                  >
                    <Icon size={10} />
                  </div>
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className="text-[9px] text-neutral-500">{meta.label}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function Slider({
  value,
  min,
  max,
  step,
  onChange,
  suffix = "",
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
  suffix?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <div className="h-1 rounded-full bg-neutral-200" />
        <div
          className="absolute top-0 h-1 rounded-full bg-[var(--prism-ink)]"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:ring-1 [&::-webkit-slider-thumb]:ring-primary"
          style={{ height: 16, marginTop: -8 }}
        />
      </div>
      <span className="w-10 text-right text-[10px] tabular-nums text-neutral-500">
        {value.toFixed(step < 1 ? 2 : 0)}
        {suffix}
      </span>
    </div>
  );
}

function NumInput({
  label,
  value,
  onChange,
  step = 0.1,
  suffix = "m",
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1.5 text-xs focus-within:bg-white focus-within:ring-1 focus-within:ring-primary/30">
      <span className="w-4 text-neutral-500">{label}</span>
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? Number(value.toFixed(2)) : 0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-transparent outline-none tabular-nums"
      />
      <span className="text-[10px] text-neutral-400">{suffix}</span>
    </label>
  );
}

function ColorSwatch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="relative flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md ring-1 ring-black/10 hover:ring-black/25">
      <span className="size-5 rounded" style={{ backgroundColor: value }} />
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  );
}

const PALETTE = ["#FFF4EC", "#FFF0E6", "#EAD5CE", "#E9F7FB", "#CCECF4", "#C01867", "#9060A0", "#E74C3C", "#F06030", "#CCECF4", "#62535C", "#FFFFFF"];

function SectionHeader({ icon: Icon, label }: { icon: React.ComponentType<{ size?: number | string }>; label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 pb-1.5 pt-3 text-[10px] uppercase tracking-wider text-neutral-400">
      <Icon size={11} />
      <span>{label}</span>
    </div>
  );
}

function ShapePreview({ obj }: { obj: CanvasObject }) {
  const maxDim = Math.max(obj.w, obj.h);
  const scale = 44 / maxDim;
  const W = obj.w * scale;
  const H = obj.h * scale;
  return (
    <div className="flex h-[68px] items-center justify-center rounded-lg bg-muted">
      <svg width={60} height={60} viewBox="0 0 60 60">
        <g transform={`translate(${(60 - W) / 2},${(60 - H) / 2}) rotate(${(obj.rotation * 180) / Math.PI} ${W / 2} ${H / 2})`}>
          {obj.kind === "ellipse" ? (
            <ellipse cx={W / 2} cy={H / 2} rx={Math.max(1, W / 2 - 0.5)} ry={Math.max(1, H / 2 - 0.5)} fill={obj.fill} stroke={obj.stroke} strokeWidth={1} />
          ) : obj.kind === "line" ? (
            <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke={obj.stroke} strokeWidth={Math.max(2, H)} strokeLinecap="round" />
          ) : (
            <rect x={0} y={0} width={W} height={H} fill={obj.fill} stroke={obj.stroke} strokeWidth={1} rx={2} />
          )}
        </g>
      </svg>
    </div>
  );
}

function ObjectInspector({ obj }: { obj: CanvasObject }) {
  const { dispatch } = useEditor();
  const patch = (p: Partial<CanvasObject>) => dispatch({ type: "UPDATE_OBJECT", id: obj.id, patch: p });
  const rotDeg = (obj.rotation * 180) / Math.PI;
  const strokeAsPct = Math.round(((obj as any).opacity ?? 1) * 100);

  return (
    <div className="flex flex-col pb-3">
      {/* Preview */}
      <div className="px-3 pt-3">
        <ShapePreview obj={obj} />
      </div>

      {/* Label */}
      <div className="px-3 pt-3">
        <input
          value={obj.label ?? obj.name}
          onChange={(e) => patch({ label: e.target.value })}
          className="w-full rounded-md bg-muted px-2 py-1.5 text-xs outline-none focus:bg-white focus:ring-1 focus:ring-primary/40"
          placeholder="Label"
        />
      </div>

      {/* Dim */}
      <SectionHeader icon={Ruler} label="Dimensions" />
      <div className="grid grid-cols-2 gap-1.5 px-3">
        <NumInput label="W" value={obj.w} onChange={(w) => patch({ w: Math.max(0.1, w) })} />
        <NumInput label="H" value={obj.h} onChange={(h) => patch({ h: Math.max(0.1, h) })} />
        <NumInput label="X" value={obj.x} onChange={(x) => patch({ x })} />
        <NumInput label="Y" value={obj.y} onChange={(y) => patch({ y })} />
      </div>

      {/* Transform */}
      <SectionHeader icon={RotateCw} label="Rotation" />
      <div className="px-3">
        <Slider
          value={rotDeg}
          min={-180}
          max={180}
          step={1}
          suffix="°"
          onChange={(deg) => patch({ rotation: (deg * Math.PI) / 180 })}
        />
        <div className="mt-2 flex gap-1.5">
          {[0, 45, 90, 180].map((deg) => (
            <button
              key={deg}
              onClick={() => patch({ rotation: (deg * Math.PI) / 180 })}
              className="flex-1 rounded-md bg-muted py-1 text-[10px] text-neutral-600 hover:bg-white hover:ring-1 hover:ring-neutral-200"
            >
              {deg}°
            </button>
          ))}
        </div>
      </div>

      {/* Opacity */}
      <SectionHeader icon={MoveHorizontal} label="Opacity" />
      <div className="px-3">
        <Slider value={strokeAsPct} min={0} max={100} step={1} suffix="%" onChange={() => {}} />
        <div className="mt-1 text-[10px] text-neutral-400">Coming soon · per-layer opacity</div>
      </div>

      {/* Color */}
      <SectionHeader icon={Palette} label="Color" />
      <div className="flex flex-col gap-2 px-3">
        <div>
          <div className="mb-1 flex items-center justify-between text-[10px] text-neutral-500">
            <span>Fill</span>
            <span className="tabular-nums uppercase">{obj.fill}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <ColorSwatch value={obj.fill} onChange={(fill) => patch({ fill })} />
            {PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => patch({ fill: c })}
                title={c}
                className={`size-5 rounded ring-1 ring-black/10 hover:ring-primary ${obj.fill === c ? "ring-2 ring-primary" : ""}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-[10px] text-neutral-500">
            <span>Stroke</span>
            <span className="tabular-nums uppercase">{obj.stroke}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ColorSwatch value={obj.stroke} onChange={(stroke) => patch({ stroke })} />
            <div className="flex-1">
              <Slider value={obj.strokeWidth} min={0} max={0.3} step={0.01} suffix="m" onChange={(v) => patch({ strokeWidth: v })} />
            </div>
          </div>
        </div>
      </div>

      {/* Seats */}
      {obj.seats !== undefined && (
        <>
          <SectionHeader icon={FlipHorizontal2} label="Seating" />
          <div className="px-3">
            <NumInput label="#" value={obj.seats} step={1} suffix="seats" onChange={(seats) => patch({ seats: Math.max(0, Math.round(seats)) })} />
          </div>
          <SectionHeader icon={Users} label="Guest assignments" />
          <SeatingAssignments obj={obj} />
        </>
      )}

      {/* Suppliers / vendors — available on every object */}
      <SectionHeader icon={Truck} label="Suppliers" />
      <SupplierAssignments obj={obj} />


      {/* Align actions */}
      <SectionHeader icon={FlipHorizontal2} label="Arrange" />
      <div className="grid grid-cols-2 gap-1.5 px-3">
        <button
          onClick={() => dispatch({ type: "DUPLICATE_SELECTION" })}
          className="rounded-md bg-muted py-1.5 text-[11px] text-neutral-700 hover:bg-white hover:ring-1 hover:ring-neutral-200"
        >
          Duplicate
        </button>
        <button
          onClick={() => dispatch({ type: "DELETE_SELECTION" })}
          className="rounded-md bg-rose-50 py-1.5 text-[11px] text-rose-700 hover:bg-rose-100"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function DocumentInspector() {
  const { state, dispatch } = useEditor();
  const p = state.project;
  return (
    <div className="flex flex-col pb-3">
      <SectionHeader icon={Ruler} label="Venue" />
      <div className="px-3">
        <input
          value={p.venue}
          onChange={(e) => dispatch({ type: "UPDATE_PROJECT", patch: { venue: e.target.value } })}
          className="w-full rounded-md bg-muted px-2 py-1.5 text-xs outline-none focus:bg-white focus:ring-1 focus:ring-primary/40"
        />
      </div>
      <SectionHeader icon={Ruler} label="Room dimensions" />
      <div className="grid grid-cols-2 gap-1.5 px-3">
        <NumInput label="W" value={p.widthM} onChange={(widthM) => dispatch({ type: "UPDATE_PROJECT", patch: { widthM } })} />
        <NumInput label="H" value={p.heightM} onChange={(heightM) => dispatch({ type: "UPDATE_PROJECT", patch: { heightM } })} />
      </div>
      <SectionHeader icon={FlipHorizontal2} label="Capacity" />
      <div className="px-3">
        <NumInput label="#" value={p.pax} step={1} suffix="pax" onChange={(pax) => dispatch({ type: "UPDATE_PROJECT", patch: { pax } })} />
      </div>
      <SectionHeader icon={Palette} label="Canvas" />
      <div className="px-3">
        <div className="flex items-center justify-between rounded-md bg-muted px-2 py-1.5 text-xs">
          <span className="text-neutral-600">Snap to grid</span>
          <button
            onClick={() => dispatch({ type: "TOGGLE_SNAP" })}
            className={[
              "relative h-4 w-7 rounded-full transition-colors",
              state.snap ? "bg-[var(--prism-ink)]" : "bg-neutral-300",
            ].join(" ")}
          >
            <span
              className={[
                "absolute top-0.5 size-3 rounded-full bg-white transition-all",
                state.snap ? "left-3.5" : "left-0.5",
              ].join(" ")}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

export function RightPanel() {
  const sel = useSelected();
  return (
    <div className="flex w-[280px] shrink-0 flex-col border-l border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
        <div className="text-[10px] uppercase tracking-wider text-neutral-400">
          {sel.length === 0 ? "Document" : sel.length === 1 ? "Properties" : "Multi-select"}
        </div>
        {sel.length > 0 && (
          <span className="rounded-full bg-[var(--prism-ink)]/10 px-1.5 py-0.5 text-[10px] text-foreground">
            {sel.length} selected
          </span>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        {sel.length === 1 ? <ObjectInspector obj={sel[0]} /> : <DocumentInspector />}
      </div>
    </div>
  );
}
