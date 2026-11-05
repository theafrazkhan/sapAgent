import { scoped, type Db, type Scope } from './db';
import { AppError } from './errors';
export type Section='orders'|'components'|'procurement'|'inspections'|'capacity'|'sales';
export type DataRow=Record<string,string|number|boolean|null>;
export type Snapshot={id:string;name:string;source_system:string;sap_client:string;extracted_at:string|null;imported_at:string;warnings:string[]};
export type Source={id:string;kind:string;original_name:string;row_count:number;byte_size:string};
export type Summary={production_orders:number;planned_orders:number;sales_items:number;missing_components:number;affected_orders:number;pending_requisitions:number;inspection_lots:number;work_centers:number;capacity_measurements:number};
export type Overview={snapshot:Snapshot|null;snapshots:Snapshot[];sources:Source[];summary:Summary|null;shortages:DataRow[];capacity:DataRow[];limitations:string[]};
export const limitations=[
 'Overdue production is unavailable: the exports do not include a planned finish date.',
 'Missing components are SAP-reported flags. Required minus withdrawn is not stock shortage.',
 'Quality lots show recorded status; rejected quantity and usage decisions are not explicit.',
 'Production and purchasing matches by material do not establish allocated supply.'
];
export async function requireSnapshot(db:Db,scope:Scope,id:string):Promise<Snapshot>{
 const result=await db.query('SELECT id,name,source_system,sap_client,extracted_at,imported_at,warnings FROM smart_factory.snapshots WHERE tenant_id=$1 AND id=$2',[scope.tenantId,id]);
 if(!result.rowCount)throw new AppError('Snapshot not found in your workspace',404);return result.rows[0];
}
export async function summaryQuery(db:Db,scope:Scope,id:string):Promise<Summary>{
 const params=[scope.tenantId,id];
 const counts=await db.query(`SELECT
 (SELECT count(DISTINCT order_id)::int FROM smart_factory.orders WHERE tenant_id=$1 AND snapshot_id=$2 AND kind='production') AS production_orders,
 (SELECT count(DISTINCT order_id)::int FROM smart_factory.orders WHERE tenant_id=$1 AND snapshot_id=$2 AND kind='planned') AS planned_orders,
 (SELECT count(DISTINCT (sales_order_id,sales_item))::int FROM smart_factory.sales_order_items WHERE tenant_id=$1 AND snapshot_id=$2) AS sales_items,
 (SELECT count(*)::int FROM smart_factory.components WHERE tenant_id=$1 AND snapshot_id=$2 AND missing) AS missing_components,
 (SELECT count(DISTINCT order_id)::int FROM smart_factory.components WHERE tenant_id=$1 AND snapshot_id=$2 AND missing AND order_id IS NOT NULL) AS affected_orders,
 (SELECT count(DISTINCT (requisition_id,requisition_item))::int FROM smart_factory.procurement WHERE tenant_id=$1 AND snapshot_id=$2 AND purchase_order_id IS NULL AND NOT deleted AND NOT closed) AS pending_requisitions,
 (SELECT count(DISTINCT lot_id)::int FROM smart_factory.inspections WHERE tenant_id=$1 AND snapshot_id=$2) AS inspection_lots,
 (SELECT count(DISTINCT (plant,work_center))::int FROM smart_factory.capacity WHERE tenant_id=$1 AND snapshot_id=$2) AS work_centers,
 (SELECT count(*)::int FROM smart_factory.capacity WHERE tenant_id=$1 AND snapshot_id=$2 AND load_percent IS NOT NULL) AS capacity_measurements`,params);
 return counts.rows[0];
}
export async function overview(scope:Scope,snapshotId?:string):Promise<Overview>{return scoped(scope,async db=>{
 const snapshots=(await db.query('SELECT id,name,source_system,sap_client,extracted_at,imported_at,warnings FROM smart_factory.snapshots WHERE tenant_id=$1 ORDER BY imported_at DESC LIMIT 50',[scope.tenantId])).rows as Snapshot[];
 const snapshot=snapshotId?await requireSnapshot(db,scope,snapshotId):snapshots[0]??null;
 if(!snapshot)return{snapshot:null,snapshots,sources:[],summary:null,shortages:[],capacity:[],limitations};
 const summary=await summaryQuery(db,scope,snapshot.id);
 const sources=(await db.query('SELECT id,kind,original_name,row_count,byte_size FROM smart_factory.source_files WHERE tenant_id=$1 AND snapshot_id=$2 ORDER BY kind',[scope.tenantId,snapshot.id])).rows as Source[];
 const shortages=(await db.query(`SELECT material_id,max(description) AS description,count(*)::int AS flagged_requirements,count(DISTINCT order_id)::int AS affected_orders FROM smart_factory.components WHERE tenant_id=$1 AND snapshot_id=$2 AND missing GROUP BY material_id ORDER BY flagged_requirements DESC,material_id LIMIT 7`,[scope.tenantId,snapshot.id])).rows;
 const capacity=(await db.query('SELECT work_center,plant,period,category,load_percent FROM smart_factory.capacity WHERE tenant_id=$1 AND snapshot_id=$2 AND load_percent IS NOT NULL ORDER BY load_percent DESC,work_center LIMIT 8',[scope.tenantId,snapshot.id])).rows;
 return{snapshot,snapshots,sources,summary,shortages,capacity,limitations};
});}

const tables:Record<Section,{table:string;search:string[];sort:string;columns:string}>= {
 orders:{table:'orders',search:['order_id','material_id','description','sales_order_id'],sort:'order_id',columns:'kind,order_id,order_type,sales_order_id,sales_item,material_id,description,quantity,delivered,unit,start_date,actual_finish,status'},
 components:{table:'components',search:['order_id','planned_order_id','material_id','description','plant'],sort:'missing DESC,material_id',columns:'order_id,planned_order_id,material_id,description,plant,requirement_date,required_quantity,withdrawn_quantity,unit,missing'},
 procurement:{table:'procurement',search:['requisition_id','purchase_order_id','material_id','description','plant'],sort:'requisition_id',columns:'requisition_id,requisition_item,purchase_order_id,material_id,description,plant,quantity,unit,delivery_date,deleted,closed'},
 inspections:{table:'inspections',search:['lot_id','material_id','sales_order_id','plant'],sort:'lot_id',columns:'lot_id,material_id,plant,sales_order_id,sales_item,quantity,unit,start_date,end_date,status'},
 capacity:{table:'capacity',search:['work_center','description','plant'],sort:'work_center,period',columns:'work_center,description,plant,category,period,requirements,available,load_percent,remaining,unit'},
 sales:{table:'sales_order_items',search:['sales_order_id','material_id','description'],sort:'sales_order_id,sales_item',columns:'sales_order_id,sales_item,material_id,description,quantity,unit,division_name'}
};
export type ListOptions={section:Section;query?:string;limit?:number;offset?:number;kind?:'production'|'planned';missingOnly?:boolean;materialId?:string;workCenter?:string};
export async function listRecords(scope:Scope,snapshotId:string,options:ListOptions){return scoped(scope,async db=>{
 const snapshot=await requireSnapshot(db,scope,snapshotId),config=tables[options.section];if(!config)throw new AppError('Unknown data section');
 const args:unknown[]=[scope.tenantId,snapshotId];let where='t.tenant_id=$1 AND t.snapshot_id=$2';
 const parameter=(v:unknown)=>{args.push(v);return `$${args.length}`;};
 if(options.query){const p=parameter(`%${options.query.replace(/[\\%_]/g,'\\$&')}%`);where+=` AND (${config.search.map(c=>`t.${c} ILIKE ${p}`).join(' OR ')})`;}
 if(options.section==='orders'&&options.kind)where+=` AND t.kind=${parameter(options.kind)}`;
 if(options.section==='components'&&options.missingOnly)where+=' AND t.missing';
 if(options.materialId&&config.columns.includes('material_id'))where+=` AND t.material_id=${parameter(options.materialId)}`;
 if(options.workCenter&&options.section==='capacity')where+=` AND t.work_center=${parameter(options.workCenter)}`;
 const total=(await db.query(`SELECT count(*)::int AS total FROM smart_factory.${config.table} t WHERE ${where}`,args)).rows[0].total as number;
 const limit=Math.min(Math.max(options.limit??25,1),100),offset=Math.max(options.offset??0,0);
 const rows=(await db.query(`SELECT ${config.columns.split(',').map(c=>`t.${c}`).join(',')},t.source_file_id,t.source_row,f.original_name AS source_file FROM smart_factory.${config.table} t JOIN smart_factory.source_files f ON f.tenant_id=t.tenant_id AND f.snapshot_id=t.snapshot_id AND f.id=t.source_file_id WHERE ${where} ORDER BY ${config.sort.split(',').map(c=>'t.'+c).join(',')},t.source_file_id,t.source_row LIMIT ${parameter(limit)} OFFSET ${parameter(offset)}`,args)).rows as DataRow[];
 return{snapshot,records:rows,total,limit,offset,limitations:options.section==='components'?[limitations[1]]:options.section==='procurement'?[limitations[3]]:options.section==='inspections'?[limitations[2]]:[]};
});}
export async function orderDetails(scope:Scope,snapshotId:string,orderId:string){return scoped(scope,async db=>{
 const snapshot=await requireSnapshot(db,scope,snapshotId);const params=[scope.tenantId,snapshotId,orderId];
 const orders=(await db.query('SELECT kind,order_id,material_id,description,quantity,delivered,unit,status,sales_order_id,sales_item,source_file_id,source_row FROM smart_factory.orders WHERE tenant_id=$1 AND snapshot_id=$2 AND order_id=$3 ORDER BY source_row LIMIT 10',params)).rows;
 const components=(await db.query('SELECT material_id,description,required_quantity,withdrawn_quantity,unit,missing,source_file_id,source_row FROM smart_factory.components WHERE tenant_id=$1 AND snapshot_id=$2 AND (order_id=$3 OR planned_order_id=$3) ORDER BY missing DESC,source_row LIMIT 25',params)).rows;
 const confirmationRows=(await db.query('SELECT confirmation_id,posting_date,yield_quantity,scrap_quantity,unit,work_center,activity,source_file_id,source_row FROM smart_factory.confirmations WHERE tenant_id=$1 AND snapshot_id=$2 AND order_id=$3 ORDER BY posting_date DESC,source_row LIMIT 15',params)).rows;
 const counts=(await db.query('SELECT count(*)::int AS requirements,count(*) FILTER(WHERE missing)::int AS flagged_requirements FROM smart_factory.components WHERE tenant_id=$1 AND snapshot_id=$2 AND (order_id=$3 OR planned_order_id=$3)',params)).rows[0];
 return{snapshot,order_id:orderId,orders,components,confirmations:confirmationRows,counts,limitations:['Confirmations are operation records, not a guaranteed finished-output total.',limitations[1]]};
});}
