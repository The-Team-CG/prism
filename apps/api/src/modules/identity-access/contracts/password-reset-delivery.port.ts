export const PASSWORD_RESET_DELIVERY = Symbol('PASSWORD_RESET_DELIVERY');

export const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

/**
 * A provider adapter may receive the reset URL only in memory. The URL is
 * never persisted in the ordinary notification outbox or returned by HTTP.
 * Resolves when the mail provider accepted the message; rejects otherwise, without the URL.
 */
export interface PasswordResetDeliveryPort {
  deliver(input: { recipient: string; resetUrl: string }): Promise<void>;
}
