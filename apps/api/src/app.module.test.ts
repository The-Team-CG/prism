import { NestFactory } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { AppModule } from './app.module';

/**
 * Guards the boot path itself. Nest DI metadata is invisible to `tsc`, so a
 * module that exports a token nothing provides typechecks cleanly and then
 * dies during module scanning with `UnknownExportException` -- the process
 * exits before port 4000 ever opens. Preview mode builds the entire module
 * graph without instantiating providers, so this needs no database, no
 * environment, and stays fast.
 */
describe('AppModule', () => {
  it('resolves the whole module graph without instantiating providers', async () => {
    const app = await NestFactory.create(AppModule, {
      preview: true,
      abortOnError: false,
      logger: false,
    });

    expect(app).toBeDefined();
    await app.close();
  });
});
