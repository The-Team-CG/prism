export const EMAIL_SIGN_IN_CODE_DELIVERY = Symbol('EMAIL_SIGN_IN_CODE_DELIVERY');

/**
 * Sends a sign-in code. The adapter receives the code only in memory: it is never stored in the notification outbox,
 * logged or returned by HTTP. Resolves when the mail provider accepted the message; rejects otherwise, without the code.
 */
export interface EmailSignInCodeDeliveryPort {
  deliver(input: { recipient: string; code: string; portalName: string }): Promise<void>;
}
