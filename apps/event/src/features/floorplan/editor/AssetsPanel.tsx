import { useMemo, useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import { ASSETS, CATEGORY_LABELS, assetToObject, type AssetDef } from "./assetLibrary";
import { useEditor } from "./store";
import type { ElementCategory } from "./types";

function AssetPreview({ asset }: { asset: AssetDef }) {
  // Render a miniature of the shape itself so the palette looks like Figma/RoomSketch
  const maxDim = Math.max(asset.w, asset.h);
  const scale = 26 / maxDim; // fit into ~32px box
  const W = asset.w * scale;
  const H = asset.h * scale;
  return (
    <svg width={36} height={36} viewBox="0 0 36 36">
      <g transform={`translate(${(36 - W) / 2},${(36 - H) / 2})`}>
        {asset.kind === "ellipse" ? (
          <ellipse cx={W / 2} cy={H / 2} rx={W / 2 - 1} ry={H / 2 - 1} fill={asset.fill} stroke={asset.stroke} strokeWidth={1} />
        ) : asset.kind === "line" ? (
          <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke={asset.stroke} strokeWidth={Math.max(2, H)} strokeLinecap="round" />
        ) : (
          <rect x={0.5} y={0.5} width={Math.max(2, W - 1)} height={Math.max(2, H - 1)} fill={asset.fill} stroke={asset.stroke} strokeWidth={1} rx={1} />
        )}
        {asset.seats && asset.kind === "ellipse" && (
          <>
            {Array.from({ length: Math.min(8, asset.seats) }).map((_, i) => {
              const a = (i / Math.min(8, asset.seats!)) * Math.PI * 2;
              const rx = W / 2 + 1.5;
              const ry = H / 2 + 1.5;
              return (
                <circle
                  key={i}
                  cx={W / 2 + Math.cos(a) * rx}
                  cy={H / 2 + Math.sin(a) * ry}
                  r={1}
                  fill={asset.stroke}
                  opacity={0.5}
                />
              );
            })}
          </>
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
      className="group flex flex-col items-center gap-1 rounded-md border border-transparent p-1.5 hover:border-neutral-200 hover:bg-white cursor-grab active:cursor-grabbing"
      title={`${asset.name} — drag onto canvas (double-click to add at center)`}
    >
      <div className="flex h-[44px] w-full items-center justify-center rounded-md bg-muted group-hover:bg-white group-hover:ring-1 group-hover:ring-neutral-200">
        <AssetPreview asset={asset} />
      </div>
      <span className="w-full truncate text-center text-[10px] leading-tight text-neutral-600">
        {asset.name}
      </span>
    </button>
  );
}

export function AssetsPanel() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<ElementCategory, boolean>>({
    furniture: true,
    stage: true,
    registration: true,
    safety: false,
    architecture: false,
  });

  const grouped = useMemo(() => {
    const lowQ = q.trim().toLowerCase();
    const out = new Map<ElementCategory, AssetDef[]>();
    for (const a of ASSETS) {
      if (lowQ && !a.name.toLowerCase().includes(lowQ)) continue;
      if (!out.has(a.category)) out.set(a.category, []);
      out.get(a.category)!.push(a);
    }
    return out;
  }, [q]);

  return (
    <div className="flex flex-col">
      <div className="p-2">
        <div className="flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-1.5 focus-within:ring-1 focus-within:ring-primary/30 focus-within:bg-white">
          <Search size={12} className="text-neutral-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search elements"
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-neutral-400"
          />
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {Array.from(grouped.entries()).map(([cat, items]) => (
          <div key={cat} className="border-b border-neutral-100 last:border-b-0">
            <button
              onClick={() => setOpen((s) => ({ ...s, [cat]: !s[cat] }))}
              className="flex w-full items-center justify-between px-3 py-2 text-[10px] uppercase tracking-wider text-neutral-500 hover:bg-neutral-50"
            >
              <span>{CATEGORY_LABELS[cat]}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-neutral-400 normal-case tracking-normal">{items.length}</span>
                <ChevronDown
                  size={11}
                  className={`transition-transform ${open[cat] ? "" : "-rotate-90"}`}
                />
              </div>
            </button>
            {open[cat] && (
              <div className="grid grid-cols-3 gap-0.5 px-1.5 pb-2">
                {items.map((a) => (
                  <AssetTile key={a.id} asset={a} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
