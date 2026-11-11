-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium

-- Planning templates: a reusable list of tasks (owner, due date counted from the event date, optional wait-for) that PMCM
-- applies to an event. A template version is immutable once published; an event's plan items remember the template and
-- version they came from and the stable key they match on, so reapplying never duplicates a task. Tasks, dates and owners
-- only: there is no amount or payment milestone anywhere in these tables. Adds three tables and deletes nothing.

-- CreateTable
CREATE TABLE "event_lifecycle"."planning_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planning_templates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "planning_templates_current_version_check" CHECK ("current_version" >= 1)
);

-- CreateTable
CREATE TABLE "event_lifecycle"."planning_template_versions" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "change_note" TEXT NOT NULL DEFAULT '',
    "items" JSONB NOT NULL,
    "published_by" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planning_template_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "planning_template_versions_version_check" CHECK ("version" >= 1)
);

-- CreateTable
CREATE TABLE "event_lifecycle"."event_plan_items" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "template_version" INTEGER NOT NULL,
    "item_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "owner_role" TEXT NOT NULL,
    "owner_name" TEXT NOT NULL DEFAULT '',
    "due_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "completed_at" TIMESTAMP(3),
    "completed_by" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "depends_on" TEXT,
    "customized" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_plan_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "event_plan_items_status_check" CHECK ("status" IN ('open', 'done', 'skipped')),
    -- Only a finished task has a completion time; a skipped or open one never does.
    CONSTRAINT "event_plan_items_completion_check" CHECK (("status" = 'done') = ("completed_at" IS NOT NULL))
);

-- CreateIndex
CREATE UNIQUE INDEX "planning_templates_name_key" ON "event_lifecycle"."planning_templates"("name");
CREATE UNIQUE INDEX "planning_template_versions_template_version_key" ON "event_lifecycle"."planning_template_versions"("template_id", "version");
CREATE UNIQUE INDEX "event_plan_items_event_template_key_key" ON "event_lifecycle"."event_plan_items"("event_id", "template_id", "item_key");
CREATE INDEX "event_plan_items_event_id_due_date_idx" ON "event_lifecycle"."event_plan_items"("event_id", "due_date");
CREATE INDEX "event_plan_items_template_id_idx" ON "event_lifecycle"."event_plan_items"("template_id");

-- AddForeignKey
ALTER TABLE "event_lifecycle"."planning_template_versions" ADD CONSTRAINT "planning_template_versions_template_fkey" FOREIGN KEY ("template_id") REFERENCES "event_lifecycle"."planning_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_lifecycle"."event_plan_items" ADD CONSTRAINT "event_plan_items_event_fkey" FOREIGN KEY ("event_id") REFERENCES "event_lifecycle"."events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_lifecycle"."event_plan_items" ADD CONSTRAINT "event_plan_items_template_fkey" FOREIGN KEY ("template_id") REFERENCES "event_lifecycle"."planning_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
