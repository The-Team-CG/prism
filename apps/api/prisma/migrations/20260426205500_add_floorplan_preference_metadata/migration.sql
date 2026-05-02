ALTER TABLE "ops_floor_plan_drafts"
  ADD COLUMN "created_by_role" TEXT NOT NULL DEFAULT 'pmcm-admin',
  ADD COLUMN "client_preference" JSONB;

ALTER TABLE "ops_floor_plan_drafts"
  ALTER COLUMN "status" SET DEFAULT 'pmcm_draft';
