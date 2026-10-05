import { describe, expect, it } from 'vitest';
import { ApplicationConfig } from '@nestjs/core/application-config';
import { NestContainer } from '@nestjs/core/injector/container';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';
import { NoopGraphInspector } from '@nestjs/core/inspector/noop-graph-inspector';
import { DependenciesScanner } from '@nestjs/core/scanner';
import { COMMAND_RECEIPT_STORE } from '@prism/kernel/event-core';
import { PLATFORM_REFERENCE_READ_MODEL } from '@prism/contexts/read-models';
import { LIFECYCLE_PRIVACY_REDACTOR } from '@prism/contexts/event-lifecycle';
import { COMMERCIAL_PRIVACY_REDACTOR } from '@prism/contexts/commercial';
import { OPERATIONS_PRIVACY_REDACTOR } from '@prism/contexts/operations';
import { IDENTITY_PRIVACY_REDACTOR } from '@prism/contexts/identity-access';
import { CommercialModule } from './modules/commercial/commercial.module';
import { EventLifecycleModule } from './modules/event-lifecycle/event-lifecycle.module';
import { IdentityAccessModule } from './modules/identity-access/identity-access.module';
import { OperationsModule } from './modules/operations/operations.module';
import { PlatformOpsModule } from './modules/platform-ops/platform-ops.module';
import { PrivacyOperationsService } from './modules/platform-ops/application/trust/privacy-operations.service';
import { PlatformPrivacyModule } from './modules/platform-ops/platform-privacy.module';
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
    for (const contextModule of [CommercialModule, EventLifecycleModule, IdentityAccessModule, OperationsModule, PlatformOpsModule, PlatformPrivacyModule]) {
      const exports = Reflect.getMetadata('exports', contextModule) as unknown[];
      expect(exports.flatMap((provider, index) => provider === undefined ? [index] : []), `${contextModule.name} undefined export positions`).toEqual([]);
    }
    const applicationConfig = new ApplicationConfig();
    const container = new NestContainer(applicationConfig, { abortOnError: false });
    const scanner = new DependenciesScanner(container, new MetadataScanner(), NoopGraphInspector, applicationConfig);

    await scanner.scan(AppModule);

    expect([...container.getModules().values()].some(({ metatype }) => metatype === AppModule)).toBe(true);
    expect([...container.getModules().values()].some(({ metatype }) => metatype === PlatformPrivacyModule)).toBe(true);
    expect([...container.getModules().values()].some(({ providers }) => providers.has(COMMAND_RECEIPT_STORE))).toBe(true);
    expect([...container.getModules().values()].some(({ providers }) => providers.has(PLATFORM_REFERENCE_READ_MODEL))).toBe(true);
    expect([...container.getModules().values()].some(({ providers }) => providers.has(PrivacyOperationsService))).toBe(true);
    expect([LIFECYCLE_PRIVACY_REDACTOR, COMMERCIAL_PRIVACY_REDACTOR, OPERATIONS_PRIVACY_REDACTOR, IDENTITY_PRIVACY_REDACTOR]
      .every((token) => [...container.getModules().values()].some(({ providers }) => providers.has(token)))).toBe(true);
  });
});
