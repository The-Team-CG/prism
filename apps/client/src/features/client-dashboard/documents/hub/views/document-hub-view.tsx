"use client";
import { visibleDocumentLabel } from '../model/document-hub-model';
import { useDocumentHubViewModel } from '../view-models/use-document-hub-view-model';
export function ClientDocumentHubView({ eventId }: { eventId: string }) { const { documents, error } = useDocumentHubViewModel(eventId); return <section aria-label="Event documents"><h2>Event documents</h2>{error ? <p>{error}</p> : null}<ul>{documents.map((document) => <li key={document.id}>{visibleDocumentLabel(document)} — {document.lifecycleState}</li>)}</ul></section>; }
