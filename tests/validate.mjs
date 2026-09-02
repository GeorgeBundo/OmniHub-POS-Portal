import fs from 'node:fs';
import vm from 'node:vm';

const order=fs.readFileSync(new URL('../order.js',import.meta.url),'utf8');
const html=fs.readFileSync('index.html','utf8');
const crm=fs.readFileSync('crm-module.js','utf8');
const quotationPdf=fs.readFileSync('quotation-pdf.js','utf8');
new vm.Script(crm,{filename:'crm-module.js'});
new vm.Script(quotationPdf,{filename:'quotation-pdf.js'});

const checks=[
  [order.includes('/functions/v1/customer-order-public'),'customer orders use protected Edge gateway'],
  [!order.includes('/rest/v1/rpc/'),'customer orders do not call privileged RPCs directly'],
  [html.includes('OmniHub Solutions Portal v2.6.0'),'portal release version'],
  [html.includes('OmniHubCRMContext')&&html.includes('src="crm-module.js"'),'CRM host integration'],
  [crm.includes('Customers &amp; CRM')&&crm.includes('Leads &amp; Conversions'),'CRM and lead workspaces'],
  [crm.includes('get_customer_360')&&crm.includes('transition_crm_lead'),'Customer 360 and conversion RPCs'],
  [crm.includes('get_cash_conversion_cycle')&&crm.includes('total_operating_outflows'),'cash-cycle analysis'],
  [crm.includes("HIGH=['administrator','manager','auditor']")&&crm.includes("WRITE=['administrator','manager']"),'auditor read-only boundary'],
  [crm.includes('const s=d.leads||d.summary||{}'),'lead dashboard contract mapping'],
  [html.includes('save_business_document')&&html.includes('saveSuiteRecordV144'),'validated quotation creation RPC'],
  [html.includes('Create &amp; download PDF')&&html.includes('downloadSuiteQuotation'),'quotation download controls'],
  [quotationPdf.includes('%PDF-1.4')&&quotationPdf.includes('application/pdf'),'real PDF byte generator'],
  [html.includes('Download PDF now')&&quotationPdf.includes('10 * 60 * 1000'),'persistent direct PDF fallback'],
  [html.includes("fillSelect('bundleItem'")&&html.includes("fillSelect('outSupplier'"),'safe database option rendering'],
  [html.includes('ensurePortalSession')&&html.includes('loginEventRows'),'resilient session and login monitoring'],
  [html.includes('customerPricingTier')&&html.includes('pricing_tier'),'customer trade pricing controls'],
  [html.includes('invalid_outsourced_job_status_transition')===false&&html.includes('status_note'),'outsourced status-note workflow'],
];
for(const [ok,label] of checks)if(!ok)throw new Error('Validation failed: '+label);

const ids=[...html.matchAll(/\sid="([^"]+)"/g),...crm.matchAll(/\sid=\\"([^"]+)\\"/g)].map(x=>x[1]);
const dup=ids.filter((id,i)=>ids.indexOf(id)!==i);
if(dup.length)throw new Error('Duplicate UI IDs: '+[...new Set(dup)].join(', '));
console.log('Portal CRM and quotation validation passed.');
