-- AlterTable
ALTER TABLE "event_core"."events"
ADD COLUMN "proposal_client_status" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN "proposal_revision_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "proposal_reviewed_at" TIMESTAMP(3),
ADD COLUMN "proposal_reviewed_by" TEXT;
