import { cookies, headers } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { pool, type Scope } from './db';
import { AppError } from './errors';
import { DEV_TENANT, DEV_USER, tokenHash, verifyPassword } from './identity';
export const sessionCookie='factory_session';
export async function getScope():Promise<Scope>{
 const h=await headers();const host=h.get('host')?.split(':')[0];
 if(process.env.DEV_AUTH==='true'){
  if(process.env.APP_MODE!=='development'||process.env.NODE_ENV==='production')throw new AppError('Development authentication is disabled in production',503);
  if(!['localhost','127.0.0.1','[::1]'].includes(host??''))throw new AppError('Local preview only accepts loopback requests',403);
  const membership=(await pool().query('SELECT t.name FROM smart_factory.memberships m JOIN smart_factory.tenants t ON t.id=m.tenant_id WHERE m.tenant_id=$1 AND m.user_id=$2',[DEV_TENANT,DEV_USER])).rows[0];
  if(!membership)throw new AppError('Run the development seed command before opening the preview',503);
  return{tenantId:DEV_TENANT,userId:DEV_USER,role:'admin',tenantName:membership.name};
 }
 const token=(await cookies()).get(sessionCookie)?.value;if(!token)throw new AppError('Sign in to continue',401);
 const result=await pool().query(`SELECT s.tenant_id,s.user_id,m.role,t.name FROM smart_factory.sessions s JOIN smart_factory.memberships m ON m.tenant_id=s.tenant_id AND m.user_id=s.user_id JOIN smart_factory.tenants t ON t.id=s.tenant_id WHERE s.token_hash=$1 AND s.expires_at>now()`,[tokenHash(token)]);
 const row=result.rows[0];if(!row)throw new AppError('Your session has expired',401);
 return{tenantId:row.tenant_id,userId:row.user_id,role:row.role,tenantName:row.name};
}
export function checkOrigin(request:Request){
 const expected=new URL(process.env.APP_URL||'http://localhost:3000').origin;
 const origin=request.headers.get('origin');
 const localPreview=process.env.APP_MODE==='development'&&process.env.NODE_ENV!=='production'&&['http://localhost:3000','http://127.0.0.1:3000'].includes(expected)&&['http://localhost:3000','http://127.0.0.1:3000'].includes(origin||'');
 if(origin!==expected&&!localPreview)throw new AppError('Request origin is not allowed',403);
}
const buckets=new Map<string,{count:number;expires:number}>();
export function rateLimit(key:string,limit=20,windowMs=60000){
 const now=Date.now();if(buckets.size>5000)for(const[k,v]of buckets)if(v.expires<now)buckets.delete(k);
 const item=buckets.get(key);if(!item||item.expires<now){buckets.set(key,{count:1,expires:now+windowMs});return;}
 if(++item.count>limit)throw new AppError('Too many requests. Please wait a moment.',429);
}
export async function signIn(email:string,password:string){
 rateLimit(`login:${email}`,5,15*60000);
 const result=await pool().query('SELECT id,password_hash FROM smart_factory.users WHERE email=$1',[email.toLowerCase()]);
 const user=result.rows[0];
 if(!user||!verifyPassword(password,user.password_hash))throw new AppError('Email or password is incorrect',401);
 const membership=(await pool().query('SELECT tenant_id FROM smart_factory.memberships WHERE user_id=$1 ORDER BY tenant_id LIMIT 1',[user.id])).rows[0];
 if(!membership)throw new AppError('No workspace access is configured',403);
 const token=randomBytes(32).toString('hex');
 await pool().query("INSERT INTO smart_factory.sessions(token_hash,tenant_id,user_id,expires_at) VALUES($1,$2,$3,now()+interval '12 hours')",[tokenHash(token),membership.tenant_id,user.id]);
 return token;
}
