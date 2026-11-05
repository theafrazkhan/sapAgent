# Database contract

## Namespace and migrations

All objects belong to the dedicated `smart_factory` schema. No unrelated schema is modified. Numbered SQL migrations are immutable after application; SHA-256 checksums are stored in a migration ledger. Advisory locks serialize migrations. Each migration is transactional. Changes use forward migrations with a backup/Neon branch before destructive changes. Never run schema push or destructive resets against a shared database.

## Ownership

The migration identity owns tables. A `smart_factory_app` runtime role is a non-owner without BYPASSRLS. Tenant-scoped transactions use `set_config('app.tenant_id', ..., true)` to avoid pooled-connection leakage. RLS includes USING and WITH CHECK and is forced. Runtime role grants exclude DDL. Authentication tables are accessed by trusted server code, never by model-generated SQL.

## Core entities

| Table | Grain / key | Purpose |
|---|---|---|
| tenants | UUID | Customer workspace |
| users | UUID, unique normalized email | Password-hashed operator identity |
| memberships | tenant + user | Admin/viewer access |
| sessions | SHA-256 token hash | Expiring authenticated sessions |
| snapshots | tenant + UUID; unique batch hash | Immutable coherent import batch, source system/client, extraction date |
| source_files | tenant + snapshot + UUID; unique kind per snapshot | Object key, hash, original filename, row count |
| sales_order_items | source file + source row | Sales order/item and material demand |
| orders | source file + source row | Planned and production orders distinguished by kind |
| production_links | source file + source row | Customer/sales/order references and availability |
| confirmations | source file + source row | Order/activity-level posted quantities |
| components | source file + source row | Order or planned order component requirement |
| procurement | source file + source row | Purchase requisition item and optional PO reference |
| inspections | source file + source row | Inspection lot and optional sales reference |
| capacity | source file + source row | Work center/category/period; nullable measurements |
| conversations | tenant + UUID | User-owned chat, pinned snapshot |
| messages | tenant + conversation + UUID | User/assistant message with evidence and usage |
| audit_events | tenant + UUID | Upload/chat actions without secrets or full prompts |

## Referential integrity

All tenant-owned parent relationships use composite foreign keys containing tenant_id. Fact tables reference `(tenant_id, snapshot_id, source_file_id)` so a source cannot cross a tenant or snapshot. Chat references also include tenant and snapshot. Business order/material references are text and indexed, not hard foreign keys: incomplete exports are valid, so unresolved references remain visible rather than dropping rows. Duplicate business identifiers are reported; source rows are never silently discarded.

## Types and indexing

Use UUID internal IDs, text external IDs (including leading zeros), NUMERIC(24,6) quantities and prices, DATE business dates and TIMESTAMPTZ technical timestamps. Units accompany quantities; quantities are not globally summed across units or different materials. JSONB is limited to validation warnings, small audit/AI evidence and usage. Business fields remain typed columns.

Index prefixes are tenant_id, snapshot_id, then common filters (order_id, material_id, plant). Unique indexes protect batch idempotency and one source kind per batch. Do not add indexes speculatively to every column. Use bounded queries and paginate tables. Summary queries aggregate in PostgreSQL and are stable per immutable snapshot.

## Snapshot lifecycle

Validate all expected files before insertion. Store files under tenant/snapshot/file identifiers, never raw user paths. Insert the snapshot, sources and all facts atomically. Readers select a complete snapshot; no partial batch is visible. A batch hash includes source-system/client, extraction date and sorted content hashes. On failure clean up newly written objects where possible and retain an explicit error for retry. Object storage and SQL are not one transaction; orphan cleanup must be documented.
