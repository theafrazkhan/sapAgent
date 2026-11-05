# Changelog

## 0.1.0-alpha.2 — in development

- Built the MVP dashboard, nine-source SAP export ingestion, tenant-scoped data APIs, deterministic business tools and GPT-6 Luna chat with evidence references.
- Added initial Neon schema and RLS policies, migration checksums, restricted runtime role setup and local MinIO-compatible storage adapter.
- Imported the provided sample bundle into Neon twice before detecting a batch identity bug; fixed canonical hashing so generated parser IDs no longer affect duplicate detection. The latest existing snapshot was rehashed. A repeat-import confirmation is pending Neon DNS availability; existing rows were preserved.
- Local verification: typecheck and 17 tests passed; production build result recorded in `docs/verification.md`.
- MinIO activation and GitHub publication remain deferred as requested.

## 0.1.0-alpha.1 — in development

- Architecture, typed schema contract, import semantics, AI tool boundaries and operational workflow documented before implementation.
- Neon selected for database, MinIO adapter planned with activation deferred by user, GPT-6 Luna selected for read-only tool calling.
- GitHub publication deferred; maintain local version history.
