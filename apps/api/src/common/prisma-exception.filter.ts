import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { isSerializationConflict } from '../kernel/database/serialization-retry';

const DATABASE_UNAVAILABLE_MESSAGE =
  'P.R.I.S.M database is unavailable. Check the prism-api database URL/network, then run npm run db:doctor:runtime.';

type ProblemBody = { statusCode: number; error: string; message: string };

function problem(statusCode: number, error: string, message: string): ProblemBody {
  return { statusCode, error, message };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function errorText(exception: unknown) {
  if (exception instanceof Error) return `${exception.name} ${exception.message}`;
  if (!isObject(exception)) return String(exception);

  const parts = [
    exception.name,
    exception.message,
    isObject(exception.cause) ? exception.cause.originalMessage ?? exception.cause.message : undefined,
  ];
  return parts.filter(Boolean).join(' ');
}

function isPrismaDatabaseUnavailable(exception: unknown) {
  if (exception instanceof Prisma.PrismaClientKnownRequestError && exception.code === 'P1001') {
    return true;
  }

  if (exception instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  const text = errorText(exception);
  return (
    text.includes('DriverAdapterError') ||
    text.includes('ENOTFOUND') ||
    text.includes('ECIRCUITBREAKER') ||
    text.includes("Can't reach database") ||
    text.includes('too many authentication failures')
  );
}

/**
 * Logs the route pattern (for example `/api/quote-requests/:token`) rather than
 * the raw URL, so tokens and access codes carried in paths or query strings stay
 * out of the logs. Request bodies are never logged.
 */
function requestLabel(request: Request | undefined) {
  if (!request) return 'unknown request';
  const route: unknown = request.route;
  const routePath = isObject(route) && typeof route.path === 'string' ? route.path : undefined;
  return `${request.method ?? 'UNKNOWN'} ${routePath ?? request.path ?? 'unknown path'}`;
}

function exceptionSummary(exception: unknown): { detail: string; stack?: string } {
  // Prisma messages can echo query fragments; the error code is enough to triage.
  if (exception instanceof Prisma.PrismaClientKnownRequestError) return { detail: `${exception.name} ${exception.code}` };
  if (exception instanceof Error) return { detail: exception.name, stack: exception.stack };
  return { detail: typeof exception };
}

function problemFor(exception: unknown): ProblemBody {
  if (exception instanceof HttpException) {
    return problem(exception.getStatus(), exception.name, exception.message);
  }

  if (isPrismaDatabaseUnavailable(exception)) {
    return problem(HttpStatus.SERVICE_UNAVAILABLE, 'Service Unavailable', DATABASE_UNAVAILABLE_MESSAGE);
  }

  // Only reached after the transaction retries in PrismaService were used up.
  if (isSerializationConflict(exception)) {
    return problem(HttpStatus.SERVICE_UNAVAILABLE, 'Service Unavailable', 'This request conflicted with another update and was not applied. Try again in a moment.');
  }

  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    if (exception.code === 'P2025') {
      return problem(HttpStatus.NOT_FOUND, 'Not Found', 'The requested record was not found.');
    }
    if (exception.code === 'P2002') {
      return problem(HttpStatus.CONFLICT, 'Conflict', 'A record with the same unique value already exists.');
    }
    if (exception.code === 'P2021') {
      return problem(
        HttpStatus.SERVICE_UNAVAILABLE,
        'Service Unavailable',
        'P.R.I.S.M database schema is not up to date. Run the pending Prisma migrations from prism-api, then retry.',
      );
    }
  }

  if (
    exception instanceof Prisma.PrismaClientKnownRequestError ||
    exception instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    return problem(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', 'A database request failed.');
  }

  return problem(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', 'An unexpected API error occurred.');
}

@Catch()
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const body = problemFor(exception);

    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const { detail, stack } = exceptionSummary(exception);
      this.logger.error(`${requestLabel(http.getRequest<Request | undefined>())} failed with ${body.statusCode}: ${detail}`, stack);
    }

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    if (body.statusCode === HttpStatus.SERVICE_UNAVAILABLE && isSerializationConflict(exception)) response.setHeader('Retry-After', '1');
    response.status(body.statusCode).json(body);
  }
}
