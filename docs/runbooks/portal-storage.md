---
type: "Playbook"
title: "Portal file storage"
description: "Configure private file storage and verify portal attachment behavior."
tags: [runbook, storage, portals, files]
status: canonical
updated: "2026-10-28"
authority: operational
audience: [engineering, operators, QA]
scope: "Platform storage adapters and client, supplier, and PMCM file workflows"
last_verified: "2026-10-16; local implementation verification; hosted provider activation unverified"
sources:
  - id: storage
    resource: "apps/api/src/modules/platform-ops/application/storage"
    title: "Storage capability"
  - id: providers
    resource: "apps/api/src/modules/platform-ops/infrastructure/storage"
    title: "Storage adapters"
  - id: workflow-contract
    resource: "docs/product/client-supplier-workflows.md"
    title: "Portal workflow contract"
---
# Portal file storage

## At a glance

- **Default:** Storage is unconfigured. Configure a provider explicitly.
- **Evidence:** A pending upload or metadata record never proves file receipt.
- **Production state:** This delivery does not configure a hosted bucket or credentials.

## Local development

Set `PRISM_STORAGE_PROVIDER=local` and `PRISM_STORAGE_LOCAL_DIRECTORY` to an
absolute directory in the checkout's ignored `.local-dev` folder. Start the API
against a prepared local database. The API authenticates upload/download bytes
and verifies actual size, SHA-256, and supported content before confirmation.
Local disk storage is suitable for development; it is not durable deployment
storage for a serverless API.

## Private Supabase storage

Create a private bucket in the intended Supabase project. Configure these
server-only variables through the deployment secret store:

| Variable | Value |
| --- | --- |
| `PRISM_STORAGE_PROVIDER` | `supabase` |
| `PRISM_STORAGE_SUPABASE_URL` | Project URL |
| `PRISM_STORAGE_SUPABASE_SERVICE_ROLE_KEY` | Server service-role credential |
| `PRISM_STORAGE_SUPABASE_BUCKET` | Private bucket name |

Never prefix a service credential with `NEXT_PUBLIC_`. Do not commit it, put it
in portal configuration, or expose bucket-wide public read policies. Configure
bucket size/content rules to match the shared upload contract.

The API authorizes an immutable object and returns a short-lived provider
upload capability. The portal transfers bytes directly to the provider, then
asks the API to confirm them. Confirmation reads the provider bytes, verifies
the declaration and content, and rechecks actor/event policy before binding.
Downloads require a fresh scoped API authorization. Signed URLs are bearer
capabilities; keep them out of logs and analytics.

Generic storage deletion rejects supplier document objects, which may be bound
to immutable contract or creative submissions. Correcting evidence creates a
new version. Retention and privacy disposal use their separate owner workflow.

Direct transfer is required for larger files on Vercel: its function payload
limit is 4.5 MB. Supabase signed upload capabilities expire after two hours.
See [Vercel limits](https://vercel.com/docs/functions/limitations) and
[Supabase signed uploads](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl).

## Activation verification

1. Apply reviewed migrations to the intended database through the normal
   migration process. Keep the bucket and API environment aligned.
2. Upload a supported file through each affected role. Refresh the screen and
   download it. Compare downloaded bytes with the original.
3. Verify a second actor cannot list, confirm, or download that object. Verify
   suppliers cannot see competing assignments or client-private documents.
4. Interrupt a transfer and retry it. Confirm a failed/pending transfer does
   not satisfy a document requirement. Replacing a file must create a new
   object/version; it must not overwrite confirmed content.
5. Reject a checksum mismatch, invalid content, and archived-event write. Check
   workflow history and audit evidence after successful confirmation.
6. Exercise a direct upload larger than 4.5 MB in the deployed role portal and
   API environment. Provider mocks and local storage cannot prove that path.

Record the environment and results before claiming hosted activation. Retention,
backup/restore, malware scanning, legal hold, and external document delivery
need their own operational decisions and evidence.
