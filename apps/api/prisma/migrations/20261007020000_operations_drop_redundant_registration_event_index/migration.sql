-- prism-owner: operations
-- prism-kind: schema
-- prism-risk: medium

-- registration_platforms already has a unique index on event_id (registration_platforms_event_id_key), which serves
-- every lookup, join and delete-check this ordinary index served. Keeping both doubles write cost for no read benefit.
DROP INDEX "operations"."registration_platforms_event_id_idx";
