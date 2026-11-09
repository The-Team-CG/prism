import { BadRequestException, Inject, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { CanvaTemplateKey } from '@prism/kernel/shared';
import type { PrismCanvaConnection } from '@prism/types';
import type { CanvaDesigns } from '../../contracts/integrations/canva-designs.port';
import { CANVA_AUTHORIZE_URL, CANVA_SCOPES, CanvaApiClient, openSecret, sealSecret } from '../../infrastructure/integrations/canva-api.client';

export const CANVA_API_CLIENT = Symbol('CANVA_API_CLIENT');
const CONNECTION_ID = 'pmcm';
const STATE_MINUTES = 10;
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const base64url = (bytes: Buffer) => bytes.toString('base64url');

/**
 * FR-59 and New-P3: PMCM connects one Canva account for the organization (Canva Connect OAuth with PKCE), and other
 * contexts fill its brand templates through CANVA_DESIGNS. Tokens are stored sealed with CANVA_TOKEN_KEY.
 */
@Injectable()
export class CanvaConnectionService implements CanvaDesigns {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessPolicyService,
    @Optional() @Inject(CANVA_API_CLIENT) private readonly canva?: CanvaApiClient | null,
  ) {}

  async status(actor: ResolvedEventOpsActor): Promise<PrismCanvaConnection> {
    await this.requirePmcm(actor);
    const connection = this.canva ? await this.prisma.opsCanvaConnection.findUnique({ where: { id: CONNECTION_ID } }) : null;
    return {
      configured: Boolean(this.canva),
      connected: Boolean(connection),
      connectedAt: connection?.connectedAt.toISOString() ?? null,
      templates: { proposal: Boolean(this.canva?.config.templates.proposal), testimonial: Boolean(this.canva?.config.templates.testimonial) },
    };
  }

  /** The Canva authorization URL; the PKCE verifier is kept sealed, keyed by the state's hash. */
  async authorizationUrl(actor: ResolvedEventOpsActor, now = new Date()): Promise<{ url: string }> {
    await this.requirePmcm(actor);
    const canva = this.requireCanva();
    const state = base64url(randomBytes(24));
    const verifier = base64url(randomBytes(48));
    await this.prisma.opsCanvaOauthState.create({ data: {
      stateHash: sha256(state), codeVerifierSealed: sealSecret(canva.config.tokenKey, verifier),
      actorId: actor.id ?? actor.name, expiresAt: new Date(now.getTime() + STATE_MINUTES * 60_000),
    } });
    const params = new URLSearchParams({
      code_challenge_method: 's256', response_type: 'code', client_id: canva.config.clientId, redirect_uri: canva.config.redirectUri,
      scope: CANVA_SCOPES, code_challenge: base64url(createHash('sha256').update(verifier).digest()), state,
    });
    return { url: `${CANVA_AUTHORIZE_URL}?${params.toString()}` };
  }

  /** Canva's redirect back. The state is single use and expires; a wrong or old state connects nothing. */
  async completeAuthorization(code: string | undefined, state: string | undefined, now = new Date()) {
    const canva = this.requireCanva();
    if (!code || !state) throw new BadRequestException('Canva did not return an authorization code');
    const pending = await this.prisma.opsCanvaOauthState.findUnique({ where: { stateHash: sha256(state) } });
    if (!pending || pending.expiresAt <= now) throw new BadRequestException('This Canva connection request expired; start again from Settings');
    await this.prisma.opsCanvaOauthState.delete({ where: { stateHash: pending.stateHash } });
    const tokens = await canva.exchangeCode(code, openSecret(canva.config.tokenKey, pending.codeVerifierSealed), now);
    const sealed = { accessTokenSealed: sealSecret(canva.config.tokenKey, tokens.accessToken), refreshTokenSealed: sealSecret(canva.config.tokenKey, tokens.refreshToken), accessExpiresAt: tokens.expiresAt };
    await this.prisma.opsCanvaConnection.upsert({
      where: { id: CONNECTION_ID },
      create: { id: CONNECTION_ID, ...sealed, connectedBy: pending.actorId, connectedAt: now },
      update: { ...sealed, connectedBy: pending.actorId, connectedAt: now },
    });
  }

  async disconnect(actor: ResolvedEventOpsActor) {
    await this.requirePmcm(actor);
    await this.prisma.opsCanvaConnection.deleteMany({ where: { id: CONNECTION_ID } });
    return this.status(actor);
  }

  async fillTemplate(template: CanvaTemplateKey, input: { title: string; fields: Record<string, string> }) {
    const canva = this.requireCanva();
    const templateId = canva.config.templates[template];
    if (!templateId) throw new ServiceUnavailableException(`No Canva ${template} template is configured`);
    return canva.autofill(await this.accessToken(canva), templateId, input.title, input.fields);
  }

  private async accessToken(canva: CanvaApiClient, now = new Date()) {
    const connection = await this.prisma.opsCanvaConnection.findUnique({ where: { id: CONNECTION_ID } });
    if (!connection) throw new ServiceUnavailableException('Canva is not connected; connect it from Settings');
    if (connection.accessExpiresAt > now) return openSecret(canva.config.tokenKey, connection.accessTokenSealed);
    const tokens = await canva.refresh(openSecret(canva.config.tokenKey, connection.refreshTokenSealed), now);
    await this.prisma.opsCanvaConnection.update({ where: { id: CONNECTION_ID }, data: {
      accessTokenSealed: sealSecret(canva.config.tokenKey, tokens.accessToken), refreshTokenSealed: sealSecret(canva.config.tokenKey, tokens.refreshToken), accessExpiresAt: tokens.expiresAt,
    } });
    return tokens.accessToken;
  }

  private requirePmcm(actor: ResolvedEventOpsActor) {
    return this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'Canva connection');
  }

  private requireCanva() {
    if (!this.canva) throw new ServiceUnavailableException('Canva is not configured for this deployment');
    return this.canva;
  }
}
