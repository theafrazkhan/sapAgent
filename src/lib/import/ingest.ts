import { createHash, randomUUID } from 'node:crypto';
import { scoped, type Scope, type Db } from '../db';
import { AppError } from '../errors';
import { storage, type ObjectStorage } from '../storage';
import { catalog, kinds, type Kind, type Fact } from './catalog';
import { MAX_BATCH_BYTES, parseFile } from './parse';

export type Upload={kind:Kind;name:string;bytes:Buffer};
export type BatchMeta={name:string;sourceSystem:string;sapClient:string;extractedAt:string|null};
export function batchHash(files:{kind:Kind;hash:string}[],meta:BatchMeta){const canonicalFiles=files.map(({kind,hash})=>({kind,hash})).sort((a,b)=>a.kind.localeCompare(b.kind));return createHash('sha256').update(JSON.stringify({system:meta.sourceSystem,client:meta.sapClient,extractedAt:meta.extractedAt,files:canonicalFiles})).digest('hex');}
export async function insertFacts(db:Db,kind:Kind,facts:Fact[],tenantId:string,snapshotId:string,fileId:string){
 if(!facts.length)return;
 const columns=Object.keys(facts[0]);
 // Identifiers come exclusively from the application-owned catalog/parser, not tool arguments.
 const allowed=new Set(['source_row','kind',...catalog[kind].fields.map(f=>f.column)]);
 if(columns.some(c=>!allowed.has(c)))throw new Error('Unexpected normalized field');
 for(let offset=0;offset<facts.length;offset+=400){
  const chunk=facts.slice(offset,offset+400),values:unknown[]=[];
  const placeholders=chunk.map(f=>{const row=[tenantId,snapshotId,fileId,...columns.map(c=>f[c])];return '('+row.map(v=>{values.push(v);return `$${values.length}`;}).join(',')+')';});
  await db.query(`INSERT INTO smart_factory.${catalog[kind].table}(tenant_id,snapshot_id,source_file_id,${columns.join(',')}) VALUES ${placeholders.join(',')}`,values);
 }
}
export async function ingest(scope:Scope,files:Upload[],meta:BatchMeta,objects:ObjectStorage=storage()){
 if(scope.role!=='admin')throw new AppError('Admin access is required to upload data',403);
 if(files.length!==kinds.length||new Set(files.map(f=>f.kind)).size!==kinds.length)throw new AppError('Upload one file for each of the nine required sources');
 if(files.reduce((sum,f)=>sum+f.bytes.length,0)>MAX_BATCH_BYTES)throw new AppError('Batch exceeds 25 MB');
 const normalized:(Upload & {facts:Fact[];warnings:string[];hash:string;id:string})[]=[];
 for(const file of files){const result=await parseFile(file.kind,file.name,file.bytes);normalized.push({...file,...result,hash:createHash('sha256').update(file.bytes).digest('hex'),id:randomUUID()});}
 if(normalized.reduce((n,f)=>n+f.facts.length,0)>250000)throw new AppError('Batch exceeds 250,000 records');
 const hash=batchHash(normalized,meta);
 const existing=await scoped(scope,async db=>(await db.query('SELECT id FROM smart_factory.snapshots WHERE tenant_id=$1 AND batch_hash=$2',[scope.tenantId,hash])).rows[0]);
 if(existing)return{snapshotId:existing.id as string,duplicate:true};
 const snapshotId=randomUUID(),written:string[]=[];
 try{
  for(const file of normalized){const key=`${scope.tenantId}/${snapshotId}/${file.id}`;await objects.put(key,file.bytes);written.push(key);}
  await scoped(scope,async db=>{
   await db.query("SELECT set_config('statement_timeout','60000',true)");
   await db.query('INSERT INTO smart_factory.snapshots(tenant_id,id,name,source_system,sap_client,extracted_at,imported_by,batch_hash,warnings) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[scope.tenantId,snapshotId,meta.name,meta.sourceSystem,meta.sapClient,meta.extractedAt,scope.userId,hash,JSON.stringify(normalized.flatMap(f=>f.warnings))]);
   for(const file of normalized){
    const key=`${scope.tenantId}/${snapshotId}/${file.id}`;
    await db.query('INSERT INTO smart_factory.source_files(tenant_id,snapshot_id,id,kind,original_name,object_key,storage_driver,sha256,byte_size,row_count) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[scope.tenantId,snapshotId,file.id,file.kind,file.name,key,objects.driver,file.hash,file.bytes.length,file.facts.length]);
    await insertFacts(db,file.kind,file.facts,scope.tenantId,snapshotId,file.id);
   }
   await db.query("INSERT INTO smart_factory.audit_events(tenant_id,id,user_id,action,details) VALUES($1,$2,$3,'snapshot.imported',$4)",[scope.tenantId,randomUUID(),scope.userId,JSON.stringify({snapshotId,files:normalized.length,rows:normalized.reduce((n,f)=>n+f.facts.length,0)})]);
  });
  return{snapshotId,duplicate:false};
 }catch(error){
  await Promise.allSettled(written.map(key=>objects.remove(key)));
  // Concurrent identical uploads can race on the batch uniqueness constraint.
  if((error as {code?:string}).code==='23505'){
   const found=await scoped(scope,async db=>(await db.query('SELECT id FROM smart_factory.snapshots WHERE tenant_id=$1 AND batch_hash=$2',[scope.tenantId,hash])).rows[0]);
   if(found)return{snapshotId:found.id as string,duplicate:true};
  }
  throw error;
 }
}
