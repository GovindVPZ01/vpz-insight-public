/* Interactive drill-down for the fixed Mainline weekly snapshot. */
let drillArea = null, drillCluster = null, drillStore = null, drillMetric = 'loyalty', drillRows = [];
const metrics = {loyalty:'Loyalty',cchm:'CCHM',multibuy:'Multibuy',bundle:'Bundle',weekly_deal:'Weekly deal'};
const suffix = {LCW:'lcw',PW:'prev_wk',LM:'4wk_ago',LY:'ly'};
const escapeText = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const add = (rows, key) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
const valueOrNull = (value, total) => total > 0 ? value / total : null;
const fmtShare = value => value == null ? 'Unavailable' : (value*100).toFixed(1)+'%';
const fmtPp = value => value == null ? 'Unavailable' : (value > 0 ? '+' : '')+(value*100).toFixed(1)+' pp';
const fmtSignedMoney = value => (value < 0 ? '−' : value > 0 ? '+' : '') + money(Math.abs(value));
function resetDrill(){drillArea = area === 'All Mainline' ? null : area; drillCluster = null; drillStore = null;}
function groupedRows(){
 const stores=data.stores.filter(s=>(!drillArea||s.sales_area===drillArea)&&(!drillCluster||s.cluster===drillCluster)&&(!drillStore||String(s.store_code)===drillStore));
 if(drillStore) return [{name:stores[0]?.store||'Store',kind:'store',key:drillStore,stores}];
 const kind=!drillArea?'area':!drillCluster?'cluster':'store';
 const groups=new Map();
 for(const s of stores){const key=kind==='area'?s.sales_area:kind==='cluster'?s.cluster:String(s.store_code);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(s)}
 return [...groups].map(([key,group])=>({key,kind,name:kind==='store'?group[0].store:key,stores:group}));
}
function totals(group, period){
 // Supplied area totals retain their historical population; cluster/store levels use current stores.
 if(group.kind==='area'){
  const r=data.sales_areas.find(x=>x.sales_area===group.key&&x.period===period);
  return r ? {metric:Number(r[drillMetric]),transactions:Number(r.transactions),sales:Number(r.net_sales),forecast:Number(r.forecast)} : null;
 }
 const rows=group.stores, end=suffix[period];
 if(!rows.length || !rows.some(r=>r['transactions_'+end]!=='' && r['transactions_'+end]!=null))return null;
 return {metric:add(rows,drillMetric+'_'+end),transactions:add(rows,'transactions_'+end),sales:add(rows,'net_sales_'+end),forecast:period==='LCW'?add(rows,'forecast_lcw'):null};
}
function trail(){
 return `<nav class="drill-crumb" aria-label="Drill-down navigation"><button data-crumb="root">All Mainline</button>${drillArea?`<span>›</span><button data-crumb="area">${escapeText(drillArea)}</button>`:''}${drillCluster?`<span>›</span><button data-crumb="cluster">${escapeText(drillCluster)}</button>`:''}${drillStore?`<span>›</span><span>${escapeText(data.stores.find(s=>String(s.store_code)===drillStore)?.store || 'Store')}</span>`:''}</nav>`;
}
function drillContent(){
 drillRows=groupedRows();
 const label=drillStore?'Store detail':!drillArea?'Sales areas':!drillCluster?'Clusters':'Stores';
 const rows=drillRows.map((group,i)=>{
  const current=totals(group,'LCW'),prior=totals(group,comparison);
  const ratio=current?valueOrNull(current.metric,current.transactions):null;
  const priorRatio=prior?valueOrNull(prior.metric,prior.transactions):null;
  const gap=ratio==null||priorRatio==null?null:ratio-priorRatio;
  const action=drillStore?escapeText(group.name):`<button class="drill-link" data-drill-index="${i}" aria-label="Open ${escapeText(group.name)}">${escapeText(group.name)} <span aria-hidden="true">→</span></button>`;
  if(section==='kpi')return {sort:ratio??-1,html:`<tr><td>${action}</td><td>${current?num(current.transactions):'Unavailable'}</td><td>${current?num(current.metric):'Unavailable'}</td><td><strong>${fmtShare(ratio)}</strong></td><td>${fmtShare(priorRatio)}</td><td class="${gap==null?'':gap<0?'negative':'positive'}">${fmtPp(gap)}</td></tr>`};
  const sales=current?.sales,forecast=current?.forecast,variance=forecast>0?(sales/forecast-1)*100:null;
  return {sort:variance??-Infinity,html:`<tr><td>${action}</td><td>${current?money(sales):'Unavailable'}</td><td>${forecast>0?money(forecast):'Unavailable'}</td><td>${forecast>0?fmtSignedMoney(sales-forecast):'Unavailable'}</td><td class="${variance==null?'':variance<0?'negative':'positive'}">${variance==null?'Unavailable':(variance>0?'+':'')+variance.toFixed(1)+'%'}</td></tr>`};
 }).sort((a,b)=>b.sort-a.sort).map(x=>x.html).join('');
 const details=section==='kpi'?`<label class="metric-choice">KPI <select id="drillMetric">${Object.entries(metrics).map(([key,name])=>`<option value="${key}" ${key===drillMetric?'selected':''}>${name}</option>`).join('')}</select></label>`:'';
 const heading=section==='kpi'?`${escapeText(metrics[drillMetric])} share by ${label.toLowerCase()}`:`Sales versus forecast by ${label.toLowerCase()}`;
 const headers=section==='kpi'?`<tr><th scope="col">${label}</th><th scope="col">Transactions</th><th scope="col">KPI transactions</th><th scope="col">Last complete week</th><th scope="col">${escapeText(compLabels[comparison])}</th><th scope="col">Change</th></tr>`:`<tr><th scope="col">${label}</th><th scope="col">Net sales</th><th scope="col">Forecast</th><th scope="col">Gap</th><th scope="col">Variance</th></tr>`;
 const explanation=section==='kpi'?`KPI share = qualifying transactions ÷ total transactions. Change is measured in percentage points; comparisons are weighted by transactions.`:`Gap = net sales − forecast. Variance = (net sales ÷ forecast − 1) × 100. All supplied forecasts, including repeated values, are included.`;
 return `${trail()}<section class="card drill-card"><div class="card-head"><div><h3>${heading}</h3><p>12–18 October 2026 · ${drillStore?'Store detail':'Select a row to explore the next level'}</p></div>${details}</div><div class="drill-note">${explanation}</div><div class="drill-scroll"><table class="table drill-table"><thead>${headers}</thead><tbody>${rows||'<tr><td colspan="6">No data available for this selection.</td></tr>'}</tbody></table></div><p class="drill-foot">${drillArea?'Cluster and store comparisons use the current open-store population.':'Area comparison totals retain their supplied historical population; store and cluster levels use current open stores.'} Forecast figures are the supplied snapshot values, with no VAT adjustment.</p></section>`;
}
const originalDashboard=dashboard;
dashboard=function(){
 originalDashboard();
 const nav=document.querySelector('.side-nav');
 if(!nav)return;
 const aboutButton=nav.querySelector('[data-section="about"]');
 for(const [id,icon,label] of [['kpi','◉','KPI drill-down'],['forecast','↗','Forecast']]){
  const button=document.createElement('button');button.type='button';button.dataset.section=id;button.className=section===id?'active':'';button.innerHTML=`<i>${icon}</i><span>${label}</span>`;nav.insertBefore(button,aboutButton);
 }
 if(section==='kpi'||section==='forecast'){
  document.querySelector('.dash-top b').textContent=section==='kpi'?'KPI drill-down':'Forecast';
  document.querySelector('.head h1').textContent=section==='kpi'?'KPI drill-down':'Sales and forecast';
  document.querySelector('.head p').textContent='Explore the snapshot from sales area to cluster and store.';
  const banner=document.querySelector('.banner'),source=document.querySelector('.source');
  while(banner.nextElementSibling && banner.nextElementSibling!==source)banner.nextElementSibling.remove();
  banner.insertAdjacentHTML('afterend',drillContent());
  const metric=document.getElementById('drillMetric');if(metric)metric.onchange=e=>{drillMetric=e.target.value;dashboard()};
 }
 const areaSelect=document.getElementById('area');
 areaSelect.onchange=e=>{area=e.target.value;resetDrill();dashboard()};
};
app.addEventListener('click',e=>{
 const nav=e.target.closest('[data-section]');
 if(nav && ['kpi','forecast'].includes(nav.dataset.section)){resetDrill();dashboard();return;}
 const crumb=e.target.closest('[data-crumb]');
 if(crumb){if(crumb.dataset.crumb==='root'){area='All Mainline';resetDrill()}else if(crumb.dataset.crumb==='area'){drillCluster=null;drillStore=null}else{drillStore=null}dashboard();return;}
 const button=e.target.closest('[data-drill-index]');if(!button)return;
 const selected=drillRows[Number(button.dataset.drillIndex)];if(!selected)return;
 if(selected.kind==='area'){drillArea=selected.key;drillCluster=null;drillStore=null}
 else if(selected.kind==='cluster'){drillCluster=selected.key;drillStore=null}
 else drillStore=selected.key;
 dashboard();
});
