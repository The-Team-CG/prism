"use client";
import { useEffect, useState } from 'react';
import type { PrismStoredObject } from '@prism/types';
import { pmcmDocumentRepository } from '../data/pmcm-document-repository';
export function PmcmDocumentHubView({ eventId }: { eventId: string }) { const [documents, setDocuments] = useState<PrismStoredObject[]>([]); useEffect(() => { pmcmDocumentRepository.list(eventId).then(setDocuments).catch(() => setDocuments([])); }, [eventId]); return <section aria-label="PMCM event file hub"><h2>Event file hub</h2><ul>{documents.map((document) => <li key={document.id}>{document.originalFileName} — {document.lifecycleState}{document.failureReason ? ` — ${document.failureReason}` : ''}</li>)}</ul></section>; }
