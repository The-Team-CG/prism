import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { map, type Observable } from 'rxjs';
import { clearSessionCookie, setSessionCookie } from './session-cookie';

function isSignedInSession(value: unknown): value is { accessToken: string; role: string; expiresAt: string } {
  if (!value || typeof value !== 'object') return false;
  const session = value as Record<string, unknown>;
  return typeof session.accessToken === 'string' && typeof session.role === 'string' && typeof session.expiresAt === 'string';
}

/** On a route that signs someone in, also sets their portal's HttpOnly session cookie. Answers that are not a session pass through. */
@Injectable()
export class SetSessionCookieInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    return next.handle().pipe(map((result: unknown) => {
      if (isSignedInSession(result)) setSessionCookie(request, response, result);
      return result;
    }));
  }
}

/** On sign-out, also clears the requesting portal's session cookie. */
@Injectable()
export class ClearSessionCookieInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    return next.handle().pipe(map((result: unknown) => {
      clearSessionCookie(request, response);
      return result;
    }));
  }
}
