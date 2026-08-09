import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('index.html','utf8');
const crm=fs.readFileSync('crm-module.js','utf8');
new vm.Script(crm,{filename:'crm-module.js'});

const checks=[
  [html.includes('OmniHub Solutions Portal v1.4.3'),'portal release version'],
  [html.includes('OmniHubCRMContext')&&html.includes('src="crm-module.js"'),'CRM host integration'],
  [crm.includes('Customers &amp; CRM')&&crm.includes('Leads &amp; Conversions'),'CRM and lead workspaces'],
  [crm.includes('get_customer_360')&&crm.includes('transition_crm_lead'),'Customer 360 and conversion RPCs'],
  [crm.includes('get_cash_conversion_cycle')&&crm.includes('total_operating_outflows'),'cash-cycle analysis'],
  [crm.includes("HIGH=['administrator','manager','auditor']")&&crm.includes("WRITE=['administrator','manager']"),'auditor read-only boundary'],
  [crm.includes('const s=d.leads||d.summary||{}'),'lead dashboard contract mapping'],
];
for(const [ok,label] of checks)if(!ok)throw new Error('Validation failed: '+label);

const ids=[...html.matchAll(/\sid="([^"]+)"/g),...crm.matchAll(/\sid=\\"([^"]+)\\"/g)].map(x=>x[1]);
const dup=ids.filter((id,i)=>ids.indexOf(id)!==i);
if(dup.length)throw new Error('Duplicate UI IDs: '+[...new Set(dup)].join(', '));
console.log('Portal CRM validation passed.');
