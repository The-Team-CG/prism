-- New-SEC4: comprehensive audit trail, security alerts, and login history.

ALTER TABLE "ops_users"
  ADD COLUMN "failed_login_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockout_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "locked_until" TIMESTAMP(3),
  ADD COLUMN "permanent_lockout" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "last_login_at" TIMESTAMP(3);

ALTER TABLE "ops_audit_logs"
  ADD COLUMN "actor_role" TEXT NOT NULL DEFAULT 'system',
  ADD COLUMN "actor_email" TEXT,
  ADD COLUMN "action_type" TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN "category" TEXT NOT NULL DEFAULT 'events',
  ADD COLUMN "affected_type" TEXT,
  ADD COLUMN "affected_id" TEXT,
  ADD COLUMN "affected_label" TEXT,
  ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "ip_address" TEXT NOT NULL DEFAULT 'system',
  ADD COLUMN "device" TEXT NOT NULL DEFAULT 'P.R.I.S.M',
  ADD COLUMN "severity" TEXT NOT NULL DEFAULT 'info',
  ADD COLUMN "immutable_hash" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "previous_hash" TEXT;

UPDATE "ops_audit_logs"
SET
  "actor_role" = CASE
    WHEN lower("actor") LIKE '%system%' THEN 'system'
    WHEN lower("actor") LIKE '%client%' THEN 'client'
    WHEN lower("actor") LIKE '%supplier%' THEN 'supplier'
    WHEN lower("actor") LIKE '%finance%' THEN 'finance'
    WHEN lower("actor") LIKE '%pmcm%' OR lower("actor") LIKE '%mys%' THEN 'pmcm-admin'
    ELSE 'coordinator'
  END,
  "category" = CASE
    WHEN lower("action") LIKE '%billing%' OR lower("action") LIKE '%payment%' THEN 'finance'
    WHEN lower("action") LIKE '%supplier%' OR lower("action") LIKE '%quote%' THEN 'suppliers'
    WHEN lower("action") LIKE '%portal%' OR lower("action") LIKE '%access%' OR lower("action") LIKE '%sign%' THEN 'access'
    WHEN lower("action") LIKE '%document%' OR lower("action") LIKE '%conforme%' THEN 'documents'
    ELSE 'events'
  END,
  "action_type" = CASE
    WHEN lower("action") LIKE '%created%' THEN 'create'
    WHEN lower("action") LIKE '%uploaded%' THEN 'upload'
    WHEN lower("action") LIKE '%approved%' THEN 'approve'
    WHEN lower("action") LIKE '%declined%' THEN 'decline'
    WHEN lower("action") LIKE '%assigned%' THEN 'assign'
    WHEN lower("action") LIKE '%archived%' THEN 'archive'
    WHEN lower("action") LIKE '%resolved%' THEN 'resolve'
    WHEN lower("action") LIKE '%marked%' OR lower("action") LIKE '%updated%' THEN 'update'
    ELSE 'general'
  END
WHERE "immutable_hash" = '';

CREATE TABLE "ops_login_history" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "user_name" TEXT NOT NULL,
  "user_role" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "ip_address" TEXT NOT NULL DEFAULT 'system',
  "device" TEXT NOT NULL DEFAULT 'P.R.I.S.M',
  "failure_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ops_login_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ops_security_alerts" (
  "id" TEXT NOT NULL,
  "event_id" TEXT,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'warning',
  "status" TEXT NOT NULL DEFAULT 'open',
  "triggered_by" TEXT NOT NULL DEFAULT 'System',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),

  CONSTRAINT "ops_security_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ops_audit_logs_actor_created_at_idx" ON "ops_audit_logs"("actor", "created_at");
CREATE INDEX "ops_audit_logs_category_created_at_idx" ON "ops_audit_logs"("category", "created_at");
CREATE INDEX "ops_audit_logs_action_type_created_at_idx" ON "ops_audit_logs"("action_type", "created_at");
CREATE INDEX "ops_audit_logs_severity_created_at_idx" ON "ops_audit_logs"("severity", "created_at");
CREATE INDEX "ops_login_history_user_id_created_at_idx" ON "ops_login_history"("user_id", "created_at");
CREATE INDEX "ops_login_history_email_created_at_idx" ON "ops_login_history"("email", "created_at");
CREATE INDEX "ops_login_history_status_created_at_idx" ON "ops_login_history"("status", "created_at");
CREATE INDEX "ops_security_alerts_status_created_at_idx" ON "ops_security_alerts"("status", "created_at");
CREATE INDEX "ops_security_alerts_type_created_at_idx" ON "ops_security_alerts"("type", "created_at");
CREATE INDEX "ops_security_alerts_severity_created_at_idx" ON "ops_security_alerts"("severity", "created_at");

ALTER TABLE "ops_login_history"
  ADD CONSTRAINT "ops_login_history_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "ops_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ops_security_alerts"
  ADD CONSTRAINT "ops_security_alerts_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "ops_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
