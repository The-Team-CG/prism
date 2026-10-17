import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismTransactionRunner } from '@prism/kernel/shared-kernel';
import { GAME_PIN_STORE, type GamePinStorePort } from '../contracts/game-pin-store.port';

type GameParticipantRequest = {
  params?: { sessionId?: string };
  headers?: Record<string, string | string[] | undefined>;
};

const PARTICIPANT_CREDENTIAL_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const UNAUTHORIZED_MESSAGE = 'Game participant access is not authorized';

@Injectable()
export class GameParticipantGuard implements CanActivate {
  constructor(
    @Inject(GAME_PIN_STORE) private readonly pinStore: GamePinStorePort,
    private readonly transactions: PrismTransactionRunner,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GameParticipantRequest>();
    const sessionId = request.params?.sessionId;
    const credential = request.headers?.['x-prism-game-credential'];
    if (!sessionId || typeof credential !== 'string' || !PARTICIPANT_CREDENTIAL_PATTERN.test(credential)) {
      throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
    }

    const tokenDigest = createHash('sha256').update(credential).digest('hex');
    const authorized = await this.transactions.run(
      (transaction) => this.pinStore.isParticipantAuthorized({ sessionId, tokenDigest }, transaction),
      { actorId: 'anonymous-game-participant' },
    );
    if (!authorized) throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
    return true;
  }
}
