import { Body, Controller, Post, Req, type RawBodyRequest } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { SCENE_LIMITS } from '@prism/floorplan-scene';
import type { Request, Response } from 'express';
import { describe, expect, it } from 'vitest';
import { configureRequestBodies, shouldCompressResponse } from './http-transport';

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

@Controller('probe')
class BodyProbeController {
  @Post()
  read(@Body() body: { scene: string }, @Req() req: RawBodyRequest<Request>) {
    return { sceneLength: body.scene.length, rawBytes: req.rawBody?.length ?? 0 };
  }
}

describe('request bodies', () => {
  it('accepts a save carrying the largest valid scene, keeps the raw bytes for webhooks and still bounds the size', async () => {
    const module = await Test.createTestingModule({ controllers: [BodyProbeController] }).compile();
    const app = module.createNestApplication<NestExpressApplication>({ rawBody: true });
    configureRequestBodies(app);
    try {
      await app.listen(0, '127.0.0.1');
      const endpoint = `${await app.getUrl()}/probe`;
      const post = (body: string) => fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      const largest = JSON.stringify({ baseVersion: 7, scene: 'x'.repeat(SCENE_LIMITS.maxBytes) });

      const accepted = await post(largest);
      expect(accepted.status).toBe(201);
      expect(await accepted.json()).toEqual({ sceneLength: SCENE_LIMITS.maxBytes, rawBytes: Buffer.byteLength(largest) });
      expect((await post(JSON.stringify({ scene: 'x'.repeat(5 * 1024 * 1024) }))).status).toBe(413);
    } finally {
      await app.close();
    }
  });
});
