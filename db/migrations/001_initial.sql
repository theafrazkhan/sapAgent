CREATE SCHEMA IF NOT EXISTS smart_factory;
SET search_path TO smart_factory, public;

CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL CHECK(length(name) BETWEEN 1 AND 160), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE users (id uuid PRIMARY KEY, email text NOT NULL UNIQUE CHECK(email = lower(email)), password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE memberships (tenant_id uuid NOT NULL REFERENCES tenants(id), user_id uuid NOT NULL REFERENCES users(id), role text NOT NULL CHECK(role IN ('admin','viewer')), PRIMARY KEY(tenant_id,user_id));
CREATE TABLE sessions (token_hash text PRIMARY KEY, tenant_id uuid NOT NULL, user_id uuid NOT NULL, expires_at timestamptz NOT NULL, FOREIGN KEY(tenant_id,user_id) REFERENCES memberships(tenant_id,user_id) ON DELETE CASCADE);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE snapshots (
 tenant_id uuid NOT NULL REFERENCES tenants(id), id uuid NOT NULL, name text NOT NULL,
 source_system text NOT NULL, sap_client text NOT NULL, extracted_at timestamptz,
 imported_at timestamptz NOT NULL DEFAULT now(), imported_by uuid NOT NULL,
 batch_hash text NOT NULL CHECK(length(batch_hash)=64), mapping_version integer NOT NULL DEFAULT 1,
 warnings jsonb NOT NULL DEFAULT '[]', PRIMARY KEY(tenant_id,id),
 UNIQUE(tenant_id,batch_hash), FOREIGN KEY(tenant_id,imported_by) REFERENCES memberships(tenant_id,user_id)
);
CREATE INDEX snapshots_latest_idx ON snapshots(tenant_id,imported_at DESC);
CREATE TABLE source_files (
 tenant_id uuid NOT NULL, snapshot_id uuid NOT NULL, id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('sales','planned','production','links','confirmations','components','procurement','inspections','capacity')),
 original_name text NOT NULL, object_key text NOT NULL UNIQUE, storage_driver text NOT NULL CHECK(storage_driver IN ('local','minio')),
 sha256 text NOT NULL CHECK(length(sha256)=64), byte_size bigint NOT NULL CHECK(byte_size>0), row_count integer NOT NULL CHECK(row_count>=0),
 PRIMARY KEY(tenant_id,snapshot_id,id), UNIQUE(tenant_id,snapshot_id,kind), FOREIGN KEY(tenant_id,snapshot_id) REFERENCES snapshots(tenant_id,id)
);

CREATE TABLE conversations (
 tenant_id uuid NOT NULL, id uuid NOT NULL, snapshot_id uuid NOT NULL, user_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,id,snapshot_id),
 FOREIGN KEY(tenant_id,snapshot_id) REFERENCES snapshots(tenant_id,id), FOREIGN KEY(tenant_id,user_id) REFERENCES memberships(tenant_id,user_id)
);
CREATE TABLE messages (
 tenant_id uuid NOT NULL, id uuid NOT NULL, conversation_id uuid NOT NULL, snapshot_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN ('user','assistant')), content text NOT NULL CHECK(length(content)<=20000),
 evidence jsonb NOT NULL DEFAULT '[]', usage jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,conversation_id,snapshot_id) REFERENCES conversations(tenant_id,id,snapshot_id)
);
CREATE INDEX messages_thread_idx ON messages(tenant_id,conversation_id,created_at);
CREATE TABLE audit_events (
 tenant_id uuid NOT NULL REFERENCES tenants(id), id uuid NOT NULL, user_id uuid NOT NULL, action text NOT NULL,
 details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,user_id) REFERENCES memberships(tenant_id,user_id)
);
CREATE INDEX audit_events_time_idx ON audit_events(tenant_id,created_at DESC);
