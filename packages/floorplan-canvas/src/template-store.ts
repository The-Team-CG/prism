import type { CreateTemplateInput, FloorPlanTemplate } from "./templates";

export interface TemplateStore {
  load(): Promise<FloorPlanTemplate[]>;
  add(template: CreateTemplateInput): Promise<FloorPlanTemplate>;
  remove(id: string): Promise<void>;
}