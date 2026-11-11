import { BadRequestException, Inject, Injectable, Optional, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { OpsNotificationChannelPreference } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { VIBER_LINK_CODE_MINUTES, type PrismNotificationPreferences, type PrismViberLink, type PrismVerifiedEventActor } from '@prism/types';
import { VIBER_BOT, type ViberBot } from '../../contracts/notifications/viber.port';
import { viberDeliveryCallbackSchema, viberCallbackSchema, type ViberCallback } from '@prism/types';
import { parseViberJson } from './viber-json';
import { viberOutcomeWhere } from './notification-provider-outcome.service';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const hashCode = (code: string) => createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
const emailOf = (actor: PrismVerifiedEventActor) => {
  const email = actor.actorEmail?.trim().toLowerCase();
  if (!email) throw new BadRequestException('Notification preferences need an account with an email address');
  return email;
};

/** A Viber callback, reduced to the fields this service reads. */
export type { ViberCallback } from '@prism/types';

/** Viber answers a conversation_started callback with this body as the welcome message. */
export type ViberWelcome = { sender: { name: string }; type: 'text'; text: string } | Record<string, never>;

/**
 * FR-25: an account links Viber by opening a one-time code in the P.R.I.S.M bot, then turns Viber updates on or off.
 * Email stays on. The link is keyed by the account's email, which is what outbox recipients resolve to.
 */
@Injectable()
export class NotificationPreferenceService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(VIBER_BOT) private readonly viber?: ViberBot | null,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async get(actor: PrismVerifiedEventActor): Promise<PrismNotificationPreferences> {
    const email = emailOf(actor);
    return this.map(email, await this.prisma.opsNotificationChannelPreference.findUnique({ where: { email } }));
  }

  async deliveryReadiness(emails: string[], channel: string): Promise<Map<string, string>> {
    if (channel === 'viber') {
      if (!this.viber) return new Map(emails.map((email) => [email, 'unconfigured']));
      const enabled = new Set((await this.findViberRecipients(emails)).map((recipient) => recipient.email));
      return new Map(emails.map((email) => [email, enabled.has(email) ? 'ready' : 'not linked or disabled']));
    }
    const status = this.map('', null).emailDelivery;
    return new Map(emails.map((email) => [email, status]));
  }

  async startViberLink(actor: PrismVerifiedEventActor, now = new Date()): Promise<PrismViberLink> {
    const viber = this.requireViber();
    const email = emailOf(actor);
    const bytes = randomBytes(8);
    const code = Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
    const expiresAt = new Date(now.getTime() + VIBER_LINK_CODE_MINUTES * 60_000);
    await this.prisma.opsNotificationChannelPreference.upsert({
      where: { email },
      create: { email, linkCodeHash: hashCode(code), linkCodeExpiresAt: expiresAt },
      update: { linkCodeHash: hashCode(code), linkCodeExpiresAt: expiresAt },
    });
    return { code, expiresAt: expiresAt.toISOString(), deepLink: `viber://pa?chatURI=${encodeURIComponent(viber.botUri)}&context=${code}` };
  }

  async setViberEnabled(actor: PrismVerifiedEventActor, enabled: boolean): Promise<PrismNotificationPreferences> {
    const email = emailOf(actor);
    const current = await this.prisma.opsNotificationChannelPreference.findUnique({ where: { email } });
    if (enabled && !current?.viberUserId) throw new BadRequestException('Link Viber before turning Viber updates on');
    if (!current) return this.map(email, null);
    return this.map(email, await this.prisma.opsNotificationChannelPreference.update({ where: { email }, data: { viberEnabled: enabled } }));
  }

  async unlinkViber(actor: PrismVerifiedEventActor): Promise<PrismNotificationPreferences> {
    const email = emailOf(actor);
    await this.prisma.opsNotificationChannelPreference.updateMany({ where: { email }, data: { viberUserId: null, viberEnabled: false, viberLinkedAt: null } });
    return this.get(actor);
  }

  /** Verified Viber callbacks: link on a code, unlink on unsubscribe. Anything else is acknowledged and ignored. */
  async handleViberCallback(rawBody: Buffer | undefined, signature: string | undefined, now = new Date()): Promise<ViberWelcome> {
    const viber = this.requireViber();
    if (!rawBody || !viber.verifySignature(rawBody, signature)) throw new UnauthorizedException('Invalid Viber signature');
    let parsed: unknown;
    try { parsed = parseViberJson(rawBody.toString('utf8')); }
    catch { throw new BadRequestException('Invalid Viber callback'); }
    const receipt = viberDeliveryCallbackSchema.safeParse(parsed);
    if (receipt.success) {
      const { message_token: token, event } = receipt.data;
      // Keep early callbacks so acceptance settlement can reconcile them after the send response.
      await this.prisma.opsNotificationProviderOutcome.upsert({ where: { receipt: token }, create: { receipt: token, outcome: event }, update: {} });
      if (event === 'seen') await this.prisma.opsNotificationProviderOutcome.updateMany({ where: { receipt: token, outcome: 'delivered' }, data: { outcome: 'seen' } });
      if (event === 'failed') await this.prisma.opsNotificationProviderOutcome.updateMany({ where: { receipt: token }, data: { outcome: 'failed' } });
      const outcome = await this.prisma.opsNotificationProviderOutcome.findUniqueOrThrow({ where: { receipt: token } });
      await this.prisma.opsNotificationDelivery.updateMany({ where: viberOutcomeWhere(token, outcome.outcome), data: { providerOutcome: outcome.outcome } });
      return {};
    }
    const validated = viberCallbackSchema.safeParse(parsed);
    if (!validated.success || ['delivered', 'seen', 'failed'].includes(validated.data.event ?? '')) throw new BadRequestException('Invalid Viber callback');
    const callback = validated.data;
    if (callback.event === 'unsubscribed' && callback.user_id) {
      await this.clearViberUser(callback.user_id);
      return {};
    }
    if (callback.event === 'conversation_started') return this.welcome(viber);
    if (callback.event === 'message') await this.linkFromMessage(viber, callback, now);
    return {};
  }

  /** The user must send the code so that linking also proves subscription to the bot. */
  private async welcome(viber: ViberBot): Promise<ViberWelcome> {
    // Opening a conversation does not subscribe the account. A message containing the code does.
    const text = 'To turn on P.R.I.S.M updates, send the link code shown in your portal Notifications screen to this chat.';
    return { sender: { name: viber.senderName }, type: 'text', text };
  }

  /** A user who already has the chat open can send the code as a message instead. */
  private async linkFromMessage(viber: ViberBot, callback: ViberCallback, now: Date) {
    const senderId = callback.sender?.id;
    const text = callback.message?.text;
    if (!senderId || !text) return;
    if (await this.link(text, senderId, now)) await viber.sendText(senderId, 'Viber updates from P.R.I.S.M are on.');
  }

  /** Viber delivery: the linked, opted-in Viber users among these account emails. */
  async findViberRecipients(emails: string[]): Promise<Array<{ email: string; viberUserId: string }>> {
    if (emails.length === 0) return [];
    const rows = await this.prisma.opsNotificationChannelPreference.findMany({
      where: { email: { in: emails.map((email) => email.trim().toLowerCase()) }, viberEnabled: true, viberUserId: { not: null } },
      select: { email: true, viberUserId: true },
    });
    return rows.flatMap((row) => (row.viberUserId ? [{ email: row.email, viberUserId: row.viberUserId }] : []));
  }

  /** The user left the bot: stop sending until they link again. */
  async clearViberUser(viberUserId: string) {
    await this.prisma.opsNotificationChannelPreference.updateMany({ where: { viberUserId }, data: { viberUserId: null, viberEnabled: false, viberLinkedAt: null } });
  }

  private async link(code: string, viberUserId: string, now: Date) {
    const codeHash = hashCode(code);
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.opsNotificationChannelPreference.findUnique({ where: { linkCodeHash: codeHash } });
      if (!row || !row.linkCodeExpiresAt || row.linkCodeExpiresAt <= now) return false;
      // One Viber user receives one account's updates; linking moves it from any earlier account.
      await tx.opsNotificationChannelPreference.updateMany({ where: { viberUserId, email: { not: row.email } }, data: { viberUserId: null, viberEnabled: false, viberLinkedAt: null } });
      await tx.opsNotificationChannelPreference.update({ where: { email: row.email }, data: { viberUserId, viberEnabled: true, viberLinkedAt: now, linkCodeHash: null, linkCodeExpiresAt: null } });
      return true;
    });
  }

  private requireViber() {
    if (!this.viber) throw new ServiceUnavailableException('Viber is not configured for this deployment');
    return this.viber;
  }

  private map(email: string, row: OpsNotificationChannelPreference | null): PrismNotificationPreferences {
    const mailTransport = this.config?.get<string>('PRISM_MAIL_TRANSPORT')?.trim().toLowerCase();
    return {
      email,
      emailDelivery: mailTransport === 'resend' ? 'external'
        : mailTransport === 'log' || mailTransport === 'mailpit' ? 'captured' : 'unavailable',
      viberConfigured: Boolean(this.viber),
      viberLinked: Boolean(row?.viberUserId),
      viberEnabled: Boolean(row?.viberEnabled && row.viberUserId),
      viberLinkedAt: row?.viberLinkedAt?.toISOString() ?? null,
    };
  }
}
