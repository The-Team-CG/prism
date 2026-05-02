import type { CanvasObject, Guest, Supplier } from "./types";
import { uid } from "./assetLibrary";

export interface FloorPlanTemplate {
  id: string;
  name: string;
  description?: string;
  venue?: string;
  widthM: number;
  heightM: number;
  pax: number;
  objects: CanvasObject[];
  includeGuests: boolean;
  includeSuppliers: boolean;
  guests: Guest[];
  suppliers: Supplier[];
  createdAt: number;
}

const KEY = "prism.templates.v1";

export function loadTemplates(): FloorPlanTemplate[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FloorPlanTemplate[];
  } catch {
    return [];
  }
}

export function saveTemplates(list: FloorPlanTemplate[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

export function addTemplate(t: Omit<FloorPlanTemplate, "id" | "createdAt">): FloorPlanTemplate {
  const full: FloorPlanTemplate = { ...t, id: uid("tpl"), createdAt: Date.now() };
  const list = loadTemplates();
  list.unshift(full);
  saveTemplates(list);
  return full;
}

export function removeTemplate(id: string) {
  const list = loadTemplates().filter((t) => t.id !== id);
  saveTemplates(list);
  return list;
}

export function renameTemplate(id: string, name: string) {
  const list = loadTemplates().map((t) => (t.id === id ? { ...t, name } : t));
  saveTemplates(list);
  return list;
}

// Clone objects with fresh ids so reuse in a new project doesn't collide.
export function cloneTemplateObjects(t: FloorPlanTemplate): CanvasObject[] {
  return t.objects.map((o) => ({
    ...o,
    id: uid("obj"),
    assignedGuestIds: [],
    assignedSupplierIds: [],
  }));
}
