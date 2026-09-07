import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const relative = ['src/index.html', 'app/src/main/assets/index.html', 'index.html'].find(p => fs.existsSync(path.join(root, p)));
const html = fs.readFileSync(path.join(root, relative), 'utf8');
const mobile = relative.startsWith('app/');
const portal = relative === 'index.html';
function source(name) {
  const start = html.search(new RegExp('^(?:async )?function ' + name + '\\(', 'm'));
  assert.ok(start >= 0, 'Function exists: ' + name);
  const firstEnd = html.indexOf('\n', start);
  if (html.slice(start, firstEnd).trimEnd().endsWith('}')) return html.slice(start, firstEnd);
  return html.slice(start, html.indexOf('\n}', firstEnd) + 2);
}
const normalizer = source('normalizeSaleCustomerName');
const normalize = vm.runInNewContext(normalizer + '\nnormalizeSaleCustomerName');
test('name is optional, preserves real name characters and neutralizes control characters', () => {
  for (const v of [undefined, null, '', '  \t\r\n  ']) assert.equal(normalize(v), null);
  assert.equal(normalize("  Tariro   O'Neil & Chloé  "), "Tariro O'Neil & Chloé");
  assert.equal(normalize('Tariro\u001b\nMoyo'), 'Tariro Moyo');
  assert.equal(normalize('x'.repeat(200)).length, 200);
  assert.throws(() => normalize('x'.repeat(201)), /200/);
  assert.throws(() => normalize({name:'Tariro'}), /valid/);
});
test('customer name inputs are explicitly optional and bounded', () => {
  const ids = portal ? ['managementSaleCustomerName'] : mobile ? ['saleCustomerName','managementMobileCustomerName'] : ['saleCustomerName'];
  for (const id of ids) {
    const field = html.match(new RegExp('<input[^>]*id="' + id + '"[^>]*>'))?.[0];
    assert.ok(field, id);
    assert.doesNotMatch(field, /\brequired\b/);
    assert.match(field, /maxlength="200"/);
  }
});
function checkout(name, {failSave=false,failPrint=false}={}) {
  const nodes=new Map(), queue=[], printed=[], notices=[];
  function node(id) {
    if(!nodes.has(id))nodes.set(id,{value:({saleCustomerName:name,paymentMethod:'cash',paymentReference:'',amountReceived:'12',changeGiven:'0'})[id]??'',disabled:false,textContent:''});
    return nodes.get(id);
  }
  const context=vm.createContext({
    $:node, isManagementRole:()=>true, cart:[{id:'service',kind:'service',name:'Printing',quantity:2,unitPrice:6}],
    cartTotal:()=>12, validateCartStock:()=>true, activeCurrency:()=> 'USD', uuid:()=>crypto.randomUUID(),
    profile:{display_name:'Test Manager'},device:{deviceId:'device',tillCode:'TILL'},CONFIG:{version:'test'},
    receiptNumber:()=> 'TEST-RECEIPT',lastReceipt:null,
    getCheckoutPrintSelection:()=>({paperMode:'a5',showDialog:true}),
    enqueuePending:row=>{if(failSave)throw Error('Storage unavailable');queue.push(row)},
    printReceipt:async row=>{printed.push(row);if(failPrint)throw Error('Printer unavailable');return {skipped:false}},
    renderCart:()=>{},status:()=>{},notify:text=>notices.push(text),
    syncPending:async()=>{},loadSales:async()=>{},loadDashboard:async()=>{},loadCatalog:async()=>{}
  });
  vm.runInContext(normalizer+'\n'+source('completeSale'),context);
  return {context,node,queue,printed,notices,run:()=>context.completeSale()};
}
if(!portal){
  for(const [entered,expected] of [["  Tariro  O'Neil & Chloé  ","Tariro O'Neil & Chloé"],['',null],['  \t ',null]]){
    test('checkout persists optional name through outbox and receipt then clears next sale: '+JSON.stringify(entered),async()=>{
      const app=checkout(entered);await app.run();
      assert.equal(app.queue.length,1);
      const sale=JSON.parse(app.queue[0].envelope.JsonPayload);
      assert.equal(sale.CustomerName,expected);assert.equal(sale.CustomerId,null);
      assert.equal(app.queue[0].receiptData.payload.CustomerName,expected);
      assert.equal(app.printed[0].payload.CustomerName,expected);
      assert.equal(app.node('saleCustomerName').value,'');
      app.node('saleCustomerName').value='Next customer';
      assert.equal(app.context.lastReceipt.payload.CustomerName,expected);
    });
  }
  test('failed durable save retains the entered customer and does not print',async()=>{
    const app=checkout('Tariro',{failSave:true});await app.run();
    assert.equal(app.queue.length,0);assert.equal(app.printed.length,0);
    assert.equal(app.node('saleCustomerName').value,'Tariro');
  });
  test('print failure leaves the named sale saved and clears the name for the next sale',async()=>{
    const app=checkout('Tariro',{failPrint:true});await app.run();
    assert.equal(app.queue.length,1);assert.equal(app.node('saleCustomerName').value,'');
    assert.equal(app.context.lastReceipt.payload.CustomerName,'Tariro');
    assert.equal(app.context.cart.length,0);
  });
  test('overlong name blocks saving before a sale reaches the offline queue',async()=>{
    const app=checkout('x'.repeat(201));await app.run();assert.equal(app.queue.length,0);
    assert.match(app.notices[0],/200/);
  });
}
if(mobile||portal){
  const prefix=portal?'managementSale':'managementMobile';
  const fn=portal?'saveManagementSale':'saveManagementMobileSale';
  for(const [entered,expected] of [["  Tariro O'Neil & Chloé  ","Tariro O'Neil & Chloé"],['',null]]){
    test('custom/backdated sale RPC and receipt retain optional name: '+JSON.stringify(entered),async()=>{
      const values={CustomerName:entered,Payment:'cash',Reference:'',Date:'2026-09-01T12:00',Currency:'USD',Description:'Custom printing',Quantity:'2',Price:'6',Reason:'Customer request',Catalog:'',ReceiptSize:'A5'};
      const nodes=new Map(Object.entries(values).map(([key,value])=>[prefix+key,{value}]));
      const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',src:''});return nodes.get(id)};
      let params,printed;
      const database={
        rpc:async(name,args)=>{assert.equal(name,'record_management_sale');params=args;return {data:{receipt_number:'MAN-TEST',sale_date:args.p_sale_date,total:12}}},
        from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{print_logo:false}})})})})
      };
      const ctx=vm.createContext({$:node,db:database,supabase:database,
        profile:{display_name:'Test Manager',branch_id:'branch'},offlineSession:false,isManagementRole:()=>true,updateOnlineState:()=>true,
        status:()=>{},preparePortalReceiptPrint:()=>({}),cancelPortalReceiptPrint:()=>{},
        deliverPortalReceiptPrint:(job,payload)=>{printed=payload},printReceipt:async receipt=>{printed=receipt.payload},
        managementLocalDateTime:()=> '2026-09-07T12:00',managementMobileLocalDateTime:()=> '2026-09-07T12:00',
        lastReceipt:null,loadDashboard:async()=>{},loadSales:async()=>{},loadCatalog:async()=>{},loadTransactions:async()=>{},loadManagementControls:async()=>{}});
      vm.runInContext(normalizer+'\n'+source(fn),ctx);
      await ctx[fn]({preventDefault(){}});
      assert.equal(params.p_customer_name,expected);
      assert.equal(portal?printed.customerName:printed.CustomerName,expected);
      assert.equal(node(prefix+'CustomerName').value,'');
    });
  }
}
const dangerous="Tariro O'Neil & <script>alert(1)</script>";
const receipt={cashier:'Cashier',method:'cash',reference:'',payload:{CustomerName:dangerous,ReceiptNumber:'TEST',CreatedAtUtc:'2026-09-07T12:00:00Z',TillCode:'TEST',Currency:'USD',Total:12,ChangeGiven:0,ChangeOwed:0,Lines:[{Description:'Printing',Quantity:2,UnitPrice:6}]}};
if(!mobile&&!portal){
  const printing=createRequire(import.meta.url)('../src/receipt-printing.js');
  for(const mode of ['a4','a5','58','80'])test(mode+' receipt safely displays name and omits empty customer line',()=>{
    const named=printing.renderReceipt(receipt,{},mode);
    assert.match(named,/Customer: Tariro O&#39;Neil &amp; &lt;script&gt;/);
    assert.doesNotMatch(named,/<script>alert/);
    assert.doesNotMatch(printing.renderReceipt({...receipt,payload:{...receipt.payload,CustomerName:null}},{},mode),/Customer:/);
  });
}
if(mobile){
  test('mobile document receipt escapes name and thermal receipt wraps it',()=>{
    const nodes={paperWidth:{value:'58'},documentPaperSizeQuick:{value:'A5'}};
    const ctx=vm.createContext({$:id=>nodes[id],receiptSettings:{print_logo:false},RECEIPT_LOGO_DATA_URI:''});
    vm.runInContext(['esc','money','lineWidth','padLine','center','pushWrapped','receiptText','receiptHtml'].map(source).join('\n'),ctx);
    assert.match(ctx.receiptHtml(receipt),/Customer: Tariro O&#39;Neil &amp; &lt;script&gt;/);
    assert.doesNotMatch(ctx.receiptHtml({...receipt,payload:{...receipt.payload,CustomerName:null}}),/Customer:/);
    const lines=ctx.receiptText({...receipt,payload:{...receipt.payload,CustomerName:'Tariro '.repeat(20).trim()}}).split('\n');
    const start=lines.findIndex(line=>line.startsWith('Customer:'));
    assert.ok(start>=0);assert.equal(lines[start].length,32);assert.ok(lines[start+1].length<=32);
  });
}
if(portal){
  test('portal print window uses text content for names and hides absent names',()=>{
    const page=fs.readFileSync(path.join(root,'print-receipt.html'),'utf8');
    const code=[...page.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
    const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false,style:{},classList:{toggle(){}}});return nodes.get(id)};
    const context=vm.createContext({location:{hash:'#test',origin:'https://portal.test'},document:{getElementById:node,body:node('body')},window:{opener:{postMessage(){}},addEventListener(){},focus(){},print(){}},setTimeout:()=>{}});
    vm.runInContext(code,context);
    context.render({customerName:dangerous,receiptNumber:'TEST',payment:'Cash'});
    assert.equal(node('customerName').textContent,dangerous);
    assert.equal(node('customerName').hidden,false);
    assert.equal(node('customerLabel').hidden,false);
    context.render({receiptNumber:'OLD',payment:'Cash'});
    assert.equal(node('customerName').hidden,true);
    assert.equal(node('customerLabel').hidden,true);
  });
}

