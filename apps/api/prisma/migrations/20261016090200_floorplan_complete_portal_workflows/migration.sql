-- prism-owner: floorplan
-- prism-kind: schema
-- prism-risk: medium

-- CreateTable
CREATE TABLE "floorplan"."client_decisions" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "draft_id" TEXT NOT NULL,
    "snapshot_hash" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "actor_id" TEXT NOT NULL,
    "actor_email" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floorplan"."client_annotations" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "draft_id" TEXT NOT NULL,
    "snapshot_hash" TEXT NOT NULL,
    "object_id" TEXT,
    "anchor_x" DOUBLE PRECISION,
    "anchor_y" DOUBLE PRECISION,
    "comment" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_annotations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "floorplan_client_decisions_idempotency_key" ON "floorplan"."client_decisions"("idempotency_key");

-- CreateIndex
CREATE INDEX "floorplan_client_decisions_event_id_idx" ON "floorplan"."client_decisions"("event_id");

-- CreateIndex
CREATE INDEX "floorplan_client_decisions_actor_id_idx" ON "floorplan"."client_decisions"("actor_id");

-- CreateIndex
CREATE UNIQUE INDEX "floorplan_client_decisions_draft_hash_actor_key" ON "floorplan"."client_decisions"("draft_id", "snapshot_hash", "actor_id");

-- CreateIndex
CREATE INDEX "floorplan_client_annotations_event_id_idx" ON "floorplan"."client_annotations"("event_id");

-- CreateIndex
CREATE INDEX "floorplan_client_annotations_draft_hash_idx" ON "floorplan"."client_annotations"("draft_id", "snapshot_hash");

-- CreateIndex
CREATE INDEX "floorplan_client_annotations_actor_id_idx" ON "floorplan"."client_annotations"("actor_id");

-- AddForeignKey

-- AddForeignKey
ALTER TABLE "floorplan"."client_decisions" ADD CONSTRAINT "client_decisions_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "floorplan"."floor_plan_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey

-- AddForeignKey
ALTER TABLE "floorplan"."client_annotations" ADD CONSTRAINT "client_annotations_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "floorplan"."floor_plan_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "floorplan"."client_decisions" ADD CONSTRAINT "floorplan_client_decisions_action_check" CHECK ("action" IN ('approve', 'request_revision'));

ALTER TABLE "floorplan"."client_annotations" ADD CONSTRAINT "floorplan_client_annotations_anchor_check" CHECK (("anchor_x" IS NULL OR "anchor_x" BETWEEN 0 AND 1) AND ("anchor_y" IS NULL OR "anchor_y" BETWEEN 0 AND 1));
