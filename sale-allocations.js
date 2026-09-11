/* OmniHub v2.7.8. Values are returned by the owner-protected finance RPC. */
(function(root){
  'use strict';
  const columns=Object.freeze([
    ['tithes','Tithe · 10% of sale (Priority 1)'],
    ['remaining_balance','Balance after tithe and cost'],
    ['rent_electricity','Rent / utility bills · 20% of balance'],
    ['growth_fund','Growth Fund · 10% of balance'],
    ['repairs_maintenance','Repairs · 10% of balance'],
    ['savings','Savings · 20% of balance'],
    ['expense_reserve','Day to Day · 20% of balance'],
    ['emergency_fund','Emergency Fund · 20% of balance'],
    ['allocation_shortfall','Priority shortfall']
  ].map(Object.freeze));
  function parseCostPercentage(value){
    const input=String(value??'').trim();
    if(input==='')return null;
    if(!/^(?:\d+(?:\.\d{1,4})?|\.\d{1,4})$/.test(input))
      throw new Error('Enter a cost percentage from 0 to 100, with up to four decimal places.');
    const rate=Number(input);
    if(!Number.isFinite(rate)||rate<0||rate>100)
      throw new Error('Cost of sale percentage must be between 0 and 100.');
    return rate;
  }
  root.OmniHubAllocations=Object.freeze({
    columns,
    headers:()=>columns.map(([,label])=>label),
    values:row=>columns.map(([key])=>Number(row[key]??0)),
    parseCostPercentage,
    note:'Priority 1: tithe is 10% of sale revenue. Priority 2: each product/service uses its configured cost percentage, or its recorded cost when no percentage is set. Split the positive remaining balance: rent / utility bills 20%, Growth Fund 10%, Repairs 10%, Savings 20%, Day to Day 20%, Emergency Fund 20%. These are planning reserves, not additional expenses or bank transfers. Any priority shortfall is shown separately. Rounding is reconciled per sale.',
    cards:(row,currency,money,css)=>columns.map(([key,label])=>
      `<div class="${css}"><span>${label}</span><strong>${money(Number(row[key]??0),currency)}</strong></div>`).join('')
  });
})(globalThis);
