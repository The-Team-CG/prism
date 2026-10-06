-- prism-owner: identity-access
-- prism-kind: mixed
-- prism-risk: medium

-- An approval request belongs to an account in the same identity_access schema. The request is the retained history of
-- an account's approval decisions, so the account cannot be deleted while it has one (RESTRICT): disabling an
-- account (approval_status, lockout) is the supported way to retire it, and the request keeps its own snapshot of
-- name, email, role and organization for review.
--
-- A request whose account no longer exists makes validation fail and aborts the migration, so an owner decides
-- explicitly whether to restore the account or archive the request. Nothing is deleted here.

CREATE INDEX "approval_requests_user_id_idx" ON "identity_access"."approval_requests" ("user_id");

ALTER TABLE "identity_access"."approval_requests"
  ADD CONSTRAINT "approval_requests_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "identity_access"."users" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "identity_access"."approval_requests" VALIDATE CONSTRAINT "approval_requests_user_id_fkey";
