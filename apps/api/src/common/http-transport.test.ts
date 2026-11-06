import type { Request, Response } from 'express';
import { describe, expect, it } from 'vitest';
import { shouldCompressResponse } from './http-transport';

function response(contentType: string) {
  return { getHeader: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : undefined) } as unknown as Response;
}
const request = { headers: {} } as Request;

describe('response compression', () => {
  it('compresses JSON but never buffers a server-sent event stream', () => {
    expect(shouldCompressResponse(request, response('application/json; charset=utf-8'))).toBe(true);
    expect(shouldCompressResponse(request, response('text/event-stream'))).toBe(false);
  });
});
