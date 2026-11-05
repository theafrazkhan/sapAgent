import { describe, expect, it } from 'vitest';
import { schemas, boundedOutput, evidenceFrom } from '../src/lib/ai/tools';
import { hashPassword, verifyPassword } from '../src/lib/identity';
describe('tool and identity boundaries',()=>{
 it('rejects model-supplied tenant scope and excessive rows',()=>{expect(()=>schemas.list_components.parse({query:null,missing_only:true,limit:25,tenant_id:'other'})).toThrow();expect(()=>schemas.list_orders.parse({query:null,kind:null,limit:1000})).toThrow();});
 it('bounds valid JSON results without changing total counts',()=>{const output=boundedOutput({total:2000,records:Array.from({length:100},(_,i)=>({id:i,description:'x'.repeat(500)}))},3000);const parsed=JSON.parse(output);expect(Buffer.byteLength(output)).toBeLessThanOrEqual(3000);expect(parsed.total).toBe(2000);expect(parsed.truncated).toBe(true);});
 it('collects evidence from executed records, not invented answer citations',()=>{expect(evidenceFrom({records:[{source_file_id:'file1',source_row:12,source_file:'source.xlsx'}]})).toEqual([{fileId:'file1',row:12,label:'source.xlsx'}]);});
 it('uses salted password hashes and rejects wrong passwords',()=>{const hash=hashPassword('long enough password');expect(verifyPassword('long enough password',hash)).toBe(true);expect(verifyPassword('wrong',hash)).toBe(false);expect(hashPassword('long enough password')).not.toBe(hash);});
});
