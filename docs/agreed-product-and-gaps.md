# Smart Factory: agreed direction and implementation gaps

## Sources and precedence

The original TMC proposal (printed pages 2-6) defines the manufacturing cockpit and export-only workflow. User decisions specify Neon, MinIO, Luna, versioned Git history and clean schema. The latest user requirements specify Next.js frontend with FastAPI and Swagger, one dashboard with a side agent, and full-screen chat. These override the older architecture document's TypeScript-only backend decision.

## Stack

| Layer | Required direction | Current local implementation |
|---|---|---|
| Frontend | React / Next.js / TypeScript; unified manufacturing dashboard and full-screen Agent | Next.js; partial dashboard revision, not visually accepted |
| Backend | Python FastAPI; validated, authenticated API; generated OpenAPI and Swagger | Next.js server routes; FastAPI is not implemented |
| Database | Neon PostgreSQL; typed business tables, tenant isolation, immutable import snapshots | Implemented migrations, runtime role, forced RLS, composite foreign keys |
| Files | Private MinIO originals; metadata and hashes in PostgreSQL | MinIO adapter; local development object storage |
| AI | Luna; schema-defined tools; deterministic queries and bounded evidence | Responses API and seven internal tools; not FastAPI-backed yet |
| Versions | Local Git commits, documented migrations and release history | Two committed milestones plus uncommitted local revision; GitHub deferred |

## Reference dashboard composition

1. Header: Dashboard / Agent, data upload action, source and extraction timestamp.
2. Filter strip: plant and date where source fields support them; MRP controller, material group and product hierarchy require mapping/coverage before enabling.
3. KPI strip: materials planned, planned orders, purchase requisitions, shortage indicators and capacity utilization. Do not copy illustrative PDF values or percentage changes.
4. Main chart row: shortage trend, critical materials, capacity by work center.
5. Detail row: planned orders, quality evidence, production and procurement summary.
6. Action area: evidence-based exceptions with drill-down and Ask agent actions.
7. Optional right agent panel. Full-screen Agent shares the active conversation and selected snapshot.

The reference image includes exception messages, but the source table explicitly says these are not required. Do not reinstate exception-message processing merely to imitate the picture.

## Data honesty and chart readiness

| Reference widget | Implementation rule |
|---|---|
| Shortage trend | Requires comparable dated snapshots or a validated historical measure; requirement dates alone do not prove a historical shortage trend |
| Top critical materials by shortfall | Requires available quantity; present export supports ranked missing-part flags, not confirmed shortfall quantities |
| Capacity utilization | Plot populated capacity loads; current sample has work-center definitions but no load measurements |
| Planned orders | Supported; preserve IDs, units and source rows; do not invent finish dates |
| Production status | Show raw SAP statuses until consultant-approved interpretation exists |
| Procurement overview | Show requisitions and linked purchase orders; material matches do not establish allocation |
| Quality | Inspection lot status is available; rejected quantities/usage decisions cannot be assumed |
| Historical defects | Optional source in proposal; not implemented in current nine-source importer |

## Database commitments

Dedicated smart_factory schema. UUID internal keys, text SAP identifiers, NUMERIC quantities, explicit units and business dates. All business records link tenant, snapshot and source row. Restricted runtime role and transaction-scoped RLS. Versioned immutable SQL migrations with checksums. Atomic publication of complete imports and stable content hashes for idempotency. Raw spreadsheets do not go into JSON business tables. Existing snapshots must survive the backend migration.

## Agent API commitments

Expose typed FastAPI operations for dashboard summary, chart aggregates, order search/details, components, procurement, inspection lots and capacity. Tool descriptions specify units, limits, filters, missing-data semantics and provenance. Tenant identity comes from authentication; the model cannot supply tenant IDs or SQL. UI and agent use the same business service definitions. Swagger must describe actual running endpoints, authentication, request/response models and errors.

Existing tools: get_dashboard_summary, list_orders, get_order_details, list_components, list_procurement, list_inspections, get_capacity. Current limits: 25 rows per tool, 16 KB serialized tool output, 8 recent messages, 6 tool executions per request, bounded token/time budgets. Add chart tools when the aggregates are implemented and verified.

## Immediate blockers and acceptance

Local API currently cannot connect to Neon (connection timeout); an HTTP-200 page does not establish a working dashboard. Restore authenticated database connectivity before claiming sample data is loaded. Then use the supplied excelfileforsmartfactoryai.zip, verify duplicate handling, and compare dashboard aggregates to its source rows.

Finish reference-aligned UI, upload feedback/refresh, FastAPI and Swagger, conversation persistence/recovery, optional defect-source handling, responsive/browser verification, backup and restore procedures. Only then replace the server with the local release at sap.afrazkhan.com.
