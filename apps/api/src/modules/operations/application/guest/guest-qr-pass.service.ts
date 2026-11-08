import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import type { PrismGuestQrPass } from '@prism/types';
import { GuestWorkflowService } from './guest-workflow.service';

const PASS_LIMIT = 2000;

/** FR-39 / FR-95 Mode 1: QR passes for roster guests with an email. The token is random and maps to one roster entry. */
@Injectable()
export class GuestQrPassService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessPolicyService,
    private readonly guests: GuestWorkflowService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
  ) {}

  async listPasses(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismGuestQrPass[]> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'guest QR passes', eventId);
    return this.passes(eventId);
  }

  /** Gives every eligible guest with an email a token; guests that already have one keep it. */
  async issuePasses(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismGuestQrPass[]> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'guest QR passes', eventId);
    const missing = await this.prisma.opsGuestRosterEntry.findMany({
      where: { eventId, withdrawnAt: null, eligibility: 'eligible', checkInToken: null, NOT: { email: '' } },
      select: { id: true },
      take: PASS_LIMIT,
    });
    // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: one token write per guest, capped by PASS_LIMIT above.
    for (const entry of missing) {
      await this.prisma.opsGuestRosterEntry.update({ where: { id: entry.id }, data: { checkInToken: randomBytes(24).toString('base64url') } });
    }
    if (missing.length > 0) {
      await writeAudit(this.auditWriter, eventId, actor.name, `Issued ${missing.length} guest QR passes`, {
        actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Events, actionType: AuditActionType.Create,
        affectedType: 'guest_qr_pass', affectedId: eventId, metadata: { count: missing.length, actorId: actor.id ?? null },
      });
    }
    return this.passes(eventId);
  }

  /** Registration desk scan. The desk access rule of the roster check-in applies. */
  async checkInByToken(eventId: string, token: string, actor: ResolvedEventOpsActor) {
    const entry = await this.prisma.opsGuestRosterEntry.findFirst({ where: { eventId, checkInToken: token }, select: { id: true } });
    if (!entry) throw new NotFoundException('This pass is not for this event');
    return this.guests.checkInRosterEntry(eventId, entry.id, actor);
  }

  private async passes(eventId: string): Promise<PrismGuestQrPass[]> {
    const rows = await this.prisma.opsGuestRosterEntry.findMany({
      where: { eventId, withdrawnAt: null, NOT: { checkInToken: null } },
      select: { id: true, guestName: true, email: true, checkInToken: true, checkedInAt: true },
      orderBy: [{ guestName: 'asc' }, { id: 'asc' }],
      take: PASS_LIMIT,
    });
    return rows.map((row) => ({ rosterEntryId: row.id, guestName: row.guestName, email: row.email, token: row.checkInToken ?? '', checkedInAt: row.checkedInAt?.toISOString() ?? null }));
  }
}
