import { describe, expect, it } from 'vitest';
import { ApplicationConfig } from '@nestjs/core/application-config';
import { NestContainer } from '@nestjs/core/injector/container';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';
import { NoopGraphInspector } from '@nestjs/core/inspector/noop-graph-inspector';
import { DependenciesScanner } from '@nestjs/core/scanner';
import { COMMAND_RECEIPT_STORE } from '@prism/kernel/event-core';
import { AppModule } from './app.module';

/**
 * Guards the boot path itself. Nest DI metadata is invisible to `tsc`, so a
 * module that exports a token nothing provides typechecks cleanly and then
 * dies during module scanning with `UnknownExportException`. Scan the module
 * graph directly instead of using Nest's preview bootstrap: preview still
 * starts provider dependency resolution and can leave an internal barrier
 * promise pending for this graph's forward references.
 */
describe('AppModule', () => {
  it('scans the whole module graph without instantiating providers', async () => {
    const applicationConfig = new ApplicationConfig();
    const container = new NestContainer(applicationConfig, { abortOnError: false });
    const scanner = new DependenciesScanner(container, new MetadataScanner(), NoopGraphInspector, applicationConfig);

    await scanner.scan(AppModule);

    expect([...container.getModules().values()].some(({ metatype }) => metatype === AppModule)).toBe(true);
    expect([...container.getModules().values()].some(({ providers }) => providers.has(COMMAND_RECEIPT_STORE))).toBe(true);
  });
});
