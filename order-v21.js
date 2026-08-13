'use strict';

const SUPABASE_URL='https://sutdhmqwrxeumrarctoc.supabase.co';
const SUPABASE_KEY='sb_publishable_Cfx2QV12ThP50sXrmFrWsw_PNlmNVei';
const BRANCH_CODE='GWE-MKOBA1';
const FILE_ENDPOINT=`${SUPABASE_URL}/functions/v1/customer-order-files`;
const $=id=>document.getElementById(id);
let retryFiles=[];
let currentOrder=null;

function show(id,text,type=''){const el=$(id);el.textContent=text;el.className=`status ${type}`.trim();el.classList.remove('hidden')}
function money(v,c){return `${c} ${Number(v||0).toFixed(2)}`}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function pretty(v){return String(v||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}

async function rpc(name,args){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`},body:JSON.stringify(args)});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(data?.message||data?.error_description||`Request failed (${response.status})`);
  return data;
}

function addLine(description='',quantity=1){
  const row=document.createElement('div');row.className='line';
  row.innerHTML=`<div class="field"><label>Product / service *</label><input class="line-description" required maxlength="500" value="${esc(description)}" placeholder="e.g. 100 A5 flyers, logo design, laptop repair"></div><div class="field"><label>Qty</label><input class="line-quantity" type="number" min="0.01" step="0.01" value="${quantity}" required></div><button class="btn danger line-remove" type="button">×</button>`;
  row.querySelector('.line-remove').onclick=()=>{if(document.querySelectorAll('.line').length>1)row.remove()};$('lines').appendChild(row);
}
function switchTab(track){$('orderView').classList.toggle('hidden',track);$('trackView').classList.toggle('hidden',!track);$('orderTab').classList.toggle('active',!track);$('trackTab').classList.toggle('active',track)}
$('orderTab').onclick=()=>switchTab(false);$('trackTab').onclick=()=>switchTab(true);$('addLine').onclick=()=>addLine();
$('fulfillment').onchange=()=>{const delivery=$('fulfillment').value==='delivery';$('deliveryField').classList.toggle('hidden',!delivery);$('deliveryAddress').required=delivery};addLine();

async function uploadFile(order,file){
  if(file.size>10*1024*1024)throw new Error(`${file.name}: larger than 10 MB`);
  const form=new FormData();form.append('tracking_code',order.tracking_code);form.append('access_token',order.access_token);form.append('file_role','artwork');form.append('file',file,file.name);
  const response=await fetch(FILE_ENDPOINT,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`},body:form});
  const data=await response.json().catch(()=>null);if(!response.ok)throw new Error(`${file.name}: ${data?.detail||data?.error||'upload failed'}`);return data.file;
}
async function uploadFiles(order,files){
  if(!files.length)return{uploaded:0,failed:[]};const failed=[];let uploaded=0;
  for(const file of files){try{await uploadFile(order,file);uploaded++}catch(error){failed.push({file,message:error.message})}$('uploadStatus').textContent=`Processed ${uploaded+failed.length} of ${files.length} file(s)`}
  retryFiles=failed.map(x=>x.file);return{uploaded,failed};
}
$('retryUploads').onclick=async()=>{if(!currentOrder||!retryFiles.length)return;$('retryUploads').disabled=true;try{const result=await uploadFiles(currentOrder,[...retryFiles]);if(result.failed.length){show('savedUploadStatus',`${result.failed.length} file(s) still failed.\n${result.failed.map(x=>x.message).join('\n')}`,'error')}else{show('savedUploadStatus','All files uploaded securely.','ok');$('retryUploads').classList.add('hidden')}}finally{$('retryUploads').disabled=false}};

$('orderForm').onsubmit=async event=>{
  event.preventDefault();$('orderStatus').classList.add('hidden');$('submitOrder').disabled=true;
  try{
    const lines=[...document.querySelectorAll('.line')].map(row=>({description:row.querySelector('.line-description').value.trim(),quantity:Number(row.querySelector('.line-quantity').value),specifications:{},artwork_required:$('artworkFiles').files.length>0}));
    if(lines.some(x=>!x.description||x.quantity<=0))throw new Error('Complete every product/service line.');
    const order=await rpc('create_customer_order_request',{p_branch_code:BRANCH_CODE,p_contact_name:$('contactName').value.trim(),p_phone:$('phone').value.trim(),p_email:$('email').value.trim()||null,p_company_name:$('companyName').value.trim()||null,p_currency:$('currency').value,p_fulfillment_method:$('fulfillment').value,p_delivery_address:$('fulfillment').value==='delivery'?$('deliveryAddress').value.trim():null,p_requested_date:$('requestedDate').value||null,p_customer_notes:$('notes').value.trim()||null,p_lines:lines});
    currentOrder=order;const result=await uploadFiles(order,[...$('artworkFiles').files]);
    $('savedOrderNumber').textContent=order.order_number;$('savedTracking').textContent=order.tracking_code;$('savedToken').textContent=order.access_token;localStorage.setItem('omnihub_last_order',JSON.stringify({tracking_code:order.tracking_code,access_token:order.access_token}));
    $('orderForm').classList.add('hidden');$('orderSuccess').classList.remove('hidden');
    if(result.failed.length){show('savedUploadStatus',`Order created. ${result.uploaded} file(s) uploaded; ${result.failed.length} failed.\n${result.failed.map(x=>x.message).join('\n')}`,'error');$('retryUploads').classList.remove('hidden')}else if(result.uploaded)show('savedUploadStatus',`${result.uploaded} file(s) uploaded securely.`,'ok');
  }catch(error){show('orderStatus',error.message,'error')}finally{$('submitOrder').disabled=false}
};

$('trackNewOrder').onclick=()=>{const saved=JSON.parse(localStorage.getItem('omnihub_last_order')||'{}');$('trackingCode').value=saved.tracking_code||'';$('accessToken').value=saved.access_token||'';switchTab(true);trackOrder()};
function docCard(label,d){return d?`<div class="doc-card"><strong>${esc(label)} · ${esc(d.document_number||'')}</strong><div class="small">${esc(pretty(d.status))} · ${money(d.total,d.currency)}${d.paid_total!=null?` · paid ${money(d.paid_total,d.currency)}`:''}</div></div>`:''}
async function quoteResponse(action){const code=$('trackingCode').value.trim(),token=$('accessToken').value.trim();if(!confirm(action==='accept'?'Accept this quotation?':'Decline this quotation and request revision?'))return;try{await rpc('respond_customer_order_quote',{p_tracking_code:code,p_access_token:token,p_action:action});await trackOrder()}catch(error){show('trackStatus',error.message,'error')}}
async function trackOrder(){
  $('trackingResult').classList.add('hidden');try{
    const data=await rpc('get_customer_order_status',{p_tracking_code:$('trackingCode').value.trim(),p_access_token:$('accessToken').value.trim()});$('trackStatus').classList.add('hidden');$('trackingTitle').textContent=`${data.order_number} · ${pretty(data.status)}`;
    const actions=data.quotation&&['sent','viewed'].includes(data.quotation.status)?'<div class="actions"><button id="acceptQuote" class="btn primary" type="button">Accept quotation</button><button id="declineQuote" class="btn ghost" type="button">Decline / request revision</button></div>':'';
    const job=data.job?`<div class="doc-card"><strong>Production job · ${esc(data.job.job_number)}</strong><div class="small">${esc(pretty(data.job.status))}${data.job.promised_at?` · promised ${esc(new Date(data.job.promised_at).toLocaleString())}`:''}<br>Artwork: ${esc(pretty(data.job.artwork_status))} · Proof: ${esc(pretty(data.job.proof_status))}</div></div>`:'';
    const files=(data.files||[]).length?`<div class="doc-card"><strong>Files</strong><div class="small">${data.files.map(x=>esc(x.file_name)).join(' · ')}</div></div>`:'';
    $('trackingSummary').innerHTML=`<p><strong>Fulfilment:</strong> ${esc(pretty(data.fulfillment_method))}<br><strong>Currency:</strong> ${esc(data.currency)}<br><strong>Deposit:</strong> ${money(data.deposit_received,data.currency)} received / ${money(data.deposit_required,data.currency)} required</p>${docCard('Quotation',data.quotation)}${actions}${docCard('Invoice',data.invoice)}${job}${files}<h3>Items</h3>${(data.lines||[]).map(x=>`<p>${esc(x.description)} × ${esc(x.quantity)}${x.quoted_unit_price!=null?` · ${money(x.quoted_unit_price,data.currency)} each`:''}</p>`).join('')}`;
    $('timeline').innerHTML=(data.events||[]).map(x=>`<div class="event"><strong>${esc(pretty(x.to_status||x.event_type))}</strong><span>${esc(x.note||'')}</span><div class="small">${new Date(x.created_at).toLocaleString()}</div></div>`).join('')||'<p class="small">No progress events yet.</p>';$('trackingResult').classList.remove('hidden');if($('acceptQuote'))$('acceptQuote').onclick=()=>quoteResponse('accept');if($('declineQuote'))$('declineQuote').onclick=()=>quoteResponse('decline');
  }catch(error){show('trackStatus',error.message,'error')}
}
$('trackOrder').onclick=trackOrder;
