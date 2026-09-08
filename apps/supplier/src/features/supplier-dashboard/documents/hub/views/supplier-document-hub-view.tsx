"use client";
import { useEffect, useState } from 'react';
import type { PrismStoredObject } from '@prism/types';
import { supplierDocumentRepository } from '../data/supplier-document-repository';
export function SupplierDocumentHubView({ eventId }: { eventId: string }) { const [documents, setDocuments] = useState<PrismStoredObject[]>([]); useEffect(() => { supplierDocumentRepository.list(eventId).then(setDocuments).catch(() => setDocuments([])); }, [eventId]); return <section aria-label="Supplier documents"><h2>Supplier documents</h2><ul>{documents.map((document) => <li key={document.id}>{document.originalFileName} — {document.lifecycleState}</li>)}</ul></section>; }
