CREATE INDEX IF NOT EXISTS events_event_date_id_idx
  ON event_core.events (event_date, id);

CREATE INDEX IF NOT EXISTS events_active_event_date_idx
  ON event_core.events (event_date, id)
  WHERE archived = false;

CREATE INDEX IF NOT EXISTS quote_requests_event_supplier_status_idx
  ON supplier_ops.quote_requests (event_id, supplier_id, status);

CREATE INDEX IF NOT EXISTS quotes_event_request_status_idx
  ON supplier_ops.quotes (event_id, request_id, status);

CREATE INDEX IF NOT EXISTS payment_milestones_event_due_date_idx
  ON finance_ops.payment_milestones (event_id, due_date, id);

CREATE INDEX IF NOT EXISTS audit_logs_event_created_at_id_idx
  ON trust_ops.audit_logs (event_id, created_at DESC, id);

CREATE INDEX IF NOT EXISTS notification_logs_status_created_at_id_idx
  ON trust_ops.notification_logs (status, created_at, id);