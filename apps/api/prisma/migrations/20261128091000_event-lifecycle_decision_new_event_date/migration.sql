-- prism-owner: event-lifecycle
-- prism-kind: data
-- prism-risk: medium

-- Store the requested date on every event decision so an idempotent replay compares one field.
-- Decisions recorded before financialImpact.newEventDate existed get the value the replay used to derive:
-- the persisted reschedule target (assignmentImpact.reschedule.toDate, as its calendar date YYYY-MM-DD) when
-- present, otherwise the owning event's current date for a postponement, otherwise JSON null (no requested date).
-- Only rows without the key are touched, so the statement is idempotent.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

UPDATE "event_lifecycle"."event_decisions"
SET "financial_impact" = jsonb_set(
  COALESCE("financial_impact", '{}'::jsonb),
  '{newEventDate}',
  COALESCE(to_jsonb(
    CASE
      WHEN jsonb_typeof("assignment_impact" -> 'reschedule' -> 'toDate') = 'string'
        THEN LEFT("assignment_impact" -> 'reschedule' ->> 'toDate', 10)
      WHEN "decision" = 'postponed'
        THEN (SELECT to_char("event_date", 'YYYY-MM-DD') FROM "event_lifecycle"."events" WHERE "id" = "event_id")
    END
  ), 'null'::jsonb),
  true
)
WHERE NOT (COALESCE("financial_impact", '{}'::jsonb) ? 'newEventDate');

COMMIT;
