import type {
  CanvasObject,
  EditorState,
  Guest,
  Project,
  Supplier,
  Tool,
  Viewport,
} from "./types";
import { uid } from "./assetLibrary";

export type Action =
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

type ActionOf<K extends Action["type"]> = Extract<Action, { type: K }>;
type ActionHandlers = {
  [K in Action["type"]]: (state: EditorState, action: ActionOf<K>) => EditorState;
};

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

function withTouchedProject(state: EditorState, project: Project): EditorState {
  return { ...state, project: touch(project) };
}

function selectedIdSet(state: EditorState): Set<string> {
  return new Set(state.selectedIds);
}

function mapObject(
  objects: CanvasObject[],
  id: string,
  patch: Partial<CanvasObject>,
): CanvasObject[] {
  return objects.map((o) => (o.id === id ? { ...o, ...patch } : o));
}

function toggleId(ids: string[], id: string): string[] {
  if (ids.includes(id)) return ids.filter((item) => item !== id);
  return [...ids, id];
}

function copySelectedObjects(state: EditorState, offset: number, idPrefix: string) {
  const ids = selectedIdSet(state);
  const copies: CanvasObject[] = [];
  const newIds: string[] = [];
  state.project.objects.forEach((o) => {
    if (!ids.has(o.id)) return;
    const nid = uid(idPrefix);
    copies.push({ ...o, id: nid, x: o.x + offset, y: o.y + offset });
    newIds.push(nid);
  });
  return { copies, newIds };
}

function pasteClipboard(state: EditorState) {
  const copies: CanvasObject[] = [];
  const newIds: string[] = [];
  state.clipboard!.forEach((o) => {
    const nid = uid("paste");
    copies.push({ ...o, id: nid, x: o.x + 0.8, y: o.y + 0.8 });
    newIds.push(nid);
  });
  return { copies, newIds };
}

function stripGuestFromObject(o: CanvasObject, guestId: string): CanvasObject {
  if (!o.assignedGuestIds?.includes(guestId)) return o;
  return { ...o, assignedGuestIds: o.assignedGuestIds.filter((gid) => gid !== guestId) };
}

function assignGuestOnObject(o: CanvasObject, guestId: string, objectId: string): CanvasObject {
  const without = (o.assignedGuestIds ?? []).filter((gid) => gid !== guestId);
  if (o.id !== objectId) return { ...o, assignedGuestIds: without };
  const cap = o.seats ?? Infinity;
  if (without.length >= cap) return { ...o, assignedGuestIds: without };
  return { ...o, assignedGuestIds: [...without, guestId] };
}

function stripSupplierFromObject(o: CanvasObject, supplierId: string): CanvasObject {
  if (!o.assignedSupplierIds?.includes(supplierId)) return o;
  return {
    ...o,
    assignedSupplierIds: o.assignedSupplierIds.filter((sid) => sid !== supplierId),
  };
}

function assignSupplierOnObject(o: CanvasObject, supplierId: string, objectId: string): CanvasObject {
  if (o.id !== objectId) return o;
  const current = o.assignedSupplierIds ?? [];
  if (current.includes(supplierId)) return o;
  return { ...o, assignedSupplierIds: [...current, supplierId] };
}

function unassignSupplierOnObject(
  o: CanvasObject,
  supplierId: string,
  objectId: string,
): CanvasObject {
  if (o.id !== objectId) return o;
  if (!o.assignedSupplierIds) return o;
  return {
    ...o,
    assignedSupplierIds: o.assignedSupplierIds.filter((sid) => sid !== supplierId),
  };
}

function reorderObjects(objects: CanvasObject[], id: string, to: number): CanvasObject[] | null {
  const objs = [...objects];
  const idx = objs.findIndex((o) => o.id === id);
  if (idx === -1) return null;
  const [item] = objs.splice(idx, 1);
  objs.splice(to, 0, item);
  return objs;
}

export const handlers: ActionHandlers = {
  SET_TOOL(state, action) {
    return { ...state, tool: action.tool };
  },
  SET_VIEWPORT(state, action) {
    return { ...state, viewport: { ...state.viewport, ...action.viewport } };
  },
  HOVER(state, action) {
    return { ...state, hoveredId: action.id };
  },
  SET_SELECTION(state, action) {
    return { ...state, selectedIds: action.ids };
  },
  ADD_SELECTION(state, action) {
    return { ...state, selectedIds: toggleId(state.selectedIds, action.id) };
  },
  ADD_OBJECT(state, action) {
    const s = pushHistory(state);
    const next = withTouchedProject(s, { ...s.project, objects: [...s.project.objects, action.obj] });
    if (action.select === false) return { ...next, selectedIds: s.selectedIds };
    return { ...next, selectedIds: [action.obj.id] };
  },
  ADD_OBJECTS(state, action) {
    const s = pushHistory(state);
    const objects = action.replace ? action.objs : [...s.project.objects, ...action.objs];
    return { ...withTouchedProject(s, { ...s.project, objects }), selectedIds: [] };
  },
  UPDATE_OBJECT(state, action) {
    const s = pushHistory(state);
    return withTouchedProject(s, {
      ...s.project,
      objects: mapObject(s.project.objects, action.id, action.patch),
    });
  },
  UPDATE_OBJECTS(state, action) {
    const s = pushHistory(state);
    const map = new Map(action.patches.map((p) => [p.id, p.patch]));
    return withTouchedProject(s, {
      ...s.project,
      objects: s.project.objects.map((o) => (map.has(o.id) ? { ...o, ...map.get(o.id)! } : o)),
    });
  },
  MOVE_SELECTION(state, action) {
    if (state.selectedIds.length === 0) return state;
    const s = pushHistory(state);
    const ids = selectedIdSet(s);
    return withTouchedProject(s, {
      ...s.project,
      objects: s.project.objects.map((o) =>
        ids.has(o.id) ? { ...o, x: o.x + action.dx, y: o.y + action.dy } : o,
      ),
    });
  },
  DELETE_SELECTION(state) {
    if (state.selectedIds.length === 0) return state;
    const s = pushHistory(state);
    const ids = selectedIdSet(s);
    return {
      ...withTouchedProject(s, { ...s.project, objects: s.project.objects.filter((o) => !ids.has(o.id)) }),
      selectedIds: [],
    };
  },
  DUPLICATE_SELECTION(state) {
    if (state.selectedIds.length === 0) return state;
    const s = pushHistory(state);
    const { copies, newIds } = copySelectedObjects(s, 0.5, "dup");
    return {
      ...withTouchedProject(s, { ...s.project, objects: [...s.project.objects, ...copies] }),
      selectedIds: newIds,
    };
  },
  COPY(state) {
    if (state.selectedIds.length === 0) return state;
    return {
      ...state,
      clipboard: state.project.objects.filter((o) => state.selectedIds.includes(o.id)),
    };
  },
  PASTE(state) {
    if (!state.clipboard) return state;
    if (state.clipboard.length === 0) return state;
    const s = pushHistory(state);
    const { copies, newIds } = pasteClipboard(s);
    return {
      ...withTouchedProject(s, { ...s.project, objects: [...s.project.objects, ...copies] }),
      selectedIds: newIds,
    };
  },
  REORDER(state, action) {
    const s = pushHistory(state);
    const objs = reorderObjects(s.project.objects, action.id, action.to);
    if (!objs) return state;
    return withTouchedProject(s, { ...s.project, objects: objs });
  },
  UPDATE_PROJECT(state, action) {
    const s = pushHistory(state);
    return withTouchedProject(s, { ...s.project, ...action.patch });
  },
  UNDO(state) {
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
  },
  REDO(state) {
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
  },
  TOGGLE_SNAP(state) {
    return { ...state, snap: !state.snap };
  },
  ADD_GUEST(state, action) {
    const s = pushHistory(state);
    return withTouchedProject(s, { ...s.project, guests: [...s.project.guests, action.guest] });
  },
  UPDATE_GUEST(state, action) {
    const s = pushHistory(state);
    return withTouchedProject(s, {
      ...s.project,
      guests: s.project.guests.map((g) => (g.id === action.id ? { ...g, ...action.patch } : g)),
    });
  },
  DELETE_GUEST(state, action) {
    const s = pushHistory(state);
    return withTouchedProject(s, {
      ...s.project,
      guests: s.project.guests.filter((g) => g.id !== action.id),
      objects: s.project.objects.map((o) => stripGuestFromObject(o, action.id)),
    });
  },
  ASSIGN_GUEST(state, action) {
    const s = pushHistory(state);
    return withTouchedProject(s, {
      ...s.project,
      objects: s.project.objects.map((o) => assignGuestOnObject(o, action.guestId, action.objectId)),
    });
  },
  UNASSIGN_GUEST(state, action) {
    const s = pushHistory(state);
    return withTouchedProject(s, {
      ...s.project,
      objects: s.project.objects.map((o) => stripGuestFromObject(o, action.guestId)),
    });
  },
  ADD_SUPPLIER(state, action) {
    const s = pushHistory(state);
    return withTouchedProject(s, {
      ...s.project,
      suppliers: [...s.project.suppliers, action.supplier],
    });
  },
  UPDATE_SUPPLIER(state, action) {
    const s = pushHistory(state);
    return withTouchedProject(s, {
      ...s.project,
      suppliers: s.project.suppliers.map((sup) =>
        sup.id === action.id ? { ...sup, ...action.patch } : sup,
      ),
    });
  },
  DELETE_SUPPLIER(state, action) {
    const s = pushHistory(state);
    return withTouchedProject(s, {
      ...s.project,
      suppliers: s.project.suppliers.filter((sup) => sup.id !== action.id),
      objects: s.project.objects.map((o) => stripSupplierFromObject(o, action.id)),
    });
  },
  ASSIGN_SUPPLIER(state, action) {
    const s = pushHistory(state);
    return withTouchedProject(s, {
      ...s.project,
      objects: s.project.objects.map((o) =>
        assignSupplierOnObject(o, action.supplierId, action.objectId),
      ),
    });
  },
  UNASSIGN_SUPPLIER(state, action) {
    const s = pushHistory(state);
    return withTouchedProject(s, {
      ...s.project,
      objects: s.project.objects.map((o) =>
        unassignSupplierOnObject(o, action.supplierId, action.objectId),
      ),
    });
  },
  APPLY_TEMPLATE(state, action) {
    const s = pushHistory(state);
    return {
      ...withTouchedProject(s, {
        ...s.project,
        ...action.patch,
        objects: action.objects,
        guests: action.guests ?? s.project.guests,
        suppliers: action.suppliers ?? s.project.suppliers,
      }),
      selectedIds: [],
    };
  },
  LOAD(_state, action) {
    return action.state;
  },
};

export function reducer(state: EditorState, action: Action): EditorState {
  return handlers[action.type](state, action as never);
}
