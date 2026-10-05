-- prism-owner: platform-ops
-- prism-kind: schema
-- prism-risk: medium

CREATE TABLE "platform_ops"."privacy_legal_holds" (
  "id" TEXT NOT NULL,
  "subject_type" TEXT NOT NULL,
  "subject_email" TEXT NOT NULL DEFAULT '',
  "subject_name" TEXT NOT NULL DEFAULT '',
  "event_id" TEXT,
  "reason" TEXT NOT NULL,
  "placed_by_id" TEXT NOT NULL,
  "placed_by_name" TEXT NOT NULL,
  "placed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "release_reason" TEXT,
  "released_by_id" TEXT,
  "released_by_name" TEXT,
  "released_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "privacy_legal_holds_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "privacy_legal_holds_email_active_idx"
  ON "platform_ops"."privacy_legal_holds"("subject_type", "subject_email", "released_at", "event_id");

CREATE INDEX "privacy_legal_holds_name_active_idx"
  ON "platform_ops"."privacy_legal_holds"("subject_type", "subject_name", "released_at", "event_id");
