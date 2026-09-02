import type { Dispatch } from "react";
import type { Action } from "./editor-reducer";
import type { EditorState, Tool } from "./types";

type ShortcutRun = (
  e: KeyboardEvent,
  dispatch: Dispatch<Action>,
  getState: () => EditorState,
) => void;

interface Shortcut {
  match: (e: KeyboardEvent, meta: boolean) => boolean;
  run: ShortcutRun;
}

const TOOL_BY_KEY: Record<string, Tool> = {
  v: "select",
  V: "select",
  h: "hand",
  H: "hand",
  r: "rect",
  R: "rect",
  o: "ellipse",
  O: "ellipse",
  l: "line",
  L: "line",
};

function isMetaPressed(e: KeyboardEvent): boolean {
  return e.metaKey || e.ctrlKey;
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target) return false;
  const el = target as HTMLElement;
  if (el.tagName === "INPUT") return true;
  if (el.tagName === "TEXTAREA") return true;
  return Boolean(el.isContentEditable);
}

function keyLetter(e: KeyboardEvent, letter: string): boolean {
  return e.key.toLowerCase() === letter;
}

function matchUndo(e: KeyboardEvent, meta: boolean): boolean {
  if (!meta) return false;
  if (!keyLetter(e, "z")) return false;
  return !e.shiftKey;
}

function matchRedo(e: KeyboardEvent, meta: boolean): boolean {
  if (!meta) return false;
  if (keyLetter(e, "y")) return true;
  if (!keyLetter(e, "z")) return false;
  return e.shiftKey;
}

function matchMetaLetter(letter: string) {
  return (e: KeyboardEvent, meta: boolean) => meta && keyLetter(e, letter);
}

function matchDelete(e: KeyboardEvent): boolean {
  return e.key === "Delete" || e.key === "Backspace";
}

function matchTool(e: KeyboardEvent): boolean {
  return Boolean(TOOL_BY_KEY[e.key]);
}

function matchEscape(e: KeyboardEvent): boolean {
  return e.key === "Escape";
}

function matchArrow(key: string) {
  return (e: KeyboardEvent) => e.key === key;
}

function nudgeAmount(shift: boolean): number {
  if (shift) return 1;
  return 0.1;
}

function runDelete(e: KeyboardEvent, dispatch: Dispatch<Action>, getState: () => EditorState) {
  if (getState().selectedIds.length === 0) return;
  e.preventDefault();
  dispatch({ type: "DELETE_SELECTION" });
}

function runTool(e: KeyboardEvent, dispatch: Dispatch<Action>) {
  const tool = TOOL_BY_KEY[e.key];
  if (!tool) return;
  dispatch({ type: "SET_TOOL", tool });
}

function runNudge(
  e: KeyboardEvent,
  dispatch: Dispatch<Action>,
  dx: number,
  dy: number,
) {
  const step = nudgeAmount(e.shiftKey);
  dispatch({ type: "MOVE_SELECTION", dx: dx * step, dy: dy * step });
}

const SHORTCUTS: Shortcut[] = [
  {
    match: matchUndo,
    run(e, dispatch) {
      e.preventDefault();
      dispatch({ type: "UNDO" });
    },
  },
  {
    match: matchRedo,
    run(e, dispatch) {
      e.preventDefault();
      dispatch({ type: "REDO" });
    },
  },
  {
    match: matchMetaLetter("d"),
    run(e, dispatch) {
      e.preventDefault();
      dispatch({ type: "DUPLICATE_SELECTION" });
    },
  },
  {
    match: matchMetaLetter("c"),
    run(_e, dispatch) {
      dispatch({ type: "COPY" });
    },
  },
  {
    match: matchMetaLetter("v"),
    run(_e, dispatch) {
      dispatch({ type: "PASTE" });
    },
  },
  {
    match: matchMetaLetter("a"),
    run(e, dispatch, getState) {
      e.preventDefault();
      dispatch({ type: "SET_SELECTION", ids: getState().project.objects.map((o) => o.id) });
    },
  },
  { match: matchDelete, run: runDelete },
  { match: matchTool, run: runTool },
  {
    match: matchEscape,
    run(_e, dispatch) {
      dispatch({ type: "SET_SELECTION", ids: [] });
    },
  },
  {
    match: matchArrow("ArrowLeft"),
    run(e, dispatch) {
      runNudge(e, dispatch, -1, 0);
    },
  },
  {
    match: matchArrow("ArrowRight"),
    run(e, dispatch) {
      runNudge(e, dispatch, 1, 0);
    },
  },
  {
    match: matchArrow("ArrowUp"),
    run(e, dispatch) {
      runNudge(e, dispatch, 0, -1);
    },
  },
  {
    match: matchArrow("ArrowDown"),
    run(e, dispatch) {
      runNudge(e, dispatch, 0, 1);
    },
  },
];

export function handleEditorKey(
  e: KeyboardEvent,
  dispatch: Dispatch<Action>,
  getState: () => EditorState,
): void {
  if (isTypingTarget(e.target)) return;
  const meta = isMetaPressed(e);
  const shortcut = SHORTCUTS.find((item) => item.match(e, meta));
  if (!shortcut) return;
  shortcut.run(e, dispatch, getState);
}
