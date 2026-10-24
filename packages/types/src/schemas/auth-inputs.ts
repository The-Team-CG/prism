import { z } from 'zod';
import { nonEmptyStringSchema, privacyConsentSchema } from './common.js';

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: nonEmptyStringSchema,
});
export type LoginInput = z.infer<typeof loginSchema>;

export const passwordSchema = z.string().min(12, 'Password must be at least 12 characters').max(128, 'Password must be at most 128 characters').refine((value) => value.trim().length > 0, 'Password cannot be blank');

export const requestPasswordResetSchema = z.object({ email: z.string().trim().email() });
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

export const consumePasswordResetSchema = z.object({
  token: z.string().trim().min(32),
  password: passwordSchema,
});
export type ConsumePasswordResetInput = z.infer<typeof consumePasswordResetSchema>;

export const activateAccountSchema = z.object({
  token: z.string().trim().min(32),
  password: passwordSchema,
});
export type ActivateAccountInput = z.infer<typeof activateAccountSchema>;

/** Staff accounts PMCM admins can invite. Clients and suppliers get their accounts from the conforme and supplier approval. */
export const createAccountInvitationSchema = z.object({
  email: z.string().trim().email(),
  name: nonEmptyStringSchema,
  role: z.enum(['pmcm-admin', 'coordinator']),
  organization: nonEmptyStringSchema,
});
export type CreateAccountInvitationInput = z.infer<typeof createAccountInvitationSchema>;

export const requestApprovalSchema = z
  .object({ email: z.string().trim().email() })
  .merge(privacyConsentSchema)
  .extend({ privacyNoticeVersion: z.string().min(1) });
export type RequestApprovalInput = z.infer<typeof requestApprovalSchema>;

export const twoFactorTokenSchema = z.object({ token: nonEmptyStringSchema });
export type TwoFactorTokenInput = z.infer<typeof twoFactorTokenSchema>;

export const verifyTwoFactorSchema = twoFactorTokenSchema.extend({
  code: z.string().regex(/^\d{6}$/, 'Two-factor code must be six digits'),
});
export type VerifyTwoFactorInput = z.infer<typeof verifyTwoFactorSchema>;
