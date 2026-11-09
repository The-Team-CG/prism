export const VIBER_BOT = Symbol('VIBER_BOT');

export type ViberSendResult =
  | { status: 'accepted'; messageToken: string }
  | { status: 'retryable_failure'; reason: string }
  /** The user blocked or never subscribed to the bot; the link should be cleared. */
  | { status: 'not_subscribed'; reason: string }
  | { status: 'permanent_failure'; reason: string };

/** The deployment's Viber bot (Viber REST Bot API). Null when Viber is not configured. */
export interface ViberBot {
  readonly botUri: string;
  readonly senderName: string;
  sendText(receiverId: string, text: string): Promise<ViberSendResult>;
  /** X-Viber-Content-Signature is the hex HMAC-SHA256 of the raw request body keyed by the auth token. */
  verifySignature(rawBody: Buffer, signature: string | undefined): boolean;
}
