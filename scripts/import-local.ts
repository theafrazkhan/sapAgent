import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { catalog, kinds } from '../src/lib/import/catalog';
import { ingest } from '../src/lib/import/ingest';
import { DEV_TENANT,DEV_USER } from '../src/lib/identity';
import { pool } from '../src/lib/db';
export async function importLocal(){
 if(process.env.APP_MODE!=='development')throw new Error('Local sample import is development-only');
 const path=process.argv[3]||process.argv[2];if(!path)throw new Error('Provide the original ZIP path');
 const zip=await JSZip.loadAsync(await readFile(path));
 const files=await Promise.all(kinds.map(async kind=>{const entry=zip.file(catalog[kind].filename);if(!entry)throw new Error(`Missing ${catalog[kind].filename}`);return{kind,name:catalog[kind].filename,bytes:await entry.async('nodebuffer')};}));
 const result=await ingest({tenantId:DEV_TENANT,userId:DEV_USER,role:'admin',tenantName:'Factory workspace'},files,{name:'SAP manufacturing exports',sourceSystem:'SAP export',sapClient:'unspecified',extractedAt:null});
 console.log(result);
}
if(!process.argv[1].endsWith('ops.ts'))importLocal().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>pool().end());
