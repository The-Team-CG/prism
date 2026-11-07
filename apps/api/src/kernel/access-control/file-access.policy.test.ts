import { describe, expect, it } from 'vitest';
import {
  canDownloadStoredObject,
  canListStoredObject,
  canReadDocumentRow,
  fileAccessKindOf,
  requirementVisibilityFor,
  type FileAccessContext,
  type FileAccessObject,
} from './file-access.policy';

const SENT: FileAccessContext = { requirementVisibility: [], billingStatementSent: true };

const KINDS: Record<string, FileAccessObject> = {
  signed_conforme: { usage: 'signed_conforme', ownerRecordType: 'event', ownerRecordId: 'evt_1', lifecycleState: 'stored', deletedAt: null },
  client_document: { usage: 'client_document', ownerRecordType: 'event', ownerRecordId: 'evt_1', lifecycleState: 'stored', deletedAt: null },
  billing_statement: { usage: 'event_deliverable', ownerRecordType: 'billing_statement', ownerRecordId: 'bill_1', lifecycleState: 'stored', deletedAt: null },
  proposal_deliverable: { usage: 'event_deliverable', ownerRecordType: 'proposal_version', ownerRecordId: 'prop_1', lifecycleState: 'stored', deletedAt: null },
  supplier_document: { usage: 'supplier_document', ownerRecordType: 'supplier', ownerRecordId: 'sup_1', lifecycleState: 'stored', deletedAt: null },
  guest_feedback_media: { usage: 'guest_feedback_media', ownerRecordType: 'guest_feedback', ownerRecordId: 'fb_1', lifecycleState: 'stored', deletedAt: null },
  event_game_media: { usage: 'event_game_media', ownerRecordType: 'event_game_definition', ownerRecordId: 'game_1', lifecycleState: 'stored', deletedAt: null },
};

const ACTORS: Record<string, { role: string; supplierId?: string }> = {
  pmcm: { role: 'pmcm-admin' },
  system: { role: 'system' },
  client: { role: 'client' },
  coordinator: { role: 'coordinator' },
  supplierOwner: { role: 'supplier', supplierId: 'sup_1' },
  supplierOther: { role: 'supplier', supplierId: 'sup_2' },
  guest: { role: 'guest' },
  unknown: { role: 'unknown' },
};

/** The one place the expected file-access matrix is written down. Every other row follows from it. */
const ALLOWED_ACTORS: Record<string, readonly string[]> = {
  signed_conforme: ['pmcm', 'system', 'client'],
  client_document: ['pmcm', 'system', 'client', 'coordinator'],
  billing_statement: ['pmcm', 'system', 'client'],
  proposal_deliverable: ['pmcm', 'system', 'client'],
  supplier_document: ['pmcm', 'system', 'supplierOwner'],
  guest_feedback_media: [],
  event_game_media: [],
};

const KIND_ACTOR_ROWS = Object.keys(KINDS).flatMap((kind) =>
  Object.keys(ACTORS).map((actor) => [kind, actor, ALLOWED_ACTORS[kind]!.includes(actor)] as const),
);

describe('file access policy: kind x role x {list, download}', () => {
  it.each(KIND_ACTOR_ROWS)('%s for %s: list and download are both %s', (kind, actor, allowed) => {
    const object = KINDS[kind]!;
    const who = ACTORS[actor]!;
    expect(canListStoredObject(who, object, SENT)).toBe(allowed);
    expect(canDownloadStoredObject(who, object, SENT)).toBe(allowed);
  });

  it('keeps a supplier to its own supplier documents only', () => {
    expect(canListStoredObject(ACTORS.supplierOther!, KINDS.supplier_document!, SENT)).toBe(false);
    expect(canDownloadStoredObject(ACTORS.supplierOther!, KINDS.supplier_document!, SENT)).toBe(false);
  });

  it('denies a client a billing statement until PMCM sends it, and PMCM always sees it', () => {
    const unsent: FileAccessContext = { requirementVisibility: [], billingStatementSent: false };
    for (const who of ['client', 'coordinator', 'supplierOwner']) {
      expect(canDownloadStoredObject(ACTORS[who]!, KINDS.billing_statement!, unsent)).toBe(false);
    }
    expect(canDownloadStoredObject(ACTORS.pmcm!, KINDS.billing_statement!, unsent)).toBe(true);
    expect(canDownloadStoredObject(ACTORS.client!, KINDS.billing_statement!, SENT)).toBe(true);
  });
});

describe('file access policy: lifecycle and list rule', () => {
  const lifecycles = ['stored', 'requested', 'failed', 'deleted'] as const;
  const listRows = lifecycles.flatMap((lifecycle) =>
    ['pmcm', 'client', 'coordinator', 'supplierOwner'].map((actor) => {
      const object = { ...KINDS.client_document!, lifecycleState: lifecycle === 'deleted' ? 'stored' : lifecycle, deletedAt: lifecycle === 'deleted' ? new Date('2026-09-01') : null };
      // PMCM also lists uploads still being requested or failed; everyone else lists stored files they may see.
      const visibleInList = lifecycle === 'deleted'
        ? false
        : actor === 'pmcm'
          ? ['stored', 'requested', 'failed'].includes(lifecycle)
          : lifecycle === 'stored' && ['client', 'coordinator'].includes(actor);
      return [lifecycle, actor, object, visibleInList] as const;
    }),
  );

  it.each(listRows)('lists a %s client_document for %s: %s', (_lifecycle, actor, object, visible) => {
    expect(canListStoredObject(ACTORS[actor]!, object, SENT)).toBe(visible);
  });

  it('never lists a non-PMCM role an upload that is not stored, even when the role may download the kind', () => {
    const requested = { ...KINDS.client_document!, lifecycleState: 'requested' };
    expect(canListStoredObject(ACTORS.client!, requested, SENT)).toBe(false);
    expect(canListStoredObject(ACTORS.pmcm!, requested, SENT)).toBe(true);
  });
});

describe('file access policy: requirement narrowing (D3)', () => {
  it('narrows a bound custom requirement for list and download alike', () => {
    const visibility = { insurance_certificate: ['pmcm-admin'] };
    const context: FileAccessContext = {
      requirementVisibility: requirementVisibilityFor(KINDS.client_document!, ['insurance_certificate'], visibility),
      billingStatementSent: true,
    };
    expect(canListStoredObject(ACTORS.client!, KINDS.client_document!, context)).toBe(false);
    expect(canDownloadStoredObject(ACTORS.client!, KINDS.client_document!, context)).toBe(false);
    expect(canDownloadStoredObject(ACTORS.pmcm!, KINDS.client_document!, context)).toBe(true);
  });

  it('applies the derived signed-conforme requirement to the conforme object without any custom binding', () => {
    const context: FileAccessContext = {
      requirementVisibility: requirementVisibilityFor(KINDS.signed_conforme!, [], { signed_conforme: ['pmcm-admin'] }),
      billingStatementSent: true,
    };
    expect(canDownloadStoredObject(ACTORS.client!, KINDS.signed_conforme!, context)).toBe(false);
    expect(canListStoredObject(ACTORS.client!, KINDS.signed_conforme!, context)).toBe(false);
  });

  it('ignores a requirement that has no visibility row, so an absent override never narrows', () => {
    expect(requirementVisibilityFor(KINDS.client_document!, ['unknown_key'], {})).toEqual([]);
  });
});

describe('file access policy: document metadata rows', () => {
  const stored = (object: FileAccessObject | null) => ({ object, requirementVisibility: [], billingStatementSent: true });

  it('never shows a supplier contract row to a non-PMCM role', () => {
    const row = { type: 'supplier_contract', storageKey: 'obj_contract' };
    expect(canReadDocumentRow(ACTORS.client!, row, stored(KINDS.supplier_document!))).toBe(false);
    expect(canReadDocumentRow(ACTORS.pmcm!, row, stored(KINDS.supplier_document!))).toBe(true);
  });

  it('shows a billing row to the client only after its statement is sent', () => {
    const row = { type: 'billing_statement', storageKey: null };
    expect(canReadDocumentRow(ACTORS.client!, row, { object: null, requirementVisibility: [], billingStatementSent: true })).toBe(true);
    expect(canReadDocumentRow(ACTORS.client!, row, { object: null, requirementVisibility: [], billingStatementSent: false })).toBe(false);
    expect(canReadDocumentRow(ACTORS.coordinator!, row, { object: null, requirementVisibility: [], billingStatementSent: true })).toBe(false);
  });

  it('follows the bound object for a row with a storage key, and hides a row whose object is gone', () => {
    const row = { type: 'insurance_certificate', storageKey: 'obj_client_doc' };
    expect(canReadDocumentRow(ACTORS.client!, row, stored(KINDS.client_document!))).toBe(true);
    expect(canReadDocumentRow(ACTORS.guest!, row, stored(KINDS.client_document!))).toBe(false);
    expect(canReadDocumentRow(ACTORS.client!, row, stored(null))).toBe(false);
  });

  it('shows an issued proposal row to the client even when its storage key is a PDF provider key with no loaded object', () => {
    const issuedProposal = { type: 'proposal', storageKey: 'events/evt_1/objects/event_deliverable/obj_pdf.pdf' };
    expect(canReadDocumentRow(ACTORS.client!, issuedProposal, stored(null))).toBe(true);
    expect(canReadDocumentRow(ACTORS.coordinator!, issuedProposal, stored(null))).toBe(false);
    expect(canReadDocumentRow(ACTORS.supplierOwner!, issuedProposal, stored(null))).toBe(false);
  });

  it('shows an unbound conforme or proposal metadata row to the client only, and never to a coordinator or supplier', () => {
    const conforme = { type: 'signed_conforme', storageKey: null };
    const proposal = { type: 'proposal', storageKey: null };
    expect(canReadDocumentRow(ACTORS.client!, conforme, stored(null))).toBe(true);
    expect(canReadDocumentRow(ACTORS.client!, proposal, stored(null))).toBe(true);
    expect(canReadDocumentRow(ACTORS.coordinator!, proposal, stored(null))).toBe(false);
    expect(canReadDocumentRow(ACTORS.supplierOwner!, conforme, stored(null))).toBe(false);
  });
});

describe('file access policy: kind classification (default deny)', () => {
  it('classifies only the supported owner and usage pairs', () => {
    expect(fileAccessKindOf({ usage: 'event_deliverable', ownerRecordType: 'proposal_version' })).toBe('proposal_deliverable');
    expect(fileAccessKindOf({ usage: 'event_deliverable', ownerRecordType: 'event' })).toBeNull();
    expect(fileAccessKindOf({ usage: 'client_document', ownerRecordType: 'supplier' })).toBeNull();
    expect(fileAccessKindOf({ usage: 'event_game_branding', ownerRecordType: 'event_game_lobby' })).toBeNull();
  });
});
