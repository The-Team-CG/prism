import { useState } from "react";
import {
  Armchair, Theater, ClipboardList, Shield, Columns, Layers, Search, Users, Truck, BookmarkPlus, Shapes,
} from "lucide-react";
import { LayersPanel } from "./LayersPanel";
import { GuestsPanel } from "./GuestsPanel";
import { SuppliersPanel } from "./SuppliersPanel";
import { TemplatesPanel } from "./TemplatesPanel";
import { ASSETS, CATEGORY_LABELS, assetToObject, type AssetDef } from "./assetLibrary";
import type { ElementCategory } from "./types";
import { useEditor } from "./store";

type TabId = "components" | "guests" | "suppliers" | "layers" | "templates";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ size?: number | string }>;
  group: "design" | "event" | "library";
}

const TABS: Tab[] = [
  { id: "components", label: "Components", icon: Shapes, group: "design" },
  { id: "layers", label: "Layers", icon: Layers, group: "design" },
  { id: "guests", label: "Guests", icon: Users, group: "event" },
  { id: "suppliers", label: "Suppliers", icon: Truck, group: "event" },
  { id: "templates", label: "Templates", icon: BookmarkPlus, group: "library" },
];

const CATEGORY_TABS: { id: ElementCategory; icon: React.ComponentType<{ size?: number | string }> }[] = [
  { id: "furniture", icon: Armchair },
  { id: "stage", icon: Theater },
  { id: "registration", icon: ClipboardList },
  { id: "safety", icon: Shield },
  { id: "architecture", icon: Columns },
];

function AssetPreview({ asset }: { asset: AssetDef }) {
  const maxDim = Math.max(asset.w, asset.h);
  const scale = 28 / maxDim;
  const W = asset.w * scale;
  const H = asset.h * scale;
  return (
    <svg width={40} height={40} viewBox="0 0 40 40">
      <g transform={`translate(${(40 - W) / 2},${(40 - H) / 2})`}>
        {asset.kind === "ellipse" ? (
          <ellipse cx={W / 2} cy={H / 2} rx={Math.max(1, W / 2 - 1)} ry={Math.max(1, H / 2 - 1)} fill={asset.fill} stroke={asset.stroke} strokeWidth={1} />
        ) : asset.kind === "line" ? (
          <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke={asset.stroke} strokeWidth={Math.max(2, H)} strokeLinecap="round" />
        ) : (
          <rect x={0.5} y={0.5} width={Math.max(2, W - 1)} height={Math.max(2, H - 1)} fill={asset.fill} stroke={asset.stroke} strokeWidth={1} rx={1.5} />
        )}
      </g>
    </svg>
  );
}

function AssetTile({ asset }: { asset: AssetDef }) {
  const { state, dispatch } = useEditor();
  function onDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("application/x-prism-asset", asset.id);
    e.dataTransfer.effectAllowed = "copy";
  }
  function addToCenter() {
    const cx = state.project.widthM / 2;
    const cy = state.project.heightM / 2;
    dispatch({ type: "ADD_OBJECT", obj: assetToObject(asset, cx, cy) });
  }
  return (
    <button
      draggable
      onDragStart={onDragStart}
      onDoubleClick={addToCenter}
      className="group flex flex-col items-center gap-1 rounded-lg p-1.5 hover:bg-white cursor-grab active:cursor-grabbing"
      title={`${asset.name} — drag to canvas`}
    >
      <div className="flex h-12 w-full items-center justify-center rounded-md bg-muted group-hover:bg-white group-hover:ring-1 group-hover:ring-neutral-200">
        <AssetPreview asset={asset} />
      </div>
      <span className="w-full truncate text-center text-[10px] leading-tight text-neutral-600">
        {asset.name}
      </span>
    </button>
  );
}

function ComponentsPanel() {
  const [cat, setCat] = useState<ElementCategory | "all">("furniture");
  const [q, setQ] = useState("");
  const items = ASSETS.filter((a) => {
    if (cat !== "all" && a.category !== cat) return false;
    if (q && !a.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col">
      <div className="px-3 pb-2 pt-3">
        <div className="text-[10px] uppercase tracking-wider text-neutral-400">Library</div>
        <div className="mt-0.5 text-sm text-neutral-900" style={{ fontWeight: 500 }}>
          Components
        </div>
      </div>
      <div className="px-2 pb-1.5">
        <div className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1.5 focus-within:bg-white focus-within:ring-1 focus-within:ring-primary/30">
          <Search size={12} className="text-neutral-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search components"
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-neutral-400"
          />
        </div>
      </div>
      {/* Sub-tabs per category */}
      <div className="flex items-center gap-0.5 border-b border-neutral-100 px-1.5 pb-1">
        <button
          onClick={() => setCat("all")}
          className={[
            "rounded px-1.5 py-1 text-[10px]",
            cat === "all" ? "bg-[var(--prism-ink)] text-white" : "text-neutral-600 hover:bg-neutral-100",
          ].join(" ")}
          title="All"
        >
          All
        </button>
        {CATEGORY_TABS.map(({ id, icon: Icon }) => {
          const active = cat === id;
          return (
            <button
              key={id}
              onClick={() => setCat(id)}
              title={CATEGORY_LABELS[id]}
              className={[
                "flex size-7 items-center justify-center rounded text-[10px]",
                active ? "bg-[var(--prism-ink)] text-white" : "text-neutral-600 hover:bg-neutral-100",
              ].join(" ")}
            >
              <Icon size={13} />
            </button>
          );
        })}
      </div>
      <div className="px-3 pt-2 text-[10px] uppercase tracking-wider text-neutral-400">
        {cat === "all" ? `All · ${items.length}` : `${CATEGORY_LABELS[cat]} · ${items.length}`}
      </div>
      <div className="grid grid-cols-3 gap-0.5 px-1.5 pb-2 pt-1">
        {items.map((a) => <AssetTile key={a.id} asset={a} />)}
        {items.length === 0 && (
          <div className="col-span-3 py-6 text-center text-[11px] text-neutral-400">No components match.</div>
        )}
      </div>
    </div>
  );
}

export function LeftPanel() {
  const [active, setActive] = useState<TabId>("components");

  let content: React.ReactNode;
  if (active === "components") content = <ComponentsPanel />;
  else if (active === "layers") {
    content = (
      <div>
        <div className="px-3 pb-2 pt-3">
          <div className="text-[10px] uppercase tracking-wider text-neutral-400">Document</div>
          <div className="mt-0.5 text-sm text-neutral-900" style={{ fontWeight: 500 }}>Layers</div>
        </div>
        <LayersPanel />
      </div>
    );
  } else if (active === "guests") content = <GuestsPanel />;
  else if (active === "suppliers") content = <SuppliersPanel />;
  else content = <TemplatesPanel />;

  return (
    <div className="flex shrink-0 border-r border-neutral-200 bg-white">
      {/* Icon rail — grouped top-level tabs like Figma */}
      <div className="flex w-[52px] shrink-0 flex-col items-center gap-0.5 border-r border-neutral-100 bg-muted py-2">
        {TABS.map((t, i) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          const prev = TABS[i - 1];
          const groupChanged = prev && prev.group !== t.group;
          return (
            <div key={t.id} className="flex w-full flex-col items-center">
              {groupChanged && <div className="my-0.5 h-px w-7 bg-neutral-200" />}
              <button
                onClick={() => setActive(t.id)}
                title={t.label}
                className={[
                  "group flex size-10 flex-col items-center justify-center gap-0.5 rounded-md transition-colors",
                  isActive ? "bg-[var(--prism-ink)] text-white" : "text-neutral-600 hover:bg-neutral-200/60",
                ].join(" ")}
              >
                <Icon size={16} />
                <span
                  className={[
                    "text-[8px] leading-none",
                    isActive ? "text-white/90" : "text-neutral-500",
                  ].join(" ")}
                >
                  {t.label}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Secondary panel */}
      <div className="w-[240px] overflow-auto">{content}</div>
    </div>
  );
}
