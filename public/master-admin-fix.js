(()=>{
  const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
  const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const oldNavigate=window.navigate;
  const masterPages={dashboard:'Dashboard','add-company':'Add Company',archive:'Archived Companies'};
  function masterNav(){
    if(!window.state?.user || window.state.user.role!=='master_admin') return;
    const nav=q('#nav'); if(!nav)return;
    nav.innerHTML=[['dashboard','Dashboard'],['add-company','Add Company'],['archive','Archived Companies']].map(([id,label])=>`<button data-master-page="${id}" class="${window.state.page===id?'active':''}"><span>${label}</span></button>`).join('');
    qa('[data-master-page]').forEach(b=>b.onclick=()=>masterNavigate(b.dataset.masterPage));
  }
  async function masterNavigate(page){
    if(window.state?.user?.role!=='master_admin') return oldNavigate(page);
    window.state.page=page; masterNav();
    const title=q('#page-title'); if(title) title.textContent=masterPages[page]||'Dashboard';
    const host=q('#content'); if(!host)return;
    host.innerHTML='<div class="card">Loading secure workspace…</div>';
    try{
      if(page==='dashboard') return await masterDashboard(host);
      if(page==='add-company') return masterAddCompany(host);
      if(page==='archive') return await masterArchive(host);
    }catch(e){
      host.innerHTML=`<div class="card"><h2>Unable to load this page</h2><p class="notice">${escapeHtml(e.message)}</p><button class="btn outline" id="master-retry">Try again</button></div>`;
      const retry=q('#master-retry'); if(retry) retry.onclick=()=>masterNavigate(page);
    }
  }
  async function masterDashboard(host){
    const d=await window.api('/api/dashboard');
    const companies=Array.isArray(d.companies)?d.companies:[];
    host.innerHTML='<div class="card"><div class="section-head"><div><p class="eyebrow">MASTER ADMIN</p><h2>Operations Map</h2><p class="muted">Company locations and coverage overview.</p></div><div><button id="master-standard" class="btn primary small">Standard</button> <button id="master-satellite" class="btn outline small">Satellite</button></div></div><div id="master-map" class="map"></div><p class="tiny">Use Standard for the street map or Satellite for aerial imagery.</p></div>';
    const el=q('#master-map'); if(!el || typeof L==='undefined')return;
    if(window.state.map){try{window.state.map.remove();}catch{} window.state.map=null;}
    const map=L.map(el).setView([-29.0,24.0],5); window.state.map=map;
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
    q('#master-company-form').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget));const err=q('#master-company-error');err.textContent='';try{await window.api('/api/master/companies',{method:'POST',body:JSON.stringify(d)});window.toast('Company registered.');masterNavigate('dashboard');}catch(x){err.textContent=x.data?.details?.map(a=>a.field+': '+a.message).join(' · ')||x.message;}};
  }
  async function masterArchive(host){
    const d=await window.api('/api/dashboard');const archived=Array.isArray(d.archived)?d.archived:[];
    host.innerHTML='<div class="card"><h2>Archived Companies</h2><div class="table-wrap"><table><thead><tr><th>Company</th><th>Archived</th><th>Actions</th></tr></thead><tbody>'+(archived.length?archived.map(c=>`<tr><td>${escapeHtml(c.registered_name)}</td><td>${window.date(c.archived_at)}</td><td><button class="btn primary small" data-master-restore="${c.id}">Restore</button> <button class="btn danger small" data-master-delete="${c.id}">Delete if empty</button></td></tr>`).join(''):'<tr><td colspan="3" class="empty">No archived companies.</td></tr>')+'</tbody></table></div><p class="tiny">Archived companies are excluded from active totals. Historical records are retained.</p></div>';
    qa('[data-master-restore]').forEach(b=>b.onclick=async()=>{try{await window.api('/api/master/companies/'+b.dataset.masterRestore,{method:'PATCH',body:JSON.stringify({archived:false})});window.toast('Company restored.');masterNavigate('archive');}catch(e){window.toast(e.message,true);}});
    qa('[data-master-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('Permanently delete this archived company if it has no records?'))return;try{await window.api('/api/master/companies/'+b.dataset.masterDelete,{method:'DELETE'});window.toast('Company deleted.');masterNavigate('archive');}catch(e){window.toast(e.message,true);}});
  }
  window.renderNav=masterNav;
  window.navigate=masterNavigate;
})();
