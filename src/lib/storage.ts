import { Client } from 'minio';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { AppError } from './errors';
export type StorageDriver='local'|'minio';
export interface ObjectStorage{driver:StorageDriver;put(key:string,bytes:Buffer):Promise<void>;get(key:string):Promise<Buffer>;remove(key:string):Promise<void>}
function validateKey(key:string){if(!/^[a-zA-Z0-9_/-]+$/.test(key)||key.includes('..')||key.startsWith('/'))throw new AppError('Invalid object key');}
export function storage(driver=(process.env.STORAGE_DRIVER||'local') as StorageDriver):ObjectStorage{
 if(driver==='local'){
  if(process.env.APP_MODE!=='development')throw new AppError('Local storage is only available in development',503);
  const base=path.join(process.cwd(),'.local','objects');const file=(key:string)=>{validateKey(key);return path.join(base,key);};
  return{driver,async put(key,bytes){const p=file(key);await mkdir(path.dirname(p),{recursive:true});await writeFile(p,bytes,{mode:0o600,flag:'wx'});},get:key=>readFile(file(key)),async remove(key){await unlink(file(key)).catch(e=>{if(e.code!=='ENOENT')throw e;});}};
 }
 if(driver!=='minio')throw new AppError('Invalid storage driver',503);
 const endpoint=process.env.MINIO_ENDPOINT,bucket=process.env.MINIO_BUCKET;
 if(!endpoint||!bucket||!process.env.MINIO_ACCESS_KEY||!process.env.MINIO_SECRET_KEY)throw new AppError('MinIO is not configured',503);
 const client=new Client({endPoint:endpoint,port:Number(process.env.MINIO_PORT||443),useSSL:process.env.MINIO_USE_SSL!=='false',accessKey:process.env.MINIO_ACCESS_KEY,secretKey:process.env.MINIO_SECRET_KEY});
 return{driver,async put(key,bytes){validateKey(key);await client.putObject(bucket,key,bytes,bytes.length,{'Content-Type':'application/octet-stream'});},async get(key){validateKey(key);const stream=await client.getObject(bucket,key);const chunks:Buffer[]=[];for await(const chunk of stream)chunks.push(Buffer.from(chunk));return Buffer.concat(chunks);},async remove(key){validateKey(key);await client.removeObject(bucket,key);}};
}
