import { z } from "zod";

export const resendEmailAcceptedSchema = z.object({ id: z.string().trim().min(1) });

export const mailpitEmailAcceptedSchema = z.object({ ID: z.string().min(1) });
