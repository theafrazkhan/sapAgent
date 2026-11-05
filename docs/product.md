# MVP scope

## Outcome

Upload the nine supplied SAP exports, inspect a reproducible snapshot, filter and investigate records, and ask grounded questions using the same queries as the dashboard. The PDF's examples are not production facts.

## Included

- Authenticated read-only business access and admin upload permission.
- Tenant-scoped immutable import snapshots and raw-file provenance.
- XLSX, CSV and SAP SYLK parsing with explicit column mappings.
- Overview counts, production/planned order tables, component flags, procurement visibility, quality lots and capacity periods where populated.
- GPT-6 Luna with bounded, validated read-only tools and source references.
- Clean Git commits, semver prerelease, migrations, tests and operational documentation.

## Deferred

Live SAP APIs/writeback, autonomous purchasing, prediction, defect-history analysis without a supplied dataset, enterprise SSO, per-plant permission policies and unrestricted natural-language SQL. MinIO activation is deferred by the user; implement and test its adapter contract, use ignored local files during development, and require MinIO in production.

## Acceptance

Repeated uploads do not inflate totals. Failed validation leaves the previous snapshot usable. Exact identifiers survive import. Dashboard and chat counts agree. Unsupported measures display unavailable. A tenant cannot access another tenant's rows or files. Luna never chooses the tenant. Every imported record has a source file and row. A successful model answer has query evidence; missing API configuration is shown honestly.
