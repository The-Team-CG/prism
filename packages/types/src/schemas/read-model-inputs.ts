import { z } from "zod";
export const PRISM_PMCM_COMMAND_INBOX_MAX_PAGE = 100;
export const pmcmCommandInboxQuerySchema = z.object({
  page: z.coerce.number().int().min(0).max(PRISM_PMCM_COMMAND_INBOX_MAX_PAGE).default(0),
});
export type PrismPmcmCommandInboxQueryInput = z.infer<typeof pmcmCommandInboxQuerySchema>;
