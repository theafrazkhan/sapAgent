import { ask } from '../src/lib/ai/chat';
import { overview } from '../src/lib/services';
import { DEV_TENANT,DEV_USER } from '../src/lib/identity';
import { pool } from '../src/lib/db';
export async function checkAI(){
 const scope={tenantId:DEV_TENANT,userId:DEV_USER,role:'admin' as const,tenantName:'Factory workspace'};
 const data=await overview(scope);if(!data.snapshot)throw new Error('Import a snapshot first');
 const result=await ask(scope,data.snapshot.id,'How many production orders and flagged component requirements are in this snapshot? Mention the data limitations.');
 console.log(JSON.stringify({answer:result.answer,usage:result.usage,evidenceCount:result.sources.length},null,2));
}
if(!process.argv[1].endsWith('ops.ts'))checkAI().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>pool().end());
