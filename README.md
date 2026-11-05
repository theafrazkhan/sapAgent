# Smart Factory

An upload-based manufacturing dashboard with evidence-backed questions powered by GPT-6 Luna. It reads SAP exports; it does not connect to SAP or write back to ERP.

## Project status

Version 0.1.0-alpha.1. Architecture and data contracts are documented before implementation. See [CHANGELOG](CHANGELOG.md) for implemented scope and [verification](docs/verification.md) for actual checks and integration limitations.

## Documentation

- [Scope and acceptance criteria](docs/product.md)
- [Architecture and decisions](docs/architecture.md)
- [Database design](docs/database/schema.md)
- [Import contracts and business rules](docs/data-contracts.md)
- [Chatbot tools and AI budget](docs/ai-tools.md)
- [Security](docs/security.md)
- [Local setup and deployment](docs/operations/runbook.md)
- [Versioning and contribution workflow](CONTRIBUTING.md)

## Development

Node.js 22.19+ and npm are required. Install with `npm ci`, copy `.env.example` to `.env.local`, configure a dedicated PostgreSQL database, then run `npm run db:migrate`, `npm run user:create`, and `npm run dev`. Detailed setup, the explicit local-preview mode, and MinIO configuration are in the runbook. No source data or credentials belong in Git.

## Checks

`npm run check` runs type checking and tests. `npm run build` verifies the production bundle. CI runs the same checks. Committed SQL migrations are the schema source of truth; the app never auto-migrates on startup.
