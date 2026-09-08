"use client";
import { useEffect, useState } from 'react';
import type { PrismStoredObject } from '@prism/types';
import { documentHubRepository } from '../data/document-hub-repository';
export function useDocumentHubViewModel(eventId: string) {
  const [documents, setDocuments] = useState<PrismStoredObject[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { let active = true; documentHubRepository.list(eventId).then((value) => active && setDocuments(value)).catch((reason: unknown) => active && setError(reason instanceof Error ? reason.message : 'Documents unavailable')); return () => { active = false; }; }, [eventId]);
  return { documents, error };
}
