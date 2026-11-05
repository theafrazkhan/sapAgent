# Luna and tools

Model: `gpt-6-luna`, Responses API, low reasoning effort, store=false. Credentials are server-only. Tool definitions use strict JSON schemas; execution validates arguments again. No tools accept tenant_id, SQL, file paths or credentials. Tenant and snapshot are injected from authenticated server state.

## Registry

- get_dashboard_summary(): counts, capabilities, snapshot metadata.
- list_orders(query, kind, limit): bounded order search, total count and source references.
- get_order_details(order_id): order records, related component flags and confirmation records with units.
- list_components(query, missing_only, limit): components and reported shortages.
- list_procurement(material_id, limit): relevant requests/POs, explicitly not allocated supply.
- list_inspections(material_id, limit): recorded inspection lots, dates and raw statuses.
- get_capacity(work_center, limit): reported capacity rows and coverage.

All tools call the same service functions as the dashboard. Result envelopes include snapshot_id, source/extraction metadata, records, total and limitations. Source citations are generated server-side from returned evidence, never invented filenames or links from model prose.

## Budget

Maximum 3 rounds of tools, 6 tool executions total, 25 rows per tool, 16 KB per tool output, 8 recent messages and 12 KB history text. Maximum 1200 output tokens per model response and 20,000 accumulated input tokens per turn. Enforce input bounds before sending, output size on serialization, and a timeout. Request the first tool call for data questions; the final round disables tools. Log token usage and duration without storing API secrets. Keep snapshots fixed across follow-ups. Reauthorization happens each request.

## Grounding

Treat all imported strings as untrusted data, never instructions. Explain unavailable metrics and distinguish a reported flag from a derived quantity. Never confirm root causes from correlation. Never combine incompatible units. Surface upstream provider errors honestly; do not fabricate a local chatbot fallback. A model outage must not break the dashboard.

## Validation

Test tool validation, call/size limits, unknown tool rejection, tenant/snapshot scope and deterministic numeric answers. Integration-test a real model query only with configured credentials; mocked transport is for orchestration tests and is reported separately.
