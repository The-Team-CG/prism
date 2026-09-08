CREATE SCHEMA IF NOT EXISTS "platform_ops";

CREATE TABLE "platform_ops"."stored_objects" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "owner_record_type" TEXT NOT NULL,
  "owner_record_id" TEXT NOT NULL,
  "usage" TEXT NOT NULL,
  "logical_target" TEXT NOT NULL,
  "original_file_name" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "declared_byte_size" INTEGER NOT NULL,
  "checksum_sha256" TEXT NOT NULL,
  "uploader_actor_id" TEXT NOT NULL,
  "uploader_actor_role" TEXT NOT NULL,
  "lifecycle_state" TEXT NOT NULL DEFAULT 'requested',
  "provider_name" TEXT,
  "provider_object_key" TEXT,
  "failure_reason" TEXT,
  "idempotency_key" TEXT,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "stored_at" TIMESTAMP(3),
  "failed_at" TIMESTAMP(3),
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stored_objects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stored_objects_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_core"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "stored_objects_idempotency_key_key"
  ON "platform_ops"."stored_objects"("idempotency_key");
CREATE UNIQUE INDEX "stored_objects_event_usage_logical_target_key"
  ON "platform_ops"."stored_objects"("event_id", "usage", "logical_target");
CREATE INDEX "stored_objects_event_id_lifecycle_state_idx"
  ON "platform_ops"."stored_objects"("event_id", "lifecycle_state");
CREATE INDEX "stored_objects_owner_record_idx"
  ON "platform_ops"."stored_objects"("owner_record_type", "owner_record_id");
