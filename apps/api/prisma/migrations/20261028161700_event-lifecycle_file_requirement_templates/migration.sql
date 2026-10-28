-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium

CREATE TABLE "event_lifecycle"."file_requirement_templates" (
    "id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "requirements" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_requirement_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "file_requirement_templates_event_type_key"
    ON "event_lifecycle"."file_requirement_templates"("event_type");
