import { ForbiddenException } from '@nestjs/common';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { describe, expect, it, vi } from 'vitest';
import { EventGamesPersistenceAdapter } from './event-games-persistence.adapter';
import { EventGamesLobbyPrismaStoreAdapter } from './event-games-lobby-prisma-store.adapter';

const eventId = 'event-1';

function createTransaction(results: unknown[][]) {
  const statements: Array<{ sql: string; values: unknown[] }> = [];
  const queryRaw = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = strings.reduce((text, segment, index) =>
      `${text}${segment}${index < values.length ? '?' : ''}`, '');
    statements.push({ sql, values });
    return results.shift() ?? [];
  });
  const executeRaw = vi.fn(async () => 1);
  const transaction = { prisma: { $queryRaw: queryRaw, $executeRaw: executeRaw } } as unknown as PrismTransactionContext;
  return { transaction, queryRaw, executeRaw, statements };
}

describe('EventGames public lobby adapters', () => {
  it('reads persisted event branding while keeping the logo reference event-scoped', async () => {
    const { transaction, statements } = createTransaction([[
      { brand_theme: 'forest', brand_primary_color: '#14532D', brand_secondary_color: null, brand_logo_object_id: 'obj_logo' },
    ]]);
    const adapter = new EventGamesLobbyPrismaStoreAdapter();

    await expect(adapter.findLobbyBranding(eventId, transaction)).resolves.toEqual({
      theme: 'forest', primaryColor: '#14532D', secondaryColor: null, logoObjectId: 'obj_logo',
    });

    expect(statements[0]?.sql.replace(/\s+/g, ' ').trim()).toContain(
      'SELECT "brand_theme", "brand_primary_color", "brand_secondary_color", "brand_logo_object_id" FROM "event_games"."lobby_slugs"',
    );
    expect(statements[0]?.values).toEqual([eventId]);
  });

  it('persists lobby slug provisioning through the host-command transaction', async () => {
    const slug = 'A'.repeat(43);
    const { transaction, statements } = createTransaction([[{ event_id: eventId, lobby_slug: slug }]]);
    const adapter = new EventGamesPersistenceAdapter({} as never);

    const result = await adapter.executeHostCommand({
      eventId,
      actorId: 'host-1',
      resourceType: 'lobby',
      resourceId: eventId,
      action: 'provision_lobby',
      command: { lobbySlug: slug },
      requestReceiptId: `provision-game-lobby:${eventId}:${slug}`,
    }, transaction);

    expect(statements).toHaveLength(1);
    expect(statements[0]?.sql).toContain('INSERT INTO "event_games"."lobby_slugs"');
    expect(statements[0]?.values).toEqual([eventId, slug]);
    expect(result).toMatchObject({
      eventId,
      resourceType: 'lobby',
      resourceId: eventId,
      action: 'provision_lobby',
      outcome: 'created',
      resultId: slug,
      transition: { beforeStatus: null, afterStatus: 'published' },
    });
  });

  it('reuses an already persisted event slug on provisioning retry', async () => {
    const priorSlug = 'B'.repeat(43);
    const { transaction, statements } = createTransaction([
      [],
      [{ event_id: eventId, lobby_slug: priorSlug }],
    ]);
    const adapter = new EventGamesPersistenceAdapter({} as never);

    const result = await adapter.executeHostCommand({
      eventId,
      actorId: 'host-1',
      resourceType: 'lobby',
      resourceId: eventId,
      action: 'provision_lobby',
      command: { lobbySlug: 'A'.repeat(43) },
      requestReceiptId: 'receipt-retry',
    }, transaction);

    expect(statements).toHaveLength(2);
    expect(statements[1]?.sql).toContain('WHERE "event_id" = ? FOR UPDATE');
    expect(result.resultId).toBe(priorSlug);
    expect(result.outcome).toBe('already_exists');
    expect(result.transition).toEqual({ beforeStatus: 'published', afterStatus: 'published', beforeVersion: 1, afterVersion: 1 });
  });

  it('persists a theme change with its actor and captures before/after values for audit', async () => {
    const { transaction, statements } = createTransaction([
      [{ event_id: eventId, brand_theme: 'prism', brand_primary_color: null, brand_secondary_color: null, brand_logo_object_id: null }],
      [{ event_id: eventId, brand_theme: 'forest' }],
    ]);
    const adapter = new EventGamesPersistenceAdapter({} as never);

    const result = await adapter.executeHostCommand({
      eventId,
      actorId: 'host-1',
      resourceType: 'lobby',
      resourceId: eventId,
      action: 'update_lobby_branding',
      command: { theme: 'forest' },
      requestReceiptId: 'theme-change-1',
    }, transaction);

    expect(statements).toHaveLength(2);
    expect(statements[0]?.sql).toContain('FOR UPDATE');
    expect(statements[1]?.sql).toContain('"brand_updated_by" = ?');
    expect(statements[1]?.values).toEqual(['forest', null, null, null, 'host-1', eventId]);
    expect(result).toMatchObject({
      outcome: 'updated', resultId: 'forest',
      transition: { beforeStatus: 'prism', afterStatus: 'forest' },
    });
  });

  it('filters public Independent games by persisted availability window', async () => {
    const { transaction, statements } = createTransaction([[]]);
    const adapter = new EventGamesLobbyPrismaStoreAdapter();

    await adapter.listPublicIndependentGames(eventId, transaction);

    const sql = statements[0]?.sql ?? '';
    expect(sql).toContain('"available_from" IS NULL OR "available_from" <= NOW()');
    expect(sql).toContain('"available_until" IS NULL OR NOW() < "available_until"');
    expect(statements[0]?.values).toEqual([eventId]);
  });

  it('reuses only an active participant credential scoped to the requested event', async () => {
    const tokenDigest = 'c'.repeat(64);
    const session = {
      id: 'session-1',
      event_id: eventId,
      game_definition_id: 'game-1',
      status: 'live',
      title: 'Word Scramble',
      game_kind: 'word-scramble',
      participant_credential_id: null,
      token_digest: null,
    };
    const { transaction, executeRaw, statements } = createTransaction([
      [],
      [{ id: 'credential-1', event_id: eventId, revoked_at: null }],
      [session],
      [{ token_digest: tokenDigest }],
      [{ ...session, participant_credential_id: 'credential-1', token_digest: tokenDigest }],
    ]);
    const adapter = new EventGamesLobbyPrismaStoreAdapter();

    const result = await adapter.createIndependentSessionAndGrant({
      eventId,
      gameId: 'game-1',
      idempotencyKey: 'd'.repeat(43),
      tokenDigest,
      credentialId: 'unused-credential-id',
      createCredential: false,
      sessionId: 'session-1',
      grantId: 'grant-1',
    }, transaction);

    expect(result).toMatchObject({ sessionId: 'session-1', title: 'Word Scramble', status: 'live' });
    expect(executeRaw).toHaveBeenCalledOnce();
    expect(statements[1]?.sql).toContain('"event_id" = ?');
    expect(statements[1]?.sql).toContain('"revoked_at" IS NULL');
    expect(statements[1]?.values).toEqual([eventId, tokenDigest]);
    expect(statements.every(({ sql }) => !sql.includes('INSERT INTO "event_games"."participant_credentials"'))).toBe(true);
  });

  it('rejects a credential that exists only under a different event', async () => {
    const requestedEventId = 'event-2';
    const eventOneCredentialDigest = 'e'.repeat(64);
    const { transaction, executeRaw, statements } = createTransaction([[], []]);
    const adapter = new EventGamesLobbyPrismaStoreAdapter();

    await expect(adapter.createIndependentSessionAndGrant({
      eventId: requestedEventId,
      gameId: 'game-1',
      idempotencyKey: 'd'.repeat(43),
      tokenDigest: eventOneCredentialDigest,
      credentialId: 'unused-credential-id',
      createCredential: false,
      sessionId: 'session-1',
      grantId: 'grant-1',
    }, transaction)).rejects.toBeInstanceOf(ForbiddenException);

    expect(executeRaw).not.toHaveBeenCalled();
    expect(statements[1]?.values).toEqual([requestedEventId, eventOneCredentialDigest]);
    expect(statements[1]?.sql).toContain('"event_id" = ?');
    expect(statements[1]?.sql).toContain('"revoked_at" IS NULL');
  });
});
