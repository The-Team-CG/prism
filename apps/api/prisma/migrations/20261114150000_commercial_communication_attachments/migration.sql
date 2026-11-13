-- prism-owner: commercial
-- prism-kind: schema
-- prism-risk: medium

-- Files attached to conversation messages. Each row links one message to one conversation-owned stored object, which
-- can belong to only one message. Touches only commercial tables; the stored object lives in platform_ops and is
-- referenced by its id, not by a foreign key.

-- CreateTable
CREATE TABLE "commercial"."communication_message_attachments" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "stored_object_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "communication_message_attachments_message_id_idx" ON "commercial"."communication_message_attachments"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "communication_message_attachments_stored_object_id_key" ON "commercial"."communication_message_attachments"("stored_object_id");

-- AddForeignKey
ALTER TABLE "commercial"."communication_message_attachments" ADD CONSTRAINT "communication_message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "commercial"."communication_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
