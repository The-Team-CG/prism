# Commercial quote-request integrity

## Preflight

The Commercial owner must inspect the target database before deploying the
quote-request integrity migration:

```powershell
npm --workspace prism-api run db:preflight:quote-request-fk
```

The command uses the direct-first migration URL selection and verified TLS
policy. It reports a count and a bounded sample of orphan quote IDs. A nonzero
count stops the release; decide how each row should be repaired with the
Commercial owner. The preflight never deletes quotes, invents a request, or
clears the reference.

Run the preflight again immediately before the Prisma deploy command. New writes
are protected after the NOT VALID constraint is installed; PostgreSQL then
validates historical rows separately.

## Migration behavior

The forward-only migration creates a request-reference index concurrently,
adds quotes.request_id to quote_requests.id as NOT VALID, then validates it.
The FK uses ON DELETE RESTRICT so a request that has recorded bid evidence
cannot be removed. ON UPDATE CASCADE preserves the stable request key if an
owner-approved key change occurs. No quote or request rows are rewritten.

The Prisma relation and index declarations describe the same behavior. No
historical migration is edited.

## Recovery

If preflight finds orphans, stop before applying the migration and resolve the
records through the Commercial owner. If index creation or constraint
validation fails, inspect the Prisma migration ledger and live constraint/index
catalog before retrying. Do not edit an applied migration or use IF NOT EXISTS
to hide a partial index. A failed CREATE INDEX CONCURRENTLY can leave an
invalid index that must be reviewed and removed before a new forward repair
migration is applied.