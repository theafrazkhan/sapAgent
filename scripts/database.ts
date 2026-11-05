import { Pool } from 'pg';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { hashPassword, DEV_TENANT, DEV_USER } from '../src/lib/identity';
import { batchHash } from '../src/lib/import/ingest';

const command=process.argv[2];
const db=new Pool({connectionString:process.env.MIGRATION_DATABASE_URL,max:1,connectionTimeoutMillis:15000});
async function main(){
 if(!process.env.MIGRATION_DATABASE_URL) throw new Error('MIGRATION_DATABASE_URL is required');
 if(command==='inspect'){
   console.log((await db.query("SELECT schemaname, count(*)::int AS tables FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') GROUP BY schemaname ORDER BY schemaname")).rows);
   console.log((await db.query('SELECT current_database() AS database, current_user AS migration_role')).rows); return;
 }
 if(command==='report'){
  const snapshots=(await db.query(`SELECT s.tenant_id,s.id,s.name,s.imported_at,s.extracted_at,s.batch_hash,sum(f.row_count)::int AS rows,count(f.id)::int AS files
    FROM smart_factory.snapshots s LEFT JOIN smart_factory.source_files f ON f.tenant_id=s.tenant_id AND f.snapshot_id=s.id
    GROUP BY s.tenant_id,s.id ORDER BY s.imported_at DESC`)).rows;
  console.log(JSON.stringify(snapshots,null,2));
  for(const s of snapshots){
   const rows=(await db.query(`SELECT
    (SELECT count(*)::int FROM smart_factory.orders WHERE tenant_id=$1 AND snapshot_id=$2 AND kind='production') AS production_orders,
    (SELECT count(*)::int FROM smart_factory.orders WHERE tenant_id=$1 AND snapshot_id=$2 AND kind='planned') AS planned_orders,
    (SELECT count(*)::int FROM smart_factory.components WHERE tenant_id=$1 AND snapshot_id=$2) AS component_rows,
    (SELECT count(*)::int FROM smart_factory.components WHERE tenant_id=$1 AND snapshot_id=$2 AND missing) AS missing_flags`,[s.tenant_id,s.id])).rows[0];
   console.log(s.id,rows);
  }
  if(snapshots.length>1){
   const first=await db.query('SELECT kind,sha256 FROM smart_factory.source_files WHERE tenant_id=$1 AND snapshot_id=$2 ORDER BY kind',[snapshots[0].tenant_id,snapshots[0].id]);
   const second=await db.query('SELECT kind,sha256 FROM smart_factory.source_files WHERE tenant_id=$1 AND snapshot_id=$2 ORDER BY kind',[snapshots[1].tenant_id,snapshots[1].id]);
   console.log('Identical-batch check:',JSON.stringify({batchHashMatches:snapshots[0].batch_hash===snapshots[1].batch_hash,fileHashesMatch:JSON.stringify(first.rows)===JSON.stringify(second.rows)}));
  }
  return;
 }
 if(command==='rehash'){
  const snapshots=(await db.query(`SELECT tenant_id,id,source_system,sap_client,extracted_at FROM smart_factory.snapshots ORDER BY imported_at DESC LIMIT 1`)).rows;
  if(!snapshots.length){console.log('No snapshot to rehash.');return;}
  const s=snapshots[0];
  const files=(await db.query('SELECT kind,sha256 AS hash FROM smart_factory.source_files WHERE tenant_id=$1 AND snapshot_id=$2',[s.tenant_id,s.id])).rows;
  const hash=batchHash(files,{name:'',sourceSystem:s.source_system,sapClient:s.sap_client,extractedAt:s.extracted_at?.toISOString?.()??null});
  await db.query('UPDATE smart_factory.snapshots SET batch_hash=$3 WHERE tenant_id=$1 AND id=$2',[s.tenant_id,s.id,hash]);
  console.log(`Canonical batch identity applied to latest snapshot ${s.id}.`);return;
 }
 if(command==='migrate'){
  const c=await db.connect();
  try{
   await c.query("SELECT pg_advisory_lock(hashtext('smart_factory_migrations'))");
   await c.query('CREATE SCHEMA IF NOT EXISTS smart_factory; CREATE TABLE IF NOT EXISTS smart_factory.schema_migrations(version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
   for(const file of (await readdir('db/migrations')).filter(f=>f.endsWith('.sql')).sort()){
    const sql=await readFile(`db/migrations/${file}`,'utf8'); const checksum=createHash('sha256').update(sql).digest('hex');
    const old=await c.query('SELECT checksum FROM smart_factory.schema_migrations WHERE version=$1',[file]);
    if(old.rowCount){if(old.rows[0].checksum!==checksum) throw new Error(`Applied migration changed: ${file}`); continue;}
    await c.query('BEGIN');
    try{await c.query(sql);await c.query('INSERT INTO smart_factory.schema_migrations(version,checksum) VALUES($1,$2)',[file,checksum]);await c.query('COMMIT');console.log(`Applied ${file}`);}
    catch(e){await c.query('ROLLBACK');throw e;}
   }
  }finally{await c.query("SELECT pg_advisory_unlock(hashtext('smart_factory_migrations'))");c.release();}
 }
 if(command==='runtime-role'){
  const existing=await db.query("SELECT rolname FROM pg_roles WHERE rolname='smart_factory_app'");
  if(existing.rowCount){ console.log('Runtime role already exists; no password was changed.'); return; }
  const password=randomBytes(32).toString('hex');
  await db.query(`CREATE ROLE smart_factory_app LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`);
  await db.query('GRANT USAGE ON SCHEMA smart_factory TO smart_factory_app; GRANT SELECT,INSERT ON ALL TABLES IN SCHEMA smart_factory TO smart_factory_app; GRANT DELETE ON smart_factory.sessions TO smart_factory_app; REVOKE ALL ON smart_factory.schema_migrations FROM smart_factory_app; REVOKE INSERT ON smart_factory.tenants, smart_factory.users, smart_factory.memberships FROM smart_factory_app; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA smart_factory TO smart_factory_app');
  const config=await readFile('.env.local','utf8');const url=new URL(process.env.DATABASE_URL!);url.username='smart_factory_app';url.password=password;
  await writeFile('.env.local',config.replace(/^DATABASE_URL=.*$/m,`DATABASE_URL=${url.toString()}`),{mode:0o600});
  console.log('Provisioned restricted runtime role and updated ignored local configuration.');
 }
 if(command==='seed'||command==='user'){
  const dev=command==='seed'; if(dev&&process.env.APP_MODE!=='development') throw new Error('Seed is development only');
  const email=dev?'preview@localhost':process.env.BOOTSTRAP_EMAIL?.toLowerCase();
  const password=dev?randomBytes(48).toString('hex'):process.env.BOOTSTRAP_PASSWORD;
  if(!email||!password||password.length<12) throw new Error('Set BOOTSTRAP_EMAIL and BOOTSTRAP_PASSWORD (at least 12 characters)');
  if((await db.query('SELECT id FROM smart_factory.users WHERE email=$1',[email])).rowCount){console.log('User already exists; unchanged.');return;}
  const tid=dev?DEV_TENANT:randomUUID(),uid=dev?DEV_USER:randomUUID();
  const c=await db.connect();try{await c.query('BEGIN');await c.query('INSERT INTO smart_factory.tenants(id,name) VALUES($1,$2)',[tid,process.env.BOOTSTRAP_TENANT||'Factory workspace']);await c.query('INSERT INTO smart_factory.users(id,email,password_hash) VALUES($1,$2,$3)',[uid,email,hashPassword(password)]);await c.query("INSERT INTO smart_factory.memberships(tenant_id,user_id,role) VALUES($1,$2,'admin')",[tid,uid]);await c.query('COMMIT');console.log('Workspace and admin provisioned.');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
}
main().catch(e=>{console.error('Database operation failed:',e.message.replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]'));process.exitCode=1;}).finally(()=>db.end());
