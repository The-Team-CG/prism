import { useEffect, useState } from "react";
import { Save, Trash2, Check, Download, Search, Layers } from "lucide-react";
import { useEditor } from "./store";
import {
  cloneTemplateObjects,
  type FloorPlanTemplate,
} from "./templates";
import type { TemplateStore } from "./template-store";

function ThumbSvg({ t }: { t: FloorPlanTemplate }) {
  const W = 96;
  const H = 64;
  const scale = Math.min(W / t.widthM, H / t.heightM) * 0.9;
  const roomW = t.widthM * scale;
  const roomH = t.heightM * scale;
  const offX = (W - roomW) / 2;
  const offY = (H - roomH) / 2;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block">
      <rect x={0} y={0} width={W} height={H} fill="#FFF4EC" />
      <rect x={offX} y={offY} width={roomW} height={roomH} fill="#FFFFFF" stroke="#C01867" strokeWidth={0.6} />
      {t.objects.map((o) => {
        const cx = offX + o.x * scale;
        const cy = offY + o.y * scale;
        const w = o.w * scale;
        const h = o.h * scale;
        if (o.kind === "ellipse") {
          return (
            <ellipse
              key={o.id}
              cx={cx + w / 2}
              cy={cy + h / 2}
              rx={Math.max(0.5, w / 2)}
              ry={Math.max(0.5, h / 2)}
              fill={o.fill}
              stroke={o.stroke}
              strokeWidth={0.4}
            />
          );
        }
        if (o.kind === "line") {
          return (
            <line
              key={o.id}
              x1={cx}
              y1={cy + h / 2}
              x2={cx + w}
              y2={cy + h / 2}
              stroke={o.stroke}
              strokeWidth={Math.max(0.6, h)}
            />
          );
        }
        return (
          <rect
            key={o.id}
            x={cx}
            y={cy}
            width={Math.max(0.5, w)}
            height={Math.max(0.5, h)}
            fill={o.fill}
            stroke={o.stroke}
            strokeWidth={0.4}
            rx={1}
          />
        );
      })}
    </svg>
  );
}

export function TemplatesPanel({ store }: { store: TemplateStore }) {
  const { state, dispatch } = useEditor();
  const [templates, setTemplates] = useState<FloorPlanTemplate[]>([]);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(state.project.name || "New template");
  const [includeGuests, setIncludeGuests] = useState(false);
  const [includeSuppliers, setIncludeSuppliers] = useState(true);
  const [justSavedId, setJustSavedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    store.load()
      .then((next) => {
        if (!cancelled) setTemplates(next);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load templates");
      });
    return () => {
      cancelled = true;
    };
  }, [store]);

  async function save() {
    const p = state.project;
    setBusy(true);
    setError(null);
    try {
      const t = await store.add({
        name: name.trim() || "Untitled template",
        venue: p.venue,
        widthM: p.widthM,
        heightM: p.heightM,
        pax: p.pax,
        objects: p.objects.map((o) => ({ ...o, assignedGuestIds: [], assignedSupplierIds: [] })),
        includeGuests,
        includeSuppliers,
        guests: includeGuests ? p.guests : [],
        suppliers: includeSuppliers ? p.suppliers : [],
      });
      setTemplates(await store.load());
      setSaving(false);
      setJustSavedId(t.id);
      setTimeout(() => setJustSavedId(null), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save template");
    } finally {
      setBusy(false);
    }
  }

  function apply(t: FloorPlanTemplate) {
    if (state.project.objects.length > 0) {
      if (!confirm(`Use "${t.name}"? This replaces the current layout.`)) return;
    }
    dispatch({
      type: "APPLY_TEMPLATE",
      patch: { widthM: t.widthM, heightM: t.heightM, pax: t.pax, venue: t.venue ?? state.project.venue },
      objects: cloneTemplateObjects(t),
      guests: t.includeGuests ? t.guests : undefined,
      suppliers: t.includeSuppliers ? t.suppliers : undefined,
    });
  }

  async function remove(id: string) {
    if (!confirm("Delete this template?")) return;
    setBusy(true);
    setError(null);
    try {
      await store.remove(id);
      setTemplates(await store.load());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete template");
    } finally {
      setBusy(false);
    }
  }

  const filtered = templates.filter(
    (t) => q === "" || t.name.toLowerCase().includes(q.toLowerCase()) || (t.venue ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="flex flex-col">
      <div className="px-3 pb-2 pt-3">
        <div className="text-[10px] uppercase tracking-wider text-neutral-400">Library</div>
        <div className="mt-0.5 text-sm text-neutral-900" style={{ fontWeight: 500 }}>
          My templates
        </div>
      </div>

      <div className="px-2 pb-2">
        {error && (
          <div className="mb-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[10px] text-rose-700">
            {error}
          </div>
        )}
        {saving ? (
          <div className="flex flex-col gap-1.5 rounded-md bg-muted p-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template name"
              className="w-full rounded-md bg-white px-2 py-1.5 text-xs outline-none ring-1 ring-neutral-200 focus:ring-primary/40"
            />
            <label className="flex items-center gap-1.5 text-[10px] text-neutral-600">
              <input type="checkbox" checked={includeGuests} onChange={(e) => setIncludeGuests(e.target.checked)} />
              Include guest list
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-neutral-600">
              <input type="checkbox" checked={includeSuppliers} onChange={(e) => setIncludeSuppliers(e.target.checked)} />
              Include suppliers
            </label>
            <div className="flex gap-1">
              <button
                onClick={save}
                disabled={busy}
                className="flex flex-1 items-center justify-center gap-1 rounded-md bg-[var(--prism-ink)] py-1 text-[11px] text-white hover:bg-[#C01867]"
              >
                <Check size={11} /> Save
              </button>
              <button
                onClick={() => setSaving(false)}
                className="rounded-md bg-white px-2 py-1 text-[11px] text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setName(state.project.name || "New template");
              setSaving(true);
            }}
            disabled={busy}
            className="flex w-full items-center justify-center gap-1 rounded-md bg-[var(--prism-ink)] py-1.5 text-[11px] text-white hover:bg-[#C01867]"
          >
            <Save size={11} /> Save current as template
          </button>
        )}
      </div>

      <div className="px-2 pb-1.5">
        <div className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1.5 focus-within:bg-white focus-within:ring-1 focus-within:ring-primary/30">
          <Search size={12} className="text-neutral-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search templates"
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-neutral-400"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5 px-2 pb-3">
        {filtered.length === 0 && (
          <div className="rounded-md border border-dashed border-neutral-300 px-3 py-6 text-center text-[11px] text-neutral-500">
            {templates.length === 0 ? (
              <>No templates yet.<br />Save your current floor plan to reuse it.</>
            ) : (
              "No templates match."
            )}
          </div>
        )}
        {filtered.map((t) => (
          <div
            key={t.id}
            className={[
              "group relative flex gap-2 rounded-md bg-white p-1.5 ring-1 transition-colors",
              justSavedId === t.id ? "ring-primary" : "ring-neutral-200 hover:ring-primary",
            ].join(" ")}
          >
            <div className="overflow-hidden rounded bg-muted">
              <ThumbSvg t={t} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="truncate text-[11px] text-neutral-900" style={{ fontWeight: 500 }}>
                {t.name}
              </div>
              <div className="truncate text-[9px] text-neutral-500">
                {t.venue ?? "—"}
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-[9px] text-neutral-500 tabular-nums">
                <Layers size={9} /> {t.objects.length}
                <span className="text-neutral-300">·</span>
                {t.widthM}×{t.heightM} m
                <span className="text-neutral-300">·</span>
                {t.pax} pax
              </div>
              <div className="mt-auto flex gap-1 pt-1">
                <button
                  onClick={() => apply(t)}
                  className="flex flex-1 items-center justify-center gap-1 rounded bg-[var(--prism-ink)] py-0.5 text-[10px] text-white hover:bg-[#C01867]"
                >
                  <Download size={10} /> Use
                </button>
                <button
                  onClick={() => remove(t.id)}
                  disabled={busy}
                  className="flex size-5 items-center justify-center rounded text-neutral-400 hover:bg-rose-50 hover:text-rose-600"
                  title="Delete"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
            {justSavedId === t.id && (
              <div className="absolute right-1.5 top-1.5 rounded-full bg-[var(--prism-ink)] px-1.5 py-0.5 text-[9px] text-white">
                Saved
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
