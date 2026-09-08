import type { PrismStoredObject } from '@prism/types';

export function visibleDocumentLabel(object: PrismStoredObject) {
  if (object.lifecycleState === 'failed') return `${object.originalFileName} (storage unavailable)`;
  if (object.lifecycleState === 'requested') return `${object.originalFileName} (awaiting confirmation)`;
  return object.originalFileName;
}
