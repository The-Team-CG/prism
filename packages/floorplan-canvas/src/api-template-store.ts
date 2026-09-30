import type { CreateTemplateInput, FloorPlanTemplate } from "./templates";
import type { CanvasObject, Guest, Supplier } from "./types";

export interface TemplateApiRequestInit {
  method?: "POST" | "PATCH" | "DELETE";
  body?: unknown;
}

export type TemplateApiRequest = <T>(
  path: string,
  init?: TemplateApiRequestInit,
) => Promise<T>;

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

/** Shared floorplan template API mapping; each portal supplies its role-authenticated transport. */
export function createTemplateStoreAdapter(request: TemplateApiRequest) {
  return {
    async load(): Promise<FloorPlanTemplate[]> {
      const templates = await request<ApiTemplate[]>("/templates");
      return templates.map(toTemplate);
    },

    async add(template: CreateTemplateInput): Promise<FloorPlanTemplate> {
      const saved = await request<ApiTemplate>("/templates", {
        method: "POST",
        body: {
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
        },
      });
      return toTemplate(saved);
    },

    async remove(id: string): Promise<void> {
      await request<ApiTemplate>(`/templates/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },

    async rename(id: string, name: string): Promise<FloorPlanTemplate> {
      const saved = await request<ApiTemplate>(`/templates/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: { name },
      });
      return toTemplate(saved);
    },
  };
}
