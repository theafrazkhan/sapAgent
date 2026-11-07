# Dashboard and agent revision

The local repository is the implementation source of truth. Server code changes are not merged. Preserve a private server backup before replacing the deployment.

## Required experience

- Dashboard and Agent are the two primary destinations.
- Dashboard contains chart summaries, record investigation, snapshot selection, upload access, and a side conversation.
- Agent opens the same conversation full screen; changing layouts must not reset messages.
- Successful imports select their committed snapshot immediately. Other open clients discover new snapshots; historical selection remains explicit.
- Charts use deterministic aggregates with units and provenance. Missing measurements remain unavailable.

## Backend target

Add a real FastAPI service with generated OpenAPI and Swagger UI, authenticated typed endpoints, and a documented agent tool registry. Keep existing validated import and tenant SQL services until an equivalent migration is verified. Document any service boundary explicitly; do not label a Next.js endpoint as FastAPI.

## Release acceptance

Verify login, upload, duplicate import, dashboard totals/graphs, shared chat state, evidence links, tenant isolation, tool validation, API documentation and responsive layouts. Preserve database and object storage with a documented backup and recovery procedure. Deploy the local release to sap.afrazkhan.com only after acceptance checks pass.
