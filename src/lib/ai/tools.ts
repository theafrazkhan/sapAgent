import { z } from 'zod';
import type { Scope } from '../db';
import { AppError } from '../errors';
import { overview, listRecords, orderDetails } from '../services';

const text=z.string().max(120).nullable();
const limit=z.number().int().min(1).max(25);
export const schemas={
 get_dashboard_summary:z.object({}).strict(),
 list_orders:z.object({query:text,kind:z.enum(['production','planned']).nullable(),limit}).strict(),
 get_order_details:z.object({order_id:z.string().min(1).max(80)}).strict(),
 list_components:z.object({query:text,missing_only:z.boolean(),limit}).strict(),
 list_procurement:z.object({material_id:text,limit}).strict(),
 list_inspections:z.object({material_id:text,limit}).strict(),
 get_capacity:z.object({work_center:text,limit}).strict()
};
const descriptions:Record<keyof typeof schemas,string>={
 get_dashboard_summary:'Get the exact dashboard counts, source coverage, extraction date and unavailable metrics for the current snapshot.',
 list_orders:'Find production or planned orders by order, material, description or sales order. Returns total plus source rows.',
 get_order_details:'Inspect an exact production or planned order number, component flags and operation confirmations. Not a sales-order lookup.',
 list_components:'Find component requirements. missing_only uses the exported missing-part flag, not calculated stock shortage.',
 list_procurement:'Find purchase requisitions and purchase orders for an exact material, or list all. Material matching does not establish allocation.',
 list_inspections:'Find recorded quality lots for an exact material. No explicit rejected quantity or usage decision is available.',
 get_capacity:'Read reported work-center capacity rows. Null measurements mean unavailable.'
};
export const definitions=Object.entries(schemas).map(([name,schema])=>({type:'function' as const,name,description:descriptions[name as keyof typeof schemas],parameters:z.toJSONSchema(schema),strict:true}));
export async function executeTool(scope:Scope,snapshotId:string,name:string,args:unknown):Promise<unknown>{
 if(!(name in schemas))throw new AppError('Unknown tool');
 switch(name){
  case 'get_dashboard_summary':{schemas.get_dashboard_summary.parse(args);const r=await overview(scope,snapshotId);return{snapshot:r.snapshot,summary:r.summary,sources:r.sources,limitations:r.limitations};}
  case 'list_orders':{const a=schemas.list_orders.parse(args);return listRecords(scope,snapshotId,{section:'orders',query:a.query??undefined,kind:a.kind??undefined,limit:a.limit});}
  case 'get_order_details':return orderDetails(scope,snapshotId,schemas.get_order_details.parse(args).order_id);
  case 'list_components':{const a=schemas.list_components.parse(args);return listRecords(scope,snapshotId,{section:'components',query:a.query??undefined,missingOnly:a.missing_only,limit:a.limit});}
  case 'list_procurement':{const a=schemas.list_procurement.parse(args);return listRecords(scope,snapshotId,{section:'procurement',materialId:a.material_id??undefined,limit:a.limit});}
  case 'list_inspections':{const a=schemas.list_inspections.parse(args);return listRecords(scope,snapshotId,{section:'inspections',materialId:a.material_id??undefined,limit:a.limit});}
  case 'get_capacity':{const a=schemas.get_capacity.parse(args);return listRecords(scope,snapshotId,{section:'capacity',workCenter:a.work_center??undefined,limit:a.limit});}
 }
}
export function boundedOutput(result:unknown,maxBytes=16000):string{
 const copy=JSON.parse(JSON.stringify(result)) as Record<string,unknown>;
 let output=JSON.stringify(copy);
 if(Buffer.byteLength(output)<=maxBytes)return output;
 copy.truncated=true;
 const arrays=Object.keys(copy).filter(k=>Array.isArray(copy[k])&&k!=='limitations');
 while(Buffer.byteLength(output)>maxBytes){
  const key=arrays.sort((a,b)=>(copy[b] as unknown[]).length-(copy[a] as unknown[]).length)[0];
  if(!key||!(copy[key] as unknown[]).length)throw new AppError('Tool result exceeds context budget');
  (copy[key] as unknown[]).pop();output=JSON.stringify(copy);
 }
 return output;
}
export type Evidence={fileId:string;row:number|null;label:string};
export function evidenceFrom(value:unknown):Evidence[]{
 const out=new Map<string,Evidence>();
 function visit(v:unknown){
  if(!v||typeof v!=='object')return;
  if(Array.isArray(v)){v.forEach(visit);return;}
  const r=v as Record<string,unknown>;
  if(typeof r.source_file_id==='string'&&typeof r.source_row==='number'){const e={fileId:r.source_file_id,row:r.source_row,label:typeof r.source_file==='string'?r.source_file:`Source row ${r.source_row}`};out.set(`${e.fileId}:${e.row}`,e);}
  if(typeof r.id==='string'&&typeof r.original_name==='string'){const e={fileId:r.id,row:null,label:r.original_name};out.set(e.fileId,e);}
  Object.values(r).forEach(visit);
 }
 visit(value);return[...out.values()].slice(0,20);
}
