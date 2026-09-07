export const PASSWORD_RESET_DELIVERY = Symbol('PASSWORD_RESET_DELIVERY');

/**
 * A provider adapter may receive the reset URL only in memory. The URL is
 * never persisted in the ordinary notification outbox or returned by HTTP.
 */
export interface PasswordResetDeliveryPort {
  deliver(input: { recipient: string; resetUrl: string }): Promise<void>;
}
