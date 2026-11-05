# Operations

## Setup

1. Node 22.19+, `npm ci`.
2. Copy `.env.example` to `.env.local` and set mode, database URLs and APP_URL. Never commit this file.
3. Inspect target schemas before applying migrations. Use a new Neon branch/database or dedicated `smart_factory` schema. `npm run db:migrate` uses MIGRATION_DATABASE_URL, checks migration checksums and takes a lock.
4. Provision the runtime role using `npm run db:runtime-role`; it prints no password. Runtime DATABASE_URL uses that role, owner URL stays restricted to operational scripts.
5. `npm run user:create` creates an admin using BOOTSTRAP_EMAIL, BOOTSTRAP_PASSWORD and BOOTSTRAP_TENANT. Existing users are not silently reset.
6. `npm run dev` for development. `npm run build && npm start` for production.

## Local development

Explicit APP_MODE=development, STORAGE_DRIVER=local and DEV_AUTH=true permit a loopback-only preview account provisioned by the seed command. This mode is rejected in production. Original customer exports can be imported from a local path using the import script; files remain in ignored .local/ and Neon, never Git.

## MinIO (deferred)

Set STORAGE_DRIVER=minio, MINIO_ENDPOINT, MINIO_PORT, MINIO_USE_SSL, MINIO_ACCESS_KEY, MINIO_SECRET_KEY and MINIO_BUCKET. Use a pre-created private bucket and a dedicated bucket-scoped service account. Run `npm run storage:check` for put/get/delete round-trip. Do not migrate local objects implicitly: copy with checksums, verify, then update object locations in a controlled migration. Local mode is not a production storage substitute.

## Release

Run check/build, review migration diff and CHANGELOG, create a version commit and annotated tag. GitHub publication is deferred. Deploy the same lockfile and artifact from the tagged commit. Run migrations once before rollout. Restore the prior application artifact for code rollback; use a forward migration or database restore for schema rollback. Keep schema changes backwards compatible where possible.

## Failure recovery

Import validation errors do not activate a snapshot. Retry identical completed batches returns the existing snapshot. SQL rollback cannot roll back object storage; failed-import cleanup deletes only newly written keys. Interrupted imports may leave private orphan keys; reconcile keys against source_files before removal. No automatic deletion of originals or historical snapshots in v0.1.

## Observability

Health endpoint reports availability without secrets. Record request IDs, model/tool duration and usage, snapshot row counts and validation warnings. Compare dashboard counts with source counts after each import. Back up Neon and MinIO separately and exercise restoration before production use.
