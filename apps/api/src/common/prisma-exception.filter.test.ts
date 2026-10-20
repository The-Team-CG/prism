import type { ArgumentsHost } from '@nestjs/common';
import { BadRequestException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaExceptionFilter } from './prisma-exception.filter';

function createHttpHost(request = { method: 'POST', path: '/api/quote-requests/secret-token/quote', route: { path: '/api/quote-requests/:token/quote' } }) {
  const response = {
    body: undefined as unknown,
    json: vi.fn(function json(body: unknown) {
      response.body = body;
      return response;
    }),
    status: vi.fn(function status() {
      return response;
    }),
  };

  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return { host, response };
}

function prismaKnownError(code: string, message = `Prisma ${code} failure`) {
  return new Prisma.PrismaClientKnownRequestError(message, { code, clientVersion: 'test' });
}

describe('PrismaExceptionFilter', () => {
  it('maps Prisma driver adapter connection failures to service unavailable', () => {
    const filter = new PrismaExceptionFilter();
    const { host, response } = createHttpHost();
    const driverAdapterError = {
      name: 'DriverAdapterError',
      cause: {
        kind: 'postgres',
        originalCode: 'XX000',
        originalMessage: '(ECIRCUITBREAKER) too many authentication failures, new connections are temporarily blocked',
      },
    };
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    filter.catch(driverAdapterError as never, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(response.body).toMatchObject({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      error: 'Service Unavailable',
      message:
        'P.R.I.S.M database is unavailable. Check the prism-api database URL/network, then run npm run db:doctor:runtime.',
    });
  });

  it('preserves ordinary Nest HTTP exceptions without logging client errors', () => {
    const filter = new PrismaExceptionFilter();
    const { host, response } = createHttpHost();
    const exception = new BadRequestException('Validation failed');
    const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.body).toMatchObject({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Validation failed',
      error: 'Bad Request',
    });
    expect(logError).not.toHaveBeenCalled();
  });

  it.each([
    ['P2025', HttpStatus.NOT_FOUND, 'Not Found', 'The requested record was not found.'],
    ['P2002', HttpStatus.CONFLICT, 'Conflict', 'A record with the same unique value already exists.'],
  ])('maps Prisma %s to a %i problem response without exposing Prisma details', (code, statusCode, error, message) => {
    const filter = new PrismaExceptionFilter();
    const { host, response } = createHttpHost();
    const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    filter.catch(prismaKnownError(code, 'Unique constraint failed on the fields: (`email`)'), host);

    expect(response.status).toHaveBeenCalledWith(statusCode);
    expect(response.body).toEqual({ statusCode, error, message });
    expect(logError).not.toHaveBeenCalled();
  });

  it('logs unexpected errors by route pattern and returns a generic 500 without internals', () => {
    const filter = new PrismaExceptionFilter();
    const { host, response } = createHttpHost();
    const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const failure = new Error('connect ECONNREFUSED internal-host:5432 password=hunter2');
    failure.name = 'WorkerFailure';

    filter.catch(failure, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.body).toEqual({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'An unexpected API error occurred.',
    });
    expect(JSON.stringify(response.body)).not.toMatch(/hunter2|internal-host|stack|WorkerFailure/);
    expect(logError).toHaveBeenCalledTimes(1);
    const [logMessage] = logError.mock.calls[0] as [string, string?];
    expect(logMessage).toContain('POST /api/quote-requests/:token/quote');
    expect(logMessage).toContain('500');
    expect(logMessage).not.toContain('secret-token');
  });

  it('logs unmapped Prisma failures by error code only and returns a generic database 500', () => {
    const filter = new PrismaExceptionFilter();
    const { host, response } = createHttpHost();
    const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    filter.catch(prismaKnownError('P2003', 'Foreign key constraint violated: value=client@example.test'), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.body).toEqual({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'A database request failed.',
    });
    const [logMessage] = logError.mock.calls[0] as [string, string?];
    expect(logMessage).toContain('P2003');
    expect(logMessage).not.toContain('client@example.test');
  });
});
