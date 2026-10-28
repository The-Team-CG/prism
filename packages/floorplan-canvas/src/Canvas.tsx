import { useEffect, useRef, useState } from "react";
import { useEditor } from "./store";
import { paintCanvas, setupCanvas } from "./canvas-draw";
import { clientToLocal } from "./canvas-geometry";
import {
  IDLE_POINTER,
  canvasCursor,
  fittedViewport,
  handleCanvasDrop,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  hasCanvasDragType,
  wheelViewportPatch,
  type PointerState,
} from "./canvas-pointer";

export function Canvas({ readOnly = false }: { readOnly?: boolean }) {
  const { state, dispatch } = useEditor();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<PointerState>(IDLE_POINTER);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [cursorWorld, setCursorWorld] = useState({ x: 0, y: 0 });
  const { viewport, project, selectedIds, tool, snap, gridSize, hoveredId } = state;
  const session = { readOnly, tool, viewport, snap, gridSize, selectedIds, hoveredId, objects: project.objects };

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(() => {
      const rect = wrapRef.current!.getBoundingClientRect();
      setSize({ w: rect.width, h: rect.height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    dispatch({ type: "SET_CANVAS_SIZE", size });
  }, [size, dispatch]);

  const fittedRef = useRef(false);
  useEffect(() => {
    if (fittedRef.current) return;
    if (size.w < 100) return;
    fittedRef.current = true;
    dispatch({ type: "SET_VIEWPORT", viewport: fittedViewport(size, project) });
  }, [size, project.widthM, project.heightM, dispatch, project]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = setupCanvas(canvas, size);
    if (!ctx) return;
    paintCanvas(ctx, { size, viewport, project, selectedIds, hoveredId, gridSize, marquee });
  }, [size, viewport, project, selectedIds, hoveredId, gridSize, marquee]);

  function onPointerDown(e: React.PointerEvent) {
    if (!canvasRef.current) return;
    const result = handlePointerDown({
      ...session,
      button: e.button,
      altKey: e.altKey,
      shiftKey: e.shiftKey,
      clientX: e.clientX,
      clientY: e.clientY,
      canvas: canvasRef.current,
    });
    if (result.kind === "ignore") return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    result.actions.forEach(dispatch);
    pointerRef.current = result.pointer;
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!canvasRef.current) return;
    const { sx, sy } = clientToLocal(e, canvasRef.current);
    setCursorWorld({ x: (sx - viewport.tx) / viewport.zoom, y: (sy - viewport.ty) / viewport.zoom });
    const result = handlePointerMove({ ...session, pointer: pointerRef.current, sx, sy, shiftKey: e.shiftKey });
    if (result.pointer) pointerRef.current = result.pointer;
    if (result.marquee !== undefined) setMarquee(result.marquee);
    result.actions.forEach(dispatch);
  }

  function onPointerUp() {
    const result = handlePointerUp({
      readOnly,
      pointer: pointerRef.current,
      marquee,
      objects: project.objects,
      viewport,
    });
    result.actions.forEach(dispatch);
    if (result.clearMarquee) setMarquee(null);
    pointerRef.current = IDLE_POINTER;
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    if (!canvasRef.current) return;
    const patch = wheelViewportPatch(e, canvasRef.current, viewport, size.h);
    if (patch) dispatch({ type: "SET_VIEWPORT", viewport: patch });
  }

  function onDragOver(e: React.DragEvent) {
    if (readOnly) return;
    if (hasCanvasDragType(e.dataTransfer.types)) e.preventDefault();
  }

  function onDrop(e: React.DragEvent) {
    if (!canvasRef.current) return;
    const result = handleCanvasDrop({
      readOnly,
      clientX: e.clientX,
      clientY: e.clientY,
      canvas: canvasRef.current,
      viewport,
      objects: project.objects,
      snap,
      gridSize,
      getData: (type) => e.dataTransfer.getData(type),
    });
    if (result.prevent) e.preventDefault();
    result.actions.forEach(dispatch);
  }

  return (
    <div ref={wrapRef} className="relative size-full overflow-hidden" onDragOver={onDragOver} onDrop={onDrop}>
      <canvas
        ref={canvasRef}
        style={{ width: size.w, height: size.h, cursor: canvasCursor(tool, readOnly), display: "block", touchAction: "none" }}
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
