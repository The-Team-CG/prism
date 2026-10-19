-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium
-- Versioned addendum conforme (immutable document + hash, client acknowledgement, PMCM countersignature) and
-- the billing trace from addendum impacts to the executed version. Additive tables and nullable columns only.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- AlterTable
ALTER TABLE "event_lifecycle"."addenda" ADD COLUMN     "executed_at" TIMESTAMP(3),
ADD COLUMN     "executed_conforme_execution_id" TEXT;

-- AlterTable
ALTER TABLE "event_lifecycle"."addendum_impacts" ADD COLUMN     "conforme_document_sha256" TEXT,
ADD COLUMN     "conforme_execution_id" TEXT;

-- CreateTable
CREATE TABLE "event_lifecycle"."addendum_conforme_executions" (
    "id" TEXT NOT NULL,
    "addendum_id" TEXT NOT NULL,
    "document_version" INTEGER NOT NULL,
    "document_content" TEXT NOT NULL,
    "document_sha256" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'awaiting_client',
    "issued_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "addendum_conforme_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_lifecycle"."addendum_conforme_signatures" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_role" TEXT NOT NULL,
    "actor_name" TEXT NOT NULL,
    "actor_email" TEXT,
    "consent_text_version" TEXT NOT NULL,
    "consent_text" TEXT NOT NULL,
    "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_hash" TEXT,
    "user_agent_hash" TEXT,

    CONSTRAINT "addendum_conforme_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "addendum_conforme_executions_status_idx" ON "event_lifecycle"."addendum_conforme_executions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "addendum_conforme_executions_addendum_version_key" ON "event_lifecycle"."addendum_conforme_executions"("addendum_id", "document_version");

-- CreateIndex
CREATE INDEX "addendum_conforme_signatures_actor_id_idx" ON "event_lifecycle"."addendum_conforme_signatures"("actor_id");

-- CreateIndex
CREATE UNIQUE INDEX "addendum_conforme_signatures_execution_role_key" ON "event_lifecycle"."addendum_conforme_signatures"("execution_id", "actor_role");

-- CreateIndex
CREATE UNIQUE INDEX "addenda_executed_conforme_execution_id_key" ON "event_lifecycle"."addenda"("executed_conforme_execution_id");

-- CreateIndex
CREATE INDEX "addendum_impacts_conforme_execution_id_idx" ON "event_lifecycle"."addendum_impacts"("conforme_execution_id");

-- AddForeignKey
ALTER TABLE "event_lifecycle"."addenda" ADD CONSTRAINT "addenda_executed_conforme_execution_id_fkey" FOREIGN KEY ("executed_conforme_execution_id") REFERENCES "event_lifecycle"."addendum_conforme_executions"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."addendum_impacts" ADD CONSTRAINT "addendum_impacts_conforme_execution_id_fkey" FOREIGN KEY ("conforme_execution_id") REFERENCES "event_lifecycle"."addendum_conforme_executions"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."addendum_conforme_executions" ADD CONSTRAINT "addendum_conforme_executions_addendum_id_fkey" FOREIGN KEY ("addendum_id") REFERENCES "event_lifecycle"."addenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."addendum_conforme_signatures" ADD CONSTRAINT "addendum_conforme_signatures_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "event_lifecycle"."addendum_conforme_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
