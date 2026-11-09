import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import { CANVA_DESIGNS, type CanvaDesigns } from '@prism/contexts/platform-ops';
import type { PrismCanvaDesign } from '@prism/types';

/** New-P3: an approved testimonial the client consented to share fills PMCM's Canva testimonial template. */
@Injectable()
export class TestimonialCanvaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(CANVA_DESIGNS) private readonly canva: CanvaDesigns,
  ) {}

  async fill(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismCanvaDesign> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'Canva testimonial', eventId);
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId }, select: { eventName: true, clientName: true } });
    if (!event) throw new NotFoundException('Event not found');
    const response = await this.prisma.opsClientCloseoutResponse.findUnique({ where: { eventId } });
    if (!response?.testimonial.trim() || !response.testimonialConsent || response.moderationStatus !== 'approved') {
      throw new BadRequestException('Only an approved testimonial the client agreed to share can be used');
    }
    const design = await this.canva.fillTemplate('testimonial', {
      title: `${event.clientName} testimonial`,
      fields: { testimonial: response.testimonial, rating: `${response.rating} out of 5`, client_name: event.clientName, event_name: event.eventName },
    });
    await writeAudit(this.auditWriter, eventId, actor.name, 'Filled the Canva testimonial template', {
      actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Events, actionType: AuditActionType.Create,
      affectedType: 'client_closeout_response', affectedId: response.id, metadata: { canvaDesignId: design.designId, actorId: actor.id ?? null },
    });
    return design;
  }
}
