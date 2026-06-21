# Prism Backend Modular Monolith Phase 6 File Ops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract file requirement and upload metadata behavior into `file-ops` while preserving existing event, closure, guest, supplier, and client file routes.

**Architecture:** `file-ops` owns the File Requirements Matrix and document upload metadata validation. `EventOpsService`, closure, guest, and supplier compatibility paths keep their current route contracts while importing the file behavior from `@prism/modules/file-ops`. Real object storage and production signed URLs stay gated; this phase adds only a typed signed-upload URL contract and a local fake contract test.

**Tech Stack:** NestJS modules/providers, PrismaService, Vitest, TypeScript path aliases, existing `event-ops` compatibility facade, `scripts/check-prism-boundaries.mjs`, and current file matrix/document-vault tests.

---

## Owner D Evidence Gate

| Evidence item | Required answer |
| --- | --- |
| Owner D system goal | Platform trust through role-visible file requirements, upload metadata validation, and explicit storage-provider gate. |
| Feature-ledger row | FL-006 document and file operations, FL-024 File Requirements Matrix, FL-004 client portal after conforme, FL-013 closure/archive gates. |
| Route/app/actor | Existing `GET /events/:eventId/file-requirements` through `apps/api`; PMCM and client actors read filtered matrix rows; supplier/guest must not receive client-only files. Supplier contract and guest feedback upload metadata validation keep existing route behavior. |
| Contract touched | Backend module exports and API TypeScript aliases. No `packages/types` or `packages/api-client` changes unless a compile failure proves an existing compatibility export is required. |
| Fallback state | Existing event-ops route facade stays. Real storage provider and production signed URLs remain gated; no cloud storage credentials or network calls are introduced. |
| Forbidden-role test | Existing `event-ops.service.test.ts` client-visible/PMCM-visible matrix tests must keep passing; add a supplier/guest denial or filtering assertion only if the route currently permits it without broad fixture rewrites. |
| Query budget | `FileRequirementsMatrixService.buildForEvent` uses one event lookup and five bounded relation queries for the requested event; no per-row Prisma loops. |
| Side-effect mode | File matrix reads are `read_only`. Document-vault upload validation is in-memory validation only; it does not create DB rows or external storage objects. |
| Route-smoke evidence | `npm --workspace prism-api run test -- libs/modules/file-ops/src/services/file-requirements-matrix.service.test.ts libs/modules/file-ops/src/services/document-vault.service.test.ts libs/modules/file-ops/src/ports/signed-upload-url-factory.port.test.ts`, `npm --workspace prism-api run test -- file`, `npm --workspace prism-api run test:event-ops`, `npm --workspace prism-api run build`, `npm run check:boundaries`. |
| Docs updated | Parent Phase 6 checklist, this child plan, `docs/prism-v4/15-system-architecture.md`, and `docs/prism-v4/17-current-state-2026-06-20.md`. |

## Current Findings

- `FileRequirementsMatrixService` depends only on `PrismaService` and builds role-filterable matrix metadata from event, document, post-event document, billing, payment, and supplier review rows.
- `DocumentVaultService` validates file name, MIME type, size, and deterministic storage key shape locally. It does not upload bytes or contact external storage.
- `EventOpsService.getFileRequirements` already performs actor event-read checks, then filters matrix items by `visibleToRoles`.
- `EventClosureService.closeGates` depends on `FileRequirementsMatrixService`.
- `GuestWorkflowService` and `SupplierNetworkWorkflowService` depend on document-vault upload metadata validation. Supplier uses a supplier-owned port currently bound in `EventOpsModule`; guest imports `DocumentVaultService` directly.
- Existing tests cover file matrix role filtering inside `event-ops.service.test.ts` and upload metadata validation in `document-vault.service.test.ts`. There is no standalone file matrix service test yet.

## Scope Rules

In scope:

- Create `apps/api/libs/modules/file-ops`.
- Move `FileRequirementsMatrixService` and `DocumentVaultService` plus their tests.
- Add `FileOpsModule` that provides/exports `FileRequirementsMatrixService`, `DocumentVaultService`, `FILE_REQUIREMENT_READER`, `FILE_REQUIREMENT_COMMANDS`, and `SIGNED_UPLOAD_URL_FACTORY` using a local contract-only adapter.
- Add public ports: `FileRequirementReader`, `FileRequirementCommands`, `SignedUploadUrlFactory`.
- Keep `event-ops` compatibility re-exports for the moved service paths.
- Update EventOpsModule, EventOpsService test construction, EventClosureService, GuestWorkflowService, and supplier document-vault binding to import from `@prism/modules/file-ops`.
- Add a focused file matrix service test and a signed-upload URL contract test that proves the default local factory is disabled/gated.

Out of scope:

- Real object storage adapter rollout, signed URL network calls, upload sessions, progress/retry/bulk upload, delete/download audit workflows, controller moves, shared package contract changes, and read-model extraction.
- Moving `EventReadModelsService`, `InquiriesService.uploadConforme`, `GuestWorkflowService`, `SupplierNetworkWorkflowService`, or `EventClosureService` into owning modules.
- Adding external credentials or enabling production storage behavior.

## Files To Create Or Move

| File | Purpose |
| --- | --- |
| `apps/api/libs/modules/file-ops/src/services/file-requirements-matrix.service.ts` | Moved File Requirements Matrix reader/close-gate owner. |
| `apps/api/libs/modules/file-ops/src/services/file-requirements-matrix.service.test.ts` | Focused file matrix read/close-gate tests. |
| `apps/api/libs/modules/file-ops/src/services/document-vault.service.ts` | Moved upload metadata validator. |
| `apps/api/libs/modules/file-ops/src/services/document-vault.service.test.ts` | Existing upload metadata validation tests. |
| `apps/api/libs/modules/file-ops/src/ports/file-ops.tokens.ts` | `FILE_REQUIREMENT_COMMANDS`, `FILE_REQUIREMENT_READER`, `SIGNED_UPLOAD_URL_FACTORY` tokens. |
| `apps/api/libs/modules/file-ops/src/ports/file-requirement-reader.port.ts` | Public read interface for matrix and close gates. |
| `apps/api/libs/modules/file-ops/src/ports/file-requirement-commands.port.ts` | Public command interface; no mutating implementation in this slice. |
| `apps/api/libs/modules/file-ops/src/ports/signed-upload-url-factory.port.ts` | Signed upload URL contract and local gated factory. |
| `apps/api/libs/modules/file-ops/src/ports/signed-upload-url-factory.port.test.ts` | Contract test proving the local factory does not enable storage accidentally. |
| `apps/api/libs/modules/file-ops/src/file-ops.module.ts` | Runtime module exporting moved services and public tokens. |
| `apps/api/libs/modules/file-ops/src/index.ts` | Public file-ops exports. |
| `apps/api/libs/modules/file-ops/tsconfig.lib.json` | Library tsconfig. |
| `apps/api/libs/modules/event-ops/src/services/file-requirements-matrix.service.ts` | Compatibility re-export. |
| `apps/api/libs/modules/event-ops/src/services/document-vault.service.ts` | Compatibility re-export. |
| `apps/api/libs/modules/event-ops/src/event-ops.module.ts` | Import `FileOpsModule`; remove local file providers; keep supplier port binding through file-ops provider. |
| `apps/api/libs/modules/event-ops/src/event-ops.service.ts` | Import file matrix/document-vault types from `@prism/modules/file-ops`. |
| `apps/api/libs/modules/event-ops/src/event-ops.service.test.ts` | Import moved services from `@prism/modules/file-ops`. |
| `apps/api/libs/modules/event-ops/src/services/event-closure.service.ts` | Import `FileRequirementsMatrixService` from file-ops. |
| `apps/api/libs/modules/event-ops/src/services/guest-workflow.service.ts` | Import `DocumentVaultService` and `UploadMetadataInput` from file-ops. |
| `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`, `apps/api/nest-cli.json` | Add file-ops aliases and Nest metadata. |

## Task 1 - Add File Matrix Service Test Before Moving

- [ ] Create `apps/api/libs/modules/event-ops/src/services/file-requirements-matrix.service.test.ts` with this focused read/close-gate coverage:

```ts
import { describe, expect, it, vi } from 'vitest';
import { FileRequirementsMatrixService } from './file-requirements-matrix.service';

function createPrisma() {
  const event = {
    id: 'evt_file',
    floorPlanStatus: 'approved',
  };
  const documents = [
    { id: 'doc_conforme', eventId: 'evt_file', type: 'signed_conforme', status: 'approved' },
    { id: 'doc_report', eventId: 'evt_file', type: 'post_event_report', status: 'submitted' },
    { id: 'doc_feedback', eventId: 'evt_file', type: 'client_feedback', status: 'submitted' },
  ];
  const postEventDocuments = [{ id: 'post_feedback', eventId: 'evt_file', title: 'Client feedback', status: 'submitted' }];
  const billingStatements = [{ id: 'bill_1', eventId: 'evt_file' }];
  const milestones = [{ id: 'pay_1', eventId: 'evt_file', status: 'paid', remainingBalance: 0 }];
  const supplierReviews = [{ id: 'rev_1', eventId: 'evt_file' }];
  return {
    opsEvent: { findUnique: vi.fn(async () => event) },
    opsDocument: { findMany: vi.fn(async () => documents) },
    opsPostEventDocument: { findMany: vi.fn(async () => postEventDocuments) },
    opsBillingStatement: { findMany: vi.fn(async () => billingStatements) },
    opsPaymentMilestone: { findMany: vi.fn(async () => milestones) },
    opsSupplierReview: { findMany: vi.fn(async () => supplierReviews) },
  };
}

describe('FileRequirementsMatrixService', () => {
  it('builds matrix items and close gates from event-scoped records', async () => {
    const prisma = createPrisma();
    const service = new FileRequirementsMatrixService(prisma as any);

    const matrix = await service.buildForEvent('evt_file');
    const closeGates = await service.closeGates('evt_file');

    expect(matrix.eventId).toBe('evt_file');
    expect(matrix.items.map((item) => item.key)).toEqual([
      'signed_conforme',
      'post_event_documents',
      'billing_statement',
      'official_floorplan',
      'supplier_reviews',
      'client_feedback',
    ]);
    expect(matrix.items.find((item) => item.key === 'supplier_reviews')?.visibleToRoles).toEqual(['pmcm-admin']);
    expect(closeGates.ready).toBe(true);
    expect(closeGates.missingKeys).toEqual([]);
    expect(prisma.opsDocument.findMany).toHaveBeenCalledWith({ where: { eventId: 'evt_file' } });
  });
});
```

- [ ] Run `npm --workspace prism-api run test -- libs/modules/event-ops/src/services/file-requirements-matrix.service.test.ts`.
  Expected: PASS before the move; this preserves current behavior.

## Task 2 - Create File-Ops Module Shell

- [ ] Create directories `apps/api/libs/modules/file-ops/src/ports` and `apps/api/libs/modules/file-ops/src/services`.
- [ ] Add `apps/api/libs/modules/file-ops/tsconfig.lib.json`:

```json
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "outDir": "../../../dist/libs/modules/file-ops"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
```

- [ ] Add `@prism/modules/file-ops` and `@prism/modules/file-ops/*` to `apps/api/tsconfig.json`.
- [ ] Add `@prism/modules/file-ops` to `apps/api/vitest.config.ts`.
- [ ] Add a `file-ops` library project to `apps/api/nest-cli.json` with root `libs/modules/file-ops`, entry `index`, source root `libs/modules/file-ops/src`, and tsconfig `libs/modules/file-ops/tsconfig.lib.json`.

## Task 3 - Move File Services Into File-Ops

- [ ] Run:

```powershell
git mv apps/api/libs/modules/event-ops/src/services/file-requirements-matrix.service.ts apps/api/libs/modules/file-ops/src/services/file-requirements-matrix.service.ts
git mv apps/api/libs/modules/event-ops/src/services/document-vault.service.ts apps/api/libs/modules/file-ops/src/services/document-vault.service.ts
git mv apps/api/libs/modules/event-ops/src/services/document-vault.service.test.ts apps/api/libs/modules/file-ops/src/services/document-vault.service.test.ts
```

- [ ] Move the untracked file matrix test from Task 1 into `apps/api/libs/modules/file-ops/src/services/file-requirements-matrix.service.test.ts`.
- [ ] Create `apps/api/libs/modules/event-ops/src/services/file-requirements-matrix.service.ts`:

```ts
export * from '@prism/modules/file-ops';
```

- [ ] Create `apps/api/libs/modules/event-ops/src/services/document-vault.service.ts`:

```ts
export * from '@prism/modules/file-ops';
```

## Task 4 - Add File Ports And Runtime Module

- [ ] Create `apps/api/libs/modules/file-ops/src/ports/file-ops.tokens.ts`:

```ts
export const FILE_REQUIREMENT_COMMANDS = Symbol('FILE_REQUIREMENT_COMMANDS');
export const FILE_REQUIREMENT_READER = Symbol('FILE_REQUIREMENT_READER');
export const SIGNED_UPLOAD_URL_FACTORY = Symbol('SIGNED_UPLOAD_URL_FACTORY');
```

- [ ] Create `apps/api/libs/modules/file-ops/src/ports/file-requirement-reader.port.ts`:

```ts
import type { FileRequirementsMatrix } from '../services/file-requirements-matrix.service';

export interface FileRequirementReader {
  buildForEvent(eventId: string): Promise<FileRequirementsMatrix>;
  closeGates(eventId: string): Promise<unknown>;
}
```

- [ ] Create `apps/api/libs/modules/file-ops/src/ports/file-requirement-commands.port.ts`:

```ts
export interface FileRequirementCommands {
  readonly storageProviderMode: 'metadata_only';
}
```

- [ ] Create `apps/api/libs/modules/file-ops/src/ports/signed-upload-url-factory.port.ts`:

```ts
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { UploadMetadataInput, ValidatedUploadMetadata } from '../services/document-vault.service';

export type SignedUploadUrlRequest = {
  eventId: string;
  actorRole: string;
  upload: UploadMetadataInput;
  prefix: string;
};

export type SignedUploadUrlResult = {
  upload: ValidatedUploadMetadata;
  uploadUrl: string;
  expiresAt: string;
  provider: string;
};

export interface SignedUploadUrlFactory {
  createSignedUploadUrl(request: SignedUploadUrlRequest): Promise<SignedUploadUrlResult>;
}

@Injectable()
export class MetadataOnlySignedUploadUrlFactory implements SignedUploadUrlFactory {
  async createSignedUploadUrl(): Promise<SignedUploadUrlResult> {
    throw new ServiceUnavailableException('Signed upload URLs require an approved storage adapter');
  }
}
```

- [ ] Create `apps/api/libs/modules/file-ops/src/ports/signed-upload-url-factory.port.test.ts`:

```ts
import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { MetadataOnlySignedUploadUrlFactory } from './signed-upload-url-factory.port';

describe('MetadataOnlySignedUploadUrlFactory', () => {
  it('keeps signed upload URLs gated until storage is approved', async () => {
    const factory = new MetadataOnlySignedUploadUrlFactory();

    await expect(
      factory.createSignedUploadUrl({
        eventId: 'evt_file',
        actorRole: 'pmcm-admin',
        prefix: 'events/evt_file/documents',
        upload: { fileName: 'brief.pdf', mimeType: 'application/pdf', sizeBytes: 1024 },
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
```

- [ ] Create `apps/api/libs/modules/file-ops/src/file-ops.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { FILE_REQUIREMENT_COMMANDS, FILE_REQUIREMENT_READER, SIGNED_UPLOAD_URL_FACTORY } from './ports/file-ops.tokens';
import { MetadataOnlySignedUploadUrlFactory } from './ports/signed-upload-url-factory.port';
import { DocumentVaultService } from './services/document-vault.service';
import { FileRequirementsMatrixService } from './services/file-requirements-matrix.service';

const metadataOnlyFileCommands = { storageProviderMode: 'metadata_only' as const };

@Module({
  imports: [DatabaseModule],
  providers: [
    DocumentVaultService,
    FileRequirementsMatrixService,
    MetadataOnlySignedUploadUrlFactory,
    { provide: FILE_REQUIREMENT_READER, useExisting: FileRequirementsMatrixService },
    { provide: FILE_REQUIREMENT_COMMANDS, useValue: metadataOnlyFileCommands },
    { provide: SIGNED_UPLOAD_URL_FACTORY, useExisting: MetadataOnlySignedUploadUrlFactory },
  ],
  exports: [
    DocumentVaultService,
    FileRequirementsMatrixService,
    FILE_REQUIREMENT_READER,
    FILE_REQUIREMENT_COMMANDS,
    SIGNED_UPLOAD_URL_FACTORY,
  ],
})
export class FileOpsModule {}
```

- [ ] Create `apps/api/libs/modules/file-ops/src/index.ts` exporting module, ports, and services.

## Task 5 - Wire Event-Ops Compatibility To File-Ops

- [ ] Update `apps/api/libs/modules/event-ops/src/event-ops.module.ts`:
  - Import `FileOpsModule`, `DocumentVaultService`, and `FileRequirementsMatrixService` from `@prism/modules/file-ops`.
  - Remove local imports for those services.
  - Remove `DocumentVaultService` and `FileRequirementsMatrixService` from `EVENT_OPS_PROVIDERS`.
  - Add `FileOpsModule` to imports.
  - Keep `{ provide: SUPPLIER_DOCUMENT_VAULT, useExisting: DocumentVaultService }` so supplier workflow keeps using the supplier-owned port.
- [ ] Update `apps/api/libs/modules/event-ops/src/event-ops.service.ts` to import `DocumentVaultService`, `UploadMetadataInput`, and `FileRequirementsMatrixService` from `@prism/modules/file-ops`.
- [ ] Update `apps/api/libs/modules/event-ops/src/event-ops.service.test.ts` to import `DocumentVaultService` and `FileRequirementsMatrixService` from `@prism/modules/file-ops`.
- [ ] Update `apps/api/libs/modules/event-ops/src/services/event-closure.service.ts` to import `FileRequirementsMatrixService` from `@prism/modules/file-ops`.
- [ ] Update `apps/api/libs/modules/event-ops/src/services/guest-workflow.service.ts` to import `DocumentVaultService` and `UploadMetadataInput` from `@prism/modules/file-ops`.

## Task 6 - Verification And Docs Closeout

- [ ] Run `npm --workspace prism-api run test -- libs/modules/file-ops/src/services/file-requirements-matrix.service.test.ts libs/modules/file-ops/src/services/document-vault.service.test.ts libs/modules/file-ops/src/ports/signed-upload-url-factory.port.test.ts`.
- [ ] Run `npm --workspace prism-api run test -- file`.
- [ ] Run `npm --workspace prism-api run test:event-ops`.
- [ ] Run `npm --workspace prism-api run build`.
- [ ] Run `npm run check:boundaries`.
- [ ] Run `rg -n "@prism/modules/event-ops|modules/event-ops|@prism/modules/supplier-ops|modules/supplier-ops|@prism/modules/finance-ops|modules/finance-ops" apps/api/libs/modules/file-ops`; expected result: no matches.
- [ ] Run `git diff --check`.
- [ ] Update parent Phase 6 checkboxes only for items proven by this slice. Leave read-model migration and real storage tasks unchecked unless the implementation actually proves them.
- [ ] Add verification evidence to this child plan.
- [ ] Update `docs/prism-v4/15-system-architecture.md` and `docs/prism-v4/17-current-state-2026-06-20.md` with file extraction state and storage gate.
- [ ] Commit checkpoint: `refactor(api): extract file operations module`.

## Acceptance Criteria

- [ ] `FileRequirementsMatrixService` and `DocumentVaultService` live under `file-ops` and are provided/exported by `FileOpsModule`.
- [ ] Existing event file requirements, closure gates, supplier contract metadata validation, guest feedback metadata validation, and EventOps compatibility tests keep passing.
- [ ] Signed upload URLs remain explicitly disabled through `MetadataOnlySignedUploadUrlFactory`; no object-storage provider is enabled.
- [ ] File matrix read tests prove client-visible and PMCM-only row behavior remains intact through existing event-ops route tests.
- [ ] Full event-ops tests, API build, boundary check, file-ops no-private-import scan, and diff check pass.
- [ ] Remaining file hardening is clear: real storage adapter, upload sessions, progress/retry, bulk upload, download/delete audit, and read-model extraction need separate child plans.

## Stop Rules

Stop and revise before implementation if:

1. `FileOpsModule` cannot provide the moved services without importing `EventOpsModule`.
2. Moving file behavior forces moving `EventReadModelsService`, guest workflow, supplier workflow, inquiry onboarding, closure, or controllers in the same phase.
3. Public route paths or required request fields must change.
4. Real storage credentials, network calls, or production signed URLs become necessary.
5. Boundary checks require allowing `file-ops` to import event-ops, supplier-ops, or finance-ops internals.
6. Supplier/guest/client file visibility leaks PMCM-only rows in tests.

## Self-Review

| Requirement | Coverage |
| --- | --- |
| Phase 6 file extraction | Tasks 2-5 create `file-ops`, move file services/tests, and wire runtime ownership. |
| File matrix tests | Task 1 adds focused matrix/close-gate coverage; Task 6 reruns route-level file filter tests through `test:event-ops`. |
| Upload validation | Task 3 moves `DocumentVaultService` and its existing test; Task 6 verifies it in the new path. |
| Signed URL gate | Task 4 adds a typed `SignedUploadUrlFactory` and disabled local adapter test. |
| Route compatibility | Task 5 keeps event-ops compatibility re-exports and route facade wiring. |
| Boundary safety | Task 6 checks no event-ops, supplier-ops, or finance-ops imports inside `file-ops`. |
| Docs alignment | Task 6 updates parent plan and Prism architecture/current-state docs. |
