import type { Prisma } from '@prisma/client';
import type { CreatePrivacyLegalHoldInput } from '@prism/types';

export type PrivacyLegalHoldScope = {
  subjectType: string;
  subjectEmail: string;
  subjectName: string;
  eventId: string | null;
};

export function normalizePrivacyLegalHoldScope(input: CreatePrivacyLegalHoldInput): PrivacyLegalHoldScope {
  const subjectType = input.subjectType.trim().toLowerCase();
  return {
    subjectType,
    subjectEmail: subjectType === 'guest' ? '' : input.subjectEmail?.trim().toLowerCase() ?? '',
    subjectName: subjectType === 'guest' ? input.subjectName?.trim().toLowerCase() ?? '' : '',
    eventId: input.eventId?.trim() || null,
  };
}

export function privacyRequestLegalHoldScope(request: {
  subjectType: string;
  subjectEmail: string;
  subjectName: string;
  eventId?: string | null;
}): PrivacyLegalHoldScope {
  const subjectType = request.subjectType.trim().toLowerCase();
  return {
    subjectType,
    subjectEmail: subjectType === 'guest' ? '' : request.subjectEmail.trim().toLowerCase(),
    subjectName: subjectType === 'guest' ? request.subjectName.trim().toLowerCase() : '',
    eventId: request.eventId?.trim() || null,
  };
}

export function legalHoldIdentityWhere(scope: PrivacyLegalHoldScope): Prisma.OpsPrivacyLegalHoldWhereInput {
  return {
    subjectType: scope.subjectType,
    subjectEmail: scope.subjectType === 'guest'
      ? ''
      : scope.subjectEmail.trim().toLowerCase(),
    subjectName: scope.subjectType === 'guest'
      ? scope.subjectName.trim().toLowerCase()
      : '',
  };
}

export function activeLegalHoldWhere(scope: PrivacyLegalHoldScope): Prisma.OpsPrivacyLegalHoldWhereInput {
  return {
    ...legalHoldIdentityWhere(scope),
    releasedAt: null,
    // A global deletion covers every event, so every active event-scoped hold must block it.
    ...(scope.eventId ? { OR: [{ eventId: null }, { eventId: scope.eventId }] } : {}),
  };
}

export function exactActiveLegalHoldWhere(scope: PrivacyLegalHoldScope): Prisma.OpsPrivacyLegalHoldWhereInput {
  return {
    ...legalHoldIdentityWhere(scope),
    eventId: scope.eventId,
    releasedAt: null,
  };
}

export function privacyLegalHoldLockKeys(scope: PrivacyLegalHoldScope): string[] {
  const subjectType = scope.subjectType.trim().toLowerCase();
  const identity = (subjectType === 'guest' ? scope.subjectName : scope.subjectEmail).trim().toLowerCase();
  const subjectLock = `privacy-legal-hold:subject:${JSON.stringify([subjectType, identity])}`;
  const eventId = scope.eventId?.trim();
  return eventId
    ? [subjectLock, `privacy-legal-hold:event:${JSON.stringify([subjectType, identity, eventId])}`]
    : [subjectLock];
}
