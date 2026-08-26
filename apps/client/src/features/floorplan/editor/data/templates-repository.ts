import type { CanvasObject, Guest, Supplier } from "../types";
import type { CreateTemplateInput, FloorPlanTemplate } from "../templates";

type ApiTemplate = {
  id: string;
  name: string;
  description?: string;
  venue?: string;
  width: number;
  height: number;
  gridSize: number;
  pax: number;
  objects?: CanvasObject[];
  includeGuests: boolean;
  includeSuppliers: boolean;
  guests?: Guest[];
  suppliers?: Supplier[];
  createdAt: string;
};

function apiUrl() {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error("NEXT_PUBLIC_API_URL is required for floor plan templates");
  return url;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Template request failed: ${response.status}`);
  }

  const body = (await response.json()) as { data?: T };
  return body.data as T;
}

function toTemplate(template: ApiTemplate): FloorPlanTemplate {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    venue: template.venue,
    widthM: template.width,
    heightM: template.height,
    pax: template.pax,
    objects: template.objects ?? [],
    includeGuests: template.includeGuests,
    includeSuppliers: template.includeSuppliers,
    guests: template.guests ?? [],
    suppliers: template.suppliers ?? [],
    createdAt: new Date(template.createdAt).getTime(),
  };
}

export async function loadTemplates(): Promise<FloorPlanTemplate[]> {
  const templates = await request<ApiTemplate[]>("/api/templates");
  return templates.map(toTemplate);
}

export async function addTemplate(template: CreateTemplateInput): Promise<FloorPlanTemplate> {
  const saved = await request<ApiTemplate>("/api/templates", {
    method: "POST",
    body: JSON.stringify({
      name: template.name,
      description: template.description,
      venue: template.venue,
      width: Math.max(1, Math.round(template.widthM)),
      height: Math.max(1, Math.round(template.heightM)),
      gridSize: 1,
      pax: Math.max(0, Math.round(template.pax)),
      objects: template.objects,
      includeGuests: template.includeGuests,
      includeSuppliers: template.includeSuppliers,
      guests: template.includeGuests ? template.guests : [],
      suppliers: template.includeSuppliers ? template.suppliers : [],
      sourceType: "custom",
    }),
  });
  return toTemplate(saved);
}

export async function removeTemplate(id: string): Promise<void> {
  await request<ApiTemplate>(`/api/templates/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function renameTemplate(id: string, name: string): Promise<FloorPlanTemplate> {
  const saved = await request<ApiTemplate>(`/api/templates/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
  return toTemplate(saved);
}
