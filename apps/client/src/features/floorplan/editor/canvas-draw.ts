import type { CanvasObject, Project, Viewport } from "./types";
import { RULER_SIZE, visibleWorldBounds, type WorldBounds } from "./canvas-geometry";

export interface CanvasScene {
  size: { w: number; h: number };
  viewport: Viewport;
  project: Project;
  selectedIds: string[];
  hoveredId: string | null;
  gridSize: number;
  marquee: { x: number; y: number; w: number; h: number } | null;
}

export function setupCanvas(
  canvas: HTMLCanvasElement,
  size: { w: number; h: number },
): CanvasRenderingContext2D | null {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = size.w * dpr;
  canvas.height = size.h * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function fillWorkspaceBackground(ctx: CanvasRenderingContext2D, size: { w: number; h: number }) {
  const bgGrad = ctx.createLinearGradient(0, 0, 0, size.h);
  bgGrad.addColorStop(0, "#FFF8F2");
  bgGrad.addColorStop(1, "#FFF0E6");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, size.w, size.h);
}

function drawMinorGrid(
  ctx: CanvasRenderingContext2D,
  bounds: WorldBounds,
  gridSize: number,
  zoom: number,
) {
  ctx.lineWidth = 1 / zoom;
  ctx.strokeStyle = "#EAD5CE";
  ctx.beginPath();
  const sxMinor = Math.floor(bounds.left / gridSize) * gridSize;
  const syMinor = Math.floor(bounds.top / gridSize) * gridSize;
  for (let x = sxMinor; x <= bounds.right; x += gridSize) {
    if (Math.abs(x - Math.round(x)) < 0.001) continue;
    ctx.moveTo(x, bounds.top);
    ctx.lineTo(x, bounds.bot);
  }
  for (let y = syMinor; y <= bounds.bot; y += gridSize) {
    if (Math.abs(y - Math.round(y)) < 0.001) continue;
    ctx.moveTo(bounds.left, y);
    ctx.lineTo(bounds.right, y);
  }
  ctx.stroke();
}

function drawMajorGrid(ctx: CanvasRenderingContext2D, bounds: WorldBounds) {
  ctx.strokeStyle = "#CCECF4";
  ctx.beginPath();
  const sxMajor = Math.ceil(bounds.left);
  const syMajor = Math.ceil(bounds.top);
  for (let x = sxMajor; x <= bounds.right; x += 1) {
    ctx.moveTo(x, bounds.top);
    ctx.lineTo(x, bounds.bot);
  }
  for (let y = syMajor; y <= bounds.bot; y += 1) {
    ctx.moveTo(bounds.left, y);
    ctx.lineTo(bounds.right, y);
  }
  ctx.stroke();
}

function drawOriginCrosshair(ctx: CanvasRenderingContext2D, bounds: WorldBounds, zoom: number) {
  ctx.strokeStyle = "rgba(192,24,103,0.2)";
  ctx.lineWidth = 1 / zoom;
  ctx.beginPath();
  ctx.moveTo(bounds.left, 0);
  ctx.lineTo(bounds.right, 0);
  ctx.moveTo(0, bounds.top);
  ctx.lineTo(0, bounds.bot);
  ctx.stroke();
}

function shouldDrawSeats(o: CanvasObject): boolean {
  if (!o.seats) return false;
  if (o.seats <= 0) return false;
  return Math.min(o.w, o.h) > 1;
}

function paintSeatDot(ctx: CanvasRenderingContext2D, o: CanvasObject, i: number, taken: number) {
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

function drawOneSeat(
  ctx: CanvasRenderingContext2D,
  o: CanvasObject,
  i: number,
  n: number,
  taken: number,
) {
  const a = (i / n) * Math.PI * 2 - Math.PI / 2;
  const rx = o.w / 2 + 0.18;
  const ry = o.h / 2 + 0.18;
  const sx = o.w / 2 + Math.cos(a) * rx;
  const sy = o.h / 2 + Math.sin(a) * ry;
  ctx.beginPath();
  ctx.arc(sx, sy, 0.13, 0, Math.PI * 2);
  paintSeatDot(ctx, o, i, taken);
}

function drawEllipseSeats(ctx: CanvasRenderingContext2D, o: CanvasObject) {
  if (!shouldDrawSeats(o)) return;
  const n = Math.min(o.seats!, 12);
  const taken = (o.assignedGuestIds ?? []).length;
  for (let i = 0; i < n; i++) {
    drawOneSeat(ctx, o, i, n, taken);
  }
}

function drawEllipse(ctx: CanvasRenderingContext2D, o: CanvasObject) {
  ctx.beginPath();
  ctx.ellipse(o.w / 2, o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  drawEllipseSeats(ctx, o);
}

function drawLine(ctx: CanvasRenderingContext2D, o: CanvasObject) {
  ctx.beginPath();
  ctx.moveTo(0, o.h / 2);
  ctx.lineTo(o.w, o.h / 2);
  ctx.lineWidth = Math.max(o.strokeWidth, o.h);
  ctx.strokeStyle = o.stroke;
  ctx.stroke();
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, o: CanvasObject) {
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

function drawShape(ctx: CanvasRenderingContext2D, o: CanvasObject) {
  if (o.kind === "ellipse") {
    drawEllipse(ctx, o);
    return;
  }
  if (o.kind === "line") {
    drawLine(ctx, o);
    return;
  }
  drawRoundedRect(ctx, o);
}

function drawObjectLabel(ctx: CanvasRenderingContext2D, o: CanvasObject) {
  if (!o.label) return;
  if (o.w <= 0.6) return;
  if (o.h <= 0.4) return;
  ctx.fillStyle = "#C01867";
  const fs = Math.min(o.w, o.h) * 0.26;
  ctx.font = `500 ${fs}px ui-sans-serif, system-ui, -apple-system`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(o.label, o.w / 2, o.h / 2);
}

function drawObject(ctx: CanvasRenderingContext2D, o: CanvasObject) {
  ctx.save();
  const cx = o.x + o.w / 2;
  const cy = o.y + o.h / 2;
  ctx.translate(cx, cy);
  ctx.rotate(o.rotation);
  ctx.translate(-o.w / 2, -o.h / 2);
  ctx.fillStyle = o.fill;
  ctx.strokeStyle = o.stroke;
  ctx.lineWidth = o.strokeWidth;
  drawShape(ctx, o);
  drawObjectLabel(ctx, o);
  ctx.restore();
}

function drawAllObjects(ctx: CanvasRenderingContext2D, objects: CanvasObject[]) {
  for (const o of objects) {
    if (o.hidden) continue;
    drawObject(ctx, o);
  }
}

function drawHoverOutline(ctx: CanvasRenderingContext2D, scene: CanvasScene) {
  if (!scene.hoveredId) return;
  if (scene.selectedIds.includes(scene.hoveredId)) return;
  const o = scene.project.objects.find((x) => x.id === scene.hoveredId);
  if (!o) return;
  ctx.save();
  ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
  ctx.rotate(o.rotation);
  ctx.strokeStyle = "#40A0D0";
  ctx.lineWidth = 1 / scene.viewport.zoom;
  ctx.strokeRect(-o.w / 2, -o.h / 2, o.w, o.h);
  ctx.restore();
}

function drawSelectionHandles(ctx: CanvasRenderingContext2D, o: CanvasObject, zoom: number) {
  const hs = 7 / zoom;
  const handles: [number, number][] = [
    [-o.w / 2, -o.h / 2],
    [0, -o.h / 2],
    [o.w / 2, -o.h / 2],
    [-o.w / 2, 0],
    [o.w / 2, 0],
    [-o.w / 2, o.h / 2],
    [0, o.h / 2],
    [o.w / 2, o.h / 2],
  ];
  ctx.fillStyle = "#FFFFFF";
  ctx.lineWidth = 1.5 / zoom;
  for (const [hx, hy] of handles) {
    ctx.beginPath();
    ctx.rect(hx - hs / 2, hy - hs / 2, hs, hs);
    ctx.fill();
    ctx.stroke();
  }
}

function drawRotateHandle(ctx: CanvasRenderingContext2D, o: CanvasObject, zoom: number) {
  ctx.beginPath();
  ctx.moveTo(0, -o.h / 2);
  ctx.lineTo(0, -o.h / 2 - 18 / zoom);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -o.h / 2 - 22 / zoom, 5 / zoom, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawDimensionLabel(ctx: CanvasRenderingContext2D, o: CanvasObject, zoom: number) {
  const dimFs = 11 / zoom;
  const dimText = `${o.w.toFixed(2)} × ${o.h.toFixed(2)} m`;
  ctx.font = `500 ${dimFs}px ui-sans-serif, system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const tw = ctx.measureText(dimText).width;
  const pad = 4 / zoom;
  const by = o.h / 2 + 10 / zoom;
  ctx.fillStyle = "#40A0D0";
  const rY = by;
  const rX = -tw / 2 - pad;
  const rW = tw + pad * 2;
  const rH = dimFs + pad * 1.2;
  const rr = 3 / zoom;
  ctx.beginPath();
  ctx.moveTo(rX + rr, rY);
  ctx.arcTo(rX + rW, rY, rX + rW, rY + rH, rr);
  ctx.arcTo(rX + rW, rY + rH, rX, rY + rH, rr);
  ctx.arcTo(rX, rY + rH, rX, rY, rr);
  ctx.arcTo(rX, rY, rX + rW, rY, rr);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(dimText, 0, by + pad * 0.6);
}

function drawSelection(ctx: CanvasRenderingContext2D, o: CanvasObject, zoom: number) {
  ctx.save();
  ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
  ctx.rotate(o.rotation);
  ctx.strokeStyle = "#40A0D0";
  ctx.lineWidth = 1.5 / zoom;
  ctx.strokeRect(-o.w / 2, -o.h / 2, o.w, o.h);
  drawSelectionHandles(ctx, o, zoom);
  drawRotateHandle(ctx, o, zoom);
  drawDimensionLabel(ctx, o, zoom);
  ctx.restore();
}

function drawAllSelections(ctx: CanvasRenderingContext2D, scene: CanvasScene) {
  for (const id of scene.selectedIds) {
    const o = scene.project.objects.find((x) => x.id === id);
    if (!o) continue;
    drawSelection(ctx, o, scene.viewport.zoom);
  }
}

function drawSupplierBadge(
  ctx: CanvasRenderingContext2D,
  o: CanvasObject,
  viewport: Viewport,
  count: number,
) {
  const cx = o.x + o.w / 2;
  const cy = o.y - o.h / 2;
  const sxp = (o.x + o.w) * viewport.zoom + viewport.tx;
  const syp = o.y * viewport.zoom + viewport.ty;
  void cx;
  void cy;
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

function drawSupplierBadges(
  ctx: CanvasRenderingContext2D,
  objects: CanvasObject[],
  viewport: Viewport,
) {
  for (const o of objects) {
    if (o.hidden) continue;
    const count = (o.assignedSupplierIds ?? []).length;
    if (count === 0) continue;
    drawSupplierBadge(ctx, o, viewport, count);
  }
}

function capacityFill(taken: number, cap: number): string {
  if (taken >= cap) return "#B4233A";
  if (taken > 0) return "#C01867";
  return "#62535C";
}

function drawCapacityChip(ctx: CanvasRenderingContext2D, o: CanvasObject, viewport: Viewport) {
  const taken = (o.assignedGuestIds ?? []).length;
  const cap = o.seats!;
  const cx = o.x + o.w / 2;
  const cy = o.y + o.h / 2;
  const sxp = cx * viewport.zoom + viewport.tx;
  const syp = (cy - o.h / 2) * viewport.zoom + viewport.ty - 10;
  const txt = `${taken}/${cap}`;
  ctx.font = `600 10px ui-sans-serif, system-ui`;
  const tw = ctx.measureText(txt).width;
  const padX = 5;
  const w = tw + padX * 2;
  const h = 14;
  const x = sxp - w / 2;
  const y = syp - h;
  ctx.fillStyle = capacityFill(taken, cap);
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

function drawCapacityChips(
  ctx: CanvasRenderingContext2D,
  objects: CanvasObject[],
  viewport: Viewport,
) {
  for (const o of objects) {
    if (o.hidden) continue;
    if (o.seats === undefined) continue;
    if (o.seats <= 0) continue;
    drawCapacityChip(ctx, o, viewport);
  }
}

function niceStep(desired: number) {
  const pow = Math.pow(10, Math.floor(Math.log10(desired)));
  const mantissa = desired / pow;
  if (mantissa < 1.5) return 1 * pow;
  if (mantissa < 3) return 2 * pow;
  if (mantissa < 7) return 5 * pow;
  return 10 * pow;
}

function round2(n: number) {
  if (Math.abs(n) < 0.001) return 0;
  return Number(n.toFixed(2));
}

function drawRulerChrome(ctx: CanvasRenderingContext2D, w: number, h: number) {
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
  ctx.fillStyle = "#FFF8F2";
  ctx.fillRect(0, 0, RULER_SIZE, RULER_SIZE);
  ctx.fillStyle = "#62535C";
  ctx.font = "10px ui-sans-serif, system-ui";
  ctx.textBaseline = "middle";
}

function drawTopRulerTicks(ctx: CanvasRenderingContext2D, w: number, v: Viewport, step: number) {
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
}

function drawLeftRulerTicks(ctx: CanvasRenderingContext2D, h: number, v: Viewport, step: number) {
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

function drawRulers(ctx: CanvasRenderingContext2D, w: number, h: number, v: Viewport) {
  drawRulerChrome(ctx, w, h);
  const step = niceStep(60 / v.zoom);
  drawTopRulerTicks(ctx, w, v, step);
  drawLeftRulerTicks(ctx, h, v, step);
}

function drawMarquee(
  ctx: CanvasRenderingContext2D,
  marquee: CanvasScene["marquee"],
) {
  if (!marquee) return;
  ctx.fillStyle = "rgba(64,160,208,0.08)";
  ctx.strokeStyle = "#40A0D0";
  ctx.lineWidth = 1;
  ctx.fillRect(marquee.x, marquee.y, marquee.w, marquee.h);
  ctx.strokeRect(marquee.x, marquee.y, marquee.w, marquee.h);
}

export function paintCanvas(ctx: CanvasRenderingContext2D, scene: CanvasScene) {
  fillWorkspaceBackground(ctx, scene.size);
  ctx.save();
  ctx.translate(scene.viewport.tx, scene.viewport.ty);
  ctx.scale(scene.viewport.zoom, scene.viewport.zoom);
  const bounds = visibleWorldBounds(scene.size, scene.viewport);
  drawMinorGrid(ctx, bounds, scene.gridSize, scene.viewport.zoom);
  drawMajorGrid(ctx, bounds);
  drawOriginCrosshair(ctx, bounds, scene.viewport.zoom);
  drawAllObjects(ctx, scene.project.objects);
  drawHoverOutline(ctx, scene);
  drawAllSelections(ctx, scene);
  ctx.restore();
  drawSupplierBadges(ctx, scene.project.objects, scene.viewport);
  drawCapacityChips(ctx, scene.project.objects, scene.viewport);
  drawRulers(ctx, scene.size.w, scene.size.h, scene.viewport);
  drawMarquee(ctx, scene.marquee);
}
