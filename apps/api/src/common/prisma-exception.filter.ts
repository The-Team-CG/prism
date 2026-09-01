import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

const DATABASE_UNAVAILABLE_MESSAGE =
  'P.R.I.S.M database is unavailable. Check the prism-api database URL/network, then run npm run db:doctor:runtime.';

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

@Catch()
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    if (isPrismaDatabaseUnavailable(exception)) {
      response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Unavailable',
        message: DATABASE_UNAVAILABLE_MESSAGE,
      });
      return;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError && exception.code === 'P2021') {
      response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Unavailable',
        message:
          'P.R.I.S.M database schema is not up to date. Run the pending Prisma migrations from prism-api, then retry.',
      });
      return;
    }

    if (
      exception instanceof Prisma.PrismaClientKnownRequestError ||
      exception instanceof Prisma.PrismaClientUnknownRequestError
    ) {
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        message: 'A database request failed.',
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'An unexpected API error occurred.',
    });
  }
}
