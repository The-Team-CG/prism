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
import type {
  CanvasObject,
  EditorState,
  Guest,
  Project,
  RSVP,
  Supplier,
  Tool,
  Viewport,
} from "./types";
import { uid } from "./assetLibrary";

type Action =
  | { type: "SET_TOOL"; tool: Tool }
  | { type: "SET_VIEWPORT"; viewport: Partial<Viewport> }
  | { type: "ADD_OBJECT"; obj: CanvasObject; select?: boolean }
  | { type: "ADD_OBJECTS"; objs: CanvasObject[]; replace?: boolean }
  | { type: "UPDATE_OBJECT"; id: string; patch: Partial<CanvasObject> }
  | { type: "UPDATE_OBJECTS"; patches: { id: string; patch: Partial<CanvasObject> }[] }
  | { type: "DELETE_SELECTION" }
  | { type: "SET_SELECTION"; ids: string[] }
  | { type: "ADD_SELECTION"; id: string }
  | { type: "HOVER"; id: string | null }
  | { type: "DUPLICATE_SELECTION" }
  | { type: "MOVE_SELECTION"; dx: number; dy: number }
  | { type: "REORDER"; id: string; to: number }
  | { type: "UPDATE_PROJECT"; patch: Partial<Project> }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "COPY" }
  | { type: "PASTE" }
  | { type: "TOGGLE_SNAP" }
  | { type: "ADD_GUEST"; guest: Guest }
  | { type: "UPDATE_GUEST"; id: string; patch: Partial<Guest> }
  | { type: "DELETE_GUEST"; id: string }
  | { type: "ASSIGN_GUEST"; guestId: string; objectId: string }
  | { type: "UNASSIGN_GUEST"; guestId: string }
  | { type: "ADD_SUPPLIER"; supplier: Supplier }
  | { type: "UPDATE_SUPPLIER"; id: string; patch: Partial<Supplier> }
  | { type: "DELETE_SUPPLIER"; id: string }
  | { type: "ASSIGN_SUPPLIER"; supplierId: string; objectId: string }
  | { type: "UNASSIGN_SUPPLIER"; supplierId: string; objectId: string }
  | {
      type: "APPLY_TEMPLATE";
      patch: Partial<Pick<Project, "widthM" | "heightM" | "pax" | "venue">>;
      objects: CanvasObject[];
      guests?: Guest[];
      suppliers?: Supplier[];
    }
  | { type: "LOAD"; state: EditorState };

function newProject(): Project {
  return {
    id: uid("proj"),
    name: "Untitled Floor Plan",
    venue: "Venue A — Ballroom",
    widthM: 30,
    heightM: 20,
    pax: 120,
    objects: [],
    guests: seedGuests(),
    suppliers: seedSuppliers(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function seedGuests(): Guest[] {
  const raw: [string, RSVP, string, string?][] = [
    ["Amelia Chen", "confirmed", "Keynote", "Vegan"],
    ["Marcus Patel", "confirmed", "Keynote"],
    ["Joy Ramirez", "confirmed", "Stylist team"],
    ["Kent Park", "confirmed", "Client — PMCM"],
    ["Sofia Alvarez", "pending", "Sponsor · Atrium"],
    ["Diego Santos", "confirmed", "Sponsor · Atrium", "Gluten-free"],
    ["Priya Kulkarni", "confirmed", "Press"],
    ["Rohan Mehta", "pending", "Press"],
    ["Claire Dubois", "confirmed", "VIP"],
    ["Olu Adeyemi", "declined", "VIP"],
    ["Hana Watanabe", "confirmed", "Crew"],
    ["Liam O'Connor", "confirmed", "Crew"],
    ["Nora Haugen", "pending", "Plus-ones"],
    ["Theo Bianchi", "confirmed", "Plus-ones"],
  ];
  return raw.map(([name, rsvp, group, dietary], i) => ({
    id: `g_seed_${i}`,
    name,
    rsvp,
    group,
    dietary,
  }));
}

function seedSuppliers(): Supplier[] {
  const raw: [string, Supplier["kind"], Supplier["status"], string][] = [
    ["Chef Margarita Catering", "catering", "confirmed", "margarita@cmc.ph"],
    ["Sound Republic AV", "av", "booked", "ops@soundrepublic.co"],
    ["Bloom Atelier", "floral", "confirmed", "hello@bloomatelier.ph"],
    ["Summit Stages", "staging", "proposed", "bookings@summitstages.com"],
    ["Perimeter Security Co.", "security", "booked", "dispatch@perimeter.ph"],
    ["Lumière Rentals", "rental", "confirmed", "rent@lumiere.ph"],
    ["Frame & Field Photography", "photography", "proposed", "studio@frameandfield.co"],
  ];
  return raw.map(([name, kind, status, contact], i) => ({
    id: `s_seed_${i}`,
    name,
    kind,
    status,
    contact,
  }));
}


export function initialState(project?: Project): EditorState {
  const p = project
    ? {
        ...project,
        guests: project.guests ?? seedGuests(),
        suppliers: project.suppliers ?? seedSuppliers(),
      }
    : newProject();
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
  };
}

function pushHistory(state: EditorState): EditorState {
  return {
    ...state,
    history: {
      past: [...state.history.past.slice(-49), state.project],
      future: [],
    },
  };
}

function touch(p: Project): Project {
  return { ...p, updatedAt: Date.now() };
}

function reducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case "SET_TOOL":
      return { ...state, tool: action.tool };
    case "SET_VIEWPORT":
      return { ...state, viewport: { ...state.viewport, ...action.viewport } };
    case "HOVER":
      return { ...state, hoveredId: action.id };
    case "SET_SELECTION":
      return { ...state, selectedIds: action.ids };
    case "ADD_SELECTION":
      return {
        ...state,
        selectedIds: state.selectedIds.includes(action.id)
          ? state.selectedIds.filter((i) => i !== action.id)
          : [...state.selectedIds, action.id],
      };
    case "ADD_OBJECT": {
      const s = pushHistory(state);
      return {
        ...s,
        project: touch({ ...s.project, objects: [...s.project.objects, action.obj] }),
        selectedIds: action.select === false ? s.selectedIds : [action.obj.id],
      };
    }
    case "ADD_OBJECTS": {
      const s = pushHistory(state);
      const objects = action.replace ? action.objs : [...s.project.objects, ...action.objs];
      return {
        ...s,
        project: touch({ ...s.project, objects }),
        selectedIds: [],
      };
    }
    case "UPDATE_OBJECT": {
      const s = pushHistory(state);
      return {
        ...s,
        project: touch({
          ...s.project,
          objects: s.project.objects.map((o) =>
            o.id === action.id ? { ...o, ...action.patch } : o,
          ),
        }),
      };
    }
    case "UPDATE_OBJECTS": {
      const s = pushHistory(state);
      const map = new Map(action.patches.map((p) => [p.id, p.patch]));
      return {
        ...s,
        project: touch({
          ...s.project,
          objects: s.project.objects.map((o) => (map.has(o.id) ? { ...o, ...map.get(o.id)! } : o)),
        }),
      };
    }
    case "MOVE_SELECTION": {
      if (state.selectedIds.length === 0) return state;
      const s = pushHistory(state);
      const ids = new Set(s.selectedIds);
      return {
        ...s,
        project: touch({
          ...s.project,
          objects: s.project.objects.map((o) =>
            ids.has(o.id) ? { ...o, x: o.x + action.dx, y: o.y + action.dy } : o,
          ),
        }),
      };
    }
    case "DELETE_SELECTION": {
      if (state.selectedIds.length === 0) return state;
      const s = pushHistory(state);
      const ids = new Set(s.selectedIds);
      return {
        ...s,
        project: touch({ ...s.project, objects: s.project.objects.filter((o) => !ids.has(o.id)) }),
        selectedIds: [],
      };
    }
    case "DUPLICATE_SELECTION": {
      if (state.selectedIds.length === 0) return state;
      const s = pushHistory(state);
      const ids = new Set(s.selectedIds);
      const copies: CanvasObject[] = [];
      const newIds: string[] = [];
      s.project.objects.forEach((o) => {
        if (ids.has(o.id)) {
          const nid = uid("dup");
          copies.push({ ...o, id: nid, x: o.x + 0.5, y: o.y + 0.5 });
          newIds.push(nid);
        }
      });
      return {
        ...s,
        project: touch({ ...s.project, objects: [...s.project.objects, ...copies] }),
        selectedIds: newIds,
      };
    }
    case "COPY":
      if (state.selectedIds.length === 0) return state;
      return {
        ...state,
        clipboard: state.project.objects.filter((o) => state.selectedIds.includes(o.id)),
      };
    case "PASTE": {
      if (!state.clipboard || state.clipboard.length === 0) return state;
      const s = pushHistory(state);
      const copies: CanvasObject[] = [];
      const newIds: string[] = [];
      s.clipboard!.forEach((o) => {
        const nid = uid("paste");
        copies.push({ ...o, id: nid, x: o.x + 0.8, y: o.y + 0.8 });
        newIds.push(nid);
      });
      return {
        ...s,
        project: touch({ ...s.project, objects: [...s.project.objects, ...copies] }),
        selectedIds: newIds,
      };
    }
    case "REORDER": {
      const s = pushHistory(state);
      const objs = [...s.project.objects];
      const idx = objs.findIndex((o) => o.id === action.id);
      if (idx === -1) return state;
      const [item] = objs.splice(idx, 1);
      objs.splice(action.to, 0, item);
      return { ...s, project: touch({ ...s.project, objects: objs }) };
    }
    case "UPDATE_PROJECT": {
      const s = pushHistory(state);
      return { ...s, project: touch({ ...s.project, ...action.patch }) };
    }
    case "UNDO": {
      if (state.history.past.length === 0) return state;
      const prev = state.history.past[state.history.past.length - 1];
      return {
        ...state,
        project: prev,
        history: {
          past: state.history.past.slice(0, -1),
          future: [state.project, ...state.history.future],
        },
      };
    }
    case "REDO": {
      if (state.history.future.length === 0) return state;
      const next = state.history.future[0];
      return {
        ...state,
        project: next,
        history: {
          past: [...state.history.past, state.project],
          future: state.history.future.slice(1),
        },
      };
    }
    case "TOGGLE_SNAP":
      return { ...state, snap: !state.snap };
    case "ADD_GUEST": {
      const s = pushHistory(state);
      return {
        ...s,
        project: touch({ ...s.project, guests: [...s.project.guests, action.guest] }),
      };
    }
    case "UPDATE_GUEST": {
      const s = pushHistory(state);
      return {
        ...s,
        project: touch({
          ...s.project,
          guests: s.project.guests.map((g) => (g.id === action.id ? { ...g, ...action.patch } : g)),
        }),
      };
    }
    case "DELETE_GUEST": {
      const s = pushHistory(state);
      return {
        ...s,
        project: touch({
          ...s.project,
          guests: s.project.guests.filter((g) => g.id !== action.id),
          objects: s.project.objects.map((o) =>
            o.assignedGuestIds?.includes(action.id)
              ? { ...o, assignedGuestIds: o.assignedGuestIds.filter((gid) => gid !== action.id) }
              : o,
          ),
        }),
      };
    }
    case "ASSIGN_GUEST": {
      const s = pushHistory(state);
      return {
        ...s,
        project: touch({
          ...s.project,
          objects: s.project.objects.map((o) => {
            const without = (o.assignedGuestIds ?? []).filter((gid) => gid !== action.guestId);
            if (o.id === action.objectId) {
              const cap = o.seats ?? Infinity;
              if (without.length >= cap) return { ...o, assignedGuestIds: without };
              return { ...o, assignedGuestIds: [...without, action.guestId] };
            }
            return { ...o, assignedGuestIds: without };
          }),
        }),
      };
    }
    case "UNASSIGN_GUEST": {
      const s = pushHistory(state);
      return {
        ...s,
        project: touch({
          ...s.project,
          objects: s.project.objects.map((o) =>
            o.assignedGuestIds?.includes(action.guestId)
              ? { ...o, assignedGuestIds: o.assignedGuestIds.filter((gid) => gid !== action.guestId) }
              : o,
          ),
        }),
      };
    }
    case "ADD_SUPPLIER": {
      const s = pushHistory(state);
      return {
        ...s,
        project: touch({ ...s.project, suppliers: [...s.project.suppliers, action.supplier] }),
      };
    }
    case "UPDATE_SUPPLIER": {
      const s = pushHistory(state);
      return {
        ...s,
        project: touch({
          ...s.project,
          suppliers: s.project.suppliers.map((sup) =>
            sup.id === action.id ? { ...sup, ...action.patch } : sup,
          ),
        }),
      };
    }
    case "DELETE_SUPPLIER": {
      const s = pushHistory(state);
      return {
        ...s,
        project: touch({
          ...s.project,
          suppliers: s.project.suppliers.filter((sup) => sup.id !== action.id),
          objects: s.project.objects.map((o) =>
            o.assignedSupplierIds?.includes(action.id)
              ? { ...o, assignedSupplierIds: o.assignedSupplierIds.filter((sid) => sid !== action.id) }
              : o,
          ),
        }),
      };
    }
    case "ASSIGN_SUPPLIER": {
      const s = pushHistory(state);
      return {
        ...s,
        project: touch({
          ...s.project,
          objects: s.project.objects.map((o) => {
            if (o.id !== action.objectId) return o;
            const current = o.assignedSupplierIds ?? [];
            if (current.includes(action.supplierId)) return o;
            return { ...o, assignedSupplierIds: [...current, action.supplierId] };
          }),
        }),
      };
    }
    case "UNASSIGN_SUPPLIER": {
      const s = pushHistory(state);
      return {
        ...s,
        project: touch({
          ...s.project,
          objects: s.project.objects.map((o) =>
            o.id === action.objectId && o.assignedSupplierIds
              ? { ...o, assignedSupplierIds: o.assignedSupplierIds.filter((sid) => sid !== action.supplierId) }
              : o,
          ),
        }),
      };
    }
    case "APPLY_TEMPLATE": {
      const s = pushHistory(state);
      return {
        ...s,
        project: touch({
          ...s.project,
          ...action.patch,
          objects: action.objects,
          guests: action.guests ?? s.project.guests,
          suppliers: action.suppliers ?? s.project.suppliers,
        }),
        selectedIds: [],
      };
    }
    case "LOAD":
      return action.state;
    default:
      return state;
  }
}

interface Ctx {
  state: EditorState;
  dispatch: React.Dispatch<Action>;
}

const EditorCtx = createContext<Ctx | null>(null);

const STORAGE_KEY = "prism.editor.v1";

export function EditorProvider({ project, children }: { project?: Project; children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState(project));
  const loadedRef = useRef(false);

  // Load on mount
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    if (project) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Project;
        if (!p.guests) p.guests = seedGuests();
        if (!p.suppliers) p.suppliers = seedSuppliers();
        dispatch({ type: "LOAD", state: initialState(p) });
      }
    } catch {}
  }, [project]);

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.project));
    } catch {}
  }, [state.project]);

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

  const onKey = useCallback((e: KeyboardEvent) => {
    if (disabled) return;
    const target = e.target as HTMLElement;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
    const meta = e.metaKey || e.ctrlKey;
    if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) {
      e.preventDefault();
      dispatch({ type: "UNDO" });
    } else if ((meta && e.key.toLowerCase() === "z" && e.shiftKey) || (meta && e.key.toLowerCase() === "y")) {
      e.preventDefault();
      dispatch({ type: "REDO" });
    } else if (meta && e.key.toLowerCase() === "d") {
      e.preventDefault();
      dispatch({ type: "DUPLICATE_SELECTION" });
    } else if (meta && e.key.toLowerCase() === "c") {
      dispatch({ type: "COPY" });
    } else if (meta && e.key.toLowerCase() === "v") {
      dispatch({ type: "PASTE" });
    } else if (meta && e.key.toLowerCase() === "a") {
      e.preventDefault();
      dispatch({ type: "SET_SELECTION", ids: stateRef.current.project.objects.map((o) => o.id) });
    } else if (e.key === "Delete" || e.key === "Backspace") {
      if (stateRef.current.selectedIds.length > 0) {
        e.preventDefault();
        dispatch({ type: "DELETE_SELECTION" });
      }
    } else if (e.key === "v" || e.key === "V") dispatch({ type: "SET_TOOL", tool: "select" });
    else if (e.key === "h" || e.key === "H") dispatch({ type: "SET_TOOL", tool: "hand" });
    else if (e.key === "r" || e.key === "R") dispatch({ type: "SET_TOOL", tool: "rect" });
    else if (e.key === "o" || e.key === "O") dispatch({ type: "SET_TOOL", tool: "ellipse" });
    else if (e.key === "l" || e.key === "L") dispatch({ type: "SET_TOOL", tool: "line" });
    else if (e.key === "Escape") dispatch({ type: "SET_SELECTION", ids: [] });
    else if (e.key === "ArrowLeft") dispatch({ type: "MOVE_SELECTION", dx: -(e.shiftKey ? 1 : 0.1), dy: 0 });
    else if (e.key === "ArrowRight") dispatch({ type: "MOVE_SELECTION", dx: e.shiftKey ? 1 : 0.1, dy: 0 });
    else if (e.key === "ArrowUp") dispatch({ type: "MOVE_SELECTION", dx: 0, dy: -(e.shiftKey ? 1 : 0.1) });
    else if (e.key === "ArrowDown") dispatch({ type: "MOVE_SELECTION", dx: 0, dy: e.shiftKey ? 1 : 0.1 });
  }, [disabled, dispatch]);

  useEffect(() => {
    if (disabled) return;
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled, onKey]);
}
