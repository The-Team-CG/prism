import { useEffect, useRef, useState } from "react";
import { useEditor } from "./store";
import type { CanvasObject } from "./types";
import { ASSETS, assetToObject } from "./assetLibrary";

interface PointerState {
  mode: "none" | "pan" | "drag" | "marquee" | "resize" | "rotate" | "draw";
  startX: number;
  startY: number;
  startWorld: { x: number; y: number };
  origObjects?: CanvasObject[];
  marquee?: { x: number; y: number; w: number; h: number };
  resizeHandle?: string;
  drawId?: string;
}

const RULER_SIZE = 22;

function hitTest(o: CanvasObject, wx: number, wy: number): boolean {
  const cx = o.x + o.w / 2;
  const cy = o.y + o.h / 2;
  const dx = wx - cx;
  const dy = wy - cy;
  const cos = Math.cos(-o.rotation);
  const sin = Math.sin(-o.rotation);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return Math.abs(lx) <= o.w / 2 && Math.abs(ly) <= o.h / 2;
}

export function Canvas({ readOnly = false }: { readOnly?: boolean }) {
  const { state, dispatch } = useEditor();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<PointerState>({ mode: "none", startX: 0, startY: 0, startWorld: { x: 0, y: 0 } });
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [cursorWorld, setCursorWorld] = useState({ x: 0, y: 0 });

  const { viewport, project, selectedIds, tool, snap, gridSize, hoveredId } = state;

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(() => {
      const rect = wrapRef.current!.getBoundingClientRect();
      setSize({ w: rect.width, h: rect.height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const fittedRef = useRef(false);
  useEffect(() => {
    if (fittedRef.current) return;
    if (size.w < 100) return;
    fittedRef.current = true;
    const pad = 90;
    const zx = (size.w - pad * 2) / project.widthM;
    const zy = (size.h - pad * 2) / project.heightM;
    const zoom = Math.min(zx, zy);
    dispatch({
      type: "SET_VIEWPORT",
      viewport: {
        zoom,
        tx: (size.w - project.widthM * zoom) / 2,
        ty: (size.h - project.heightM * zoom) / 2,
      },
    });
  }, [size, project.widthM, project.heightM, dispatch]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Workspace bg — a very soft neutral, feels premium
    const bgGrad = ctx.createLinearGradient(0, 0, 0, size.h);
    bgGrad.addColorStop(0, "#FFF8F2");
    bgGrad.addColorStop(1, "#FFF0E6");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, size.w, size.h);

    // Floor shadow
    ctx.save();
    ctx.translate(viewport.tx, viewport.ty);
    ctx.scale(viewport.zoom, viewport.zoom);

    // Visible world bounds (for infinite grid)
    const worldLeftAll = (0 - viewport.tx) / viewport.zoom;
    const worldRightAll = (size.w - viewport.tx) / viewport.zoom;
    const worldTopAll = (0 - viewport.ty) / viewport.zoom;
    const worldBotAll = (size.h - viewport.ty) / viewport.zoom;

    // Infinite minor grid
    ctx.lineWidth = 1 / viewport.zoom;
    ctx.strokeStyle = "#EAD5CE";
    ctx.beginPath();
    const g = gridSize;
    const sxMinor = Math.floor(worldLeftAll / g) * g;
    const syMinor = Math.floor(worldTopAll / g) * g;
    for (let x = sxMinor; x <= worldRightAll; x += g) {
      if (Math.abs(x - Math.round(x)) < 0.001) continue;
      ctx.moveTo(x, worldTopAll);
      ctx.lineTo(x, worldBotAll);
    }
    for (let y = syMinor; y <= worldBotAll; y += g) {
      if (Math.abs(y - Math.round(y)) < 0.001) continue;
      ctx.moveTo(worldLeftAll, y);
      ctx.lineTo(worldRightAll, y);
    }
    ctx.stroke();

    // Infinite major grid (every meter)
    ctx.strokeStyle = "#CCECF4";
    ctx.beginPath();
    const sxMajor = Math.ceil(worldLeftAll);
    const syMajor = Math.ceil(worldTopAll);
    for (let x = sxMajor; x <= worldRightAll; x += 1) {
      ctx.moveTo(x, worldTopAll);
      ctx.lineTo(x, worldBotAll);
    }
    for (let y = syMajor; y <= worldBotAll; y += 1) {
      ctx.moveTo(worldLeftAll, y);
      ctx.lineTo(worldRightAll, y);
    }
    ctx.stroke();

    // World origin cross-hair
    ctx.strokeStyle = "rgba(192,24,103,0.2)";
    ctx.lineWidth = 1 / viewport.zoom;
    ctx.beginPath();
    ctx.moveTo(worldLeftAll, 0);
    ctx.lineTo(worldRightAll, 0);
    ctx.moveTo(0, worldTopAll);
    ctx.lineTo(0, worldBotAll);
    ctx.stroke();


    // Objects
    for (const o of project.objects) {
      if (o.hidden) continue;
      ctx.save();
      const cx = o.x + o.w / 2;
      const cy = o.y + o.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate(o.rotation);
      ctx.translate(-o.w / 2, -o.h / 2);

      ctx.fillStyle = o.fill;
      ctx.strokeStyle = o.stroke;
      ctx.lineWidth = o.strokeWidth;

      if (o.kind === "ellipse") {
        ctx.beginPath();
        ctx.ellipse(o.w / 2, o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Seats around perimeter — filled if assigned
        if (o.seats && o.seats > 0 && Math.min(o.w, o.h) > 1) {
          const n = Math.min(o.seats, 12);
          const taken = (o.assignedGuestIds ?? []).length;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 - Math.PI / 2;
            const rx = o.w / 2 + 0.18;
            const ry = o.h / 2 + 0.18;
            const sx = o.w / 2 + Math.cos(a) * rx;
            const sy = o.h / 2 + Math.sin(a) * ry;
            ctx.beginPath();
            ctx.arc(sx, sy, 0.13, 0, Math.PI * 2);
            if (i < taken) {
              ctx.fillStyle = "#C01867";
              ctx.globalAlpha = 0.9;
            } else {
              ctx.fillStyle = o.stroke;
              ctx.globalAlpha = 0.3;
            }
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
      } else if (o.kind === "line") {
        ctx.beginPath();
        ctx.moveTo(0, o.h / 2);
        ctx.lineTo(o.w, o.h / 2);
        ctx.lineWidth = Math.max(o.strokeWidth, o.h);
        ctx.strokeStyle = o.stroke;
        ctx.stroke();
      } else {
        const r = Math.min(0.08, Math.min(o.w, o.h) / 8);
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(o.w - r, 0);
        ctx.quadraticCurveTo(o.w, 0, o.w, r);
        ctx.lineTo(o.w, o.h - r);
        ctx.quadraticCurveTo(o.w, o.h, o.w - r, o.h);
        ctx.lineTo(r, o.h);
        ctx.quadraticCurveTo(0, o.h, 0, o.h - r);
        ctx.lineTo(0, r);
        ctx.quadraticCurveTo(0, 0, r, 0);
        ctx.fill();
        ctx.stroke();
      }

      if (o.label && o.w > 0.6 && o.h > 0.4) {
        ctx.fillStyle = "#C01867";
        const fs = Math.min(o.w, o.h) * 0.26;
        ctx.font = `500 ${fs}px ui-sans-serif, system-ui, -apple-system`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(o.label, o.w / 2, o.h / 2);
      }
      ctx.restore();
    }

    // Hover outline
    if (hoveredId && !selectedIds.includes(hoveredId)) {
      const o = project.objects.find((x) => x.id === hoveredId);
      if (o) {
        ctx.save();
        const cx = o.x + o.w / 2;
        const cy = o.y + o.h / 2;
        ctx.translate(cx, cy);
        ctx.rotate(o.rotation);
        ctx.strokeStyle = "#40A0D0";
        ctx.lineWidth = 1 / viewport.zoom;
        ctx.strokeRect(-o.w / 2, -o.h / 2, o.w, o.h);
        ctx.restore();
      }
    }

    // Selection
    for (const id of selectedIds) {
      const o = project.objects.find((x) => x.id === id);
      if (!o) continue;
      ctx.save();
      const cx = o.x + o.w / 2;
      const cy = o.y + o.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate(o.rotation);
      ctx.strokeStyle = "#40A0D0";
      ctx.lineWidth = 1.5 / viewport.zoom;
      ctx.strokeRect(-o.w / 2, -o.h / 2, o.w, o.h);
      const hs = 7 / viewport.zoom;
      const handles: [number, number][] = [
        [-o.w / 2, -o.h / 2], [0, -o.h / 2], [o.w / 2, -o.h / 2],
        [-o.w / 2, 0], [o.w / 2, 0],
        [-o.w / 2, o.h / 2], [0, o.h / 2], [o.w / 2, o.h / 2],
      ];
      ctx.fillStyle = "#FFFFFF";
      ctx.lineWidth = 1.5 / viewport.zoom;
      for (const [hx, hy] of handles) {
        ctx.beginPath();
        ctx.rect(hx - hs / 2, hy - hs / 2, hs, hs);
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0, -o.h / 2);
      ctx.lineTo(0, -o.h / 2 - 18 / viewport.zoom);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -o.h / 2 - 22 / viewport.zoom, 5 / viewport.zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Dimension label on selected (under the shape)
      const dimFs = 11 / viewport.zoom;
      const dimText = `${o.w.toFixed(2)} × ${o.h.toFixed(2)} m`;
      ctx.font = `500 ${dimFs}px ui-sans-serif, system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const tw = ctx.measureText(dimText).width;
      const pad = 4 / viewport.zoom;
      const by = o.h / 2 + 10 / viewport.zoom;
      ctx.fillStyle = "#40A0D0";
      const rY = by;
      const rX = -tw / 2 - pad;
      const rW = tw + pad * 2;
      const rH = dimFs + pad * 1.2;
      const rr = 3 / viewport.zoom;
      ctx.beginPath();
      ctx.moveTo(rX + rr, rY);
      ctx.arcTo(rX + rW, rY, rX + rW, rY + rH, rr);
      ctx.arcTo(rX + rW, rY + rH, rX, rY + rH, rr);
      ctx.arcTo(rX, rY + rH, rX, rY, rr);
      ctx.arcTo(rX, rY, rX + rW, rY, rr);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(dimText, 0, by + pad * 0.6);
      ctx.restore();
    }

    ctx.restore();

    // Supplier badge (screen-space) — a small truck/dot at top-right of any object w/ suppliers
    for (const o of project.objects) {
      if (o.hidden) continue;
      const count = (o.assignedSupplierIds ?? []).length;
      if (count === 0) continue;
      const cx = o.x + o.w / 2;
      const cy = o.y - o.h / 2;
      // Screen position of top-right corner of un-rotated bounding box
      const sxp = (o.x + o.w) * viewport.zoom + viewport.tx;
      const syp = o.y * viewport.zoom + viewport.ty;
      void cx; void cy;
      const r = 8;
      ctx.fillStyle = "#F06030";
      ctx.beginPath();
      ctx.arc(sxp, syp, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "600 9px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(count), sxp, syp + 0.5);
    }

    // Capacity chips (screen-space) for seated objects
    for (const o of project.objects) {
      if (o.hidden || o.seats === undefined) continue;
      const taken = (o.assignedGuestIds ?? []).length;
      const cap = o.seats;
      if (cap <= 0) continue;
      const cx = o.x + o.w / 2;
      const cy = o.y + o.h / 2;
      const sxp = cx * viewport.zoom + viewport.tx;
      const syp = (cy - o.h / 2) * viewport.zoom + viewport.ty - 10;
      const full = taken >= cap;
      const txt = `${taken}/${cap}`;
      ctx.font = `600 10px ui-sans-serif, system-ui`;
      const tw = ctx.measureText(txt).width;
      const padX = 5;
      const w = tw + padX * 2;
      const h = 14;
      const x = sxp - w / 2;
      const y = syp - h;
      ctx.fillStyle = full ? "#B4233A" : taken > 0 ? "#C01867" : "#62535C";
      ctx.beginPath();
      const r = 7;
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(txt, x + w / 2, y + h / 2 + 0.5);
    }

    // Rulers
    drawRulers(ctx, size.w, size.h, viewport);

    // Marquee
    if (marquee) {
      ctx.fillStyle = "rgba(64,160,208,0.08)";
      ctx.strokeStyle = "#40A0D0";
      ctx.lineWidth = 1;
      ctx.fillRect(marquee.x, marquee.y, marquee.w, marquee.h);
      ctx.strokeRect(marquee.x, marquee.y, marquee.w, marquee.h);
    }
  }, [size, viewport, project, selectedIds, hoveredId, gridSize, marquee]);

  function drawRulers(ctx: CanvasRenderingContext2D, w: number, h: number, v: typeof viewport) {
    // Top ruler
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, w, RULER_SIZE);
    ctx.fillRect(0, 0, RULER_SIZE, h);
    ctx.strokeStyle = "#EAD5CE";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, RULER_SIZE);
    ctx.lineTo(w, RULER_SIZE);
    ctx.moveTo(RULER_SIZE, 0);
    ctx.lineTo(RULER_SIZE, h);
    ctx.stroke();
    // corner
    ctx.fillStyle = "#FFF8F2";
    ctx.fillRect(0, 0, RULER_SIZE, RULER_SIZE);

    ctx.fillStyle = "#62535C";
    ctx.font = "10px ui-sans-serif, system-ui";
    ctx.textBaseline = "middle";

    // Step size in meters based on zoom
    const targetPx = 60;
    const step = niceStep(targetPx / v.zoom);
    // Top
    const worldLeft = (0 - v.tx) / v.zoom;
    const worldRight = (w - v.tx) / v.zoom;
    const startX = Math.floor(worldLeft / step) * step;
    ctx.beginPath();
    for (let x = startX; x < worldRight; x += step) {
      const sx = x * v.zoom + v.tx;
      if (sx < RULER_SIZE) continue;
      ctx.moveTo(sx, RULER_SIZE);
      ctx.lineTo(sx, RULER_SIZE - 6);
      ctx.textAlign = "left";
      ctx.fillText(`${round2(x)}`, sx + 3, RULER_SIZE / 2);
    }
    ctx.stroke();
    // Left
    const worldTop = (0 - v.ty) / v.zoom;
    const worldBot = (h - v.ty) / v.zoom;
    const startY = Math.floor(worldTop / step) * step;
    ctx.beginPath();
    for (let y = startY; y < worldBot; y += step) {
      const sy = y * v.zoom + v.ty;
      if (sy < RULER_SIZE) continue;
      ctx.moveTo(RULER_SIZE, sy);
      ctx.lineTo(RULER_SIZE - 6, sy);
      ctx.save();
      ctx.translate(RULER_SIZE / 2, sy + 3);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "right";
      ctx.fillText(`${round2(y)}`, 0, 0);
      ctx.restore();
    }
    ctx.stroke();
  }
  function niceStep(desired: number) {
    const pow = Math.pow(10, Math.floor(Math.log10(desired)));
    const mantissa = desired / pow;
    const nice = mantissa < 1.5 ? 1 : mantissa < 3 ? 2 : mantissa < 7 ? 5 : 10;
    return nice * pow;
  }
  function round2(n: number) {
    return Math.abs(n) < 0.001 ? 0 : Number(n.toFixed(2));
  }

  function toWorld(sx: number, sy: number) {
    return { x: (sx - viewport.tx) / viewport.zoom, y: (sy - viewport.ty) / viewport.zoom };
  }
  function snapCoord(v: number) {
    if (!snap) return v;
    return Math.round(v / gridSize) * gridSize;
  }
  function getHandleAt(sx: number, sy: number): string | null {
    if (selectedIds.length !== 1) return null;
    const o = project.objects.find((x) => x.id === selectedIds[0]);
    if (!o) return null;
    const cx = o.x + o.w / 2;
    const cy = o.y + o.h / 2;
    const handles: [string, number, number][] = [
      ["nw", -o.w / 2, -o.h / 2],
      ["n", 0, -o.h / 2],
      ["ne", o.w / 2, -o.h / 2],
      ["w", -o.w / 2, 0],
      ["e", o.w / 2, 0],
      ["sw", -o.w / 2, o.h / 2],
      ["s", 0, o.h / 2],
      ["se", o.w / 2, o.h / 2],
      ["rot", 0, -o.h / 2 - 22 / viewport.zoom],
    ];
    const cos = Math.cos(o.rotation);
    const sin = Math.sin(o.rotation);
    const hs = 10 / viewport.zoom;
    for (const [name, hx, hy] of handles) {
      const wx = cx + hx * cos - hy * sin;
      const wy = cy + hx * sin + hy * cos;
      const { x: mwx, y: mwy } = toWorld(sx, sy);
      if (Math.abs(mwx - wx) < hs && Math.abs(mwy - wy) < hs) return name;
    }
    return null;
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0 && e.button !== 1) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    // Don't pick up interactions in ruler area
    if (sx < RULER_SIZE || sy < RULER_SIZE) return;
    const world = toWorld(sx, sy);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    if (readOnly) {
      pointerRef.current = { mode: "pan", startX: sx, startY: sy, startWorld: world };
      return;
    }

    if (tool === "hand" || e.button === 1 || e.altKey) {
      pointerRef.current = { mode: "pan", startX: sx, startY: sy, startWorld: world };
      return;
    }

    const handle = getHandleAt(sx, sy);
    if (handle === "rot") {
      const sel = project.objects.find((x) => selectedIds.includes(x.id));
      pointerRef.current = { mode: "rotate", startX: sx, startY: sy, startWorld: world, origObjects: sel ? [sel] : [] };
      return;
    }
    if (handle) {
      const sel = project.objects.filter((x) => selectedIds.includes(x.id));
      pointerRef.current = { mode: "resize", startX: sx, startY: sy, startWorld: world, resizeHandle: handle, origObjects: sel };
      return;
    }

    if (tool === "rect" || tool === "ellipse" || tool === "line") {
      const id = `draw_${Date.now()}`;
      const obj: CanvasObject = {
        id,
        name: tool === "rect" ? "Rectangle" : tool === "ellipse" ? "Ellipse" : "Line",
        kind: tool,
        category: "architecture",
        x: snapCoord(world.x),
        y: snapCoord(world.y),
        w: 0.01,
        h: 0.01,
        rotation: 0,
        fill: tool === "line" ? "#C01867" : "#CCECF4",
        stroke: "#c01867",
        strokeWidth: 0.04,
        locked: false,
        hidden: false,
      };
      dispatch({ type: "ADD_OBJECT", obj });
      pointerRef.current = { mode: "draw", startX: sx, startY: sy, startWorld: world, drawId: id };
      return;
    }

    for (let i = project.objects.length - 1; i >= 0; i--) {
      const o = project.objects[i];
      if (o.hidden || o.locked) continue;
      if (hitTest(o, world.x, world.y)) {
        const already = selectedIds.includes(o.id);
        if (e.shiftKey) dispatch({ type: "ADD_SELECTION", id: o.id });
        else if (!already) dispatch({ type: "SET_SELECTION", ids: [o.id] });
        const toMove = already ? project.objects.filter((x) => selectedIds.includes(x.id)) : [o];
        pointerRef.current = { mode: "drag", startX: sx, startY: sy, startWorld: world, origObjects: toMove.map((o) => ({ ...o })) };
        return;
      }
    }
    if (!e.shiftKey) dispatch({ type: "SET_SELECTION", ids: [] });
    pointerRef.current = { mode: "marquee", startX: sx, startY: sy, startWorld: world };
  }

  function onPointerMove(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const world = toWorld(sx, sy);
    setCursorWorld(world);

    const p = pointerRef.current;
    if (p.mode === "none") {
      let hit: string | null = null;
      for (let i = project.objects.length - 1; i >= 0; i--) {
        if (hitTest(project.objects[i], world.x, world.y)) {
          hit = project.objects[i].id;
          break;
        }
      }
      if (hit !== hoveredId) dispatch({ type: "HOVER", id: hit });
      return;
    }
    if (p.mode === "pan") {
      dispatch({ type: "SET_VIEWPORT", viewport: { tx: viewport.tx + (sx - p.startX), ty: viewport.ty + (sy - p.startY) } });
      pointerRef.current = { ...p, startX: sx, startY: sy };
      return;
    }
    if (p.mode === "marquee") {
      if (readOnly) return;
      setMarquee({
        x: Math.min(sx, p.startX),
        y: Math.min(sy, p.startY),
        w: Math.abs(sx - p.startX),
        h: Math.abs(sy - p.startY),
      });
      return;
    }
    if (p.mode === "drag" && p.origObjects) {
      if (readOnly) return;
      const dx = world.x - p.startWorld.x;
      const dy = world.y - p.startWorld.y;
      const patches = p.origObjects.map((o) => ({ id: o.id, patch: { x: snapCoord(o.x + dx), y: snapCoord(o.y + dy) } }));
      dispatch({ type: "UPDATE_OBJECTS", patches });
      return;
    }
    if (p.mode === "draw" && p.drawId) {
      if (readOnly) return;
      const x0 = p.startWorld.x;
      const y0 = p.startWorld.y;
      const nx = Math.min(x0, world.x);
      const ny = Math.min(y0, world.y);
      const nw = Math.max(0.1, Math.abs(world.x - x0));
      const nh = Math.max(0.1, Math.abs(world.y - y0));
      dispatch({ type: "UPDATE_OBJECT", id: p.drawId, patch: { x: snapCoord(nx), y: snapCoord(ny), w: snapCoord(nw), h: snapCoord(nh) } });
      return;
    }
    if (p.mode === "resize" && p.origObjects && p.resizeHandle) {
      if (readOnly) return;
      const o = p.origObjects[0];
      if (!o) return;
      const dx = world.x - p.startWorld.x;
      const dy = world.y - p.startWorld.y;
      let { x, y, w, h } = o;
      const H = p.resizeHandle;
      if (H.includes("e")) w = Math.max(0.1, o.w + dx);
      if (H.includes("s")) h = Math.max(0.1, o.h + dy);
      if (H.includes("w")) { w = Math.max(0.1, o.w - dx); x = o.x + dx; }
      if (H.includes("n")) { h = Math.max(0.1, o.h - dy); y = o.y + dy; }
      dispatch({ type: "UPDATE_OBJECT", id: o.id, patch: { x: snapCoord(x), y: snapCoord(y), w: snapCoord(w), h: snapCoord(h) } });
      return;
    }
    if (p.mode === "rotate" && p.origObjects) {
      if (readOnly) return;
      const o = p.origObjects[0];
      if (!o) return;
      const cx = o.x + o.w / 2;
      const cy = o.y + o.h / 2;
      const ang = Math.atan2(world.y - cy, world.x - cx) + Math.PI / 2;
      const snapped = e.shiftKey ? Math.round(ang / (Math.PI / 12)) * (Math.PI / 12) : ang;
      dispatch({ type: "UPDATE_OBJECT", id: o.id, patch: { rotation: snapped } });
    }
  }

  function onPointerUp() {
    const p = pointerRef.current;
    if (!readOnly && p.mode === "marquee" && marquee) {
      const x0 = (marquee.x - viewport.tx) / viewport.zoom;
      const y0 = (marquee.y - viewport.ty) / viewport.zoom;
      const x1 = x0 + marquee.w / viewport.zoom;
      const y1 = y0 + marquee.h / viewport.zoom;
      const ids = project.objects
        .filter((o) => {
          const cx = o.x + o.w / 2;
          const cy = o.y + o.h / 2;
          return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
        })
        .map((o) => o.id);
      dispatch({ type: "SET_SELECTION", ids });
      setMarquee(null);
    }
    pointerRef.current = { mode: "none", startX: 0, startY: 0, startWorld: { x: 0, y: 0 } };
  }

  function toPixelDelta(delta: number, deltaMode: number): number {
    if (deltaMode === 1) return delta * 16;
    if (deltaMode === 2) return delta * size.h;
    return delta;
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const deltaY = toPixelDelta(e.deltaY, e.deltaMode);
      const factor = Math.exp(-deltaY * 0.002);
      const newZoom = Math.min(400, Math.max(5, viewport.zoom * factor));
      if (Math.abs(newZoom - viewport.zoom) < 0.0001) return;
      const wx = (sx - viewport.tx) / viewport.zoom;
      const wy = (sy - viewport.ty) / viewport.zoom;
      dispatch({ type: "SET_VIEWPORT", viewport: { zoom: newZoom, tx: sx - wx * newZoom, ty: sy - wy * newZoom } });
    } else {
      const deltaX = toPixelDelta(e.deltaX, e.deltaMode);
      const deltaY = toPixelDelta(e.deltaY, e.deltaMode);
      dispatch({ type: "SET_VIEWPORT", viewport: { tx: viewport.tx - deltaX, ty: viewport.ty - deltaY } });
    }
  }

  function onDragOver(e: React.DragEvent) {
    if (readOnly) return;
    if (
      e.dataTransfer.types.includes("application/x-prism-asset") ||
      e.dataTransfer.types.includes("application/x-prism-guest") ||
      e.dataTransfer.types.includes("application/x-prism-supplier")
    ) {
      e.preventDefault();
    }
  }
  function onDrop(e: React.DragEvent) {
    if (readOnly) {
      e.preventDefault();
      return;
    }
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const world = toWorld(sx, sy);

    const supplierId = e.dataTransfer.getData("application/x-prism-supplier");
    if (supplierId) {
      e.preventDefault();
      for (let i = project.objects.length - 1; i >= 0; i--) {
        const o = project.objects[i];
        if (o.hidden || o.locked) continue;
        if (hitTest(o, world.x, world.y)) {
          dispatch({ type: "ASSIGN_SUPPLIER", supplierId, objectId: o.id });
          dispatch({ type: "SET_SELECTION", ids: [o.id] });
          return;
        }
      }
      return;
    }

    const guestId = e.dataTransfer.getData("application/x-prism-guest");
    if (guestId) {
      e.preventDefault();
      for (let i = project.objects.length - 1; i >= 0; i--) {
        const o = project.objects[i];
        if (o.hidden || o.locked) continue;
        if (o.seats === undefined) continue;
        if (hitTest(o, world.x, world.y)) {
          dispatch({ type: "ASSIGN_GUEST", guestId, objectId: o.id });
          dispatch({ type: "SET_SELECTION", ids: [o.id] });
          return;
        }
      }
      return;
    }

    const assetId = e.dataTransfer.getData("application/x-prism-asset");
    if (!assetId) return;
    e.preventDefault();
    const asset = ASSETS.find((a) => a.id === assetId);
    if (!asset) return;
    const obj = assetToObject(asset, snapCoord(world.x), snapCoord(world.y));
    dispatch({ type: "ADD_OBJECT", obj });
  }

  const cursor =
    readOnly ? "grab" : tool === "hand" ? "grab" : tool === "rect" || tool === "ellipse" || tool === "line" ? "crosshair" : "default";

  return (
    <div ref={wrapRef} className="relative size-full overflow-hidden" onDragOver={onDragOver} onDrop={onDrop}>
      <canvas
        ref={canvasRef}
        style={{ width: size.w, height: size.h, cursor, display: "block", touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
      />
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-white/95 px-2.5 py-1 text-[11px] text-neutral-700 shadow-sm ring-1 ring-black/5 tabular-nums">
        <span className="text-neutral-400">x</span> {cursorWorld.x.toFixed(2)}m
        <span className="mx-1.5 text-neutral-300">·</span>
        <span className="text-neutral-400">y</span> {cursorWorld.y.toFixed(2)}m
      </div>
    </div>
  );
}
