import { describe, expect, it, vi } from 'vitest';
import { AccountContactReadModelsService } from './account-contact-read-models.service';

describe('AccountContactReadModelsService', () => {
  it('returns only the earliest approved account email for a role', async () => {
    const findFirst = vi.fn(async () => ({ email: 'admin@example.test' }));
    const service = new AccountContactReadModelsService({ opsUser: { findFirst } } as never);

    await expect(service.findApprovedEmailByRole('pmcm-admin')).resolves.toBe('admin@example.test');
    expect(findFirst).toHaveBeenCalledWith({
      where: { role: 'pmcm-admin', approvalStatus: 'approved' },
      orderBy: { createdAt: 'asc' },
      select: { email: true },
    });
  });

  it('resolves requester notification addresses by approved display name', async () => {
    const findFirst = vi.fn(async () => ({ email: 'alex@example.test' }));
    const service = new AccountContactReadModelsService({ opsUser: { findFirst } } as never);

    await expect(service.findApprovedEmailByName('Alex')).resolves.toBe('alex@example.test');
    expect(findFirst).toHaveBeenCalledWith({
      where: { name: 'Alex', approvalStatus: 'approved' },
      select: { email: true },
    });
  });
});
