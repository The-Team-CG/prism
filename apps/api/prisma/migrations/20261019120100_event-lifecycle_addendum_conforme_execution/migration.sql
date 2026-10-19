-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium

-- CreateTable
CREATE TABLE "event_lifecycle"."addendum_conforme_executions" (
    "id" TEXT NOT NULL,
    "addendum_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "document_content" TEXT NOT NULL,
    "document_sha256" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'awaiting_client',
    "billing_source_id" TEXT,
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
CREATE UNIQUE INDEX "addendum_conforme_executions_addendum_key" ON "event_lifecycle"."addendum_conforme_executions"("addendum_id");

-- CreateIndex
CREATE INDEX "addendum_conforme_executions_event_id_idx" ON "event_lifecycle"."addendum_conforme_executions"("event_id");

-- CreateIndex
CREATE INDEX "addendum_conforme_signatures_actor_id_idx" ON "event_lifecycle"."addendum_conforme_signatures"("actor_id");

-- CreateIndex
CREATE UNIQUE INDEX "addendum_conforme_signatures_execution_role_key" ON "event_lifecycle"."addendum_conforme_signatures"("execution_id", "actor_role");


-- AddForeignKey
ALTER TABLE "event_lifecycle"."addendum_conforme_executions" ADD CONSTRAINT "addendum_conforme_executions_addendum_id_fkey" FOREIGN KEY ("addendum_id") REFERENCES "event_lifecycle"."addenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."addendum_conforme_executions" ADD CONSTRAINT "addendum_conforme_executions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_lifecycle"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."addendum_conforme_signatures" ADD CONSTRAINT "addendum_conforme_signatures_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "event_lifecycle"."addendum_conforme_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "event_lifecycle"."addendum_conforme_executions" ADD CONSTRAINT "addendum_conforme_executions_status_check" CHECK ("status" IN ('awaiting_client', 'awaiting_pmcm', 'completed'));

ALTER TABLE "event_lifecycle"."addendum_conforme_executions" ADD CONSTRAINT "addendum_conforme_executions_sha256_check" CHECK ("document_sha256" ~ '^[a-f0-9]{64}$');

ALTER TABLE "event_lifecycle"."addendum_conforme_executions" ADD CONSTRAINT "addendum_conforme_executions_version_check" CHECK ("version_number" > 0);

ALTER TABLE "event_lifecycle"."addendum_conforme_signatures" ADD CONSTRAINT "addendum_conforme_signatures_role_check" CHECK ("actor_role" IN ('client', 'pmcm'));
