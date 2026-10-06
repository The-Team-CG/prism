-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium
-- Stores PMCM-managed event grants without a cross-context user foreign key.
CREATE TABLE "event_lifecycle"."client_floorplan_access_grants" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "client_user_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "revoked_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_floorplan_access_grants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "client_floorplan_access_grants_event_user_key"
    ON "event_lifecycle"."client_floorplan_access_grants"("event_id", "client_user_id");
CREATE INDEX "client_floorplan_access_grants_user_active_idx"
    ON "event_lifecycle"."client_floorplan_access_grants"("client_user_id", "active");

ALTER TABLE "event_lifecycle"."client_floorplan_access_grants"
    ADD CONSTRAINT "client_floorplan_access_grants_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "event_lifecycle"."events"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
