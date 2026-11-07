import JSZip from 'jszip';
import { catalog, kinds } from './catalog';
import { checkXlsxSize, MAX_BATCH_BYTES, MAX_FILE_BYTES } from './parse';
import { AppError } from '../errors';
import type { Upload } from './ingest';
export async function unpackBundle(bytes:Buffer):Promise<Upload[]>{
 if(bytes.length>MAX_BATCH_BYTES)throw new AppError('ZIP exceeds 25 MB');
 checkXlsxSize(bytes);
 const zip=await JSZip.loadAsync(bytes);
 const entries=Object.values(zip.files).filter(f=>!f.dir&&!f.name.startsWith('__MACOSX/'));
 const result:Upload[]=[];let total=0;
 for(const kind of kinds){
  const stem=catalog[kind].filename.replace(/\.[^.]+$/,'').toLowerCase();
  const matches=entries.filter(e=>e.name.split('/').pop()!.replace(/\.[^.]+$/,'').toLowerCase()===stem&&/\.(xlsx|csv|slk)$/i.test(e.name));
  if(matches.length!==1)throw new AppError(`${catalog[kind].label}: expected one matching export in the ZIP (${catalog[kind].filename}); found ${matches.length}`);
  const entry=matches[0];const content=await entry.async('nodebuffer');total+=content.length;
  if(content.length>MAX_FILE_BYTES||total>MAX_BATCH_BYTES)throw new AppError('Extracted files exceed 10 MB per file or 25 MB total');
  result.push({kind,name:entry.name.split('/').pop()!,bytes:content});
 }
 return result;
}
