import { Pool, type PoolClient } from 'pg';

export type Db = Pick<PoolClient, 'query'>;
export type Scope = { tenantId: string; userId: string; role: 'admin' | 'viewer'; tenantName: string };
const globalDb = globalThis as unknown as { factoryPool?: Pool };
export function pool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');
  return globalDb.factoryPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 15000, connectionTimeoutMillis: 10000 });
}
export async function scoped<T>(scope: Scope, fn: (db: Db) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    const role = await client.query('SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user');
    if (role.rows[0]?.rolsuper || role.rows[0]?.rolbypassrls) throw new Error('Runtime database role must not bypass row security.');
    await client.query("SELECT set_config('app.tenant_id',$1,true), set_config('statement_timeout','20000',true)",[scope.tenantId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
