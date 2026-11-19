import type { FloorplanSceneDocument } from "@prism/types";
import type { CreateTemplateInput, FloorPlanTemplate } from "./templates";

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
  venueRules?: string;
  width: number;
  height: number;
  pax: number;
  scene: FloorplanSceneDocument | null;
  createdAt: string;
};

function toTemplate(template: ApiTemplate): FloorPlanTemplate {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    venue: template.venue,
    venueRules: template.venueRules || undefined,
    widthM: template.width,
    heightM: template.height,
    pax: template.pax,
    scene: template.scene,
    createdAt: new Date(template.createdAt).getTime(),
  };
}

/** Shared floorplan template API mapping; each portal supplies its role-authenticated transport. */
export function createTemplateStoreAdapter(request: TemplateApiRequest) {
  return {
    async load(): Promise<FloorPlanTemplate[]> {
      const templates = await request<ApiTemplate[]>("/api/templates");
      return templates.map(toTemplate);
    },

    async add(template: CreateTemplateInput): Promise<FloorPlanTemplate> {
      const saved = await request<ApiTemplate>("/api/templates", {
        method: "POST",
        body: {
          name: template.name,
          description: template.description,
          venue: template.venue,
          venueRules: template.venueRules?.trim() ?? "",
          pax: Math.max(0, Math.round(template.pax)),
          scene: template.scene,
          sourceType: "custom",
        },
      });
      return toTemplate(saved);
    },

    async remove(id: string): Promise<void> {
      await request<ApiTemplate>(`/api/templates/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },

    async rename(id: string, name: string): Promise<FloorPlanTemplate> {
      const saved = await request<ApiTemplate>(`/api/templates/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: { name },
      });
      return toTemplate(saved);
    },
  };
}
