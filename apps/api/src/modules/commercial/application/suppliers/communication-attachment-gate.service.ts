import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import type { CommunicationAttachmentGate, CommunicationThreadAccess } from '@prism/contexts/platform-ops';

/**
 * What platform-ops needs to know about a conversation to authorize one of its files: its event, whether it is
 * closed, and whether the account is an active member. Storage never reads the conversation tables itself.
 */
@Injectable()
export class CommunicationAttachmentGateService implements CommunicationAttachmentGate {
  constructor(private readonly prisma: PrismaService) {}

  async findThreadAccess({ threadId, actorId }: { threadId: string; actorId: string }): Promise<CommunicationThreadAccess | null> {
    const thread = await this.prisma.opsCommunicationThread.findUnique({
      where: { id: threadId },
      select: { eventId: true, status: true, participants: { where: { actorId, active: true }, select: { id: true }, take: 1 } },
    });
    if (!thread) return null;
    return { eventId: thread.eventId, closed: thread.status === 'closed', activeMember: thread.participants.length > 0 };
  }

  async unattachedObjectIds(objectIds: string[]): Promise<Set<string>> {
    if (!objectIds.length) return new Set();
    const linked = await this.prisma.opsCommunicationMessageAttachment.findMany({
      where: { storedObjectId: { in: objectIds } },
      select: { storedObjectId: true },
      take: objectIds.length,
    });
    const attached = new Set(linked.map((row) => row.storedObjectId));
    return new Set(objectIds.filter((id) => !attached.has(id)));
  }
}
