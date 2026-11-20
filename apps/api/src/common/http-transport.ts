import compression from 'compression';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response } from 'express';

/**
 * JSON request bodies up to 4 MB. Express defaults to 100 kB, which refused floor plan saves long before the
 * scene validator's 2 MB cap; this leaves room for that scene, its envelope and multi-byte names.
 */
export const JSON_BODY_LIMIT = '4mb';

/** Call before the app initialises so Nest keeps this parser, with `rawBody`, instead of its 100 kB default. */
export function configureRequestBodies(app: NestExpressApplication) {
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
}

/**
 * Compress JSON responses. Read models such as the PMCM workspace are 100+ KB of JSON and compress about
 * 8-10x. Server-sent event streams are excluded: compression buffers output, which would hold back events.
 */
export function responseCompression() {
  return compression({ threshold: 1024, filter: shouldCompressResponse });
}

export function shouldCompressResponse(req: Request, res: Response): boolean {
  const contentType = String(res.getHeader('Content-Type') ?? '');
  if (contentType.startsWith('text/event-stream')) return false;
  return compression.filter(req, res);
}

/**
 * How long browsers may reuse a CORS preflight answer. Every authenticated JSON request from a portal
 * on another origin is preflighted; without a max age Chromium re-asks after 5 s, adding a round trip.
 */
export const CORS_PREFLIGHT_MAX_AGE_SECONDS = 2 * 60 * 60;
