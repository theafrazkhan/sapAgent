import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
const db=new PGlite();
const a='10000000-0000-4000-8000-000000000001',b='20000000-0000-4000-8000-000000000002';
const user='30000000-0000-4000-8000-000000000003',snapshot='40000000-0000-4000-8000-000000000004',file='50000000-0000-4000-8000-000000000005';
beforeAll(async()=>{
 for(const f of ['001_initial.sql','002_business_records.sql','003_secondary_requirement.sql'])await db.exec(await readFile(`db/migrations/${f}`,'utf8'));
 await db.exec(`INSERT INTO smart_factory.tenants VALUES('${a}','A',now()),('${b}','B',now()); INSERT INTO smart_factory.users(id,email,password_hash) VALUES('${user}','a@example.test','hash'); INSERT INTO smart_factory.memberships VALUES('${a}','${user}','admin'),('${b}','${user}','admin'); CREATE ROLE sf_test; GRANT USAGE ON SCHEMA smart_factory TO sf_test; GRANT SELECT,INSERT ON ALL TABLES IN SCHEMA smart_factory TO sf_test;`);
 await db.exec(`INSERT INTO smart_factory.snapshots(tenant_id,id,name,source_system,sap_client,imported_by,batch_hash) VALUES('${a}','${snapshot}','A','SAP','100','${user}',repeat('a',64)),('${b}','${snapshot}','B','SAP','100','${user}',repeat('b',64)); INSERT INTO smart_factory.source_files(tenant_id,snapshot_id,id,kind,original_name,object_key,storage_driver,sha256,byte_size,row_count) VALUES('${a}','${snapshot}','${file}','components','a.xlsx','a/key','local',repeat('a',64),100,1); SET ROLE sf_test;`);
});
afterAll(()=>db.close());
describe('database isolation and integrity',()=>{
 it('defaults to no visible tenant data',async()=>{const r=await db.query('SELECT * FROM smart_factory.snapshots');expect(r.rows).toHaveLength(0);});
 it('isolates identical snapshot IDs between tenants and resets transaction scope',async()=>{
  await db.exec('BEGIN');await db.query("SELECT set_config('app.tenant_id',$1,true)",[a]);
  const r=await db.query<{name:string}>('SELECT name FROM smart_factory.snapshots');expect(r.rows.map(r=>r.name)).toEqual(['A']);await db.exec('COMMIT');
  expect((await db.query('SELECT * FROM smart_factory.snapshots')).rows).toHaveLength(0);
 });
 it('rejects cross-tenant inserts',async()=>{await db.exec('BEGIN');await db.query("SELECT set_config('app.tenant_id',$1,true)",[a]);await expect(db.query(`INSERT INTO smart_factory.audit_events(tenant_id,id,user_id,action) VALUES($1,$2,$3,'test')`,[b,crypto.randomUUID(),user])).rejects.toThrow(/row-level security/);await db.exec('ROLLBACK');});
 it('rejects a source belonging to another tenant even under its own valid scope',async()=>{await db.exec('BEGIN');await db.query("SELECT set_config('app.tenant_id',$1,true)",[b]);await expect(db.query('INSERT INTO smart_factory.components(tenant_id,snapshot_id,source_file_id,source_row,material_id) VALUES($1,$2,$3,2,\'MAT\')',[b,snapshot,file])).rejects.toThrow(/foreign key/);await db.exec('ROLLBACK');});
 it('preserves text identifiers and decimal values',async()=>{await db.exec('BEGIN');await db.query("SELECT set_config('app.tenant_id',$1,true)",[a]);await db.query("INSERT INTO smart_factory.components(tenant_id,snapshot_id,source_file_id,source_row,material_id,required_quantity) VALUES($1,$2,$3,2,'0000123',1.234567)",[a,snapshot,file]);const r=await db.query<{material_id:string;required_quantity:string}>('SELECT material_id,required_quantity FROM smart_factory.components');expect(r.rows[0]).toEqual({material_id:'0000123',required_quantity:'1.234567'});await db.exec('ROLLBACK');});
});
