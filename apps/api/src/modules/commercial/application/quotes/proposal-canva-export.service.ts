import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import { CANVA_DESIGNS, type CanvaDesigns } from '@prism/contexts/platform-ops';
import type { PrismCanvaDesign } from '@prism/types';

const peso = (amount: number) => `PHP ${amount.toLocaleString('en-PH')}`;

/** FR-59: the latest issued proposal fills PMCM's Canva proposal template; PMCM finishes the deck in Canva. */
@Injectable()
export class ProposalCanvaExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(CANVA_DESIGNS) private readonly canva: CanvaDesigns,
  ) {}

  async exportLatest(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismCanvaDesign> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'Canva proposal export', eventId);
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId }, select: { eventName: true, clientName: true, eventDate: true } });
    if (!event) throw new NotFoundException('Event not found');
    const version = await this.prisma.opsProposalVersion.findFirst({ where: { eventId, status: 'issued', issuedAt: { not: null } }, orderBy: { versionNumber: 'desc' } });
    if (!version) throw new BadRequestException('Issue a proposal before sending it to Canva');
    const design = await this.canva.fillTemplate('proposal', {
      title: `${event.eventName} proposal v${version.versionNumber}`,
      fields: {
        title: version.title, summary: version.summary, total: peso(version.totalAmount),
        alternative_total: version.alternativeTotalAmount ? peso(version.alternativeTotalAmount) : '',
        client_name: event.clientName, event_name: event.eventName,
        event_date: event.eventDate.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' }),
        version: `Version ${version.versionNumber}`,
      },
    });
    await writeAudit(this.auditWriter, eventId, actor.name, `Sent proposal version ${version.versionNumber} to Canva`, {
      actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Events, actionType: AuditActionType.Create,
      affectedType: 'proposal_version', affectedId: version.id, metadata: { canvaDesignId: design.designId, actorId: actor.id ?? null },
    });
    return design;
  }
}
