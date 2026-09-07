import { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { EventAccessPolicyService } from './event-access-policy.service';

const url = process.env.P0_TEST_DATABASE_URL;
const live = Boolean(url && /^postgresql:\/\/[^@]+@127\.0\.0\.1:55437\/prism_p0(?:\?|$)/.test(url));

describe.skipIf(!live)('verified client ownership against PostgreSQL', () => {
  it('separates same-name clients by inquiry email', async () => {
    process.env.DATABASE_URL = url;
    const prisma = new PrismaClient();
    const suffix = Math.random().toString(36).slice(2);
    const ids = [`inq_owner_${suffix}`, `inq_other_${suffix}`];
    try {
      for (const [index, id] of ids.entries()) {
        await prisma.opsInquiry.create({ data: { id, clientName: 'Same Name', email: `client${index}@${suffix}.test`, eventName: `Event ${index}`, eventDate: new Date('2026-09-01'), clientType: 'Private', status: 'accepted', normalizedEmail: `client${index}@${suffix}.test`, events: { create: { id: `evt_${id}`, clientName: 'Same Name', eventName: `Event ${index}`, eventDate: new Date('2026-09-01'), clientPortalStatus: 'unlocked' } } } });
      }
      const rows = await prisma.opsEvent.findMany({ where: { id: { startsWith: `evt_inq_` } }, include: { inquiry: { select: { email: true } } } });
      const policy = new EventAccessPolicyService({ write: async () => ({}) });
      const actor = policy.resolveVerifiedActor({ id: 'u', actorId: 'u', role: 'client', actorRole: 'client', email: `client0@${suffix}.test`, actorEmail: `client0@${suffix}.test`, name: 'Same Name', actorName: 'Same Name', expiresAt: '2099-01-01' });
      const own = rows.find((row) => row.inquiry.email === actor.email);
      const foreign = rows.find((row) => row.inquiry.email !== actor.email);
      expect(own && policy.canReadEvent(actor, own)).toBe(true);
      expect(foreign && policy.canReadEvent(actor, foreign)).toBe(false);
    } finally {
      await prisma.opsInquiry.deleteMany({ where: { id: { in: ids } } });
      await prisma.$disconnect();
    }
  });
});
