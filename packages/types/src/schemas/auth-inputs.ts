import { z } from 'zod';
import { nonEmptyStringSchema, privacyConsentSchema, privacyNoticeVersionSchema } from './common.js';

/** A browser trusted after an authenticator code skips that step for this many days. */
export const TRUSTED_DEVICE_DAYS = 30;
/** Backup codes issued when an authenticator is set up, for a lost phone; each works once. */
export const TWO_FACTOR_BACKUP_CODE_COUNT = 10;
/** A backup code reads as two groups of four letters or digits, e.g. "k7p2-9xqm"; the dash is optional when typed. */
export const TWO_FACTOR_BACKUP_CODE_PATTERN = /^[a-z0-9]{4}-?[a-z0-9]{4}$/i;

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: nonEmptyStringSchema,
  /** Present when this browser was trusted after an authenticator code; a valid one skips that step. */
  trustedDeviceToken: z.string().trim().min(32).max(200).optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const passwordSchema = z.string().min(12, 'Password must be at least 12 characters').max(128, 'Password must be at most 128 characters').refine((value) => value.trim().length > 0, 'Password cannot be blank');

/** The signed-in person's own details they can change themselves. */
export const updateOwnProfileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(120, 'Keep your name under 120 characters'),
}).strict();
export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;

/** Changing the password while signed in: the current one proves it is them, the new one meets the usual rules. */
export const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password').max(200),
  newPassword: passwordSchema,
}).strict().refine((input) => input.currentPassword !== input.newPassword, { path: ['newPassword'], message: 'Choose a password you are not using now' });
export type ChangeOwnPasswordInput = z.infer<typeof changeOwnPasswordSchema>;

/** The current password, to start or turn off the signed-in person's own two-step sign-in. */
export const confirmOwnPasswordSchema = z.object({
  password: z.string().min(1, 'Enter your password').max(200),
}).strict();
export type ConfirmOwnPasswordInput = z.infer<typeof confirmOwnPasswordSchema>;

/** Changing the sign-in email: the password proves it is them; the change waits for the link sent to the new address. */
export const requestEmailChangeSchema = z.object({
  newEmail: z.string().trim().toLowerCase().email('Enter an email address').max(254),
  password: z.string().min(1, 'Enter your password').max(200),
}).strict();
export type RequestEmailChangeInput = z.infer<typeof requestEmailChangeSchema>;

/** The token from the link in the confirmation email. */
export const confirmEmailChangeSchema = z.object({
  token: z.string().trim().min(32).max(200),
}).strict();
export type ConfirmEmailChangeInput = z.infer<typeof confirmEmailChangeSchema>;

/** The six-digit code from the authenticator app that was just set up, which turns two-step sign-in on. */
export const enableOwnTwoFactorSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the six-digit code from your app'),
}).strict();
export type EnableOwnTwoFactorInput = z.infer<typeof enableOwnTwoFactorSchema>;

export const requestPasswordResetSchema = z.object({ email: z.string().trim().email() });
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

/** How long an emailed sign-in code works, and how many wrong tries it allows before a new one is needed. */
export const EMAIL_SIGN_IN_CODE_TTL_MINUTES = 10;
export const EMAIL_SIGN_IN_CODE_MAX_ATTEMPTS = 5;

/** Clients and suppliers can sign in with a code emailed to them instead of a password; PMCM staff cannot. */
export const requestEmailSignInCodeSchema = z.object({ email: z.string().trim().email() });
export type RequestEmailSignInCodeInput = z.infer<typeof requestEmailSignInCodeSchema>;

export const verifyEmailSignInCodeSchema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the six-digit code from the email"),
});
export type VerifyEmailSignInCodeInput = z.infer<typeof verifyEmailSignInCodeSchema>;

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

/** A client or supplier opening their invitation link: the link itself proves the email, so no password is needed. */
export const invitationTokenSchema = z.object({ token: z.string().trim().min(32) });
export type InvitationTokenInput = z.infer<typeof invitationTokenSchema>;

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
  .merge(privacyConsentSchema);
export type RequestApprovalInput = z.infer<typeof requestApprovalSchema>;

/** Signed-in person confirming they have read the current privacy notice. */
export const acknowledgePrivacyNoticeSchema = z.object({
  version: privacyNoticeVersionSchema,
}).strict();
export type AcknowledgePrivacyNoticeInput = z.infer<typeof acknowledgePrivacyNoticeSchema>;

export const twoFactorTokenSchema = z.object({ token: nonEmptyStringSchema });
export type TwoFactorTokenInput = z.infer<typeof twoFactorTokenSchema>;

export const verifyTwoFactorSchema = twoFactorTokenSchema.extend({
  /** The six digits from the authenticator app, or one of the person's backup codes. */
  code: z.string().trim().refine((value) => /^\d{6}$/.test(value) || TWO_FACTOR_BACKUP_CODE_PATTERN.test(value), 'Enter the six-digit code or a backup code'),
  /** Skip the authenticator step on this browser for TRUSTED_DEVICE_DAYS. */
  trustDevice: z.boolean().optional(),
});
export type VerifyTwoFactorInput = z.infer<typeof verifyTwoFactorSchema>;
