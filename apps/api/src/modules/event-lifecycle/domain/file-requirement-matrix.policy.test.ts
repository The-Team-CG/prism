import { describe, expect, it } from 'vitest';
import {
  mergeFileRequirementOverrides,
  scopeFileRequirementItemsForActor,
  visibleFileRequirementItems,
  type DerivedFileRequirementItem,
  type FileRequirementDocumentFact,
  type PersistedFileRequirement,
} from './file-requirement-matrix.policy';

const now = new Date('2026-10-20T00:00:00.000Z');

const derivedSignedConforme: DerivedFileRequirementItem = {
  key: 'signed_conforme', label: 'Signed conforme', ownerRole: 'pmcm-admin', visibleToRoles: ['pmcm-admin', 'client'],
  sourceWorkflow: 'client_onboarding', status: 'missing', auditCategory: 'documents', detail: 'Not uploaded.',
};

const override = (patch: Partial<PersistedFileRequirement>): PersistedFileRequirement => ({
  key: 'signed_conforme', label: 'Signed conforme', ownerRole: 'pmcm-admin', visibleToRoles: ['pmcm-admin', 'client'],
  required: true, dueAt: null, sourceWorkflow: 'client_onboarding', isCustom: false, notes: null, revision: 1, ...patch,
});

describe('file requirement overdue and merge rules', () => {
  it('marks only required, unsatisfied items past their due date as overdue', () => {
    const [past, satisfied, optional, future] = mergeFileRequirementOverrides(
      [
        derivedSignedConforme,
        { ...derivedSignedConforme, key: 'billing_statement', status: 'complete' },
        { ...derivedSignedConforme, key: 'client_feedback' },
        { ...derivedSignedConforme, key: 'logistics' },
      ],
      [
        override({ dueAt: new Date('2026-10-01T00:00:00.000Z') }),
        override({ key: 'billing_statement', dueAt: new Date('2026-10-01T00:00:00.000Z') }),
        override({ key: 'client_feedback', required: false, dueAt: new Date('2026-10-01T00:00:00.000Z') }),
        override({ key: 'logistics', dueAt: new Date('2026-12-01T00:00:00.000Z') }),
      ],
      [],
      [],
      now,
    );
    expect(past).toMatchObject({ key: 'signed_conforme', overdue: true, required: true });
    expect(satisfied).toMatchObject({ key: 'billing_statement', overdue: false });
    expect(optional).toMatchObject({ key: 'client_feedback', required: false, overdue: false });
    expect(future).toMatchObject({ key: 'logistics', overdue: false });
  });

  it('applies PMCM owner, visibility, required state and due date while keeping the derived status', () => {
    const [merged] = mergeFileRequirementOverrides(
      [derivedSignedConforme],
      [override({ ownerRole: 'client', visibleToRoles: ['pmcm-admin', 'client'], required: false, dueAt: new Date('2026-11-01T00:00:00.000Z'), notes: 'Chase by email', revision: 3 })],
      [],
      [],
      now,
    );
    expect(merged).toMatchObject({
      key: 'signed_conforme', status: 'missing', ownerRole: 'client', required: false,
      dueDate: '2026-11-01T00:00:00.000Z', origin: 'derived', revision: 3, notes: 'Chase by email', overdue: false,
    });
  });

  it('reports a rejected latest upload as missing with a rejected validation status, and an accepted one as submitted', () => {
    const rejected = mergeFileRequirementOverrides(
      [derivedSignedConforme],
      [],
      [{ id: 'doc_new', type: 'signed_conforme', status: 'submitted', validationStatus: 'rejected', uploadedAt: new Date('2026-10-10T00:00:00.000Z') }],
      [],
      now,
    );
    expect(rejected[0]).toMatchObject({ validationStatus: 'rejected' });

    const accepted = mergeFileRequirementOverrides(
      [derivedSignedConforme],
      [],
      [{ id: 'doc_new', type: 'signed_conforme', status: 'submitted', validationStatus: 'accepted', uploadedAt: new Date('2026-10-10T00:00:00.000Z') }],
      [],
      now,
    );
    expect(accepted[0]).toMatchObject({ validationStatus: 'accepted' });
  });

  it('appends PMCM custom requirements, marks them custom, and ignores persisted rows that shadow derived keys', () => {
    const items = mergeFileRequirementOverrides(
      [derivedSignedConforme],
      [
        override({ key: 'venue_permit', label: 'Venue permit', ownerRole: 'client', visibleToRoles: ['pmcm-admin', 'client'], isCustom: true, sourceWorkflow: 'custom', dueAt: new Date('2026-10-01T00:00:00.000Z') }),
        override({ key: 'signed_conforme', label: 'Shadow label', isCustom: true }),
      ],
      [],
      [],
      now,
    );
    expect(items.map((item) => item.key)).toEqual(['signed_conforme', 'venue_permit']);
    expect(items[0].label).toBe('Signed conforme');
    expect(items[1]).toMatchObject({ key: 'venue_permit', origin: 'custom', status: 'missing', overdue: true });
  });

  it('does not count a requirement upload after its stored bytes were deleted', () => {
    const items = mergeFileRequirementOverrides(
      [],
      [override({ key: 'venue_permit', label: 'Venue permit', ownerRole: 'client', visibleToRoles: ['pmcm-admin', 'client'], isCustom: true, sourceWorkflow: 'custom' })],
      [{ id: 'doc_deleted', type: 'venue_permit', status: 'submitted', validationStatus: 'accepted', uploadedAt: new Date('2026-10-10T00:00:00.000Z'), available: false }],
      [],
      now,
    );
    expect(items[0]).toMatchObject({ status: 'missing', uploadedAssetId: undefined, detail: 'No file submitted yet.' });
    expect(items[0]).not.toHaveProperty('uploadedObjectId');
  });

  it('names the stored file that currently fulfils a custom requirement', () => {
    const requirement = override({ key: 'venue_permit', label: 'Venue permit', ownerRole: 'client', visibleToRoles: ['pmcm-admin', 'client'], isCustom: true, sourceWorkflow: 'custom' });
    const items = mergeFileRequirementOverrides(
      [],
      [requirement],
      [
        { id: 'doc_old', type: 'venue_permit', status: 'submitted', validationStatus: 'accepted', uploadedAt: new Date('2026-10-01T00:00:00.000Z'), storageKey: 'obj_old' },
        { id: 'doc_new', type: 'venue_permit', status: 'submitted', validationStatus: 'accepted', uploadedAt: new Date('2026-10-05T00:00:00.000Z'), storageKey: 'obj_new' },
      ],
      [],
      now,
    );
    expect(items[0]).toMatchObject({ status: 'submitted', uploadedAssetId: 'doc_new', uploadedObjectId: 'obj_new' });
  });
});

describe('supplier-owned custom requirements', () => {
  const selectedSuppliers = [
    { supplierId: 'supplier_a', supplierName: 'Atlas Sound' },
    { supplierId: 'supplier_b', supplierName: 'Bright Lights' },
  ];
  const insuranceRequirement = override({
    key: 'insurance_certificate', label: 'Insurance certificate', ownerRole: 'supplier', visibleToRoles: ['pmcm-admin', 'supplier', 'client'],
    isCustom: true, sourceWorkflow: 'custom', dueAt: new Date('2026-10-01T00:00:00.000Z'),
  });
  // Atlas Sound's file: the stored object is owned by supplier A, so the document is attributed to A alone.
  const atlasDocument: FileRequirementDocumentFact = {
    id: 'doc_a', type: 'insurance_certificate', status: 'submitted', validationStatus: 'accepted',
    uploadedAt: new Date('2026-10-10T00:00:00.000Z'), storageKey: 'obj_a', ownerSupplierId: 'supplier_a',
  };

  it('fulfils each selected supplier separately: a document owned by A never satisfies B', () => {
    const [item] = mergeFileRequirementOverrides([], [insuranceRequirement], [atlasDocument], selectedSuppliers, now);

    expect(item.supplierFulfilments).toEqual([
      { supplierId: 'supplier_a', supplierName: 'Atlas Sound', status: 'submitted', overdue: false, validationStatus: 'accepted', uploadedAssetId: 'doc_a', uploadedObjectId: 'obj_a' },
      { supplierId: 'supplier_b', supplierName: 'Bright Lights', status: 'missing', overdue: true },
    ]);
    expect(item).toMatchObject({ status: 'missing', overdue: true, origin: 'custom' });
    expect(item).not.toHaveProperty('uploadedObjectId');
    expect(item).not.toHaveProperty('uploadedAssetId');
    expect(item).not.toHaveProperty('validationStatus');
    expect(item.detail).toBe('1 of 2 selected supplier(s) submitted');
  });

  it('reports the aggregate as submitted only when every selected supplier has submitted', () => {
    const bright: FileRequirementDocumentFact = { id: 'doc_b', type: 'insurance_certificate', status: 'submitted', validationStatus: 'accepted', uploadedAt: new Date('2026-10-11T00:00:00.000Z'), storageKey: 'obj_b', ownerSupplierId: 'supplier_b' };
    const [item] = mergeFileRequirementOverrides([], [insuranceRequirement], [atlasDocument, bright], selectedSuppliers, now);

    expect(item).toMatchObject({ status: 'submitted', overdue: false });
    expect(item.supplierFulfilments?.map((fulfilment) => fulfilment.overdue)).toEqual([false, false]);
  });

  it('reports the aggregate as approved only when every selected supplier is approved', () => {
    const approved = (id: string, ownerSupplierId: string): FileRequirementDocumentFact => ({
      id, type: 'insurance_certificate', status: 'approved', validationStatus: 'accepted', uploadedAt: new Date('2026-10-11T00:00:00.000Z'), storageKey: `obj_${id}`, ownerSupplierId,
    });
    const [partly] = mergeFileRequirementOverrides([], [insuranceRequirement], [approved('doc_a', 'supplier_a')], selectedSuppliers, now);
    expect(partly.status).toBe('missing');

    const [all] = mergeFileRequirementOverrides([], [insuranceRequirement], [approved('doc_a', 'supplier_a'), approved('doc_b', 'supplier_b')], selectedSuppliers, now);
    expect(all.status).toBe('approved');
  });

  it('is missing with no supplier entries when no supplier is selected on the event', () => {
    const [item] = mergeFileRequirementOverrides([], [insuranceRequirement], [], [], now);
    expect(item).toMatchObject({ status: 'missing', supplierFulfilments: [], overdue: true, detail: 'No supplier is selected on this event.' });
  });
});

describe('file requirement visibility projection', () => {
  const items = mergeFileRequirementOverrides(
    [derivedSignedConforme, { ...derivedSignedConforme, key: 'supplier_reviews', visibleToRoles: ['pmcm-admin'] }],
    [override({ notes: 'Internal only' })],
    [],
    [],
    now,
  );

  it('hides items outside the actor role and strips PMCM-only notes for every other role', () => {
    const clientView = visibleFileRequirementItems(items, 'client');
    expect(clientView.map((item) => item.key)).toEqual(['signed_conforme']);
    expect(clientView[0]).not.toHaveProperty('notes');

    expect(visibleFileRequirementItems(items, 'supplier')).toEqual([]);
    expect(visibleFileRequirementItems(items, 'coordinator')).toEqual([]);
  });

  it('keeps every item and its notes for PMCM', () => {
    const pmcmView = visibleFileRequirementItems(items, 'pmcm-admin');
    expect(pmcmView.map((item) => item.key)).toEqual(['signed_conforme', 'supplier_reviews']);
    expect(pmcmView[0]).toMatchObject({ notes: 'Internal only' });
  });
});

describe('scopeFileRequirementItemsForActor', () => {
  const selectedSuppliers = [
    { supplierId: 'supplier_a', supplierName: 'Atlas Sound' },
    { supplierId: 'supplier_b', supplierName: 'Bright Lights' },
  ];
  const items = mergeFileRequirementOverrides(
    [],
    [override({
      key: 'insurance_certificate', label: 'Insurance certificate', ownerRole: 'supplier', visibleToRoles: ['pmcm-admin', 'supplier', 'client'],
      isCustom: true, sourceWorkflow: 'custom', dueAt: new Date('2026-10-01T00:00:00.000Z'),
    })],
    [{ id: 'doc_a', type: 'insurance_certificate', status: 'submitted', validationStatus: 'accepted', uploadedAt: new Date('2026-10-10T00:00:00.000Z'), storageKey: 'obj_a', ownerSupplierId: 'supplier_a' }],
    selectedSuppliers,
    now,
  );

  it("gives supplier B its own missing, overdue status and nothing of supplier A's", () => {
    const [seenByB] = scopeFileRequirementItemsForActor(visibleFileRequirementItems(items, 'supplier'), { role: 'supplier', supplierId: 'supplier_b' });

    expect(seenByB).toMatchObject({ key: 'insurance_certificate', status: 'missing', overdue: true, detail: 'No file submitted yet.' });
    expect(seenByB).not.toHaveProperty('supplierFulfilments');
    expect(seenByB).not.toHaveProperty('uploadedObjectId');
    expect(seenByB).not.toHaveProperty('uploadedAssetId');
    const serialised = JSON.stringify(seenByB);
    for (const leaked of ['Atlas Sound', 'supplier_a', 'obj_a', 'doc_a']) expect(serialised).not.toContain(leaked);
  });

  it('shows supplier A its own submitted fulfilment with its uploaded ids', () => {
    const [seenByA] = scopeFileRequirementItemsForActor(items, { role: 'supplier', supplierId: 'supplier_a' });
    expect(seenByA).toMatchObject({ status: 'submitted', overdue: false, uploadedAssetId: 'doc_a', uploadedObjectId: 'obj_a', validationStatus: 'accepted' });
    expect(seenByA).not.toHaveProperty('supplierFulfilments');
  });

  it('drops the item for a supplier with no entry on the event', () => {
    expect(scopeFileRequirementItemsForActor(items, { role: 'supplier', supplierId: 'supplier_outsider' })).toEqual([]);
    expect(scopeFileRequirementItemsForActor(items, { role: 'supplier' })).toEqual([]);
  });

  it('gives a client the aggregate only, with no supplier breakdown or file ids', () => {
    const [seenByClient] = scopeFileRequirementItemsForActor(visibleFileRequirementItems(items, 'client'), { role: 'client' });
    expect(seenByClient).toMatchObject({ key: 'insurance_certificate', status: 'missing', detail: '1 of 2 selected supplier(s) submitted' });
    expect(seenByClient).not.toHaveProperty('supplierFulfilments');
    expect(JSON.stringify(seenByClient)).not.toMatch(/Atlas Sound|supplier_a|obj_a|doc_a/);
  });

  it('keeps every item and its breakdown for PMCM', () => {
    expect(scopeFileRequirementItemsForActor(items, { role: 'pmcm-admin' })).toEqual(items);
    expect(scopeFileRequirementItemsForActor(items, { role: 'system' })).toEqual(items);
  });
});
