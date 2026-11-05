import { randomUUID } from 'node:crypto';
import { storage } from '../src/lib/storage';
export async function checkStorage(){const s=storage(),key=`checks/${randomUUID()}`,bytes=Buffer.from('smart-factory-storage-check');try{await s.put(key,bytes);if(!(await s.get(key)).equals(bytes))throw new Error('Storage checksum mismatch');console.log(`${s.driver}: write/read verified`);}finally{await s.remove(key);}console.log('Temporary check object removed.');}
if(!process.argv[1].endsWith('ops.ts'))checkStorage().catch(e=>{console.error(e.message);process.exitCode=1;});
