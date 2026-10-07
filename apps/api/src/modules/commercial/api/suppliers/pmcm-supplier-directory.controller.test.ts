import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { EventSessionGuard } from '@prism/kernel/event-session';
import { ZodValidationPipe } from '@prism/kernel/shared';
import { OpsPmcmSupplierDirectoryController } from './pmcm-supplier-directory.controller';

const admin = { actorId: 'user_maxine', actorRole: 'pmcm-admin', actorName: 'Maxine' };

function queryPipe(methodName: string, argumentIndex: number) {
  const routeArguments = Reflect.getMetadata('__routeArguments__', OpsPmcmSupplierDirectoryController, methodName) as
    Record<string, { index: number; pipes?: unknown[] }>;
  return Object.values(routeArguments).find((argument) => argument.index === argumentIndex)?.pipes?.[0];
}

describe('OpsPmcmSupplierDirectoryController', () => {
  it('protects every focused supplier read with the verified session guard', () => {
    for (const method of ['listDirectory', 'getProfile', 'listReviews', 'listCertifications', 'listRecords']) {
      expect(Reflect.getMetadata('__guards__', OpsPmcmSupplierDirectoryController.prototype[method as keyof OpsPmcmSupplierDirectoryController])).toContain(EventSessionGuard);
    }
  });

  it('validates each directory/history/profile query with the shared Zod contract', () => {
    expect(queryPipe('listDirectory', 0)).toBeInstanceOf(ZodValidationPipe);
    expect(queryPipe('getProfile', 1)).toBeInstanceOf(ZodValidationPipe);
    expect(queryPipe('listReviews', 1)).toBeInstanceOf(ZodValidationPipe);
    expect(queryPipe('listCertifications', 1)).toBeInstanceOf(ZodValidationPipe);
    expect(queryPipe('listRecords', 1)).toBeInstanceOf(ZodValidationPipe);
  });

  it('uses only the verified PMCM actor and refuses other roles before private reads', async () => {
    const reader = { listDirectory: vi.fn(async () => ({ items: [] })) };
    const access = {
      resolveActor: vi.fn((_input, actor) => ({ role: actor.actorRole, name: actor.actorName })),
      requireActorRole: vi.fn(async (actor) => {
        if (!['pmcm-admin', 'system'].includes(actor.role)) throw new ForbiddenException();
      }),
    };
    const controller = new OpsPmcmSupplierDirectoryController(reader as any, access as any);
    await expect(controller.listDirectory({ q: '' } as any, admin as any)).resolves.toEqual({ items: [] });
    expect(access.resolveActor).toHaveBeenCalledWith({}, admin);
    expect(access.requireActorRole).toHaveBeenCalledWith({ role: 'pmcm-admin', name: 'Maxine' }, ['pmcm-admin', 'system'], 'PMCM supplier workspace');

    await expect(controller.listDirectory({ q: '' } as any, { ...admin, actorRole: 'supplier' } as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(reader.listDirectory).toHaveBeenCalledTimes(1);
  });

  it.each(['supplier', 'client', 'guest', 'coordinator', 'unknown'])('refuses the %s role before reading supplier data', async (role) => {
    const reader = { listDirectory: vi.fn() };
    const access = {
      resolveActor: vi.fn((_input, actor) => ({ role: actor.actorRole, name: actor.actorName })),
      requireActorRole: vi.fn(async (actor) => {
        if (!['pmcm-admin', 'system'].includes(actor.role)) throw new ForbiddenException();
      }),
    };
    const controller = new OpsPmcmSupplierDirectoryController(reader as any, access as any);

    await expect(controller.listDirectory({ q: '' } as any, { ...admin, actorRole: role } as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(reader.listDirectory).not.toHaveBeenCalled();
  });

  it('returns a 400 for malformed query values before invoking the reader', async () => {
    const reader = { listDirectory: vi.fn() };
    const access = {
      resolveActor: vi.fn(() => ({ role: 'pmcm-admin', name: 'Maxine' })),
      requireActorRole: vi.fn(async () => undefined),
    };
    const controller = new OpsPmcmSupplierDirectoryController(reader as any, access as any);
    const pipe = queryPipe('listDirectory', 0) as ZodValidationPipe;

    expect(() => pipe.transform({ rating: 'unbounded' }, { type: 'query' } as any)).toThrow(BadRequestException);
    expect(() => pipe.transform({ q: '', actorRole: 'pmcm-admin' }, { type: 'query' } as any)).toThrow(BadRequestException);
    expect(reader.listDirectory).not.toHaveBeenCalled();
  });
});
