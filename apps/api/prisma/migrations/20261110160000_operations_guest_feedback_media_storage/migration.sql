-- prism-owner: operations
-- prism-kind: schema
-- prism-risk: medium

-- New-SEC3: guest feedback photos and videos are stored after a byte check; each media row points at its
-- stored object. Rows recorded before this change keep a null reference and their pending_storage status.
ALTER TABLE "operations"."feedback_media" ADD COLUMN "stored_object_id" TEXT;
CREATE UNIQUE INDEX "feedback_media_stored_object_id_key" ON "operations"."feedback_media"("stored_object_id");
