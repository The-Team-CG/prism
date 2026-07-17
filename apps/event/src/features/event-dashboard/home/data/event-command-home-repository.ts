/**
 * I/O facade for the PMCM command home surface.
 * Presentation imports this repository rather than calling prism-api directly.
 */
import { prismApi } from "@/lib/prism-api";

export const eventCommandHomeRepository = prismApi;
