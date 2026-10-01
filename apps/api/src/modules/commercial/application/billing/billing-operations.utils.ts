import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { PrismCommandContext } from '@prism/kernel/shared-kernel';
import type { BillingActor } from '../../contracts/billing-operations.types';

export function requireBillingActor(actor: BillingActor | undefined): BillingActor {
  if (!actor?.id?.trim() || !actor.name?.trim() || !actor.role?.trim()) {
    throw new ForbiddenException('Verified billing actor is required');
  }
  return actor;
}

export function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function timestamp(value: Date) {
  return value.toISOString();
}

export function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

export function parseDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid date');
  return date;
}

export function auditMetadata(actor: BillingActor, metadata: Record<string, unknown> = {}) {
  const next: Record<string, unknown> = { ...metadata, actorId: actor.id };
  if (actor.correlationId) next.correlationId = actor.correlationId;
  return Object.keys(next).length > 0 ? next : undefined;
}

export function billingCommandContext(
  eventId: string,
  commandName: string,
  idempotencyKey: string | undefined,
  actor: BillingActor,
): PrismCommandContext | undefined {
  if (!idempotencyKey) return undefined;
  return {
    actorId: actor.id,
    actorRole: actor.role,
    eventId,
    correlationId: actor.correlationId ?? `${commandName}:${eventId}:${idempotencyKey}`,
    idempotencyKey,
  };
}
