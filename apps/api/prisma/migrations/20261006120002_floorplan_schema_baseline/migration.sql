-- prism-owner: floorplan
-- prism-kind: schema
-- prism-risk: medium
-- Owner-scoped baseline for the floorplan schema.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "floorplan";

-- CreateTable
CREATE TABLE "floorplan"."floor_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "venue" TEXT NOT NULL DEFAULT '',
    "width" INTEGER NOT NULL DEFAULT 1400,
    "height" INTEGER NOT NULL DEFAULT 900,
    "grid_size" INTEGER NOT NULL DEFAULT 20,
    "pax" INTEGER NOT NULL DEFAULT 0,
    "owner_id" TEXT NOT NULL,
    "template_id" TEXT,
    "event_id" TEXT,
    "objects" JSONB NOT NULL DEFAULT '[]',
    "guests" JSONB NOT NULL DEFAULT '[]',
    "suppliers" JSONB NOT NULL DEFAULT '[]',
    "seats" JSONB NOT NULL DEFAULT '[]',
    "seat_categories" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "floor_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floorplan"."floor_plan_objects" (
    "floor_plan_id" TEXT NOT NULL,
    "object_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "z_index" INTEGER NOT NULL DEFAULT 0,
    "object_data" JSONB NOT NULL,
    "svg_markup" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "floor_plan_objects_pkey" PRIMARY KEY ("floor_plan_id","object_id")
);

-- CreateTable
CREATE TABLE "floorplan"."venue_templates" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "venue" TEXT NOT NULL DEFAULT '',
    "venue_rules" TEXT NOT NULL DEFAULT '',
    "permanent_features" JSONB NOT NULL DEFAULT '[]',
    "floor_plan_id" TEXT NOT NULL,
    "pax" INTEGER NOT NULL DEFAULT 0,
    "include_guests" BOOLEAN NOT NULL DEFAULT false,
    "include_suppliers" BOOLEAN NOT NULL DEFAULT false,
    "guests" JSONB NOT NULL DEFAULT '[]',
    "suppliers" JSONB NOT NULL DEFAULT '[]',
    "source_type" TEXT NOT NULL DEFAULT 'custom',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venue_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floorplan"."event_instances" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "floor_plan_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floorplan"."published_snapshots" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "floor_plan" JSONB NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "published_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floorplan"."floor_plan_drafts" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "floor_plan_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pmcm_draft',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "source_type" TEXT NOT NULL DEFAULT 'blank',
    "created_by_role" TEXT NOT NULL,
    "client_preference" JSONB,
    "submitted_snapshot" JSONB,
    "approved_snapshot" JSONB,
    "submitted_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "submitted_snapshot_at" TIMESTAMP(3),
    "approved_snapshot_at" TIMESTAMP(3),
    "revision_comment" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "floor_plan_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floorplan"."floor_plan_projection_clocks" (
    "event_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "floor_plan_projection_clocks_pkey" PRIMARY KEY ("event_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "venue_templates_floor_plan_id_key" ON "floorplan"."venue_templates"("floor_plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_instances_floor_plan_id_key" ON "floorplan"."event_instances"("floor_plan_id");

-- CreateIndex
CREATE INDEX "event_instances_template_id_idx" ON "floorplan"."event_instances"("template_id");

-- CreateIndex
CREATE UNIQUE INDEX "published_snapshots_slug_key" ON "floorplan"."published_snapshots"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "published_snapshots_event_id_key" ON "floorplan"."published_snapshots"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "floor_plan_drafts_floor_plan_id_key" ON "floorplan"."floor_plan_drafts"("floor_plan_id");

-- CreateIndex
CREATE INDEX "floor_plan_drafts_event_id_status_idx" ON "floorplan"."floor_plan_drafts"("event_id", "status");

-- CreateIndex
CREATE INDEX "floor_plan_drafts_event_id_is_active_idx" ON "floorplan"."floor_plan_drafts"("event_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "floor_plan_drafts_one_active_per_event_key" ON "floorplan"."floor_plan_drafts"("event_id") WHERE ("is_active" = true);

-- AddForeignKey
ALTER TABLE "floorplan"."floor_plan_objects" ADD CONSTRAINT "floor_plan_objects_floor_plan_id_fkey" FOREIGN KEY ("floor_plan_id") REFERENCES "floorplan"."floor_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floorplan"."venue_templates" ADD CONSTRAINT "venue_templates_floor_plan_id_fkey" FOREIGN KEY ("floor_plan_id") REFERENCES "floorplan"."floor_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floorplan"."event_instances" ADD CONSTRAINT "event_instances_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "floorplan"."venue_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floorplan"."event_instances" ADD CONSTRAINT "event_instances_floor_plan_id_fkey" FOREIGN KEY ("floor_plan_id") REFERENCES "floorplan"."floor_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floorplan"."published_snapshots" ADD CONSTRAINT "published_snapshots_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "floorplan"."event_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floorplan"."floor_plan_drafts" ADD CONSTRAINT "floor_plan_drafts_floor_plan_id_fkey" FOREIGN KEY ("floor_plan_id") REFERENCES "floorplan"."floor_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
