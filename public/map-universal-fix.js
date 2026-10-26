(function(){
'use strict';
if(window.__ES247_UNIVERSAL_MAP_FIX__)return;
window.__ES247_UNIVERSAL_MAP_FIX__=true;
var instances=new WeakMap();
var standardUrl='https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
var satelliteUrl='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
var standardAttr='Street map © Esri, HERE, Garmin, USGS, NGA, EPA, NPS';
var satelliteAttr='Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community';
function num(v){var n=Number(v);return Number.isFinite(n)?n:null}
function coord(o){if(!o)return null;var a=num(o.latitude!=null?o.latitude:o.lat),b=num(o.longitude!=null?o.longitude:(o.lng!=null?o.lng:o.lon));return a!==null&&b!==null&&a>=-90&&a<=90&&b>=-180&&b<=180?[a,b]:null}
function clear(el){var old=instances.get(el);if(old){try{old.remove()}catch(e){}instances.delete(el)}el.innerHTML=''}
function mapFor(el,center,zoom){clear(el);el.style.position='relative';var m=L.map(el,{zoomControl:true,attributionControl:true,preferCanvas:true,worldCopyJump:true}).setView(center,zoom);var s=L.tileLayer(standardUrl,{maxZoom:19,attribution:standardAttr,crossOrigin:true}).addTo(m),i=L.tileLayer(satelliteUrl,{maxZoom:19,attribution:satelliteAttr,crossOrigin:true});var box=document.createElement('div');box.style.cssText='position:absolute;z-index:1100;right:12px;top:12px;display:flex;gap:6px';box.innerHTML='<button type="button" class="btn primary small">Standard</button><button type="button" class="btn outline small">Satellite</button>';el.appendChild(box);var bs=box.children[0],bi=box.children[1];function set(which){if(which==='satellite'){if(m.hasLayer(s))m.removeLayer(s);i.addTo(m);bs.className='btn outline small';bi.className='btn primary small'}else{if(m.hasLayer(i))m.removeLayer(i);s.addTo(m);bs.className='btn primary small';bi.className='btn outline small'}}bs.onclick=function(){set('standard')};bi.onclick=function(){set('satellite')};instances.set(el,m);setTimeout(function(){try{m.invalidateSize(true)}catch(e){}},100);setTimeout(function(){try{m.invalidateSize(true)}catch(e){}},600);return m}
function pin(m,p,title,text){var x=L.marker(p).addTo(m);if(title||text)x.bindPopup('<strong>'+window.esc(String(title||''))+'</strong>'+(text?'<br>'+window.esc(String(text)):''));return x}
function areas(v){return Array.isArray(v)?v:String(v||'').split(/[,;|]/).map(function(x){return x.trim()}).filter(Boolean)}
function geocode(m,name,title){if(typeof window.geocodeCoverageArea!=='function')return;window.geocodeCoverageArea(name).then(function(g){if(!g||g.lat==null||g.lon==null)return;var p=[Number(g.lat),Number(g.lon)];pin(m,p,title||name,name);L.circle(p,{radius:18000,weight:2,fillOpacity:.12}).addTo(m).bindTooltip(name)}).catch(function(){})}
function master(){var el=document.getElementById('master-map');if(!el||!window.L)return;var d=window.state&&window.state.data||{};var m=mapFor(el,[-29,24],5),b=[];(Array.isArray(d.companies)?d.companies:[]).forEach(function(c){var p=coord(c);if(p){pin(m,p,c.registered_name||'Company',c.covering_areas||'');b.push(p)}else areas(c.covering_areas).forEach(function(a){geocode(m,a,c.registered_name||'Company')})});if(b.length>1)m.fitBounds(b,{padding:[30,30],maxZoom:10})}
function incidents(){var el=document.getElementById('incident-map');if(!el||!window.L)return;var list=window.state&&Array.isArray(window.state.incidents)?window.state.incidents:[],pts=[];list.forEach(function(x){var p=coord(x);if(p)pts.push({x:x,p:p})});var m=mapFor(el,pts.length?pts[0].p:[-29,24],pts.length?10:5),b=[];pts.forEach(function(q){pin(m,q.p,q.x.client_name||'Client panic','GPS: '+q.p[0].toFixed(6)+', '+q.p[1].toFixed(6));b.push(q.p)});if(b.length>1)m.fitBounds(b,{padding:[30,30],maxZoom:15})}
function company(){var el=document.getElementById('company-coverage-map');if(!el||!window.L)return;var d=window.state&&window.state.data||{},c=d.company||{},p=coord(c),m=mapFor(el,p||[-29,24],p?10:5);if(p)pin(m,p,c.registered_name||'Company',c.covering_areas||'');areas(c.covering_areas).forEach(function(a){geocode(m,a,c.registered_name||'Company')})}
function refresh(){if(!window.L||!window.state||!window.state.user)return;try{master()}catch(e){}try{incidents()}catch(e){}try{company()}catch(e){}}
var n=0,t=setInterval(function(){if(window.L&&window.state){refresh();clearInterval(t)}else if(++n>600)clearInterval(t)},100);
window.addEventListener('load',function(){setTimeout(refresh,300);setTimeout(refresh,1200)});
window.addEventListener('es247:map-refresh',refresh);
})();
