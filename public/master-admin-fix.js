(()=>{
  const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
  const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const api=async(url,options={})=>{const r=await fetch(url,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});const d=await r.json().catch(()=>({error:'Unexpected server response.'}));if(!r.ok)throw new Error(d.error||'Request failed.');return d;};
  const toast=(s,bad=false)=>{const t=q('#toast');if(!t)return;t.textContent=s;t.style.borderColor=bad?'#ff6f79':'#2de0bf';t.classList.remove('hidden');setTimeout(()=>t.classList.add('hidden'),3800);};
  const masterPages={dashboard:'Dashboard','add-company':'Add Company',archive:'Archived Companies'};
  let active=false;
  function isMaster(){return q('#role-label')?.textContent?.trim().toLowerCase().replace(/\s+/g,'_')==='master_admin'||q('#role-label')?.textContent?.toLowerCase().includes('master admin');}
  function masterNav(page='dashboard'){
    const nav=q('#nav');if(!nav)return;
    const desired=[['dashboard','Dashboard'],['add-company','Add Company'],['archive','Archived Companies']];
    const current=[...nav.querySelectorAll('[data-master-page]')].map(b=>[b.dataset.masterPage,b.textContent.trim()]);
    if(JSON.stringify(current)!==JSON.stringify(desired)) nav.innerHTML=desired.map(([id,label])=>`<button data-master-page="${id}" class="${page===id?'active':''}"><span>${label}</span></button>`).join('');
    else [...nav.querySelectorAll('[data-master-page]')].forEach(b=>b.classList.toggle('active',b.dataset.masterPage===page));
    qa('[data-master-page]').forEach(b=>b.onclick=()=>masterNavigate(b.dataset.masterPage));
  }
  async function masterNavigate(page){
    if(!isMaster())return;
    active=true;
    const title=q('#page-title');if(title)title.textContent=masterPages[page]||'Dashboard';
    masterNav(page);
    const host=q('#content');if(!host)return;
    host.innerHTML='<div class="card">Loading secure workspace…</div>';
    try{
      if(page==='dashboard')return masterDashboard(host);
      if(page==='add-company')return masterAddCompany(host);
      if(page==='archive')return masterArchive(host);
    }catch(e){host.innerHTML=`<div class="card"><h2>Unable to load this page</h2><p class="notice">${escapeHtml(e.message)}</p><button class="btn outline" id="master-retry">Try again</button></div>`;q('#master-retry')?.addEventListener('click',()=>masterNavigate(page));}
  }
  async function masterDashboard(host){
    host.innerHTML='<div class="card"><div class="section-head"><div><p class="eyebrow">MASTER ADMIN</p><h2>Operations Map</h2><p class="muted">Company locations and coverage overview.</p></div><div><button id="master-standard" class="btn primary small">Standard</button> <button id="master-satellite" class="btn outline small">Satellite</button></div></div><div id="master-map" class="map"></div></div>';
    const d=await api('/api/dashboard');
    const companies=Array.isArray(d.companies)?d.companies:[];
    const el=q('#master-map');if(!el||typeof L==='undefined')throw new Error('Map library could not be loaded.');
    const map=L.map(el).setView([-29.0,24.0],5);
    const standard=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'});
    const satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles © Esri'});
    standard.addTo(map);
    const setLayer=(layer,on,off)=>{if(!map.hasLayer(layer))layer.addTo(map);if(map.hasLayer(off))map.removeLayer(off);on.classList.add('primary');on.classList.remove('outline');off.classList.remove('primary');off.classList.add('outline');setTimeout(()=>map.invalidateSize(),50);};
    q('#master-standard').onclick=()=>setLayer(standard,q('#master-standard'),q('#master-satellite'));
    q('#master-satellite').onclick=()=>setLayer(satellite,q('#master-satellite'),q('#master-standard'));
    const markers=companies.filter(c=>c.latitude!=null&&c.longitude!=null).map(c=>L.marker([Number(c.latitude),Number(c.longitude)]).addTo(map).bindPopup('<strong>'+escapeHtml(c.registered_name)+'</strong><br>'+escapeHtml(c.covering_areas||'')));
    if(markers.length)map.fitBounds(L.featureGroup(markers).getBounds().pad(.2));
    setTimeout(()=>map.invalidateSize(),100);
  }
  function masterAddCompany(host){
    host.innerHTML='<div class="card"><h2>Register a company</h2><p class="muted">Fields marked * are required.</p><form id="master-company-form" class="form-grid"><label>Registered Company Name *<input name="registered_name" required></label><label>CIPC Number *<input name="cipc_number" required></label><label>PSIRA Number *<input name="psira_number" required></label><label>B-BBEE (optional)<input name="bbbee_level"></label><label>Contact Number *<input name="contact_number" required></label><label>Contact Email *<input name="contact_email" type="email" required></label><label>Tax Number *<input name="tax_number" required></label><label>VAT Number (optional)<input name="vat_number"></label><label class="full">Covering Areas *<textarea name="covering_areas" required placeholder="Towns, suburbs and service regions"></textarea></label><div class="full form-actions"><button class="btn primary">Save company</button><button type="button" class="btn outline" id="master-company-cancel">Cancel</button></div><p class="notice full" id="master-company-error"></p></form></div>';
    q('#master-company-cancel').onclick=()=>masterNavigate('dashboard');
    q('#master-company-form').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget));const err=q('#master-company-error');try{await api('/api/master/companies',{method:'POST',body:JSON.stringify(d)});toast('Company registered.');masterNavigate('dashboard');}catch(x){err.textContent=x.message;}};
  }
  async function masterArchive(host){
    const d=await api('/api/dashboard');const archived=Array.isArray(d.archived)?d.archived:[];
    host.innerHTML='<div class="card"><h2>Archived Companies</h2><div class="table-wrap"><table><thead><tr><th>Company</th><th>Archived</th><th>Actions</th></tr></thead><tbody>'+(archived.length?archived.map(c=>`<tr><td>${escapeHtml(c.registered_name)}</td><td>${window.date(c.archived_at)}</td><td><button class="btn primary small" data-master-restore="${c.id}">Restore</button> <button class="btn danger small" data-master-delete="${c.id}">Delete if empty</button></td></tr>`).join(''):'<tr><td colspan="3" class="empty">No archived companies.</td></tr>')+'</tbody></table></div><p class="tiny">Archived companies are excluded from active totals. Historical records are retained.</p></div>';
    qa('[data-master-restore]').forEach(b=>b.onclick=async()=>{try{await api('/api/master/companies/'+b.dataset.masterRestore,{method:'PATCH',body:JSON.stringify({archived:false})});toast('Company restored.');masterNavigate('archive');}catch(e){toast(e.message,true);}});
    qa('[data-master-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('Permanently delete this archived company if it has no records?'))return;try{await api('/api/master/companies/'+b.dataset.masterDelete,{method:'DELETE'});toast('Company deleted.');masterNavigate('archive');}catch(e){toast(e.message,true);}});
  }
  function enforce(){if(!isMaster())return;const title=q('#page-title')?.textContent?.trim();if(!active||!['Dashboard','Add Company','Archived Companies'].includes(title)){active=true;masterNavigate('dashboard');return;}masterNav(title==='Add Company'?'add-company':title==='Archived Companies'?'archive':'dashboard');}
  const observer=new MutationObserver(()=>{if(isMaster())setTimeout(enforce,0);});
  observer.observe(document.body,{subtree:true,childList:true});
  setTimeout(enforce,250);
})();
