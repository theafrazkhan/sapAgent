# Architecture

## Decision

A TypeScript modular monolith on Node.js: Next.js App Router for UI and server routes, PostgreSQL on Neon, MinIO-compatible object storage, and OpenAI Responses API using `gpt-6-luna`. This removes a second backend language while keeping parsing, SQL, storage and AI modules separate. CPU-bounded parsing runs in the upload request for this small MVP (nine files, 25 MB aggregate, bounded expanded ZIP size and rows). Durable background imports are a future scale boundary, not an invisible in-process task.

## Flow

Browser → authenticated route → application service → parameterized SQL in a tenant transaction. Upload bytes → private storage → validate/normalize → atomic snapshot insert → query services. Chat → fixed tool schemas → the same query services → bounded evidence → model explanation.

## Boundaries

- `src/lib/db`: connection, scoped transactions and migration compatibility.
- `src/lib/import`: file parsers, mappings and snapshot insertion.
- `src/lib/services`: deterministic dashboard/order/material/quality queries.
- `src/lib/ai`: tool registry, budget enforcement and model loop.
- `src/lib/storage`: local-development and MinIO adapters.
- `src/app/api`: authentication, validation and response handling only.

## State

PostgreSQL is authoritative for facts and session authorization. Raw files reside outside the database. Conversation records store messages, snapshot identity and usage; tool calls receive current authorization. No global mutable tenant context. No vector database or orchestration framework is needed for the MVP.

## Deployment

One Node server behind a TLS reverse proxy; Neon pooled connection for runtime, direct owner connection for versioned migrations. Runtime executes as a non-owner role subject to forced RLS. Production startup rejects owner/bypass roles, insecure local storage and development authentication. Model keys and MinIO secrets remain server-only. GitHub publishing is deferred by user instruction.

## References checked 2026-11-05

- https://developers.openai.com/api/docs/models/gpt-6-luna
- https://developers.openai.com/api/docs/guides/function-calling
- https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- https://neon.com/docs/connect/connection-pooling
- https://github.com/minio/minio-js/blob/master/docs/API.md

Model availability is verified against the configured account before claiming a live integration. No automatic model substitution.
