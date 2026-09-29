import { createTemplateStoreAdapter } from "@prism/floorplan-canvas";
import { clientApiRequest } from "@/lib/prism-api";

const store = createTemplateStoreAdapter(clientApiRequest);

export const loadTemplates = store.load;
export const addTemplate = store.add;
export const removeTemplate = store.remove;
export const renameTemplate = store.rename;
