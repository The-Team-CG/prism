-- prism-owner: operations
-- prism-kind: schema
-- prism-risk: medium

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE "operations"."guest_qr_passes" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "roster_entry_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "delivery_status" TEXT NOT NULL DEFAULT 'queued',
    "notification_id" TEXT,
    "issued_by_id" TEXT NOT NULL,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_by_id" TEXT,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_qr_passes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "guest_qr_passes_roster_entry_event_fkey"
        FOREIGN KEY ("roster_entry_id", "event_id")
        REFERENCES "operations"."guest_roster_entries" ("id", "event_id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "guest_qr_passes_token_hash_key"
    ON "operations"."guest_qr_passes"("token_hash");
CREATE UNIQUE INDEX "guest_qr_passes_active_roster_key"
    ON "operations"."guest_qr_passes"("event_id", "roster_entry_id")
    WHERE "status" = 'active';
CREATE INDEX "guest_qr_passes_event_status_idx"
    ON "operations"."guest_qr_passes"("event_id", "status");
CREATE INDEX "guest_qr_passes_notification_idx"
    ON "operations"."guest_qr_passes"("notification_id");

COMMIT;
