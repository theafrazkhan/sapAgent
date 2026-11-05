import { pool } from '../src/lib/db';
async function main(){switch(process.argv[2]){
 case 'import':await (await import('./import-local')).importLocal();break;
 case 'storage':await (await import('./storage-check')).checkStorage();break;
 case 'ai':await (await import('./ai-check')).checkAI();break;
 default:throw new Error('Use import <zip>, storage or ai');
}}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>pool().end());
