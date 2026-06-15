import type { ArgumentsHost } from '@nestjs/common';
import { BadRequestException, HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PrismaExceptionFilter } from './prisma-exception.filter';

function createHttpHost() {
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
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return { host, response };
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

    filter.catch(driverAdapterError as never, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(response.body).toMatchObject({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      error: 'Service Unavailable',
      message:
        'P.R.I.S.M database is unavailable. Check the prism-api database URL/network, then run npm run db:doctor:runtime.',
    });
  });

  it('preserves ordinary Nest HTTP exceptions', () => {
    const filter = new PrismaExceptionFilter();
    const { host, response } = createHttpHost();
    const exception = new BadRequestException('Validation failed');

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.body).toMatchObject({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Validation failed',
      error: 'Bad Request',
    });
  });

  it('does not label non-database errors as database outages', () => {
    const filter = new PrismaExceptionFilter();
    const { host, response } = createHttpHost();

    filter.catch(new Error('Unexpected worker failure'), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.body).toMatchObject({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'An unexpected API error occurred.',
    });
  });
});
