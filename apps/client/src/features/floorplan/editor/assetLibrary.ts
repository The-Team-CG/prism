import type { CanvasObject, ElementCategory, ShapeKind } from "./types";

export interface AssetDef {
  id: string;
  name: string;
  category: ElementCategory;
  kind: ShapeKind;
  w: number;
  h: number;
  fill: string;
  stroke: string;
  seats?: number;
  icon: string; // lucide name
}

export const ASSETS: AssetDef[] = [
  // Furniture
  { id: "round-banquet", name: "Round Banquet (10pax)", category: "furniture", kind: "ellipse", w: 1.8, h: 1.8, fill: "#FFF4EC", stroke: "#9060A0", seats: 10, icon: "Circle" },
  { id: "round-small", name: "Round Table (6pax)", category: "furniture", kind: "ellipse", w: 1.4, h: 1.4, fill: "#FFF4EC", stroke: "#9060A0", seats: 6, icon: "Circle" },
  { id: "rect-banquet", name: "Rectangular Banquet", category: "furniture", kind: "rect", w: 2.4, h: 0.8, fill: "#FFF4EC", stroke: "#9060A0", seats: 8, icon: "RectangleHorizontal" },
  { id: "buffet", name: "Buffet Table", category: "furniture", kind: "rect", w: 3.0, h: 0.8, fill: "#FFF0E6", stroke: "#F06030", icon: "Utensils" },
  { id: "cocktail", name: "Cocktail High-Top", category: "furniture", kind: "ellipse", w: 0.7, h: 0.7, fill: "#FFF4EC", stroke: "#9060A0", icon: "Wine" },
  { id: "classroom", name: "Classroom Desk", category: "furniture", kind: "rect", w: 1.5, h: 0.5, fill: "#FFF4EC", stroke: "#9060A0", seats: 2, icon: "BookOpen" },
  { id: "vip-table", name: "VIP Table", category: "furniture", kind: "rect", w: 2.8, h: 1.0, fill: "#FFF0E6", stroke: "#F06030", seats: 10, icon: "Crown" },
  { id: "chair", name: "Chair", category: "furniture", kind: "rect", w: 0.45, h: 0.45, fill: "#EAD5CE", stroke: "#9060A0", icon: "Armchair" },

  // Stage & Production
  { id: "stage", name: "Stage", category: "stage", kind: "rect", w: 6.0, h: 3.0, fill: "#9060A0", stroke: "#c01867", icon: "Square" },
  { id: "led-wall", name: "LED Wall", category: "stage", kind: "rect", w: 5.0, h: 0.4, fill: "#1B1B1F", stroke: "#000000", icon: "Monitor" },
  { id: "podium", name: "Podium", category: "stage", kind: "rect", w: 0.8, h: 0.6, fill: "#9060A0", stroke: "#171216", icon: "Mic" },
  { id: "speaker", name: "Speaker", category: "stage", kind: "rect", w: 0.5, h: 0.5, fill: "#1B1B1F", stroke: "#000000", icon: "Speaker" },
  { id: "light-truss", name: "Light Truss", category: "stage", kind: "rect", w: 4.0, h: 0.3, fill: "#9AA2AD", stroke: "#4C5561", icon: "Lightbulb" },

  // Registration & Flow
  { id: "reg-desk", name: "Registration Desk", category: "registration", kind: "rect", w: 2.0, h: 0.8, fill: "#E9F7FB", stroke: "#9060A0", icon: "ClipboardList" },
  { id: "entrance-arch", name: "Entrance Arch", category: "registration", kind: "rect", w: 2.5, h: 0.4, fill: "#CCECF4", stroke: "#9060A0", icon: "DoorOpen" },
  { id: "photo-wall", name: "Photo Wall", category: "registration", kind: "rect", w: 3.0, h: 0.3, fill: "#E9F7FB", stroke: "#9060A0", icon: "Image" },
  { id: "photo-booth", name: "Photo Booth", category: "registration", kind: "rect", w: 1.5, h: 1.5, fill: "#E9F7FB", stroke: "#9060A0", icon: "Camera" },
  { id: "signage", name: "Directional Sign", category: "registration", kind: "rect", w: 0.4, h: 0.4, fill: "#E9F7FB", stroke: "#9060A0", icon: "SignpostBig" },

  // Safety
  { id: "emergency-exit", name: "Emergency Exit", category: "safety", kind: "rect", w: 1.2, h: 0.2, fill: "#E74C3C", stroke: "#B4233A", icon: "DoorOpen" },
  { id: "fire-ext", name: "Fire Extinguisher", category: "safety", kind: "ellipse", w: 0.3, h: 0.3, fill: "#E74C3C", stroke: "#B4233A", icon: "Flame" },
  { id: "first-aid", name: "First Aid", category: "safety", kind: "rect", w: 0.6, h: 0.6, fill: "#FFFFFF", stroke: "#E74C3C", icon: "Cross" },

  // Architecture
  { id: "wall", name: "Wall", category: "architecture", kind: "rect", w: 4.0, h: 0.2, fill: "#3A3A3A", stroke: "#1A1A1A", icon: "Minus" },
  { id: "door", name: "Door", category: "architecture", kind: "rect", w: 1.0, h: 0.15, fill: "#F06030", stroke: "#9060A0", icon: "DoorClosed" },
  { id: "window", name: "Window", category: "architecture", kind: "rect", w: 1.5, h: 0.15, fill: "#CCECF4", stroke: "#40A0D0", icon: "Square" },
  { id: "pillar", name: "Pillar", category: "architecture", kind: "rect", w: 0.6, h: 0.6, fill: "#62535C", stroke: "#2E2E2E", icon: "Columns" },
];

export const CATEGORY_LABELS: Record<ElementCategory, string> = {
  furniture: "Furniture",
  stage: "Stage & Production",
  registration: "Registration & Flow",
  safety: "Safety",
  architecture: "Architecture",
};

let counter = 0;
export function uid(prefix = "obj"): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

export function assetToObject(a: AssetDef, x: number, y: number): CanvasObject {
  return {
    id: uid(a.id),
    name: a.name,
    kind: a.kind,
    category: a.category,
    x: x - a.w / 2,
    y: y - a.h / 2,
    w: a.w,
    h: a.h,
    rotation: 0,
    fill: a.fill,
    stroke: a.stroke,
    strokeWidth: 0.04,
    label: a.seats ? `T${Math.floor(Math.random() * 99) + 1}` : undefined,
    seats: a.seats,
    locked: false,
    hidden: false,
  };
}
