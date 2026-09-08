ALTER TABLE "compliance_ops"."post_event_documents"
  RENAME COLUMN "client_acknowledged_by" TO "acknowledgement_recorded_by";
ALTER TABLE "compliance_ops"."post_event_documents"
  ADD COLUMN "acknowledgement_source" TEXT NOT NULL DEFAULT 'pmcm_recorded';

ALTER TABLE "compliance_ops"."event_wrap_ups"
  RENAME COLUMN "client_acknowledged_by" TO "acknowledgement_recorded_by";
ALTER TABLE "compliance_ops"."event_wrap_ups"
  ADD COLUMN "acknowledgement_source" TEXT NOT NULL DEFAULT 'pmcm_recorded';
