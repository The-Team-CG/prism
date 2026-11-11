import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ViberBot, ViberSendResult } from '../../contracts/notifications/viber.port';
import type { ViberConfig } from '@prism/kernel/shared';
import { viberSendResponseSchema } from '@prism/types';
import { parseViberJson } from '../../application/notifications/viber-json';

const SEND_MESSAGE_URL = 'https://chatapi.viber.com/pa/send_message';
const REQUEST_TIMEOUT_MS = 15_000;
/** Viber status codes: 5 receiver not registered, 6 receiver not subscribed, 12 too many requests. */
const NOT_SUBSCRIBED = new Set([5, 6]);
const RETRYABLE = new Set([12]);

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

function parseViberResponse(raw: string) {
  // Viber message tokens are 64-bit integers and may exceed Number.MAX_SAFE_INTEGER.
  const parsed = parseViberJson(raw);
  return viberSendResponseSchema.parse(parsed);
}

/** Viber REST Bot API client. Response bodies are reduced to status codes so no token or text reaches stored reasons. */
export class ViberBotClient implements ViberBot {
  readonly botUri: string;
  readonly senderName: string;

  constructor(private readonly config: ViberConfig, private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike) {
    this.botUri = config.botUri;
    this.senderName = config.senderName;
  }

  async sendText(receiverId: string, text: string): Promise<ViberSendResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(SEND_MESSAGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Viber-Auth-Token': this.config.authToken },
        body: JSON.stringify({ receiver: receiverId, min_api_version: 1, sender: { name: this.senderName }, type: 'text', text: text.slice(0, 7_000) }),
        signal: controller.signal,
      });
      if (!response.ok) return response.status >= 500 || response.status === 429 ? { status: 'retryable_failure', reason: `Viber returned HTTP ${response.status}` } : { status: 'permanent_failure', reason: `Viber returned HTTP ${response.status}` };
      const body = parseViberResponse(await response.text());
      const code = body.status;
      if (code === 0) return body.message_token ? { status: 'accepted', messageToken: body.message_token }
        : { status: 'permanent_failure', reason: 'Viber accepted without a receipt; operator review required before retry' };
      if (NOT_SUBSCRIBED.has(code)) return { status: 'not_subscribed', reason: `Viber status ${code}: the user is not subscribed to the bot` };
      if (RETRYABLE.has(code)) return { status: 'retryable_failure', reason: `Viber status ${code}` };
      return { status: 'permanent_failure', reason: `Viber status ${code}` };
    } catch {
      return { status: 'retryable_failure', reason: 'Viber request failed or timed out' };
    } finally {
      clearTimeout(timer);
    }
  }

  verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
    if (!signature || !/^[0-9a-f]{64}$/i.test(signature)) return false;
    const expected = createHmac('sha256', this.config.authToken).update(rawBody).digest();
    return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
  }
}
