'use strict';

const SUPABASE_URL='https://sutdhmqwrxeumrarctoc.supabase.co';
const SUPABASE_KEY='sb_publishable_Cfx2QV12ThP50sXrmFrWsw_PNlmNVei';
const BRANCH_CODE='GWE-MKOBA1';
const $=id=>document.getElementById(id);

function show(id,text,type='') { const el=$(id); el.textContent=text; el.className=`status ${type}`.trim(); el.classList.remove('hidden'); }
function money(value,currency){return `${currency} ${Number(value||0).toFixed(2)}`}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

async function rpc(name,args){
  const operation={
    create_customer_order_request:'create',
    get_customer_order_status:'status',
    respond_customer_order_quote:'quote-response'
  }[name];
  if(!operation)throw new Error('Unsupported customer order operation.');
  const response=await fetch(`${SUPABASE_URL}/functions/v1/customer-order-public`,{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},
    body:JSON.stringify({operation,payload:args})
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok){
    const messages={
      invalid_request:'Check the supplied order details.',
      order_not_found_or_token_invalid:'The tracking code or access token is incorrect.',
      rate_limit_exceeded:'Too many requests. Wait one minute and try again.',
      service_unavailable:'Order services are temporarily unavailable.'
    };
    throw new Error(messages[data?.error]||`Request failed (${response.status})`);
  }
  return data;
}

function addLine(description='',quantity=1){
  const row=document.createElement('div'); row.className='line';
  row.innerHTML=`<div class="field"><label>Product / service *</label><input class="line-description" required maxlength="500" value="${escapeHtml(description)}" placeholder="e.g. 100 A5 flyers, logo design, laptop repair"></div><div class="field"><label>Qty</label><input class="line-quantity" type="number" min="0.01" step="0.01" value="${quantity}" required></div><button class="btn danger line-remove" type="button" aria-label="Remove">×</button>`;
  row.querySelector('.line-remove').onclick=()=>{if(document.querySelectorAll('.line').length>1)row.remove()};
  $('lines').appendChild(row);
}

function switchTab(track){
  $('orderView').classList.toggle('hidden',track); $('trackView').classList.toggle('hidden',!track);
  $('orderTab').classList.toggle('active',!track); $('trackTab').classList.toggle('active',track);
}

$('orderTab').onclick=()=>switchTab(false); $('trackTab').onclick=()=>switchTab(true); $('addLine').onclick=()=>addLine();
$('fulfillment').onchange=()=>{$('deliveryField').classList.toggle('hidden',$('fulfillment').value!=='delivery')};
addLine();

async function uploadSelectedFiles(order){
  const files=[...$('artworkFiles').files]; if(!files.length)return;
  $('uploadStatus').textContent='Artwork upload is queued for the secure order-file endpoint.';
  // The backend migration intentionally keeps storage private. Once the
  // customer-order-files Edge Function is deployed, this client sends each
  // file with the tracking code + token. Until then the order itself remains
  // valid and staff can request files through the recorded contact channel.
  localStorage.setItem(`omnihub_pending_files_${order.tracking_code}`,JSON.stringify(files.map(f=>({name:f.name,size:f.size,type:f.type}))));
}

$('orderForm').onsubmit=async event=>{
  event.preventDefault(); $('orderStatus').classList.add('hidden');
  try{
    const lines=[...document.querySelectorAll('.line')].map(row=>({description:row.querySelector('.line-description').value.trim(),quantity:Number(row.querySelector('.line-quantity').value),specifications:{},artwork_required:$('artworkFiles').files.length>0}));
    if(lines.some(x=>!x.description||!(x.quantity>0)))throw new Error('Complete every product/service line.');
    const order=await rpc('create_customer_order_request',{
      p_branch_code:BRANCH_CODE,p_contact_name:$('contactName').value.trim(),p_phone:$('phone').value.trim(),p_email:$('email').value.trim()||null,p_company_name:$('companyName').value.trim()||null,p_currency:$('currency').value,p_fulfillment_method:$('fulfillment').value,p_delivery_address:$('fulfillment').value==='delivery'?$('deliveryAddress').value.trim():null,p_requested_date:$('requestedDate').value||null,p_customer_notes:$('notes').value.trim()||null,p_lines:lines
    });
    await uploadSelectedFiles(order);
    $('savedOrderNumber').textContent=order.order_number; $('savedTracking').textContent=order.tracking_code; $('savedToken').textContent=order.access_token;
    localStorage.setItem('omnihub_last_order',JSON.stringify({tracking_code:order.tracking_code,access_token:order.access_token}));
    $('orderForm').classList.add('hidden'); $('orderSuccess').classList.remove('hidden');
  }catch(error){show('orderStatus',error.message,'error')}
};

$('trackNewOrder').onclick=()=>{const saved=JSON.parse(localStorage.getItem('omnihub_last_order')||'{}');$('trackingCode').value=saved.tracking_code||'';$('accessToken').value=saved.access_token||'';switchTab(true);$('trackOrder').click()};

$('trackOrder').onclick=async()=>{
  $('trackingResult').classList.add('hidden');
  try{
    const data=await rpc('get_customer_order_status',{p_tracking_code:$('trackingCode').value.trim(),p_access_token:$('accessToken').value.trim()});
    $('trackStatus').classList.add('hidden'); $('trackingTitle').textContent=`${data.order_number} · ${String(data.status).replaceAll('_',' ')}`;
    $('trackingSummary').innerHTML=`<p><strong>Fulfilment:</strong> ${escapeHtml(String(data.fulfillment_method).replaceAll('_',' '))}<br><strong>Currency:</strong> ${escapeHtml(data.currency)}<br><strong>Deposit:</strong> ${money(data.deposit_received,data.currency)} received / ${money(data.deposit_required,data.currency)} required</p><h3>Items</h3>${(data.lines||[]).map(x=>`<p>${escapeHtml(x.description)} × ${escapeHtml(x.quantity)}${x.quoted_unit_price!=null?` · ${money(x.quoted_unit_price,data.currency)} each`:''}</p>`).join('')}`;
    $('timeline').innerHTML=(data.events||[]).map(x=>`<div class="event"><strong>${escapeHtml(String(x.to_status||x.event_type).replaceAll('_',' '))}</strong><span>${escapeHtml(x.note||'')}</span><div class="small">${new Date(x.created_at).toLocaleString()}</div></div>`).join('')||'<p class="small">No progress events yet.</p>';
    $('trackingResult').classList.remove('hidden');
  }catch(error){show('trackStatus',error.message,'error')}
};
