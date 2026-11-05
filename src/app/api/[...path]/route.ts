import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { getScope, checkOrigin, rateLimit, signIn, sessionCookie } from '@/lib/auth';
import { AppError, publicError } from '@/lib/errors';
import { overview, listRecords, orderDetails, type Section } from '@/lib/services';
import { pool, scoped } from '@/lib/db';
import { tokenHash } from '@/lib/identity';
import { kinds, type Kind } from '@/lib/import/catalog';
import { ingest, type Upload } from '@/lib/import/ingest';
import { MAX_BATCH_BYTES } from '@/lib/import/parse';
import { storage, type StorageDriver } from '@/lib/storage';
import { ask } from '@/lib/ai/chat';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=120;
const uuid=z.string().uuid();
function failed(error:unknown){if(error instanceof z.ZodError)return NextResponse.json({error:error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')},{status:400});const r=publicError(error);return NextResponse.json({error:r.error},{status:r.status});}
async function limitedBody(req:Request,limit:number){
 if(Number(req.headers.get('content-length')||0)>limit)throw new AppError('Request is too large',413);
 const reader=req.body?.getReader();if(!reader)return Buffer.alloc(0);const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const{done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new AppError('Request is too large',413);}chunks.push(value);}}finally{reader.releaseLock();}
 return Buffer.concat(chunks);
}
async function jsonBody(req:Request){try{return JSON.parse((await limitedBody(req,20000)).toString('utf8'));}catch(e){if(e instanceof AppError)throw e;throw new AppError('Invalid JSON body');}}
export async function GET(req:NextRequest,ctx:{params:Promise<{path:string[]}>}){
 try{
  const path=(await ctx.params).path.join('/');
  if(path==='health')return NextResponse.json({status:'ok',version:'0.1.0-alpha.1'});
  const scope=await getScope(),p=req.nextUrl.searchParams;
  if(path==='session')return NextResponse.json({workspace:scope.tenantName,role:scope.role,development:process.env.DEV_AUTH==='true',model:process.env.OPENAI_MODEL||'gpt-6-luna',aiConfigured:Boolean(process.env.OPENAI_API_KEY),storage:process.env.STORAGE_DRIVER||'local'});
  if(path==='overview')return NextResponse.json(await overview(scope,p.has('snapshot')?uuid.parse(p.get('snapshot')):undefined));
  const snapshotId=uuid.parse(p.get('snapshot'));
  if(path==='records'){
   const section=z.enum(['orders','components','procurement','inspections','capacity','sales']).parse(p.get('section')) as Section;
   return NextResponse.json(await listRecords(scope,snapshotId,{section,query:z.string().max(120).parse(p.get('q')||''),kind:p.has('kind')?z.enum(['production','planned']).parse(p.get('kind')):undefined,missingOnly:p.get('missing')==='true',offset:z.coerce.number().int().min(0).max(250000).parse(p.get('offset')||0),limit:25}));
  }
  if(path==='order')return NextResponse.json(await orderDetails(scope,snapshotId,z.string().min(1).max(80).parse(p.get('id'))));
  if(path==='file'){
   const id=uuid.parse(p.get('id'));const file=await scoped(scope,async db=>(await db.query('SELECT object_key,storage_driver,original_name FROM smart_factory.source_files WHERE tenant_id=$1 AND snapshot_id=$2 AND id=$3',[scope.tenantId,snapshotId,id])).rows[0]);
   if(!file)throw new AppError('Source file not found',404);
   const bytes=await storage(file.storage_driver as StorageDriver).get(file.object_key);
   return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`,'Cache-Control':'private, no-store'}});
  }
  throw new AppError('Endpoint not found',404);
 }catch(e){return failed(e);}
}
export async function POST(req:NextRequest,ctx:{params:Promise<{path:string[]}>}){
 try{
  checkOrigin(req);const path=(await ctx.params).path.join('/');
  if(path==='login'){
   rateLimit('login-global',50);
   const b=z.object({email:z.string().email().max(254),password:z.string().min(1).max(256)}).parse(await jsonBody(req));
   const token=await signIn(b.email,b.password);const res=NextResponse.json({ok:true});res.cookies.set(sessionCookie,token,{httpOnly:true,sameSite:'strict',secure:new URL(process.env.APP_URL!).protocol==='https:',path:'/',maxAge:43200});return res;
  }
  const scope=await getScope();
  if(path==='logout'){const token=(await cookies()).get(sessionCookie)?.value;if(token)await pool().query('DELETE FROM smart_factory.sessions WHERE token_hash=$1',[tokenHash(token)]);const res=NextResponse.json({ok:true});res.cookies.delete(sessionCookie);return res;}
  if(path==='upload'){
   if(scope.role!=='admin')throw new AppError('Admin access required',403);rateLimit(`upload:${scope.tenantId}`,5,60000);
   const body=await limitedBody(req,MAX_BATCH_BYTES+1024*1024);
   const form=await new Response(new Uint8Array(body),{headers:{'content-type':req.headers.get('content-type')||''}}).formData();
   const meta=z.object({name:z.string().trim().min(1).max(120),sourceSystem:z.string().trim().min(1).max(80),sapClient:z.string().trim().min(1).max(20),extractedAt:z.string().datetime().nullable()}).parse({name:form.get('name'),sourceSystem:form.get('sourceSystem'),sapClient:form.get('sapClient'),extractedAt:form.get('extractedAt')||null});
   const files:Upload[]=[];
   for(const kind of kinds){const entries=form.getAll(kind);if(entries.length!==1||!(entries[0] instanceof File))throw new AppError(`Select one ${kind} export`);const file=entries[0];files.push({kind:kind as Kind,name:file.name,bytes:Buffer.from(await file.arrayBuffer())});}
   return NextResponse.json(await ingest(scope,files,meta),{status:201});
  }
  if(path==='chat'){
   rateLimit(`chat:${scope.tenantId}:${scope.userId}`,10);
   const b=z.object({snapshotId:uuid,message:z.string().trim().min(1).max(3000),conversationId:uuid.optional()}).strict().parse(await jsonBody(req));
   return NextResponse.json(await ask(scope,b.snapshotId,b.message,b.conversationId));
  }
  throw new AppError('Endpoint not found',404);
 }catch(e){return failed(e);}
}
