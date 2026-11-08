-- prism-owner: operations
-- prism-kind: schema
-- prism-risk: medium

-- Per-role event brief for coordinators (New-CO2): call time, attire, script and role instructions.
CREATE TABLE "operations"."coordinator_role_briefs" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "call_time" TIMESTAMP(3),
    "attire" TEXT NOT NULL DEFAULT '',
    "script" TEXT NOT NULL DEFAULT '',
    "instructions" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT NOT NULL,

    CONSTRAINT "coordinator_role_briefs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "coordinator_role_briefs_event_role_key" ON "operations"."coordinator_role_briefs"("event_id", "role");
