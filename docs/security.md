# Security boundaries

MVP users are provisioned by CLI; no public signup. Passwords use scrypt with random salt. Session tokens are random, stored only as SHA-256 hashes, expire, and travel in HttpOnly SameSite cookies (Secure under HTTPS). Membership is checked on every request. Admin uploads; viewers can read/chat. Mutation routes validate Origin against APP_URL and enforce content limits. Login and chat have bounded rate limits; single-process enforcement is documented until a distributed limiter is added.

All business access uses parameterized queries under a tenant-scoped transaction and forced RLS. Use a restricted runtime role; do not give the model a SQL tool. Composite foreign keys prevent cross-tenant child references. A conversation belongs to its creator. File object keys are server-generated; signed download URLs are short-lived and issued after scope checks. Never expose public MinIO buckets.

Development preview authentication is explicit, loopback-only and refused in production. Local file storage is development-only and lives in ignored .local/. Tenant data, original ZIP/PDF/Excel files, secrets, screenshots and environment files are excluded from Git. Logs do not include raw API error payloads or credentials.

Production requires TLS, restricted database credentials, private MinIO, backups, retention policy, and actual MinIO validation. Per-plant permissions/SSO are outside v0.1; all authorized tenant members can view that tenant's dataset. Document this limitation when onboarding customers.
