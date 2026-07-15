import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { PrismVerifiedEventActor } from '@prism/types';
import type { EventSessionRequest } from '../guards/event-session.guard';

export const VerifiedEventActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): PrismVerifiedEventActor => {
    const request = context.switchToHttp().getRequest<EventSessionRequest>();
    if (!request.prismActor) {
      throw new UnauthorizedException('Missing verified event actor');
    }
    return request.prismActor;
  },
);
