import { Controller, Get, Module, StreamableFile } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { TransformInterceptor } from './transform.interceptor';

const fileBytes = Buffer.from('%PDF-1.7\nByte-identical portal download\n%%EOF');

@Controller()
class DownloadProbeController {
  @Get('file')
  download() {
    return new StreamableFile(fileBytes, { type: 'application/pdf' });
  }

  @Get('metadata')
  metadata() {
    return { fileName: 'document.pdf' };
  }
}

@Module({ controllers: [DownloadProbeController] })
class DownloadProbeModule {}

describe('API response transport', () => {
  it('streams original file bytes while retaining the JSON response envelope', async () => {
    const app = await NestFactory.create(DownloadProbeModule, { logger: false });
    try {
      app.useGlobalInterceptors(new TransformInterceptor());
      await app.listen(0, '127.0.0.1');
      const baseUrl = await app.getUrl();
      const file = await fetch(`${baseUrl}/file`);
      expect(file.status).toBe(200);
      expect(file.headers.get('content-type')).toBe('application/pdf');
      expect(Buffer.from(await file.arrayBuffer())).toEqual(fileBytes);
      const metadata = await fetch(`${baseUrl}/metadata`);
      expect(await metadata.json()).toEqual({ data: { fileName: 'document.pdf' } });
    } finally {
      await app.close();
    }
  }, 30_000);
});
