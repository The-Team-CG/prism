import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import type { CanvasObject, EditorState, Project } from "./types";
import { reducer, type Action } from "./editor-reducer";
import { handleEditorKey } from "./editor-shortcuts";

export type { Action };

export function initialState(project: Project): EditorState {
  const p = {
    ...project,
    guests: project.guests ?? [],
    suppliers: project.suppliers ?? [],
  };
  return {
    project: p as Project,
    viewport: { tx: 0, ty: 0, zoom: 30 },
    selectedIds: [],
    tool: "select",
    hoveredId: null,
    history: { past: [], future: [] },
    clipboard: null,
    gridSize: 0.5,
    snap: true,
    assignmentRejection: null,
  };
}

interface Ctx {
  state: EditorState;
  dispatch: React.Dispatch<Action>;
}

const EditorCtx = createContext<Ctx | null>(null);

export function EditorProvider({ project, children }: { project: Project; children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState(project));

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <EditorCtx.Provider value={value}>{children}</EditorCtx.Provider>;
}

export function useEditor() {
  const ctx = useContext(EditorCtx);
  if (!ctx) throw new Error("useEditor outside provider");
  return ctx;
}

export function useSelected(): CanvasObject[] {
  const { state } = useEditor();
  return state.project.objects.filter((o) => state.selectedIds.includes(o.id));
}

export function useKeyboard(disabled = false) {
  const { state, dispatch } = useEditor();
  const stateRef = useRef(state);
  stateRef.current = state;

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (disabled) return;
      handleEditorKey(e, dispatch, () => stateRef.current);
    },
    [disabled, dispatch],
  );

  useEffect(() => {
    if (disabled) return;
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled, onKey]);
}
