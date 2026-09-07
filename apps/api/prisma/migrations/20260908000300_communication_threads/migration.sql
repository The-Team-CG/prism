CREATE TABLE "supplier_ops"."communication_threads" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "communication_threads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_ops"."communication_participants" (
  "id" TEXT NOT NULL,
  "thread_id" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "actor_role" TEXT NOT NULL,
  "actor_email" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "communication_participants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_ops"."communication_messages" (
  "id" TEXT NOT NULL,
  "thread_id" TEXT NOT NULL,
  "sender_id" TEXT NOT NULL,
  "sender_role" TEXT NOT NULL,
  "sender_email" TEXT,
  "body" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "communication_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "communication_participants_thread_actor_key" ON "supplier_ops"."communication_participants"("thread_id", "actor_id");
CREATE UNIQUE INDEX "communication_messages_idempotency_key_key" ON "supplier_ops"."communication_messages"("idempotency_key");
CREATE INDEX "communication_threads_event_id_updated_at_idx" ON "supplier_ops"."communication_threads"("event_id", "updated_at");
CREATE INDEX "communication_participants_actor_active_idx" ON "supplier_ops"."communication_participants"("actor_id", "active");
CREATE INDEX "communication_messages_thread_id_created_at_idx" ON "supplier_ops"."communication_messages"("thread_id", "created_at");

ALTER TABLE "supplier_ops"."communication_threads" ADD CONSTRAINT "communication_threads_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_core"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_ops"."communication_participants" ADD CONSTRAINT "communication_participants_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "supplier_ops"."communication_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_ops"."communication_messages" ADD CONSTRAINT "communication_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "supplier_ops"."communication_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
