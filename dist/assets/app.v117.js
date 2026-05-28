
const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const T={
 'zh-CN':{kicker:'实时监控',table:'表格',map:'地图',compact:'简表',refresh:'刷新',admin:'后台',search:'搜索节点、地区、分组',allGroups:'全部分组',total:'总节点',online:'在线',avgCpu:'平均 CPU',avgRam:'平均内存',avgDisk:'平均磁盘',traffic:'实时流量',totalUpload:'总上传',totalDownload:'总下载',countries:'国家/地区',groups:'分组',offline:'离线',overview:'资产概览',fleetScore:'健康指数',radarTitle:'运行雷达',radarSub:'在线率、资源余量与分布活跃度',nodesText:'台节点',onlineRate:'在线率',cpuHeadroom:'CPU 余量',ramHeadroom:'内存余量',diskHeadroom:'磁盘余量',globalSpread:'全球分布',networkActivity:'网络活跃',node:'节点',status:'状态',region:'地区',group:'分组',cpu:'CPU',ram:'内存',disk:'磁盘',network:'网络',system:'系统',uptime:'运行时间',loadTrend:'负载趋势',realtimeLoad:'实时负载',latency:'延迟检测',asset:'资产档案',back:'返回',smooth:'平滑',allNodes:'所有节点',servers:'服务器',onlineCount:'在线',noNodes:'暂无节点',billing:'账单信息',notes:'备注',version:'版本',probe:'测速任务',resource:'资源',trafficLeft:'剩余流量',remaining:'剩余',noData:'暂无数据',connections:'连接',tcp:'TCP 连接',udp:'UDP 连接',processes:'进程数量',socketLoad:'连接负载'},
 'en-US':{kicker:'Live Monitor',table:'Table',map:'Map',compact:'Compact',refresh:'Refresh',admin:'Admin',search:'Search nodes, region, group',allGroups:'All groups',total:'Total',online:'Online',avgCpu:'Avg CPU',avgRam:'Avg RAM',avgDisk:'Avg Disk',traffic:'Live traffic',totalUpload:'Total upload',totalDownload:'Total download',countries:'Countries',groups:'Groups',offline:'Offline',overview:'Asset Overview',fleetScore:'Health Score',radarTitle:'Ops Radar',radarSub:'Online rate, resource headroom and distribution',nodesText:'nodes',onlineRate:'Online rate',cpuHeadroom:'CPU headroom',ramHeadroom:'RAM headroom',diskHeadroom:'Disk headroom',globalSpread:'Global spread',networkActivity:'Network activity',node:'Node',status:'Status',region:'Region',group:'Group',cpu:'CPU',ram:'RAM',disk:'Disk',network:'Network',system:'System',uptime:'Uptime',loadTrend:'Load Trend',realtimeLoad:'Live Load',latency:'Latency Probes',asset:'Asset Profile',back:'Back',smooth:'Smooth',allNodes:'All nodes',servers:'servers',onlineCount:'online',noNodes:'No nodes',billing:'Billing',notes:'Notes',version:'Version',probe:'Probe',resource:'Resources',trafficLeft:'Traffic left',remaining:'left',noData:'No data',connections:'Connections',tcp:'TCP',udp:'UDP',processes:'Processes',socketLoad:'Connection load'}
};
const defaultSettings={language:'auto',home_title_zh:'基础设施',home_subtitle_zh:'实时节点状态与全球资产分布',home_title_en:'Infrastructure',home_subtitle_en:'Live fleet status and global node distribution',default_view:'table',default_load_hours:'6',default_ping_hours:'6',default_smooth_charts:true,accent:'#2563eb',show_billing:true,show_footer:true};
const state={settings:{...defaultSettings},lang:'zh-CN',nodes:[],live:{},world:null,query:'',group:localStorage.getItem('nodeSelectedGroup')||'',view:localStorage.getItem('soraView')||'',activeNode:null,ws:null,wsOk:false,loadHours:Number(localStorage.getItem('soraLoadHours')||0),pingHours:Number(localStorage.getItem('soraPingHours')||0),smoothLoad:localStorage.getItem('soraSmoothLoad')?localStorage.getItem('soraSmoothLoad')==='true':true,smoothPing:localStorage.getItem('soraSmoothPing')?localStorage.getItem('soraSmoothPing')==='true':true,loadVisible:new Set(['cpu','ram','disk']),pingVisible:new Set(),loadModalMetric:'cpu',loadModalHours:Number(localStorage.getItem('soraLoadModalHours')||0),charts:{loadSeries:null,pingSeries:null,pingTasks:null,pingPalette:null},mapProjection:null,_mapKey:'',_pingToken:0,_loadModalToken:0};
function tr(k){return (T[state.lang]||T['zh-CN'])[k]||k}

function boolSetting(v, fallback=true){
 if(v===undefined||v===null||v==='')return fallback;
 if(typeof v==='boolean')return v;
 if(typeof v==='number')return v!==0;
 const s=String(v).trim().toLowerCase();
 if(['false','0','off','no','否','关闭','disabled','hide'].includes(s))return false;
 if(['true','1','on','yes','是','开启','enabled','show'].includes(s))return true;
 return fallback;
}
function detectLang(){const cfg=state.settings.language; if(cfg&&cfg!=='auto')return cfg; const saved=localStorage.getItem('i18nextLng'); if(saved&&/^en/i.test(saved))return 'en-US'; if(saved&&/^zh/i.test(saved))return 'zh-CN'; return /^zh/i.test(navigator.language)?'zh-CN':'en-US'}
async function api(url){const r=await fetch(url,{cache:'no-store'}); if(!r.ok)throw new Error(url+' '+r.status); return r.json()}
function unwrap(x){let v=x; for(const k of ['data','nodes','clients','list','items','result']){if(Array.isArray(v))break; if(v&&Array.isArray(v[k])){v=v[k];break} if(v&&v[k]&&typeof v[k]==='object')v=v[k]} return Array.isArray(v)?v:[]}
function getNodeId(n){return String(n?.uuid??n?.client_id??n?.id??n?.node_id??n?.name??'')}
function getName(n){return n?.name||n?.nickname||n?.alias||getNodeId(n)||'Node'}
function liveOf(n){return state.live[getNodeId(n)]||n?.latest||n?.status||{}}
function isOnline(n){const l=liveOf(n); if(l.__online!==undefined)return !!l.__online; const v=l.online??n.online??l.status??n.status; if(typeof v==='boolean')return v; if(typeof v==='string')return /online|up|true|running/i.test(v); return false}
function getDeep(obj,path){return String(path).split('.').reduce((o,k)=>o&&o[k]!=null?o[k]:undefined,obj)}
function val(obj,keys){for(const k of keys){const v=String(k).includes('.')?getDeep(obj,k):(obj&&obj[k]); if(v!=null)return v}return undefined}
function dataBlock(x){return x&&x.data&&typeof x.data==='object'?x.data:x}
function arrFrom(x,key){const b=dataBlock(x); if(Array.isArray(x))return x; if(b&&Array.isArray(b[key]))return b[key]; if(x&&Array.isArray(x[key]))return x[key]; return []}
function pct(x){x=Number(x); if(!isFinite(x))return 0; if(x>=0&&x<=1)x*=100; return Math.max(0,Math.min(100,x))}
function pctMetric(n,kind){const l=liveOf(n); if(kind==='cpu')return pct(val(l,['cpu.usage','cpu','cpu_usage','cpu_percent','cpu_percent_used'])??val(n,['cpu'])); if(kind==='ram'){let used=val(l,['ram.used','ram','mem','memory','memory_used','ram_used','mem_used']), total=val(l,['ram.total','ram_total','mem_total','memory_total'])||val(n,['mem_total','ram_total','memory_total']); if(total&&Number(used)>100)return pct(Number(used)/Number(total)); return pct(used??val(n,['ram']))} if(kind==='disk'){let used=val(l,['disk.used','disk','disk_used','storage','storage_used']), total=val(l,['disk.total','disk_total','storage_total'])||val(n,['disk_total','storage_total']); if(total&&Number(used)>100)return pct(Number(used)/Number(total)); return pct(used??val(n,['disk']))} return 0}
function fmtBytes(v){v=Number(v);if(!isFinite(v)||v<=0)return '0 B';const u=['B','KB','MB','GB','TB','PB'];let i=0;while(v>=1024&&i<u.length-1){v/=1024;i++}return (v>=10?v.toFixed(1):v.toFixed(2))+' '+u[i]}
function fmtSpeed(v){return fmtBytes(v)+'/s'}
function byteVal(obj,keys){const v=val(obj,keys); const n=Number(v); return isFinite(n)&&n>0?n:0}
function totalTrafficOf(n,dir){const l=liveOf(n); const downKeys=['network.totalDown','network.total_down','network.down_total','network.download_total','network.net_total_down','totalDown','total_down','downloadTotal','download_total','traffic_down','traffic_download','rx_total','total_rx','net_in_total','net_total_down','down_total']; const upKeys=['network.totalUp','network.total_up','network.up_total','network.upload_total','network.net_total_up','totalUp','total_up','uploadTotal','upload_total','traffic_up','traffic_upload','tx_total','total_tx','net_out_total','net_total_up','up_total']; const keys=dir==='up'?upKeys:downKeys; return byteVal(l,keys)||byteVal(n,keys)}
function trafficLimitOf(n){return parseBytesSmart(firstVal(n,['billing.traffic_limit','billing.trafficLimit','billing.traffic','billing.data_limit','traffic_limit','trafficLimit','data_limit','transfer_limit','bandwidth_limit','month_traffic','monthly_traffic_limit']))}
function trafficUsedOf(n){const l=liveOf(n); const explicit=byteVal(l,['network.total','network.totalTraffic','traffic_used','used_traffic','traffic.used','transfer_used','data_used'])||byteVal(n,['traffic_used','used_traffic','traffic.used','transfer_used','data_used']); if(explicit)return explicit; return (totalTrafficOf(n,'up')||0)+(totalTrafficOf(n,'down')||0)}
function trafficLeftOf(n){const limit=trafficLimitOf(n); if(!limit)return null; const used=trafficUsedOf(n); const left=Math.max(0,limit-used); return {limit,used,left,pct:limit?Math.max(0,Math.min(100,left/limit*100)):0}}
function fmtUptime(s){s=Number(s); if(!isFinite(s)||s<=0)return '--'; const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60); return d?`${d}d ${h}h`:h?`${h}h ${m}m`:`${m}m`}
function regionText(n){return [n.region,n.location,n.country,n.area,n.group].filter(Boolean).join(' / ')||'--'}

function localeCode(){return state.lang==='zh-CN'?'zh-CN':'en-US'}
function dash(v){return v==null||v===''||v==='--'?'--':String(v)}
function boolText(v){if(v===true||v===1||String(v).toLowerCase()==='true')return state.lang==='zh-CN'?'是':'Yes'; if(v===false||v===0||String(v).toLowerCase()==='false')return state.lang==='zh-CN'?'否':'No'; return '--'}
function labelText(key){const zh={id:'节点 ID',country:'国家/地区',region:'区域',group:'分组',uptime:'运行时间',network:'实时网络',os:'操作系统',kernel:'内核',arch:'架构',cpuModel:'处理器',virt:'虚拟化',version:'Agent 版本',gpu:'显卡',price:'价格',expire:'账单日',trafficLimit:'流量限制',autoRenew:'自动续费',note:'公开备注',tags:'标签',unsetCurrency:'未设置币种',free:'免费',priceUnset:'未设置',daysLeft:'剩余',days:'天',expired:'已过期',unknown:'未知',lifetime:'长期'}; const en={id:'Node ID',country:'Country / Region',region:'Location',group:'Group',uptime:'Uptime',network:'Live network',os:'Operating system',kernel:'Kernel',arch:'Architecture',cpuModel:'Processor',virt:'Virtualization',version:'Agent version',gpu:'GPU',price:'Price',expire:'Billing date',trafficLimit:'Traffic limit',autoRenew:'Auto renew',note:'Public note',tags:'Tags',unsetCurrency:'currency unset',free:'Free',priceUnset:'Not set',daysLeft:'left',days:'days',expired:'expired',unknown:'Unknown',lifetime:'Lifetime'}; return (state.lang==='zh-CN'?zh:en)[key]||key}
function firstVal(obj,keys){return val(obj,keys)}
function formatDateValue(v){
 if(v==null||v==='')return '--';
 const raw=String(v).trim();
 if(!raw||raw==='0'||raw==='0000-00-00'||/^0001[-/]/.test(raw)||/^1[-/]/.test(raw))return labelText('priceUnset');
 if(isLifetimeValue(raw))return labelText('lifetime');
 let input=v;
 if(typeof input==='number'&&input>0&&input<1e12)input*=1000;
 const d=new Date(input);
 if(isNaN(d.getTime()))return raw;
 const year=d.getFullYear();
 if(year<=1)return labelText('priceUnset');
 const days=Math.ceil((d.getTime()-Date.now())/86400000);
 if(year>=2100||days>36500)return labelText('lifetime');
 const text=d.toLocaleDateString(localeCode(),{year:'numeric',month:'2-digit',day:'2-digit'}).replaceAll('-','/');
 const sub=days>=0?(state.lang==='zh-CN'?`${labelText('daysLeft')} ${days} ${labelText('days')}`:`${days} ${labelText('days')} ${labelText('daysLeft')}`):labelText('expired');
 return `${text}:::sub:::${sub}`
}
function isLifetimeValue(v){return /长期|永久|终身|lifetime|permanent|forever|unlimited|one[- ]?time/i.test(String(v||''))}
function formatMoneyValue(raw,currency,period){
 if(isLifetimeValue(raw)||isLifetimeValue(period))return labelText('lifetime');
 if(raw==null||raw==='')return '--';
 let s=String(raw).trim();
 const numericOnly=s.replace(/[,\s]/g,'');
 if(/^-1(?:\.0+)?$/.test(numericOnly))return labelText('free');
 if(/^0(?:\.0+)?$/.test(numericOnly))return labelText('priceUnset');
 let cur=String(currency||'').trim().toUpperCase();
 if(/^(CNY|RMB|人民币|¥|￥)$/i.test(cur))cur='CNY';
 if(/^(USD|US\$|\$)$/i.test(cur))cur='USD';
 if(/^(EUR|€)$/i.test(cur))cur='EUR';
 if(/^(JPY|円|日元)$/i.test(cur))cur='JPY';
 const symbolMap={USD:'US$',CNY:'¥',EUR:'€',JPY:'¥',GBP:'£',HKD:'HK$',TWD:'NT$',SGD:'S$'};
 const m=s.match(/([¥￥$€£]|US\$|HK\$|NT\$|S\$)?\s*(-?[0-9]+(?:\.[0-9]+)?)/i);
 if(!cur){
  if(/[￥¥]/.test(s)&&!/JPY|日元|円/i.test(s))cur='CNY';
  else if(/US\$|\$/.test(s))cur='USD';
  else if(/€/.test(s))cur='EUR';
  else if(/£/.test(s))cur='GBP';
  else {const code=s.match(/(USD|CNY|RMB|EUR|JPY|GBP|HKD|TWD|SGD)/i); if(code)cur=code[1].toUpperCase().replace('RMB','CNY')}
 }
 if(m){
  const num=Number(m[2]);
  if(num===-1)return labelText('free');
  if(num===0)return labelText('priceUnset');
  const amount=isFinite(num)?num.toLocaleString(localeCode(),{minimumFractionDigits:num%1?2:0,maximumFractionDigits:2}):m[2];
  if(cur)return `${symbolMap[cur]||cur} ${amount}`;
  return `${amount}:::sub:::${labelText('unsetCurrency')}`
 }
 return s
}
function parseBytesSmart(v){if(v==null||v==='')return 0; if(typeof v==='number')return v; const s=String(v).trim(); const m=s.match(/^([0-9.]+)\s*(B|KB|MB|GB|TB|PB|K|M|G|T|P)?/i); if(!m)return Number(s)||0; let n=Number(m[1]); const u=(m[2]||'B').toUpperCase(); const pow={B:0,K:1,KB:1,M:2,MB:2,G:3,GB:3,T:4,TB:4,P:5,PB:5}[u]||0; return n*Math.pow(1024,pow)}
function kvHtml(items){
 const renderValue=(v,sub)=>{
  let str=String(v);
  let extra=sub||'';
  if(str.includes(':::sub:::')){
   const parts=str.split(':::sub:::');
   str=parts[0];
   extra=extra||parts.slice(1).join(':::sub:::');
  }
  const valHtml=esc(str).replace(/\n/g,'<br>');
  const subHtml=extra?`<span class="kv-sub${/currency|币种/.test(String(extra))?' warn':''}">${esc(extra)}</span>`:'';
  return {valHtml,subHtml};
 };
 return items.filter(x=>x&&x[1]!=null&&x[1]!==''&&x[1]!=='--').map(([k,v,sub])=>{const r=renderValue(v,sub);return `<div class="kv-item"><small>${esc(k)}</small><strong>${r.valHtml}</strong>${r.subHtml}</div>`}).join('')||`<div class="kv-item"><small>${labelText('unknown')}</small><strong>--</strong></div>`
}
function tagsText(v){if(Array.isArray(v))return v.join(' · '); if(typeof v==='string')return v; return ''}

function applyLang(){state.lang=detectLang(); $$('[data-i18n]').forEach(el=>el.textContent=tr(el.dataset.i18n)); $('#searchInput').placeholder=tr('search'); $('#heroTitle').textContent=state.lang==='zh-CN'?(state.settings.home_title_zh||defaultSettings.home_title_zh):(state.settings.home_title_en||defaultSettings.home_title_en); $('#heroSub').textContent=state.lang==='zh-CN'?(state.settings.home_subtitle_zh||defaultSettings.home_subtitle_zh):(state.settings.home_subtitle_en||defaultSettings.home_subtitle_en); $$('.lang button').forEach(b=>b.classList.toggle('active',(state.lang==='zh-CN'&&b.dataset.lang==='zh-CN')||(state.lang==='en-US'&&b.dataset.lang==='en-US')))}
function setupSettings(publicSettings={}){const s={...((window.KOMARI_THEME_CONFIG||window.themeConfig||{})),...(publicSettings||{})}; state.settings={...defaultSettings,...s}; state.settings.show_footer=boolSetting(state.settings.show_footer,true); state.settings.show_billing=boolSetting(state.settings.show_billing,true); state.settings.default_smooth_charts=boolSetting(state.settings.default_smooth_charts,true); document.documentElement.style.setProperty('--accent',state.settings.accent||defaultSettings.accent); if(!state.view)state.view=state.settings.default_view||'table'; if(!['table','map','compact'].includes(state.view)){state.view='table';localStorage.setItem('soraView','table')} if(!state.loadHours)state.loadHours=Number(state.settings.default_load_hours||6); if(!state.pingHours)state.pingHours=Number(state.settings.default_ping_hours||6); if(localStorage.getItem('soraSmoothLoad')==null)state.smoothLoad=!!state.settings.default_smooth_charts; if(localStorage.getItem('soraSmoothPing')==null)state.smoothPing=!!state.settings.default_smooth_charts; if($('#smoothLoad')) $('#smoothLoad').checked=state.smoothLoad; if($('#smoothPing')) $('#smoothPing').checked=state.smoothPing; const footer=$('#footer'); if(footer)footer.style.display=state.settings.show_footer?'flex':'none'; const billBtn=$('[data-side-tab="billing"]'); if(billBtn) billBtn.style.display=state.settings.show_billing?'inline-flex':'none'; applyLang()}
function publicDataOf(x){return (x&&x.data&&typeof x.data==='object')?x.data:(x||{})}
async function loadPublicSettings(){try{const pub=await api('/api/public'); const data=publicDataOf(pub); if(data.sitename)document.title=data.sitename; if(data.title)document.title=data.title; return (data.theme_settings&&typeof data.theme_settings==='object')?data.theme_settings:{} }catch(e){console.warn('public settings failed',e);return {}}}
function setAppReady(){document.body.classList.add('app-ready'); const loader=$('#appLoader'); if(loader) setTimeout(()=>loader.remove(),420)}
function filtered(){const available=new Set(state.nodes.map(n=>n.group).filter(Boolean).map(String)); if(state.group&&!available.has(state.group)){state.group='';localStorage.removeItem('nodeSelectedGroup')} const q=state.query.trim().toLowerCase(); return state.nodes.filter(n=>{const g=state.group?String(n.group||'')===state.group:true; const hay=[getName(n),getNodeId(n),n.region,n.location,n.country,n.group,n.os,n.tags].join(' ').toLowerCase(); return g && (!q || hay.includes(q))})}
function nodeSortKey(n){return isOnline(n)?0:1}
function nodeWeight(n){const w=Number(firstVal(n,['weight','sort_weight','sortWeight','order','priority'])??0); return Number.isFinite(w)?w:0}
function visibleNodes(){return filtered().slice().sort((a,b)=>{const ao=nodeSortKey(a),bo=nodeSortKey(b); if(ao!==bo)return ao-bo; const aw=nodeWeight(a),bw=nodeWeight(b); if(aw!==bw)return bw-aw; const ag=String(a.group||''),bg=String(b.group||''); if(ag!==bg)return ag.localeCompare(bg); return getName(a).localeCompare(getName(b))})}
function groups(){return [...new Set(state.nodes.map(n=>n.group).filter(Boolean).map(String))].sort()}
function summary(){
 const fs=filtered(); const total=fs.length; const online=fs.filter(isOnline).length; const offline=Math.max(0,total-online);
 const avg=a=>total?Math.round(fs.reduce((sum,n)=>sum+pctMetric(n,a),0)/total):0;
 const avgCpu=avg('cpu'), avgRam=avg('ram'), avgDisk=avg('disk');
 const traffic=fs.reduce((sum,n)=>{const l=liveOf(n);return sum+Number(val(l,['network.down','network.down_speed','network_rx','rx','net_in','down_speed','download_speed'])||0)+Number(val(l,['network.up','network.up_speed','network_tx','tx','net_out','up_speed','upload_speed'])||0)},0);
 const totalDown=fs.reduce((sum,n)=>sum+totalTrafficOf(n,'down'),0);
 const totalUp=fs.reduce((sum,n)=>sum+totalTrafficOf(n,'up'),0);
 const countryCount=new Set(fs.map(detectCountry).filter(c=>c&&c!=='UN')).size;
 const onlineRate=total?Math.round(online/total*100):0; const score=Math.round((onlineRate*0.38+(100-avgCpu)*0.17+(100-avgRam)*0.17+(100-avgDisk)*0.14+Math.min(100,countryCount*18)*0.07+Math.min(100,Math.log10(traffic+1)*14)*0.07));
 if($('#statTotal')){$('#statTotal').textContent=total; $('#statOnline').textContent=`${online}/${total}`; $('#statCpu').textContent=avgCpu+'%'; $('#statRam').textContent=avgRam+'%'; $('#statTraffic').textContent=fmtSpeed(traffic)}
 if($('#fleetScore')) $('#fleetScore').textContent=isFinite(score)?score:0; if($('#overviewScore')) $('#overviewScore').textContent=isFinite(score)?score:0;
 if($('#overviewNarrative')) $('#overviewNarrative').textContent=state.lang==='zh-CN'?`${total} 台节点 · ${online} 台在线 · ${offline} 台离线 · 覆盖 ${countryCount} 个国家/地区`:`${total} nodes · ${online} online · ${offline} offline · ${countryCount} countries`;
 const items=[
  {k:'total',v:String(total),s:state.lang==='zh-CN'?`${online} 台在线`:`${online} online`},
  {k:'avgCpu',v:avgCpu+'%',s:tr('cpu')},
  {k:'avgRam',v:avgRam+'%',s:tr('ram')},
  {k:'avgDisk',v:avgDisk+'%',s:tr('disk')},
  {k:'traffic',v:fmtSpeed(traffic),s:tr('network')},
  {k:'totalUpload',v:fmtBytes(totalUp),s:tr('totalUpload')},
  {k:'totalDownload',v:fmtBytes(totalDown),s:tr('totalDownload')},
  {k:'countries',v:String(countryCount),s:tr('countries')}
 ];
 const grid=$('#overviewGrid'); if(grid)grid.innerHTML=items.map(it=>`<div class="overview-card"><small>${esc(tr(it.k))}</small><strong>${esc(it.v)}</strong><span>${esc(it.s)}</span></div>`).join('');
 drawFleetRadar({onlineRate,cpu:100-avgCpu,ram:100-avgRam,disk:100-avgDisk,spread:Math.min(100,countryCount*18),network:Math.min(100,Math.log10(traffic+1)*14)});
}
function drawFleetRadar(m){const canvas=$('#fleetRadar'); if(!canvas)return; const dpr=window.devicePixelRatio||1; const rect=canvas.getBoundingClientRect(); const w=Math.max(300,Math.min(360,Math.round(rect.width||340))),h=240; canvas.style.height=h+'px'; canvas.width=w*dpr; canvas.height=h*dpr; const ctx=canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h); const cx=w/2,cy=h/2+4,r=Math.min(w,h)*0.31; const axes=[['onlineRate',tr('onlineRate'),m.onlineRate],['cpuHeadroom',tr('cpuHeadroom'),m.cpu],['ramHeadroom',tr('ramHeadroom'),m.ram],['diskHeadroom',tr('diskHeadroom'),m.disk],['globalSpread',tr('globalSpread'),m.spread],['networkActivity',tr('networkActivity'),m.network]]; const accent=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#2563eb'; ctx.font='11px Inter,system-ui,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; for(let ring=1;ring<=4;ring++){ctx.beginPath(); axes.forEach((a,i)=>{const ang=-Math.PI/2+i*Math.PI*2/axes.length; const rr=r*ring/4; const x=cx+Math.cos(ang)*rr,y=cy+Math.sin(ang)*rr; i?ctx.lineTo(x,y):ctx.moveTo(x,y)}); ctx.closePath(); ctx.strokeStyle='rgba(148,163,184,.20)'; ctx.lineWidth=1; ctx.stroke()} axes.forEach((a,i)=>{const ang=-Math.PI/2+i*Math.PI*2/axes.length; const x=cx+Math.cos(ang)*r,y=cy+Math.sin(ang)*r; ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(x,y);ctx.strokeStyle='rgba(148,163,184,.18)';ctx.stroke(); const lx=cx+Math.cos(ang)*(r+30),ly=cy+Math.sin(ang)*(r+22); ctx.fillStyle='#64748b'; ctx.fillText(a[1],lx,ly)}); const grad=ctx.createRadialGradient(cx,cy,5,cx,cy,r); grad.addColorStop(0,'rgba(37,99,235,.30)'); grad.addColorStop(1,'rgba(37,99,235,.08)'); ctx.beginPath(); axes.forEach((a,i)=>{const ang=-Math.PI/2+i*Math.PI*2/axes.length; const rr=r*Math.max(0,Math.min(100,a[2]))/100; const x=cx+Math.cos(ang)*rr,y=cy+Math.sin(ang)*rr; i?ctx.lineTo(x,y):ctx.moveTo(x,y)}); ctx.closePath(); ctx.fillStyle=grad; ctx.strokeStyle=accent; ctx.lineWidth=2.2; ctx.fill(); ctx.stroke(); axes.forEach((a,i)=>{const ang=-Math.PI/2+i*Math.PI*2/axes.length; const rr=r*Math.max(0,Math.min(100,a[2]))/100; const x=cx+Math.cos(ang)*rr,y=cy+Math.sin(ang)*rr; ctx.beginPath();ctx.arc(x,y,3.2,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle=accent;ctx.lineWidth=2;ctx.stroke()})}

function renderGroups(){const gs=groups(); const sel=$('#groupSelect'); if(sel) sel.innerHTML=`<option value="">${tr('allGroups')}</option>`+gs.map(g=>`<option value="${esc(g)}" ${state.group===g?'selected':''}>${esc(g)}</option>`).join(''); const label=state.group||tr('allGroups'); const btnText=$('#groupButtonText'); if(btnText)btnText.textContent=label; const menu=$('#groupMenu'); if(menu){menu.innerHTML=`<button type="button" class="group-option ${!state.group?'active':''}" data-group=""><span>${esc(tr('allGroups'))}</span><em>${state.nodes.length}</em></button>`+gs.map(g=>{const count=state.nodes.filter(n=>(n.group||'')===g).length; return `<button type="button" class="group-option ${state.group===g?'active':''}" data-group="${esc(g)}"><span>${esc(g)}</span><em>${count}</em></button>`}).join('')}}
function statusHtml(n){const on=isOnline(n); return `<span class="status ${on?'online':'offline'}"><i class="dot"></i>${on?tr('online'):tr('offline')}</span>`}
function animMetric(n,key,value){
 const v=Math.max(0,Math.min(100,Number(value)||0));
 const id=getNodeId(n)||getName(n)||'node';
 const k=String(id)+':'+key;
 state.metricPrev=state.metricPrev||{}; state.metricNext=state.metricNext||{};
 const from=state.metricPrev[k];
 state.metricNext[k]=v;
 return {value:v,from:from==null?v:Math.max(0,Math.min(100,Number(from)||0))};
}
function ringMetric(label,value,opts={}){const p=Math.max(0,Math.min(100,Number(value)||0)); const from=opts.from==null?p:Math.max(0,Math.min(100,Number(opts.from)||0)); const cls=p>=85?'danger':p>=70?'warn':'ok'; const text=opts.text||Math.round(p)+'%'; const title=opts.title||`${label} ${text}`; return `<span class="ring-metric ${cls}" data-from="${from}" data-target="${p}" style="--p:${from}" title="${esc(title)}"><i></i><b>${esc(label)}</b><em>${esc(text)}</em></span>`}
function leftRingMetric(n){const t=trafficLeftOf(n); if(!t)return `<span class="ring-metric muted" data-from="0" data-target="0" style="--p:0" title="${esc(tr('trafficLeft'))}: --"><i></i><b>${esc(state.lang==='zh-CN'?'流量':'Traffic')}</b><em>--</em></span>`; const usedPct=100-t.pct; const cls=usedPct>=90?'danger':usedPct>=75?'warn':'ok'; const text=Math.round(t.pct)+'%'; const a=animMetric(n,'trafficLeft',t.pct); return `<span class="ring-metric ${cls}" data-from="${a.from}" data-target="${a.value}" style="--p:${a.from}" title="${esc(tr('trafficLeft'))}: ${esc(fmtBytes(t.left))} / ${esc(fmtBytes(t.limit))}"><i></i><b>${esc(state.lang==='zh-CN'?'流量':'Traffic')}</b><em>${text}</em></span>`}
function trafficLeftLabel(n){const t=trafficLeftOf(n); if(!t)return '--'; return fmtBytes(t.left)}
function trafficLeftTitle(n){const t=trafficLeftOf(n); if(!t)return `${tr('trafficLeft')}: --`; return `${tr('trafficLeft')}: ${fmtBytes(t.left)} / ${fmtBytes(t.limit)}`}
function trafficLeftPct(n){const t=trafficLeftOf(n); return t?Math.max(0,Math.min(100,t.pct)):0}
function resourceRings(n){const cpu=animMetric(n,'cpu',pctMetric(n,'cpu')),ram=animMetric(n,'ram',pctMetric(n,'ram')),disk=animMetric(n,'disk',pctMetric(n,'disk')); return `<div class="resource-rings">${ringMetric('CPU',cpu.value,{from:cpu.from})}${ringMetric('RAM',ram.value,{from:ram.from})}${ringMetric('Disk',disk.value,{from:disk.from})}${leftRingMetric(n)}</div>`}

function latencyValueOf(n){
 const l=liveOf(n);
 const raw=firstVal(l,['latency','ping','rtt','delay','network.latency','network.ping','icmp','ping_ms','response_time']) ?? firstVal(n,['latency','ping','rtt','delay','ping_ms','response_time']);
 const num=Number(raw);
 return Number.isFinite(num)&&num>=0?num:null;
}
function latencyText(n){const v=latencyValueOf(n); return v==null?'--':(v<100?v.toFixed(0):v.toFixed(0))+' ms'}
function osNameOf(n){const l=liveOf(n); return dash(firstVal(n,['os','system','platform','distro'])||firstVal(l,['os','system','platform','distro']))}
function priceRawOf(n){return firstVal(n,['billing.price','billing_price','price','cost','plan_price','billing.cost','billing.amount'])}
function priceCurrencyOf(n){return firstVal(n,['billing.currency','currency','billing_currency','price_currency'])}
function pricePeriodOf(n){return firstVal(n,['billing.period','billing.cycle','billing.billing_cycle','billing.billingCycle','billing.cycle_unit','billing.cycleUnit','billing.cycle_type','billing.cycleType','billing.interval','billing.interval_unit','billing.intervalUnit','billing.duration','billing.term','billing.renewal','billing.renewal_cycle','billing.renewalCycle','billing.plan','billing.name','billing.plan_cycle','billing.planCycle','billing.periodName','billing.payment_cycle','billing.paymentCycle','billing.period_unit','billing.periodUnit','billing.price_period','billing.pricePeriod','billing.type','period','cycle','billing_cycle','billingCycle','cycle_unit','cycleUnit','interval','duration','term','renewal_cycle','payment_cycle','paymentCycle','plan','billing_period','price_period'])}
function expireRawOf(n){return firstVal(n,['billing.expire','billing.expired_at','billing.expire_at','billing.expires_at','expired_at','expire','expire_at','expires_at','due_date','next_due_date','billing_date'])}
function numericPriceOf(raw){if(raw==null||raw==='')return null; if(isLifetimeValue(raw))return 'lifetime'; const s=String(raw).trim().replace(/[,\s]/g,''); if(/^-1(?:\.0+)?$/.test(s))return 'free'; if(/^0(?:\.0+)?$/.test(s))return 'unset'; const m=String(raw).match(/-?[0-9]+(?:\.[0-9]+)?/); if(!m)return null; const num=Number(m[0]); if(num===-1)return 'free'; if(num===0)return 'unset'; return Number.isFinite(num)?num:null}
function currencySymbolOf(currency,raw=''){
 let cur=String(currency||'').trim().toUpperCase();
 if(/^(CNY|RMB|人民币|¥|￥)$/i.test(cur))cur='CNY';
 if(/^(USD|US\$|\$)$/i.test(cur))cur='USD';
 if(/^(EUR|€)$/i.test(cur))cur='EUR';
 if(/^(JPY|円|日元)$/i.test(cur))cur='JPY';
 if(!cur){const s=String(raw||''); if(/[￥¥]/.test(s)&&!/JPY|日元|円/i.test(s))cur='CNY'; else if(/US\$|\$/.test(s))cur='USD'; else if(/€/.test(s))cur='EUR'; else if(/£/.test(s))cur='GBP'; else {const code=s.match(/\b(USD|CNY|RMB|EUR|JPY|GBP|HKD|TWD|SGD)\b/i); if(code)cur=code[1].toUpperCase().replace('RMB','CNY')}}
 return ({USD:'US$',CNY:'¥',EUR:'€',JPY:'¥',GBP:'£',HKD:'HK$',TWD:'NT$',SGD:'S$'})[cur]||cur||'';
}
function compactPriceText(n){const raw=priceRawOf(n), period=pricePeriodOf(n), val=numericPriceOf(raw), sym=currencySymbolOf(priceCurrencyOf(n),raw); if(isLifetimeValue(raw)||isLifetimeValue(period))return labelText('lifetime'); if(val==='free')return labelText('free'); if(val==='unset')return labelText('priceUnset'); if(typeof val==='number'){const amount=val.toLocaleString(localeCode(),{maximumFractionDigits:2}); const suffix=period?(' / '+String(period).replace(/billing|cycle|period/ig,'').trim()):''; return (sym?`${sym}${amount}`:amount)+suffix} return '--'}
function expireDaysOf(n){const raw=expireRawOf(n); if(raw==null||raw==='')return null; const s=String(raw).trim(); if(!s||s==='0'||s==='0000-00-00'||/^0001[-/]/.test(s)||/^1[-/]/.test(s)||isLifetimeValue(s))return null; let input=raw; if(typeof input==='number'&&input>0&&input<1e12)input*=1000; const d=new Date(input); if(isNaN(d.getTime())||d.getFullYear()<=1)return null; const days=Math.ceil((d.getTime()-Date.now())/86400000); if(d.getFullYear()>=2100||days>36500)return 'lifetime'; return days}
function compactExpireText(n){const d=expireDaysOf(n); if(d==='lifetime')return labelText('lifetime'); if(d==null)return labelText('priceUnset'); if(d<0)return labelText('expired'); return state.lang==='zh-CN'?`${d} 天`:`${d} days`}
function billingCycleDays(raw,period,n=null){
 const parts=[period];
 if(n){
  const extra=[
   'billing.period','billing.cycle','billing.billing_cycle','billing.billingCycle','billing.cycle_unit','billing.cycleUnit','billing.cycle_type','billing.cycleType','billing.interval','billing.interval_unit','billing.intervalUnit','billing.duration','billing.term','billing.renewal','billing.renewal_cycle','billing.renewalCycle','billing.plan','billing.name','billing.plan_cycle','billing.planCycle','billing.periodName','billing.payment_cycle','billing.paymentCycle','billing.period_unit','billing.periodUnit','billing.price_period','billing.pricePeriod','billing.type','period','cycle','billing_cycle','billingCycle','cycle_unit','cycleUnit','interval','duration','term','renewal_cycle','payment_cycle','paymentCycle','plan','billing_period','price_period'
  ].map(k=>firstVal(n,[k])).filter(v=>v!=null&&v!=='');
  parts.push(...extra);
 }
 const text=String(parts.filter(v=>v!=null&&v!=='').join(' ')).toLowerCase();
 const num=(re,def)=>{const m=text.match(re); return m&&m[1]?Math.max(1,Number(m[1]))*def:def};
 if(/annual|annually|yearly|per\s*year|\/\s*y(?:ear)?|每年|年付|年缴|年費|年费|年/.test(text))return num(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?|年)/,365);
 if(/semi[-\s]?annual|half[-\s]?year|半年/.test(text))return 182.5;
 if(/quarter|quarterly|per\s*quarter|季付|季度|季/.test(text))return num(/(\d+(?:\.\d+)?)\s*(?:quarters?|季)/,90);
 if(/monthly|per\s*month|\/\s*m(?:onth)?|月付|月缴|月費|月费|月/.test(text))return num(/(\d+(?:\.\d+)?)\s*(?:months?|mons?|月)/,30);
 if(/weekly|per\s*week|周付|周/.test(text))return num(/(\d+(?:\.\d+)?)\s*(?:weeks?|周)/,7);
 if(/daily|per\s*day|日付|按天|天/.test(text))return num(/(\d+(?:\.\d+)?)\s*(?:days?|日|天)/,1);
 const pure=String(period??'').trim();
 if(/^365$/.test(pure))return 365;
 if(/^90$/.test(pure))return 90;
 if(/^30$/.test(pure))return 30;
 if(/^12$/.test(pure))return 365;
 return 30;
}
function residualValueText(n){
 const raw=priceRawOf(n), period=pricePeriodOf(n), val=numericPriceOf(raw), days=expireDaysOf(n), sym=currencySymbolOf(priceCurrencyOf(n),raw);
 if(isLifetimeValue(raw)||isLifetimeValue(period)||days==='lifetime')return labelText('lifetime');
 if(val==='free')return labelText('free');
 if(val==='unset'||val==null||days==null)return '--';
 if(days<0)return labelText('expired');
 if(typeof val==='number'){
  const cycleDays=billingCycleDays(raw,period,n);
  const remain=Math.max(0,val/cycleDays*days);
  const amount=remain.toLocaleString(localeCode(),{maximumFractionDigits:2});
  return sym?`${sym}${amount}`:amount;
 }
 return '--'
}
function tagChipsHtml(n){const raw=n.tags||liveOf(n).tags; let list=[]; if(Array.isArray(raw))list=raw; else if(typeof raw==='string')list=raw.split(/[，,|\s]+/).filter(Boolean); return list.slice(0,4).map(t=>`<span>${esc(t)}</span>`).join('') || `<span>${esc(state.lang==='zh-CN'?'无标签':'No tag')}</span>`}
function compactInfoGrid(n){
 const up=fmtUptime(val(liveOf(n),['uptime','uptime_seconds'])||n.uptime);
 const items=[
  ['价格','Price',compactPriceText(n),'¥'],
  ['剩余天数','Days left',compactExpireText(n),'◷'],
  ['剩余价值','Value left',residualValueText(n),'◇'],
  ['系统名称','System',osNameOf(n),'⌘'],
  ['在线时长','Uptime',up,'⏱'],
  ['标签','Tags',tagsText(n.tags||liveOf(n).tags)||(state.lang==='zh-CN'?'无标签':'No tag'),'#']
 ];
 return `<div class="compact-info-list">${items.map(([zh,en,v,ico])=>`<div class="compact-info-row"><span class="compact-info-key"><i>${esc(ico)}</i>${esc(state.lang==='zh-CN'?zh:en)}</span><strong>${esc(v)}</strong></div>`).join('')}</div>`;
}

function compactBars(n){const defs=[['CPU','cpu',pctMetric(n,'cpu'),Math.round(pctMetric(n,'cpu'))+'%'],['RAM','ram',pctMetric(n,'ram'),Math.round(pctMetric(n,'ram'))+'%'],['Disk','disk',pctMetric(n,'disk'),Math.round(pctMetric(n,'disk'))+'%'],[state.lang==='zh-CN'?'流量':'Traffic','trafficLeft',trafficLeftPct(n),trafficLeftLabel(n),trafficLeftTitle(n)]]; return `<div class="compact-bars">${defs.map(([name,key,p,text,title])=>{const a=animMetric(n,'compact:'+key,p); return `<div class="mini-bar" title="${esc(title||name+' '+text)}"><span>${esc(name)}</span><div><i class="mini-bar-fill" data-from="${a.from}" data-target="${a.value}" style="--p:${a.from}"></i></div><b>${esc(text)}</b></div>`}).join('')}</div>`}
function networkPills(n){const l=liveOf(n); const down=Number(val(l,['network.down','network.down_speed','network_rx','rx','net_in','down_speed','download_speed'])||0); const up=Number(val(l,['network.up','network.up_speed','network_tx','tx','net_out','up_speed','upload_speed'])||0); return `<div class="net-pills" title="↓ ${esc(fmtSpeed(down))} / ↑ ${esc(fmtSpeed(up))}"><span class="net-pill down"><b>↓</b><em>${esc(fmtSpeed(down))}</em></span><span class="net-pill up"><b>↑</b><em>${esc(fmtSpeed(up))}</em></span></div>`}
function nodeRow(n){const id=esc(getNodeId(n)); return `<tr class="${isOnline(n)?'':'is-offline'}" data-node-id="${id}"><td><div class="node-name node-name-only" title="${esc(getName(n))}">${esc(getName(n))}</div></td><td>${statusHtml(n)}</td><td data-label-resource="${esc(tr('resource'))}">${resourceRings(n)}</td><td class="network-cell" data-label-network="${esc(tr('network'))}">${networkPills(n)}</td></tr>`}
function compactCard(n){const id=esc(getNodeId(n)); return `<div class="slab compact-rich ${isOnline(n)?'':'is-offline'}" data-node-id="${id}"><div class="slab-top"><div><div class="node-name">${esc(getName(n))}</div><div class="subtle">${esc(regionText(n))}</div></div>${statusHtml(n)}</div>${compactInfoGrid(n)}${compactBars(n)}</div>`}

function easeOutCubic(t){return 1-Math.pow(1-t,3)}
function animateInlineMetrics(){
 if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){
  $$('.ring-metric[data-target]').forEach(el=>el.style.setProperty('--p',el.dataset.target||0));
  $$('.mini-bar-fill[data-target]').forEach(el=>el.style.setProperty('--p',el.dataset.target||0));
  return;
 }
 const items=[...$$('.ring-metric[data-target], .mini-bar-fill[data-target]')].map(el=>({el,from:Number(el.dataset.from||0),to:Number(el.dataset.target||0)}));
 const start=performance.now(),dur=820;
 function step(now){
  const t=Math.min(1,(now-start)/dur),e=easeOutCubic(t);
  items.forEach(it=>it.el.style.setProperty('--p',(it.from+(it.to-it.from)*e).toFixed(2)));
  if(t<1)requestAnimationFrame(step);
 }
 requestAnimationFrame(step);
}
function renderNodes(){state.metricNext={}; const fs=visibleNodes(); $('#tableBody').innerHTML=fs.length?fs.map(nodeRow).join(''):`<tr><td colspan="4" class="empty">${tr('noNodes')}</td></tr>`; $('#compactGrid').innerHTML=fs.length?fs.map(compactCard).join(''):`<div class="empty">${tr('noNodes')}</div>`; $('#mapNodeList').innerHTML=fs.length?fs.map(n=>`<div class="map-node-item ${isOnline(n)?'':'is-offline'}" data-node-id="${esc(getNodeId(n))}"><div><div class="node-name">${esc(getName(n))}</div><div class="map-node-meta">${esc(countryName(detectCountry(n)))} · ${esc(regionText(n))}</div></div>${statusHtml(n)}</div>`).join(''):`<div class="empty">${tr('noNodes')}</div>`; animateInlineMetrics(); state.metricPrev={...(state.metricNext||{})}; bindNodeClicks(); renderMap()}
function render(){applyLang(); renderGroups(); summary(); renderNodes(); $$('.seg button,.nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===state.view)); $$('.view').forEach(v=>v.classList.toggle('active',v.id===state.view+'View')); updateActiveDetail()}
function setView(v){state.view=v;localStorage.setItem('soraView',v);render()}
function bindNodeClicks(){ $$('[data-node-id]').forEach(el=>{el.onclick=()=>{const id=el.dataset.nodeId; if(id)location.hash='#/node/'+encodeURIComponent(id)}})}
const countryAliases=[
 ['CN','China',['中国','china','mainland','beijing','shanghai','guangzhou','shenzhen','hainan','haikou','taiwan','taipei','tw','香港','hong kong','hk','澳门','macau','macao','mo']],
 ['US','United States',['usa','united states','america','us','u.s.','los angeles','new york','san jose','california','ashburn','chicago','seattle']],['JP','Japan',['日本','japan','jp','tokyo','osaka']],['SG','Singapore',['新加坡','singapore','sg']],['KR','South Korea',['韩国','south korea','korea','seoul','kr']],['DE','Germany',['德国','germany','deutschland','frankfurt','de']],['GB','United Kingdom',['英国','uk','united kingdom','london','gb']],['FR','France',['法国','france','paris','fr']],['NL','Netherlands',['荷兰','netherlands','amsterdam','nl']],['RU','Russia',['俄罗斯','russia','moscow','ru']],['CA','Canada',['加拿大','canada','toronto','ca']],['AU','Australia',['澳大利亚','australia','sydney','au']],['IN','India',['印度','india','mumbai','in']],['BR','Brazil',['巴西','brazil','sao paulo','br']],['ZA','South Africa',['南非','south africa','johannesburg','za']],['TH','Thailand',['泰国','thailand','bangkok','th']],['VN','Vietnam',['越南','vietnam','vn']],['MY','Malaysia',['马来西亚','malaysia','kuala lumpur','my']],['ID','Indonesia',['印尼','indonesia','jakarta','id']],['PH','Philippines',['菲律宾','philippines','manila','ph']],['TR','Turkey',['土耳其','turkey','istanbul','tr']],['AE','UAE',['阿联酋','uae','dubai','ae']]
];
const flagMap={'🇨🇳':'CN','🇹🇼':'CN','🇭🇰':'CN','🇲🇴':'CN','🇺🇸':'US','🇯🇵':'JP','🇸🇬':'SG','🇰🇷':'KR','🇩🇪':'DE','🇬🇧':'GB','🇫🇷':'FR','🇳🇱':'NL','🇷🇺':'RU','🇨🇦':'CA','🇦🇺':'AU','🇮🇳':'IN','🇧🇷':'BR','🇿🇦':'ZA','🇹🇭':'TH','🇻🇳':'VN','🇲🇾':'MY','🇮🇩':'ID','🇵🇭':'PH','🇹🇷':'TR','🇦🇪':'AE'};
function flagCountry(s){s=String(s||''); for(const [f,c] of Object.entries(flagMap)){if(s.includes(f))return c} return null}
function reEsc(s){return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
const countryCenters={CN:[104.2,35.8],US:[-98,39],JP:[138,37],SG:[103.82,1.35],KR:[127.8,36.4],DE:[10.4,51.1],GB:[-2.2,54.2],FR:[2.2,46.2],NL:[5.3,52.1],RU:[90,61],CA:[-106,57],AU:[134,-25],IN:[78.9,22.8],BR:[-52,-10],ZA:[24,-29],TH:[101,15],VN:[108,16],MY:[102.3,4.2],ID:[113,-2],PH:[122,13],TR:[35,39],AE:[54,24]};
const iso3To2={CHN:'CN',USA:'US',JPN:'JP',SGP:'SG',KOR:'KR',DEU:'DE',GBR:'GB',FRA:'FR',NLD:'NL',RUS:'RU',CAN:'CA',AUS:'AU',IND:'IN',BRA:'BR',ZAF:'ZA',THA:'TH',VNM:'VN',MYS:'MY',IDN:'ID',PHL:'PH',TUR:'TR',ARE:'AE',TWN:'CN',HKG:'CN',MAC:'CN'};
function normCountryCode(c){if(!c)return null; let s=String(c).trim(); if(/^(TW|HK|MO|CN|HKD|HKG|MAC|TWN)$/i.test(s))return 'CN'; if(/^[A-Z]{2}$/i.test(s))return s.toUpperCase(); const m={USA:'US',CHN:'CN',JPN:'JP',SGP:'SG',KOR:'KR',DEU:'DE',GBR:'GB',FRA:'FR',NLD:'NL',RUS:'RU',CAN:'CA',AUS:'AU',IND:'IN',BRA:'BR',ZAF:'ZA',THA:'TH',VNM:'VN',MYS:'MY',IDN:'ID',PHL:'PH',TUR:'TR',ARE:'AE',TWN:'CN',HKG:'CN',MAC:'CN'}; return m[s.toUpperCase()]||null}
function detectCountry(n){
 const direct=normCountryCode(n.country_code||n.countryCode||n.cc||n.iso2||n.iso3||n.country_code2||n.countryCode2); if(direct)return direct;
 const fields=[n.country,n.region,n.location,n.area,n.group,n.tags,n.remark,n.description,n.name].filter(Boolean).map(String);
 for(const f of fields){const fc=flagCountry(f); if(fc)return fc}
 for(const f of fields){const raw=f.toLowerCase(); const hay=' '+raw+' '; for(const [code,,arr] of countryAliases){for(const a of arr){const aa=String(a).toLowerCase(); if(aa.length<=2){const re=new RegExp('(^|[^a-z0-9])'+reEsc(aa)+'([^a-z0-9]|$)','i'); if(re.test(hay))return code}else if(raw.includes(aa))return code}}}
 return 'UN'
}
function countryName(code){const row=countryAliases.find(x=>x[0]===code); return row?row[1]:(code==='UN'?'Unknown':code)}
function project(lon,lat,w,h){const x=(lon+180)/360*w; const y=(90-lat)/180*h; return [x,y]}
function pathForGeom(geom,w,h){function ringPath(r){return r.map((p,i)=>{const [x,y]=project(p[0],p[1],w,h);return (i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)}).join('')+'Z'} if(!geom)return ''; if(geom.type==='Polygon')return geom.coordinates.map(ringPath).join(''); if(geom.type==='MultiPolygon')return geom.coordinates.flatMap(poly=>poly.map(ringPath)).join(''); return ''}
function featureCountryCode(f){const p=f?.properties||{}; let c=normCountryCode(p.iso_a2||p.ISO_A2||p.adm0_a3||p.ADM0_A3||p.iso_a3||p.ISO_A3); if(c)return c; const iso3=String(p.iso_a3||p.ADM0_A3||'').toUpperCase(); if(iso3To2[iso3])return iso3To2[iso3]; const name=String(p.name||p.NAME||'').toLowerCase(); if(/taiwan|hong kong|macau|macao/.test(name))return 'CN'; for(const [code,,arr] of countryAliases){if(arr.some(a=>String(a).length>2&&name.includes(String(a).toLowerCase())))return code} return null}
function mapTipHtml(a){const names=a.nodes.map(getName).slice(0,10).map(esc).join('<br>');return `<strong>${esc(countryName(a.code))}</strong>${a.nodes.length} ${tr('servers')} · ${a.online} ${tr('onlineCount')}<div class="tooltip-list">${names}${a.nodes.length>10?'<br>…':''}</div>`}
function bindMapTip(el,a){const tip=$('#mapTip'); el.onmousemove=e=>{tip.innerHTML=mapTipHtml(a); tip.style.display='block'; const r=$('#mapPanel').getBoundingClientRect(); tip.style.left=Math.min(r.width-310,Math.max(10,e.clientX-r.left+12))+'px'; tip.style.top=Math.min(r.height-150,Math.max(10,e.clientY-r.top+12))+'px'}; el.onmouseleave=()=>tip.style.display='none'}
function renderMap(){const svg=$('#worldSvg'); if(!svg||!state.world)return; const w=1000,h=560; svg.setAttribute('viewBox',`0 0 ${w} ${h}`); svg.setAttribute('preserveAspectRatio','xMidYMid meet'); const agg={}; visibleNodes().forEach(n=>{const c=detectCountry(n); if(!agg[c])agg[c]={code:c,nodes:[],online:0}; agg[c].nodes.push(n); if(isOnline(n))agg[c].online++}); const mapKey=Object.values(agg).map(a=>`${a.code}:${a.nodes.length}:${a.online}:${a.nodes.map(getNodeId).join(',')}`).sort().join('|'); if(state._mapKey===mapKey&&svg.dataset.ready==='1')return; state._mapKey=mapKey; let gr=''; for(let lon=-120;lon<=120;lon+=60){const [x]=project(lon,0,w,h);gr+=`<path class="graticule" d="M${x} 26L${x} ${h-26}"/>`} for(let lat=-60;lat<=60;lat+=30){const [,y]=project(0,lat,w,h);gr+=`<path class="graticule" d="M26 ${y}L${w-26} ${y}"/>`} const countries=(state.world.features||[]).map(f=>{const code=featureCountryCode(f); const active=code&&agg[code]; const cls=active?`country active ${agg[code].online?'has-online':'all-offline'}`:'country'; return `<path class="${cls}" data-country="${code||''}" d="${pathForGeom(f.geometry,w,h)}"><title>${esc(code&&active?countryName(code):f.properties?.name||'')}</title></path>`}).join(''); const marks=Object.values(agg).filter(a=>a.code!=='UN').map(a=>{const [lon,lat]=countryCenters[a.code]||[0,0]; const [x,y]=project(lon,lat,w,h); const off=a.online===0?' offline':''; const count=a.nodes.length; return `<g class="marker${off}" data-country="${a.code}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle class="halo" r="${14+Math.min(8,count*1.7)}"></circle><circle class="core" r="11"></circle><text y=".5">${count}</text></g>`}).join(''); svg.innerHTML=`<g class="map-glass-oval"><ellipse cx="${w/2}" cy="${h/2}" rx="${w*.46}" ry="${h*.40}"></ellipse></g>${gr}<g class="countries">${countries}</g><g class="marks">${marks}</g>`; svg.dataset.ready='1'; $$('.country.active',svg).forEach(el=>{const a=agg[el.dataset.country]; if(a)bindMapTip(el,a)}); $$('.marker',svg).forEach(el=>{const a=agg[el.dataset.country]; if(a)bindMapTip(el,a)})}

function setDetailTab(name,restart=true){
 state.detailTab=name||state.detailTab||'asset';
 if(state.detailTab==='billing'&&!state.settings.show_billing)state.detailTab='asset';
 $$('.side-tab-btn').forEach(b=>{const isBill=b.dataset.sideTab==='billing'; b.style.display=(isBill&&!state.settings.show_billing)?'none':'inline-flex'; b.classList.toggle('active',b.dataset.sideTab===state.detailTab)});
 $$('.side-tab-pane').forEach(p=>{const isBill=p.dataset.sidePane==='billing'; const on=p.dataset.sidePane===state.detailTab; p.classList.toggle('active',on); p.style.display=(isBill&&!state.settings.show_billing)?'none':(on?'block':'none'); });
 if(restart) restartDetailTabAuto();
}
function restartDetailTabAuto(){
 clearInterval(state.sideTabTimer);
 if(!state.activeNode) return;
 const panes=['asset','system'].concat(state.settings.show_billing?['billing']:[]).concat(['connections']);
 let idx=Math.max(0,panes.indexOf(state.detailTab||'asset'));
 state.sideTabTimer=setInterval(()=>{ if(!state.activeNode) return; idx=(idx+1)%panes.length; setDetailTab(panes[idx],false); }, 5000);
}

function clearCanvasChart(selOrCanvas,msg){
 const canvas=typeof selOrCanvas==='string'?$(selOrCanvas):selOrCanvas;
 if(!canvas)return;
 const dpr=window.devicePixelRatio||1;
 const rect=canvas.getBoundingClientRect();
 const w=Math.max(320,rect.width||320),h=Math.max(220,rect.height||220);
 canvas.width=w*dpr; canvas.height=h*dpr;
 const ctx=canvas.getContext('2d');
 ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
 ctx.font='12px Inter,system-ui,sans-serif'; ctx.fillStyle='#94a3b8';
 ctx.textAlign='center'; ctx.fillText(msg||tr('noData'),w/2,h/2); ctx.textAlign='start';
 canvas._chart={states:[],opt:{}};
}
function clearPingChart(){
 state.charts.pingSeries=null; state.charts.pingTasks=null; state.charts.pingPalette=null;
 const chips=$('#pingChips'); if(chips)chips.innerHTML='';
 clearCanvasChart('#pingCanvas',tr('noData'));
 const tip=$('#pingCanvas')?.parentElement?.querySelector('.chart-tooltip'); if(tip)tip.style.display='none';
}
function clearLoadModalChart(msg){
 clearCanvasChart('#loadModalCanvas',msg||tr('noData'));
 const tip=$('#loadModalCanvas')?.parentElement?.querySelector('.chart-tooltip'); if(tip)tip.style.display='none';
}
function route(){const m=location.hash.match(/^#\/node\/(.+)$/); if(m){const id=decodeURIComponent(m[1]); const n=state.nodes.find(x=>getNodeId(x)===id||getName(x)===id); if(n){state.activeNode=n; $('#home').style.display='none'; $('#detail').classList.add('active'); clearPingChart(); clearLoadModalChart(); renderDetail(n); restartDetailTabAuto(); loadCharts(n); return}} clearInterval(state.sideTabTimer); state.activeNode=null; $('#home').style.display='block'; $('#detail').classList.remove('active')}
function updateActiveDetail(){if(state.activeNode){const fresh=state.nodes.find(n=>getNodeId(n)===getNodeId(state.activeNode)); if(fresh){state.activeNode=fresh; renderDetail(fresh,false)}}}

function metricNumberOf(n,keys){
 const l=liveOf(n);
 const v=firstVal(l,keys)||firstVal(n,keys);
 const num=Number(v);
 return isFinite(num)&&num>=0?num:null;
}
function connectionStats(n){
 const tcp=metricNumberOf(n,['connections.tcp','connection.tcp','network.tcp','tcp','tcp_conn','tcp_connections','tcp_count','tcp_count_current','tcp_established','net_tcp','conn_tcp']);
 const udp=metricNumberOf(n,['connections.udp','connection.udp','network.udp','udp','udp_conn','udp_connections','udp_count','udp_count_current','net_udp','conn_udp']);
 const proc=metricNumberOf(n,['process','processes','process_count','processCount','system.processes','system.process_count','load.processes','process_num','procs']);
 return {tcp,udp,proc};
}
function compactNumber(v){
 if(v==null)return '--';
 if(v>=1000000)return (v/1000000).toFixed(1)+'M';
 if(v>=1000)return (v/1000).toFixed(1)+'K';
 return String(Math.round(v));
}
function connectionCardHtml(label,value,kind){
 const missing=value==null;
 const n=missing?0:Math.max(0,Number(value));
 const p=Math.max(8,Math.min(100, missing?8:(n>=1000?100:n/10)));
 return `<div class="conn-card ${missing?'muted':''}" style="--p:${p}"><div class="conn-top"><span>${esc(label)}</span><b>${esc(compactNumber(value))}</b></div><div class="conn-bar"><i></i></div><div class="conn-foot">${missing?esc(tr('noData')):esc(kind)}</div></div>`;
}
function renderConnectionInfo(n){
 const host=$('#connectionInfo'); if(!host)return;
 const s=connectionStats(n);
 host.innerHTML=`<div class="connection-grid">${connectionCardHtml(tr('tcp'),s.tcp,'TCP')}${connectionCardHtml(tr('udp'),s.udp,'UDP')}${connectionCardHtml(tr('processes'),s.proc,state.lang==='zh-CN'?'PROC':'PROC')}</div>`;
}

function renderDetail(n,reload=true){
 $('#detailTitle').textContent=getName(n);
 $('#detailSub').textContent=`${countryName(detectCountry(n))} · ${regionText(n)}`;
 $('#detailStatus').innerHTML=statusHtml(n);
 const l=liveOf(n);
 const netDown=Number(val(l,['network.down','network.down_speed','network_rx','rx','net_in','down_speed','download_speed'])||0);
 const netUp=Number(val(l,['network.up','network.up_speed','network_tx','tx','net_out','up_speed','upload_speed'])||0);
 const metrics=[
  [labelText('id'),esc(getNodeId(n))],
  [labelText('country'),esc(countryName(detectCountry(n)))],
  [labelText('region'),esc(regionText(n))],
  [labelText('group'),esc(n.group||'--')],
  [labelText('uptime'),esc(fmtUptime(val(l,['uptime','uptime_seconds'])||n.uptime))],
  [labelText('network'),esc(`${fmtSpeed(netDown)} ↓ / ${fmtSpeed(netUp)} ↑`)]
 ];
 $('#detailMetrics').classList.add('pretty-kv');
 $('#detailMetrics').innerHTML=kvHtml(metrics);
 renderLoadGauges(n);
 const os=firstVal(n,['os','system','platform'])||firstVal(l,['os','system','platform']);
 const sys=[
  [labelText('os'),esc(dash(os))],
  [labelText('kernel'),esc(dash(firstVal(n,['kernel','kernel_version'])||firstVal(l,['kernel','kernel_version'])))],
  [labelText('arch'),esc(dash(firstVal(n,['arch','architecture'])||firstVal(l,['arch','architecture'])))],
  [labelText('cpuModel'),esc(dash(firstVal(n,['cpu_name','cpu_model','processor'])||firstVal(l,['cpu_name','cpu_model','processor'])))],
  [labelText('virt'),esc(dash(firstVal(n,['virtualization','vm','virtual'])||firstVal(l,['virtualization','vm','virtual'])))],
  [labelText('gpu'),esc(dash(firstVal(n,['gpu','gpu_name'])||firstVal(l,['gpu','gpu_name'])))],
  [labelText('version'),esc(dash(firstVal(n,['version','agent_version'])||firstVal(l,['version','agent_version'])))],
  [labelText('tags'),esc(tagsText(n.tags||l.tags))]
 ];
 $('#assetInfo').classList.add('pretty-kv');
 $('#assetInfo').innerHTML=kvHtml(sys);
 renderConnectionInfo(n);
 if(state.settings.show_billing){
  const priceRaw=firstVal(n,['billing.price','billing_price','price','cost','plan_price','billing.cost','billing.amount']);
  const currency=firstVal(n,['billing.currency','currency','billing_currency','price_currency']);
  const pricePeriod=firstVal(n,['billing.period','billing.cycle','billing.type','billing.plan','billing.name','billing.periodName','period','cycle','plan','billing_cycle']);
  const expire=firstVal(n,['billing.expire','billing.expired_at','billing.expire_at','billing.expires_at','expired_at','expire','expire_at','expires_at','due_date','next_due_date','billing_date']);
  const trafficLimit=firstVal(n,['billing.traffic_limit','billing.trafficLimit','traffic_limit','trafficLimit','data_limit','transfer_limit','bandwidth_limit']);
  const autoRenew=firstVal(n,['billing.auto_renew','billing.autoRenew','auto_renew','autoRenew','renew']);
  const note=firstVal(n,['public_note','publicNote','note','remark','description']);
  const bill=[
   [labelText('price'),formatMoneyValue(priceRaw,currency,pricePeriod)],
   [labelText('expire'),formatDateValue(expire)],
   [labelText('trafficLimit'),trafficLimit?esc(fmtBytes(parseBytesSmart(trafficLimit))):'--'],
   [labelText('autoRenew'),esc(boolText(autoRenew))],
   [labelText('note'),note?esc(note):'--']
  ];
  $('#billingInfo').innerHTML=`<div class="panel-head compact-head"><div class="section-title">${tr('billing')}</div></div><div class="panel-body"><div class="kv pretty-kv billing-kv">${kvHtml(bill)}</div></div>`
 }else $('#billingInfo').innerHTML=''
 setDetailTab(state.detailTab||'asset', false);
}


function renderLoadGauges(n){
 const host=$('#loadGauges'); if(!host)return;
 const l=liveOf(n);
 const defs=[
  {id:'cpu',name:'CPU',value:pctMetric(n,'cpu'),color:'#2563eb',sub:fmtLoadTriplet(l)},
  {id:'ram',name:'RAM',value:pctMetric(n,'ram'),color:'#06b6d4',sub:fmtMemLine(n,l)},
  {id:'disk',name:'Disk',value:pctMetric(n,'disk'),color:'#f59e0b',sub:fmtDiskLine(n,l)}
 ];
 state.gaugeValues=state.gaugeValues||{};
 state.gaugeRafs=state.gaugeRafs||{};
 const currentKey=defs.map(d=>d.id).join('|');
 if(host.dataset.gaugeKey!==currentKey){host.innerHTML=defs.map(d=>gaugeHtml({...d,display:state.gaugeValues[d.id]??d.value})).join('');host.dataset.gaugeKey=currentKey}
 defs.forEach(d=>updateGaugeCard(d));
 const up=$('#liveUpdated'); if(up) up.textContent=(state.wsOk?'Live':'Fallback')+' · '+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
}
function clampPct(v){v=Number(v); if(!isFinite(v))v=0; return Math.max(0,Math.min(100,v));}
function gaugeOffset(v){const r=42,c=2*Math.PI*r;return {c,off:c*(1-clampPct(v)/100)}}
function easeOutCubic(t){return 1-Math.pow(1-t,3)}
function updateGaugeCard(d){
 const card=$(`.gauge-card[data-load-metric="${d.id}"]`); if(!card)return;
 card.style.setProperty('--g',d.color); card.title=state.lang==='zh-CN'?'点击查看历史趋势':'Click to view history trend';
 const meta=card.querySelector('.gauge-meta'); if(meta)meta.textContent=d.sub||'';
 const fg=card.querySelector('.gauge-fg'); const strong=card.querySelector('.gauge-center strong');
 const target=clampPct(d.value); const start=state.gaugeValues[d.id]==null?target:clampPct(state.gaugeValues[d.id]);
 if(state.gaugeRafs[d.id])cancelAnimationFrame(state.gaugeRafs[d.id]);
 const dur=start===target?0:780; const t0=performance.now();
 function paint(v){const g=gaugeOffset(v); if(fg){fg.setAttribute('stroke-dasharray',g.c.toFixed(1));fg.setAttribute('stroke-dashoffset',g.off.toFixed(1))} if(strong)strong.textContent=Math.round(v)+'%'}
 if(!dur){paint(target);state.gaugeValues[d.id]=target;return}
 function step(now){const p=Math.min(1,(now-t0)/dur),v=start+(target-start)*easeOutCubic(p); paint(v); if(p<1){state.gaugeRafs[d.id]=requestAnimationFrame(step)}else{state.gaugeValues[d.id]=target;}}
 state.gaugeRafs[d.id]=requestAnimationFrame(step);
}
function gaugeHtml(d){const v=clampPct(d.display??d.value); const g=gaugeOffset(v); const hint=state.lang==='zh-CN'?'查看历史':'History'; const fullHint=state.lang==='zh-CN'?'点击查看历史趋势':'Click to view history trend'; const icon='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 13.5 7.2 10.3 9.4 12.5 14 7.9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.9 7.9h2.6v2.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'; return `<div class="gauge-card gauge-clickable" data-load-metric="${esc(d.id)}" style="--g:${d.color}" title="${esc(fullHint)}"><svg class="gauge" viewBox="0 0 120 120" aria-label="${esc(d.name)} ${v.toFixed(0)}%"><circle class="gauge-bg" cx="60" cy="60" r="42"></circle><circle class="gauge-fg" cx="60" cy="60" r="42" stroke-dasharray="${g.c.toFixed(1)}" stroke-dashoffset="${g.off.toFixed(1)}"></circle></svg><div class="gauge-center"><strong>${v.toFixed(0)}%</strong><span>${esc(d.name)}</span></div><div class="gauge-meta">${esc(d.sub||'')}</div><div class="gauge-action" aria-hidden="true"><span class="gauge-action-icon">${icon}</span></div></div>`}
function fmtLoadTriplet(l){const a=[l.load1,l.load5,l.load15].filter(x=>x!=null).map(x=>Number(x).toFixed(2)); return a.length?'Load '+a.join(' / '):'Current usage'}
function fmtMemLine(n,l){const used=Number(val(l,['memory.used','mem_used','ram_used','memory_used'])||val(n,['memory.used','mem_used','ram_used','memory_used'])||0); const total=Number(val(l,['memory.total','mem_total','ram_total','memory_total'])||val(n,['memory.total','mem_total','ram_total','memory_total'])||0); return used&&total?fmtBytes(used)+' / '+fmtBytes(total):'Memory usage'}
function fmtDiskLine(n,l){const used=Number(val(l,['disk.used','disk_used','storage_used'])||val(n,['disk.used','disk_used','storage_used'])||0); const total=Number(val(l,['disk.total','disk_total','storage_total'])||val(n,['disk.total','disk_total','storage_total'])||0); return used&&total?fmtBytes(used)+' / '+fmtBytes(total):'Disk usage'}


function normalizeHistoryHours(h){h=Number(h)||6; return [1,6,24].includes(h)?h:6}
function sortedPoints(records,hours,fn){
 const len=records.length||1;
 return records.map((r,i)=>[chartTime(r,i,len,hours),fn(r)]).filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1])).sort((a,b)=>a[0]-b[0]);
}
function loadMetricDef(metric,records,hours){
 hours=normalizeHistoryHours(hours);
 const defs={
  cpu:{id:'cpu',name:'CPU',color:'#2563eb',data:sortedPoints(records,hours,r=>recPct(r,['cpu','cpu_usage','cpu_percent','cpu_percent_used']))},
  ram:{id:'ram',name:'RAM',color:'#06b6d4',data:sortedPoints(records,hours,r=>recPct(r,['ram','mem','memory','memory_used','ram_used','mem_used'],['ram_total','mem_total','memory_total']))},
  disk:{id:'disk',name:'Disk',color:'#f59e0b',data:sortedPoints(records,hours,r=>recPct(r,['disk','disk_used','storage','storage_used'],['disk_total','storage_total']))}
 };
 return defs[metric]||defs.cpu;
}
function metricLabel(metric){return ({cpu:'CPU',ram:'RAM',disk:'Disk'}[metric]||'CPU')}
function openLoadHistory(metric){
 if(!state.activeNode)return;
 state.loadModalMetric=metric||'cpu';
 state.loadModalHours=normalizeHistoryHours(state.loadModalHours||state.loadHours||6);
 const modal=$('#loadHistoryModal'); if(!modal)return;
 modal.classList.add('active'); modal.setAttribute('aria-hidden','false');
 const sm=$('#loadModalSmooth'); if(sm)sm.checked=state.smoothLoad;
 clearLoadModalChart(state.lang==='zh-CN'?'正在加载…':'Loading…');
 loadMetricHistoryChart();
}
function closeLoadHistory(){const modal=$('#loadHistoryModal'); if(!modal)return; modal.classList.remove('active'); modal.setAttribute('aria-hidden','true')}
async function loadMetricHistoryChart(){
 const n=state.activeNode; if(!n)return;
 const metric=state.loadModalMetric||'cpu', hours=normalizeHistoryHours(state.loadModalHours||6); state.loadModalHours=hours;
 setRangeActive('#loadModalRange',hours);
 const title=metricLabel(metric);
 const modalTitle=$('#loadModalTitle'), sub=$('#loadModalSub'), kicker=$('#loadModalKicker');
 if(kicker)kicker.textContent=state.lang==='zh-CN'?'历史负载':'Load History';
 if(modalTitle)modalTitle.textContent=title;
 if(sub)sub.textContent=`${getName(n)} · ${hours}h`;
 try{
  const data=await api(`/api/records/load?uuid=${encodeURIComponent(getNodeId(n))}&hours=${encodeURIComponent(hours)}`);
  const records=arrFrom(data,'records');
  const series=loadMetricDef(metric,records,hours);
  drawChart($('#loadModalCanvas'),[series],{unit:'%',max:100,smooth:state.smoothLoad,hours});
 }catch(e){console.warn('load metric history failed',e);drawChart($('#loadModalCanvas'),[],{unit:'%',max:100,hours})}
}

async function loadCharts(n){renderLoadGauges(n);state._pingInit='';state.pingVisible=new Set();clearPingChart();await loadPingChart(n)}
function pingValue(r){const raw=val(r,['value','latency','ping','rtt','ms']); if(raw==null||raw==='')return NaN; const num=Number(raw); return isFinite(num)&&num>0?num:NaN}
function chartTime(r,i,len,hours){const t=val(r,['time','created_at','createdAt','timestamp','ts','date']); if(t){if(typeof t==='number')return t<1e12?t*1000:t; const d=Date.parse(t); if(isFinite(d))return d} return Date.now()-(len-1-i)*(hours*3600*1000/Math.max(1,len-1))}
function recPct(r,keys,totalKeys){let used=val(r,keys); let total=totalKeys?val(r,totalKeys):undefined; if(total&&Number(used)>100)return pct(Number(used)/Number(total)); return pct(used)}
async function loadLoadChart(n){try{setRangeActive('#loadRange',state.loadHours); let data=await api(`/api/records/load?uuid=${encodeURIComponent(getNodeId(n))}&hours=${encodeURIComponent(state.loadHours)}`); let records=arrFrom(data,'records'); const len=records.length||1; const defs=[loadMetricDef('cpu',records,state.loadHours),loadMetricDef('ram',records,state.loadHours),loadMetricDef('disk',records,state.loadHours)]; $('#loadChips').innerHTML=defs.map(d=>`<button class="chip ${state.loadVisible.has(d.id)?'':'off'}" data-load="${d.id}" style="--c:${d.color}"><span class="swatch"></span>${d.name}</button>`).join(''); state.charts.loadSeries=defs; $$('#loadChips [data-load]').forEach(b=>b.onclick=()=>{state.loadVisible.has(b.dataset.load)?state.loadVisible.delete(b.dataset.load):state.loadVisible.add(b.dataset.load); renderLoadChipsAndChart(n)}); drawChart($('#loadCanvas'),defs.filter(d=>state.loadVisible.has(d.id)),{unit:'%',max:100,smooth:state.smoothLoad,hours:state.loadHours})}catch(e){console.warn('load chart failed',e);drawChart($('#loadCanvas'),[],{unit:'%',max:100,hours:state.loadHours})}}
async function loadPingChart(n){
 const nodeKey=getNodeId(n); const token=++state._pingToken;
 try{
  setRangeActive('#pingRange',state.pingHours);
  clearPingChart();
  clearCanvasChart('#pingCanvas',state.lang==='zh-CN'?'正在加载…':'Loading…');
  let data=await api(`/api/records/ping?uuid=${encodeURIComponent(nodeKey)}&hours=${encodeURIComponent(state.pingHours)}`);
  if(token!==state._pingToken || !state.activeNode || getNodeId(state.activeNode)!==nodeKey)return;
  const records=arrFrom(data,'records'); const tasks=arrFrom(data,'tasks');
  if(!tasks.length){const ids=[...new Set(records.map(r=>r.task_id).filter(x=>x!=null))]; ids.forEach(id=>tasks.push({id,name:'Task '+id}))}
  if(!tasks.length&&!records.length){clearPingChart(); return;}
  if(state._pingInit!==nodeKey){state.pingVisible=new Set(tasks.map(t=>String(t.id)));state._pingInit=nodeKey}
  const palette=['#2563eb','#06b6d4','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#64748b','#84cc16','#0ea5e9','#a855f7'];
  $('#pingChips').innerHTML=tasks.map((t,i)=>`<button class="chip ${state.pingVisible.has(String(t.id))?'':'off'}" data-task="${esc(t.id)}" style="--c:${palette[i%palette.length]}"><span class="swatch"></span>${esc(t.name||('Task '+t.id))}</button>`).join('');
  const colorMap=new Map(tasks.map((t,i)=>[String(t.id),palette[i%palette.length]]));
  const allSeries=tasks.map((t)=>{const rows=records.filter(r=>String(r.task_id)===String(t.id)); const len=rows.length||1; return {id:String(t.id),name:t.name||('Task '+t.id),color:colorMap.get(String(t.id)),data:rows.map((r,j)=>[chartTime(r,j,len,state.pingHours),pingValue(r)]).filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1])).sort((a,b)=>a[0]-b[0])}});
  state.charts.pingSeries=allSeries; state.charts.pingTasks=tasks; state.charts.pingPalette=palette;
  $$('#pingChips [data-task]').forEach(b=>b.onclick=()=>{state.pingVisible.has(String(b.dataset.task))?state.pingVisible.delete(String(b.dataset.task)):state.pingVisible.add(String(b.dataset.task)); renderPingChipsAndChart()});
  drawChart($('#pingCanvas'),allSeries.filter(s=>state.pingVisible.has(String(s.id))),{unit:'ms',smooth:state.smoothPing,hours:state.pingHours})
 }catch(e){if(token!==state._pingToken)return; console.warn('ping chart failed',e);clearPingChart()}
}
function renderLoadChipsAndChart(n){const defs=state.charts.loadSeries||[]; $$('#loadChips [data-load]').forEach(b=>b.classList.toggle('off',!state.loadVisible.has(b.dataset.load))); drawChart($('#loadCanvas'),defs.filter(d=>state.loadVisible.has(d.id)),{unit:'%',max:100,smooth:state.smoothLoad,hours:state.loadHours})}
function renderPingChipsAndChart(){const series=state.charts.pingSeries||[]; $$('#pingChips [data-task]').forEach(b=>b.classList.toggle('off',!state.pingVisible.has(String(b.dataset.task)))); drawChart($('#pingCanvas'),series.filter(s=>state.pingVisible.has(String(s.id))),{unit:'ms',smooth:state.smoothPing,hours:state.pingHours})}

function setRangeActive(sel,h){$$(sel+' button').forEach(b=>b.classList.toggle('active',Number(b.dataset.hours)===Number(h)))}
function drawChart(canvas,series,opt={}){const dpr=window.devicePixelRatio||1; const rect=canvas.getBoundingClientRect(); const w=Math.max(320,rect.width),h=Math.max(220,rect.height); canvas.width=w*dpr; canvas.height=h*dpr; const ctx=canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h); const pad={l:54,r:18,t:22,b:38}; const plotW=w-pad.l-pad.r, plotH=h-pad.t-pad.b; ctx.font='12px Inter,system-ui,sans-serif'; ctx.strokeStyle='rgba(148,163,184,.24)'; ctx.fillStyle='#667085'; ctx.lineWidth=1; let all=series.flatMap(s=>s.data.map(p=>p[1]).filter(Number.isFinite)); let max=opt.max||Math.max(10,...all); if(opt.unit!=='%'&&!opt.max)max=Math.ceil(max*1.18/10)*10; if(!isFinite(max)||max<=0)max=opt.unit==='%'?100:10; const now=Date.now(); const x1=now, x0=now-(opt.hours||6)*3600e3; function X(t){return pad.l+(t-x0)/(x1-x0)*plotW} function Y(v){return pad.t+plotH-(v/max)*plotH} for(let i=0;i<=4;i++){const y=pad.t+plotH*i/4; ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke(); const val=max*(1-i/4); ctx.fillText(opt.unit==='%'?Math.round(val)+'%':Math.round(val)+'ms',8,y+4)} for(let i=0;i<=3;i++){const t=x0+(x1-x0)*i/3, x=X(t); ctx.fillText(formatTime(t),Math.min(x,w-64),h-12)} if(!series.length){ctx.fillStyle='#94a3b8';ctx.fillText(tr('noData'),w/2-28,h/2);return} const states=[]; series.forEach(s=>{const pts=s.data.filter(p=>isFinite(p[0])&&isFinite(p[1])&&p[0]>=x0&&p[0]<=x1).map(p=>({x:X(p[0]),y:Y(p[1]),t:p[0],v:p[1]})); states.push({s,pts}); if(pts.length<2)return; ctx.strokeStyle=s.color;ctx.lineWidth=2.4;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath(); if(opt.smooth){ctx.moveTo(pts[0].x,pts[0].y); for(let i=1;i<pts.length-1;i++){const mx=(pts[i].x+pts[i+1].x)/2,my=(pts[i].y+pts[i+1].y)/2;ctx.quadraticCurveTo(pts[i].x,pts[i].y,mx,my)}; const last=pts[pts.length-1];ctx.lineTo(last.x,last.y)} else {pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y))} ctx.stroke(); if(!opt.smooth){ctx.fillStyle=s.color; const step=Math.max(1,Math.ceil(pts.length/90)); pts.forEach((p,i)=>{if(i%step)return;ctx.beginPath();ctx.arc(p.x,p.y,1.8,0,Math.PI*2);ctx.fill()})}}); canvas._chart={states,pad,plotW,plotH,opt,x0,x1,max}; bindChartTooltip(canvas)}
function nearestIdx(pts,x){let bi=0,bd=Infinity; pts.forEach((p,i)=>{const d=Math.abs(p.x-x); if(d<bd){bd=d;bi=i}}); return bi}
function bindChartTooltip(canvas){if(canvas._bound)return; canvas._bound=true; const tip=canvas.parentElement.querySelector('.chart-tooltip'); canvas.addEventListener('mousemove',e=>{const st=canvas._chart;if(!st||!st.states.length)return; const r=canvas.getBoundingClientRect(); const x=e.clientX-r.left; const primary=st.states.find(s=>s.pts.length); if(!primary)return; const idx=nearestIdx(primary.pts,x), p0=primary.pts[idx]; drawChart(canvas,st.states.map(x=>x.s),st.opt); const ctx=canvas.getContext('2d'),dpr=window.devicePixelRatio||1; ctx.setTransform(dpr,0,0,dpr,0,0); ctx.save();ctx.strokeStyle='rgba(15,23,42,.22)';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(p0.x,st.pad.t);ctx.lineTo(p0.x,canvas.getBoundingClientRect().height-st.pad.b);ctx.stroke();ctx.setLineDash([]); st.states.forEach(({s,pts})=>{if(!pts.length)return; const p=pts[nearestIdx(pts,p0.x)]; ctx.fillStyle='#fff';ctx.strokeStyle=s.color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fill();ctx.stroke()});ctx.restore(); const rows=st.states.map(({s,pts})=>{if(!pts.length)return ''; const p=pts[nearestIdx(pts,p0.x)]; return `<div><span><i style="--c:${s.color}"></i>${esc(s.name)}</span><b>${p.v.toFixed(st.opt.unit==='%'?1:1)}${st.opt.unit}</b></div>`}).join(''); tip.innerHTML=`<strong>${formatDateTime(p0.t)}</strong>${rows}`; tip.style.display='block'; tip.style.left=Math.min(r.width-230,Math.max(8,p0.x+12))+'px'; tip.style.top='12px'}); canvas.addEventListener('mouseleave',()=>{tip.style.display='none'; const st=canvas._chart;if(st)drawChart(canvas,st.states.map(x=>x.s),st.opt)})}
function formatTime(t){return new Date(t).toLocaleTimeString(state.lang,{hour:'2-digit',minute:'2-digit'})}
function formatDateTime(t){return new Date(t).toLocaleString(state.lang,{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}
function connectWs(){try{const proto=location.protocol==='https:'?'wss':'ws'; const ws=new WebSocket(`${proto}://${location.host}/api/clients`); state.ws=ws; let tick=null; const ask=()=>{try{if(ws.readyState===1)ws.send('get')}catch(e){}}; ws.onopen=()=>{state.wsOk=true; ask(); tick=setInterval(ask,3000); render()}; ws.onmessage=e=>{try{const msg=JSON.parse(e.data); const d=(msg&&msg.data&&msg.online===undefined)?msg.data:msg; const onlineList=(d&&d.online)||(d&&d.data&&d.data.online)||[]; const online=new Set(Array.isArray(onlineList)?onlineList.map(String):[]); let payload=(d&&d.data&&typeof d.data==='object'&&!Array.isArray(d.data))?d.data:d; if(payload&&payload.data&&typeof payload.data==='object'&&!Array.isArray(payload.data))payload=payload.data; Object.entries(payload||{}).forEach(([uuid,val])=>{if(['online','data','message','status','code'].includes(uuid))return; if(!val||typeof val!=='object')return; state.live[String(uuid)]={...val,__online:online.size?online.has(String(uuid)):true}}); render()}catch(err){}}; ws.onclose=()=>{if(tick)clearInterval(tick);state.wsOk=false;render();setTimeout(connectWs,5000)}; ws.onerror=()=>{state.wsOk=false;try{ws.close()}catch(e){}}}catch(e){state.wsOk=false}}
async function pollRecent(){if(state.wsOk)return; await Promise.all(state.nodes.map(async n=>{try{const id=getNodeId(n); const recent=await api('/api/recent/'+encodeURIComponent(id)); const arr=Array.isArray(recent)?recent:unwrap(recent); if(arr.length)state.live[id]={...arr[arr.length-1],__online:true}}catch(e){}})); render()}
async function loadWorldGeo(){
 const urls=['assets/world.geo.json','./assets/world.geo.json','/themes/SoraGlassV40/dist/assets/world.geo.json','/themes/SoraGlassV38/dist/assets/world.geo.json'];
 for(const u of urls){try{const data=await api(u); if(data&&Array.isArray(data.features)&&data.features.length){console.log('world map loaded',u,data.features.length); return data}}catch(e){}}
 console.warn('world map failed to load'); return {features:[]}
}
async function bootstrap(){const publicSettings=await loadPublicSettings(); setupSettings(publicSettings); try{state.world=await loadWorldGeo()}catch(e){console.warn('world map load failed',e);state.world={features:[]}} try{state.nodes=unwrap(await api('/api/nodes'))}catch(e){console.warn('nodes load failed',e);state.nodes=[]} render(); setAppReady(); connectWs(); pollRecent(); setInterval(pollRecent,10000)}
function bindUI(){ $$('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view)); $$('.lang button').forEach(b=>b.onclick=()=>{localStorage.setItem('i18nextLng',b.dataset.lang);state.settings.language=b.dataset.lang;applyLang();render()}); $('#searchInput').oninput=e=>{state.query=e.target.value;render()}; const groupSelect=$('#groupSelect'); if(groupSelect)groupSelect.onchange=e=>{state.group=e.target.value;localStorage.setItem('nodeSelectedGroup',state.group);render()}; const groupButton=$('#groupButton'); const groupPicker=$('#groupPicker'); if(groupButton&&groupPicker){ groupButton.onclick=e=>{e.stopPropagation(); groupPicker.classList.toggle('open')}; document.addEventListener('click',e=>{const opt=e.target.closest('.group-option'); if(opt){state.group=opt.dataset.group||'';localStorage.setItem('nodeSelectedGroup',state.group);groupPicker.classList.remove('open');render();return} if(!e.target.closest('#groupPicker'))groupPicker.classList.remove('open')}); } const adminBtn=$('#adminBtn'); if(adminBtn) adminBtn.onclick=()=>{ location.href='/admin'; };  $('#backBtn').onclick=()=>{location.hash='#/'}; $('#reloadCharts').onclick=()=>state.activeNode&&loadCharts(state.activeNode); $$('.side-tab-btn').forEach(b=>b.onclick=()=>setDetailTab(b.dataset.sideTab)); const sideBody=$('#sideTabsBody'); if(sideBody){ sideBody.onmouseenter=()=>clearInterval(state.sideTabTimer); sideBody.onmouseleave=()=>restartDetailTabAuto(); } document.addEventListener('click',e=>{const rb=e.target.closest('#loadModalRange button'); if(rb){ e.preventDefault(); state.loadModalHours=normalizeHistoryHours(rb.dataset.hours); localStorage.setItem('soraLoadModalHours',state.loadModalHours); setRangeActive('#loadModalRange',state.loadModalHours); loadMetricHistoryChart(); return; } const g=e.target.closest('[data-load-metric]'); if(g)openLoadHistory(g.dataset.loadMetric); if(e.target.closest('[data-load-close]'))closeLoadHistory()}); $$('#loadModalRange button').forEach(b=>b.onclick=()=>{state.loadModalHours=normalizeHistoryHours(b.dataset.hours);localStorage.setItem('soraLoadModalHours',state.loadModalHours);setRangeActive('#loadModalRange',state.loadModalHours);loadMetricHistoryChart()}); const loadSm=$('#loadModalSmooth'); if(loadSm)loadSm.onchange=e=>{state.smoothLoad=e.target.checked;localStorage.setItem('soraSmoothLoad',state.smoothLoad);loadMetricHistoryChart()}; if($('#loadRange')) $$('#loadRange button').forEach(b=>b.onclick=()=>{state.loadHours=Number(b.dataset.hours);localStorage.setItem('soraLoadHours',state.loadHours);state.activeNode&&loadLoadChart(state.activeNode)}); $$('#pingRange button').forEach(b=>b.onclick=()=>{state.pingHours=Number(b.dataset.hours);localStorage.setItem('soraPingHours',state.pingHours);state.activeNode&&loadPingChart(state.activeNode)}); if($('#smoothLoad')) $('#smoothLoad').onchange=e=>{state.smoothLoad=e.target.checked;localStorage.setItem('soraSmoothLoad',state.smoothLoad);(state.charts.loadSeries?renderLoadChipsAndChart(state.activeNode):state.activeNode&&loadLoadChart(state.activeNode))}; $('#smoothPing').onchange=e=>{state.smoothPing=e.target.checked;localStorage.setItem('soraSmoothPing',state.smoothPing);(state.charts.pingSeries?renderPingChipsAndChart():state.activeNode&&loadPingChart(state.activeNode))}; window.addEventListener('resize',()=>{renderMap(); if(state.activeNode)loadCharts(state.activeNode); if($('#loadHistoryModal')?.classList.contains('active'))loadMetricHistoryChart()}); window.addEventListener('hashchange',route)}
console.info('SoraGlass v1.0.0 loaded'); window.SORA_DEBUG=state; bindUI(); bootstrap().then(route);
