import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('index.html','utf8');
const crm=fs.readFileSync('crm-module.js','utf8');
new vm.Script(crm,{filename:'crm-module.js'});
const ids=[...html.matchAll(/\\sid="([^"]+)"/g),...crm.matchAll(/\\sid="([^"]+)"/g)].map(x=>x[1]);
const duplicates=ids.filter((id,i)=>ids.indexOf(id)!==i);
if(duplicates.length)throw new Error('Duplicate UI IDs: '+[...new Set(duplicates)].join(', '));
for(const marker of [
  'OMNIHUB POS v1.4.3',
  'window.OmniHubCRMContext',
  'src="crm-module.js"'
])if(!html.includes(marker))throw new Error('Missing portal integration: '+marker);
for(const marker of [
  'Customers &amp; CRM',
  'Leads &amp; Conversions',
  'Cash Conversion Cycle',
  'save_crm_customer',
  'get_customer_360',
  'save_crm_lead',
  'transition_crm_lead',
  'get_crm_dashboard',
  'get_cash_conversion_cycle',
  'total_operating_outflows',
  'working_capital_funding_required',
  "WRITE=['administrator','manager']",
  'Auditor access is read-only.'
])if(!crm.includes(marker))throw new Error('Missing CRM control: '+marker);
const crmTag=html.lastIndexOf('<script src="crm-module.js">');
if(crmTag < html.lastIndexOf('</script>',crmTag-1))throw new Error('The CRM module tag is inside an application script.');
if(/service_role|sb_secret_/i.test(html+crm))throw new Error('A secret Supabase credential was found in the browser release.');
console.log('Validated portal v1.4.3 with '+ids.length+' unique UI IDs and all CRM/lead/cash-cycle boundaries.');
