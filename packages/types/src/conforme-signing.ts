export interface PrismConformeSignature {
  id: string;
  actorRole: string;
  actorName: string;
  consentTextVersion: string;
  signedAt: string;
}

export interface PrismConformeExecution {
  id: string;
  inquiryId: string;
  eventId: string | null;
  templateVersion: number;
  templateSha256: string;
  documentContent: string;
  documentSha256: string;
  status: 'awaiting_client' | 'awaiting_pmcm' | 'completed' | 'superseded';
  createdAt: string;
  completedAt: string | null;
  signatures: PrismConformeSignature[];
}
