-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium

-- CreateTable
CREATE TABLE "event_lifecycle"."conforme_executions" (
    "id" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "event_id" TEXT,
    "template_version" INTEGER NOT NULL,
    "template_content" TEXT NOT NULL,
    "template_sha256" TEXT NOT NULL,
    "document_content" TEXT NOT NULL,
    "document_sha256" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'awaiting_client',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "conforme_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_lifecycle"."conforme_signatures" (
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

    CONSTRAINT "conforme_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_lifecycle"."client_closeout_responses" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "feedback" TEXT NOT NULL,
    "testimonial" TEXT NOT NULL DEFAULT '',
    "testimonial_consent" BOOLEAN NOT NULL DEFAULT false,
    "moderation_status" TEXT NOT NULL DEFAULT 'pending',
    "actor_id" TEXT NOT NULL,
    "actor_email" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_closeout_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conforme_executions_event_id_idx" ON "event_lifecycle"."conforme_executions"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "conforme_executions_inquiry_version_key" ON "event_lifecycle"."conforme_executions"("inquiry_id", "template_version");

-- CreateIndex
CREATE INDEX "conforme_signatures_actor_id_idx" ON "event_lifecycle"."conforme_signatures"("actor_id");

-- CreateIndex
CREATE UNIQUE INDEX "conforme_signatures_execution_role_key" ON "event_lifecycle"."conforme_signatures"("execution_id", "actor_role");

-- CreateIndex
CREATE UNIQUE INDEX "client_closeout_responses_event_id_key" ON "event_lifecycle"."client_closeout_responses"("event_id");

-- CreateIndex
CREATE INDEX "client_closeout_responses_actor_id_idx" ON "event_lifecycle"."client_closeout_responses"("actor_id");

-- AddForeignKey
ALTER TABLE "event_lifecycle"."conforme_executions" ADD CONSTRAINT "conforme_executions_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "event_lifecycle"."inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."conforme_executions" ADD CONSTRAINT "conforme_executions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_lifecycle"."events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."conforme_signatures" ADD CONSTRAINT "conforme_signatures_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "event_lifecycle"."conforme_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."client_closeout_responses" ADD CONSTRAINT "client_closeout_responses_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_lifecycle"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_lifecycle"."conforme_executions" ADD CONSTRAINT "conforme_executions_version_check" CHECK ("template_version" > 0);

ALTER TABLE "event_lifecycle"."client_closeout_responses" ADD CONSTRAINT "client_closeout_responses_rating_consent_check" CHECK ("rating" BETWEEN 1 AND 5 AND (NOT "testimonial_consent" OR LENGTH(BTRIM("testimonial")) > 0));
