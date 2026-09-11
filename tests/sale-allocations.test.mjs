import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root=path.resolve(import.meta.dirname,'..');
const mobile=fs.existsSync(path.join(root,'app/src/main/assets/index.html'));
const assets=mobile?'app/src/main/assets/':'';
const html=fs.readFileSync(path.join(root,assets,'index.html'),'utf8');
const shared=fs.readFileSync(path.join(root,assets,'sale-allocations.js'),'utf8');
function source(name){
 const start=html.search(new RegExp('^(?:async )?function '+name+'\\(','m'));
 assert.ok(start>=0,name);
 const end=html.indexOf('\n',start);
 return html.slice(start,html.slice(start,end).trimEnd().endsWith('}')?end:html.indexOf('\n}',end)+2);
}
function harness(extra={}){
 const nodes=new Map();
 function element(){return {value:'',innerHTML:'',textContent:'',children:[],classList:{toggle(){},add(){},remove(){}},appendChild(e){this.children.push(e);return e},append(...e){this.children.push(...e)}};}
 const $=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)};
 const context=vm.createContext({$,document:{createElement:element,createTextNode:s=>({textContent:s}),querySelectorAll:()=>[]},
  money:(v,c)=>`${c} ${Number(v||0).toFixed(2)}`,td:v=>Object.assign(element(),{textContent:v}),esc:String,
  financePeriod:'month',mobileFinancePeriod:'month',catalog:[],
  isHighLevelRole:()=>true,isManagementRole:()=>true,updateFinancePeriodControls(){},financeDashboardParams:()=>({}),
  notify(message,error){if(error)throw Error(message)},profile:{role:'manager',branch_id:'branch'},...extra});
 vm.runInContext(shared,context);return {context,$};
}
test('cost rates distinguish blank fallback and explicit zero, rejecting malformed/out-of-range input',()=>{
 const {context:c}=harness();const parse=c.OmniHubAllocations.parseCostPercentage;
 assert.equal(parse(''),null);assert.equal(parse('0'),0);assert.equal(parse('30.125'),30.125);assert.equal(parse('100'),100);
 for(const value of ['-1','101','NaN','Infinity','1e2','12x','1.00001'])assert.throws(()=>parse(value));
});
const sale={receipt_number:'TEST',occurred_at:'2026-09-11T08:00:00Z',till_code:'TEST',status:'completed',currency:'USD',
 revenue:100,cost_of_sales:30,cost_percentage:30,tithes:10,remaining_balance:60,rent_electricity:12,growth_fund:6,
 repairs_maintenance:6,savings:12,expense_reserve:12,emergency_fund:12,allocation_shortfall:0,
 operating_expenses:5,total_expenses:35,profit_loss:65,transactions:1};
test('the actual finance renderer and CSV use the same server funds in USD and ZiG',async()=>{
 const data={period:'month',from:'2026-09-01',to:'2026-09-30',summary:{USD:sale,ZiG:{...sale,currency:'ZiG'}},sales:[sale,{...sale,currency:'ZiG'}],expenses:[]};
 const {context:c,$}=harness({db:{rpc:async()=>({data})}});
 if(mobile){vm.runInContext(source('loadAccountingAccurate'),c);await c.loadAccountingAccurate()}
 else{vm.runInContext(source('financeCard')+'\n'+source('renderFinance'),c);c.renderFinance(data)}
 const rows=c[mobile?'accountingExport':'financeExportRows'];
 const summaryHeader=rows.find(r=>r[0]==='Currency'),usd=rows.find(r=>r[0]==='USD'),zig=rows.find(r=>r[0]==='ZiG');
 assert.equal(summaryHeader.length,usd.length);assert.equal(zig.length,usd.length);
 const growthIndex=summaryHeader.findIndex(s=>String(s).startsWith('Growth Fund'));
 assert.equal(usd[growthIndex],6);assert.equal(zig[growthIndex],6);
 const revenueIndex=summaryHeader.indexOf('Revenue');assert.equal(usd[revenueIndex],100);
 const receipts=rows.filter(r=>r[0]==='TEST');assert.equal(receipts.length,2);
 const receiptHeader=rows.find(r=>r[0]==='Receipt');for(const row of receipts)assert.equal(row.length,receiptHeader.length);
 const card=$(mobile?'accountingMetrics':'financeSummary').children[0].innerHTML;
 for(const label of ['Growth Fund','Rent / utility bills','Day to Day','Emergency Fund','Priority shortfall'])assert.ok(card.includes(label),label);
 assert.ok(!card.includes('Savings remainder'));
});
test('empty periods produce an empty-sales message and zero summaries',async()=>{
 const data={period:'month',from:'2026-09-01',to:'2026-09-30',summary:{},sales:[],expenses:[]};
 const {context:c,$}=harness({db:{rpc:async()=>({data})}});
 if(mobile){vm.runInContext(source('loadAccountingAccurate'),c);await c.loadAccountingAccurate();assert.match($('mobileSaleAllocations').innerHTML,/No sales/)}
 else{vm.runInContext(source('financeCard')+'\n'+source('renderFinance'),c);c.renderFinance(data);assert.equal($('financeSaleRows').children[0].children[0].colSpan,15)}
});
test('cost edit is scoped to the selected catalogue item and persists the numeric rate',async()=>{
 let payload,selected;const events=[];
 const result={then:resolve=>Promise.resolve(resolve({})),eq(k,v){if(k==='id')selected=v;return this}};
 const db={from:()=>({update(p){payload=p;return result},insert(p){payload=p;return result}})};
 const {context:c,$}=harness({supabase:db,db,prompt:()=> '37.5',status(...args){events.push(args)},loadCatalog:async()=>{},clearCatalogForm(){}});
 if(mobile){
   $('catalogEditId').value='item-1';$('itemCostPercentage').value='37.5';$('itemName').value='Printing';$('itemKind').value='service';
   vm.runInContext(source('saveCatalogItem'),c);await c.saveCatalogItem({preventDefault(){}});
 }else{vm.runInContext(source('editCostPercentage'),c);await c.editCostPercentage({id:'item-1',name:'Printing'})}
 assert.equal(payload.cost_of_sale_percentage,37.5);assert.equal(selected,'item-1');
});
