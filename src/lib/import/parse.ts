import ExcelJS from 'exceljs';
import { parse } from 'csv-parse/sync';
import { AppError } from '../errors';
import { catalog, type Kind, type Fact, type Value } from './catalog';

export const MAX_FILE_BYTES=10*1024*1024, MAX_BATCH_BYTES=25*1024*1024, MAX_ROWS=100000;
type Cell=string|number|boolean|Date|null;
type Grid={row:number;cells:Cell[]}[];
const norm=(s:string)=>s.trim().replace(/\s+/g,' ').toLowerCase();
export function decimal(value:Cell):string|null {
 if(value===null||value==='')return null;
 let s=String(value).trim();
 if(typeof value==='number'){if(!Number.isFinite(value))throw new AppError('Non-finite quantity');s=value.toFixed(6).replace(/\.?0+$/,'');if(s==='')s='0';}
 if(/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s))s=s.replaceAll(',','');
 if(!/^-?\d+(\.\d+)?$/.test(s))throw new AppError(`Invalid numeric value: ${s.slice(0,40)}`);
 if(s.replace('-','').split('.')[0].length>18)throw new AppError('Quantity exceeds numeric precision');
 // PostgreSQL NUMERIC(24,6) is the storage contract; round spreadsheet binary noise once.
 const n=Number(s); if(!Number.isFinite(n))throw new AppError('Invalid quantity');
 if((s.split('.')[1]?.length??0)>6)s=n.toFixed(6);
 return s;
}
export function businessDate(value:Cell):string|null {
 if(value===null||value==='')return null;
 if(value instanceof Date){if(isNaN(value.getTime()))throw new AppError('Invalid date');return value.toISOString().slice(0,10);}
 if(typeof value==='number')return businessDate(new Date(Date.UTC(1899,11,30)+Math.round(value)*86400000));
 const s=String(value).trim(); let iso=s;
 if(/^\d{2}\.\d{2}\.\d{4}$/.test(s)){const[d,m,y]=s.split('.');iso=`${y}-${m}-${d}`;}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))throw new AppError(`Use ISO or DD.MM.YYYY dates: ${s.slice(0,30)}`);
 const d=new Date(`${iso}T00:00:00Z`);if(isNaN(d.getTime())||d.toISOString().slice(0,10)!==iso)throw new AppError(`Invalid calendar date: ${s}`);
 return iso;
}
function flag(v:Cell){if(v===null||v==='')return false;const s=String(v).toLowerCase().trim();if(['x','true','1','yes'].includes(s))return true;if(['false','0','no'].includes(s))return false;throw new AppError(`Unrecognized flag: ${s.slice(0,30)}`);}

export function checkXlsxSize(bytes:Buffer){
 let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(bytes.readUInt32LE(i)===0x06054b50){end=i;break;}}
 if(end<0)throw new AppError('Invalid XLSX container');
 const entries=bytes.readUInt16LE(end+10);let offset=bytes.readUInt32LE(end+16),total=0;
 if(entries===65535||offset===0xffffffff)throw new AppError('ZIP64 spreadsheets are not supported');
 for(let i=0;i<entries;i++){
  if(offset+46>bytes.length||bytes.readUInt32LE(offset)!==0x02014b50)throw new AppError('Invalid XLSX directory');
  total+=bytes.readUInt32LE(offset+24);if(total>80*1024*1024)throw new AppError('Expanded spreadsheet exceeds 80 MB');
  offset+=46+bytes.readUInt16LE(offset+28)+bytes.readUInt16LE(offset+30)+bytes.readUInt16LE(offset+32);
 }
}
function sylkTokens(line:string){return line.match(/(?:[^;"\r\n]|"(?:[^"]|"")*")+/g)??[];}
export function parseSylk(text:string):Grid{
 const rows=new Map<number,Cell[]>();let x=1,y=1;
 for(const line of text.split(/\r?\n/)){
  if(!/^[CF];/.test(line))continue;
  const tokens=sylkTokens(line);for(const t of tokens.slice(1)){if(/^X\d+$/.test(t))x=Number(t.slice(1));if(/^Y\d+$/.test(t))y=Number(t.slice(1));}
  if(x>100||y>MAX_ROWS)throw new AppError('Capacity export exceeds supported dimensions');
  if(tokens[0]!=='C')continue;
  const k=tokens.find(t=>t.startsWith('K'));if(!k)continue;
  const raw=k.slice(1);const value=raw.startsWith('"')?raw.slice(1,-1).replaceAll('""','"'):raw;
  const row=rows.get(y)??[];row[x-1]=value;rows.set(y,row);
 }
 return [...rows].sort(([a],[b])=>a-b).map(([row,cells])=>({row,cells}));
}
function capacityFacts(grid:Grid):Fact[]{
 const facts:Fact[]=[];let center='',description='',plant='',category='',emitted=false,centerRow=1;
 function empty(){if(center&&!emitted)facts.push({source_row:centerRow,work_center:center,description,plant,category,period:null,requirements:null,available:null,load_percent:null,remaining:null,unit:null});}
 for(const {row,cells:c}of grid){
  const label=String(c[0]??'').trim().toLowerCase();
  if(label.startsWith('work center')){empty();center=String(c[1]??'');description=String(c[2]??'');plant='';category='';emitted=false;centerRow=row;}
  else if(label==='plant')plant=String(c[1]??'');
  else if(label.startsWith('capacity cat'))category=String(c[1]??'');
  else if(center&&label&&label!=='month'&&label!=='period'){
   if(!c.slice(1,5).some(v=>v!==undefined&&v!==''))continue;
   facts.push({source_row:row,work_center:center,description,plant,category,period:String(c[0]),requirements:decimal(c[1]??null),available:decimal(c[2]??null),load_percent:decimal(c[3]??null),remaining:decimal(c[4]??null),unit:String(c[5]??'')||null});emitted=true;
  }
 }
 empty();if(!facts.length)throw new AppError('No work-center sections found in capacity file');return facts;
}
async function gridFromXlsx(bytes:Buffer):Promise<Grid>{
 checkXlsxSize(bytes);const wb=new ExcelJS.Workbook();await wb.xlsx.load(bytes as unknown as ExcelJS.Buffer);
 const sheets=wb.worksheets.filter(s=>s.actualRowCount>0);if(sheets.length!==1)throw new AppError('Upload a workbook with exactly one populated sheet');
 const sheet=sheets[0];if(sheet.rowCount>MAX_ROWS+1||sheet.columnCount>150)throw new AppError('Spreadsheet exceeds row or column limit');
 const grid:Grid=[];
 sheet.eachRow((row,n)=>{const cells:Cell[]=[];row.eachCell({includeEmpty:true},(cell,i)=>{
  let value=cell.value;
  if(value&&typeof value==='object'&&'formula'in value){if(value.result===undefined)throw new AppError(`Formula without cached result at ${cell.address}`);value=value.result;}
  if(value&&typeof value==='object'&&'error'in value)throw new AppError(`Spreadsheet error at ${cell.address}`);
  if(value instanceof Date||typeof value==='boolean')cells[i-1]=value;
  else if(typeof value==='number')cells[i-1]=/^0{2,}$/.test(cell.numFmt)?String(value).padStart(cell.numFmt.length,'0'):value;
  else cells[i-1]=value===null?null:cell.text;
 });grid.push({row:n,cells});});return grid;
}
export async function parseFile(kind:Kind,filename:string,bytes:Buffer):Promise<{facts:Fact[];warnings:string[]}>{
 if(!bytes.length||bytes.length>MAX_FILE_BYTES)throw new AppError(`${filename}: file must be between 1 byte and 10 MB`);
 let grid:Grid;
 if(/\.slk$/i.test(filename)){if(kind!=='capacity')throw new AppError('SLK is supported for capacity only');return{facts:capacityFacts(parseSylk(bytes.toString('latin1'))),warnings:[]};}
 if(/\.xlsx$/i.test(filename))grid=await gridFromXlsx(bytes);
 else if(/\.csv$/i.test(filename)){const rows=parse(bytes,{bom:true,skip_empty_lines:false,relax_column_count:false,max_record_size:100000}) as string[][];grid=rows.map((cells,i)=>({row:i+1,cells})).filter(r=>r.cells.some(c=>c!==''));}
 else throw new AppError('Only XLSX, CSV and SLK files are accepted');
 if(grid.length<2)throw new AppError(`${filename}: no data rows`);
 if(grid.length>MAX_ROWS+1)throw new AppError(`${filename}: exceeds ${MAX_ROWS} rows`);
 const seen=new Map<string,number>();const headers=grid[0].cells.map(c=>{const key=norm(String(c??'')),n=(seen.get(key)??0)+1;seen.set(key,n);return n>1?`${key}#${n}`:key;});
 const spec=catalog[kind];
 const missing=spec.fields.filter(f=>!headers.includes(norm(f.header))).map(f=>f.header);
 if(missing.length)throw new AppError(`${filename}: missing columns: ${missing.join(', ')}`);
 const warnings:string[]=[];
 let detailGrid=grid.slice(1);
 if(kind==='planned'||kind==='production'){
  const idx=(h:string)=>headers.indexOf(norm(h));
  const value=(cells:Cell[],h:string)=>cells[idx(h)]??null;
  const totals=new Map<string,number[]>();
  const measures=['Order quantity','Delivered quantity','Committed qty'];
  for(const {cells}of detailGrid){if(!value(cells,'Order'))continue;const unit=String(value(cells,'Unit of measure')??''),material=String(value(cells,'Material')??'');
   for(const key of [`${material}|${unit}`,`*|${unit}`]){const sums=totals.get(key)??[0,0,0];measures.forEach((m,i)=>{sums[i]+=Number(decimal(value(cells,m))??0);});totals.set(key,sums);}
  }
  const excluded:number[]=[];
  detailGrid=detailGrid.filter(({row,cells})=>{
   if(value(cells,'Order'))return true;
   const allowed=new Set(['material','order quantity','delivered quantity','committed qty','unit of measure']);
   if(cells.some((v,i)=>v!==null&&v!==''&&v!==undefined&&!allowed.has(headers[i])))return true;
   const material=String(value(cells,'Material')??''),unit=String(value(cells,'Unit of measure')??'');
   const sums=totals.get(`${material||'*'}|${unit}`);
   if(!sums)return true;
   if(!measures.every((m,i)=>Math.abs(Number(decimal(value(cells,m))??0)-sums[i])<0.002))throw new AppError(`${filename}, row ${row}: report subtotal does not reconcile with detail records`);
   excluded.push(row);return false;
  });
  if(excluded.length)warnings.push(`${filename}: excluded ${excluded.length} verified subtotal/total rows from business records. Source rows: ${excluded.slice(0,12).join(', ')}${excluded.length>12?'…':''}.`);
 }
 const facts=detailGrid.map(({row,cells})=>{
  const fact:Fact={source_row:row};if(kind==='planned'||kind==='production')fact.kind=kind;
  for(const field of spec.fields){const raw=cells[headers.indexOf(norm(field.header))]??null;let value:Value;
   try{value=field.type==='number'?decimal(raw):field.type==='date'?businessDate(raw):field.type==='flag'?flag(raw):raw===null||raw===''?null:String(raw).trim();}
   catch(e){throw new AppError(`${filename}, row ${row}, ${field.header}: ${(e as Error).message}`);}
   if(field.required&&(value===null||value===''))throw new AppError(`${filename}, row ${row}: ${field.header} is required`);
   fact[field.column]=value;
  }
  return fact;
 });
 if(kind==='components'){
  const differing=facts.filter(f=>f.secondary_required_quantity!==null&&Number(f.secondary_required_quantity)!==Number(f.required_quantity)).length;
  if(differing)warnings.push(`${filename}: ${differing} rows have different values in the two Requirement Quantity columns. Both are preserved; the second column is excluded from calculations until its meaning is verified.`);
 }
 return{facts,warnings};
}
