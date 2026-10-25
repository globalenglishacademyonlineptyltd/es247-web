(function(){
  var KEY='es247:selectedCompanyId';
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]||c;});}
  function fmt(v){if(!v)return '—';try{return new Intl.DateTimeFormat('en-ZA',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v));}catch(e){return String(v);}}
  function selected(){try{return sessionStorage.getItem(KEY)||'';}catch(e){return ''}}
  function selectCompany(id){try{sessionStorage.setItem(KEY,String(id));}catch(e){}}
  function clearCompany(){try{sessionStorage.removeItem(KEY);}catch(e){}}
  async function me(){var r=await fetch('/api/me',{credentials:'same-origin',cache:'no-store'});var d=await r.json();if(!r.ok)throw new Error(d.error||'Session unavailable.');return d.user;}
  async function api(url,options){options=options||{};var headers=Object.assign({'Content-Type':'application/json'},options.headers||{});var id=selected();if(id)headers['x-company-context']=id;var r=await fetch(url,Object.assign({},options,{credentials:'same-origin',headers:headers,cache:'no-store'}));var d=await r.json().catch(function(){return {error:'Unexpected server response.'};});if(!r.ok)throw new Error(d.error||'Request failed.');return d;}
  function host(){return document.querySelector('#content');}
  function title(s){var el=document.querySelector('#page-title');if(el)el.textContent=s;}
  function activeNav(page){document.querySelectorAll('#nav [data-page]').forEach(function(b){b.classList.toggle('active',b.dataset.page===page);});}
  function safeName(c){return String(c&&c.full_name||c&&c.name||'Unnamed client').trim()||'Unnamed client';}
  async function renderCompanies(){
    var h=host();if(!h)return;title('View Companies');activeNav('company-dashboards');h.innerHTML='<div class="card"><h2>View Companies</h2><p class="muted">Loading companies…</p></div>';
    try{
      clearCompany();
      var d=await api('/api/dashboard');var companies=Array.isArray(d.companies)?d.companies:[];
      h.innerHTML='<div class="card"><div class="section-head"><div><p class="eyebrow">MASTER ADMIN</p><h2>View Companies</h2><p class="muted">Select a company to view its details and client records.</p></div></div><div class="search-row"><input id="safe-company-search" placeholder="Search companies or coverage areas…" aria-label="Search companies"></div><div class="table-wrap"><table id="safe-company-table"><thead><tr><th>Company name</th><th>Coverage areas</th><th>Clients</th><th>Action</th></tr></thead><tbody>'+ (companies.length?companies.map(function(c){return '<tr><td><strong>'+esc(c.registered_name||'Unnamed company')+'</strong></td><td>'+esc(c.covering_areas||'—')+'</td><td>'+Number(c.total_clients||0)+'</td><td><button class="btn primary small" data-safe-company="'+esc(c.id)+'">View Company</button></td></tr>';}).join(''):'<tr><td colspan="4" class="empty">No active companies found.</td></tr>')+'</tbody></table></div></div>';
      var s=document.querySelector('#safe-company-search');if(s)s.oninput=function(){var q=s.value.toLowerCase().trim();h.querySelectorAll('#safe-company-table tbody tr').forEach(function(tr){tr.hidden=!!q&&!tr.textContent.toLowerCase().includes(q);});};
      h.querySelectorAll('[data-safe-company]').forEach(function(b){b.onclick=function(){selectCompany(b.dataset.safeCompany);renderCompany();};});
    }catch(e){h.innerHTML='<div class="card"><h2>View Companies</h2><p class="notice">'+esc(e.message||'Unable to load companies.')+'</p><button class="btn outline" id="safe-company-retry">Try Again</button></div>';document.querySelector('#safe-company-retry').onclick=renderCompanies;}
  }
  async function renderCompany(){
    var id=selected(),h=host();if(!h)return;if(!id)return renderCompanies();title('Company Details');activeNav('company-dashboards');h.innerHTML='<div class="card"><h2>Loading company…</h2></div>';
    try{
      var d=await api('/api/dashboard');var c=d.company;if(!c&&Array.isArray(d.companies))c=d.companies.find(function(x){return String(x.id)===String(id);});
      if(!c)throw new Error('Company not found.');
      var role=d.role||'';
      h.innerHTML='<div class="card"><div class="section-head"><div><p class="eyebrow">COMPANY DETAILS</p><h2>'+esc(c.registered_name||'Company')+'</h2></div><button class="btn outline small" id="safe-back-companies">← View Companies</button></div><div class="stats"><div class="stat"><small>TOTAL CLIENTS</small><strong>'+Number(c.total_clients||d.counts?.clients||0)+'</strong></div><div class="stat"><small>CLIENTS ON PAUSE</small><strong>'+Number(c.paused_clients||d.counts?.paused_clients||0)+'</strong></div><div class="stat"><small>COVERAGE AREAS</small><strong style="font-size:17px">'+esc(c.covering_areas||'—')+'</strong></div></div><div class="detail-grid"><div><small>Company name</small><p>'+esc(c.registered_name||'—')+'</p></div><div><small>CIPC number</small><p>'+esc(c.cipc_number||'—')+'</p></div><div><small>PSIRA number</small><p>'+esc(c.psira_number||'—')+'</p></div><div><small>Contact number</small><p>'+esc(c.contact_number||'—')+'</p></div><div><small>Email</small><p>'+esc(c.contact_email||'—')+'</p></div><div><small>Tax number</small><p>'+esc(c.tax_number||'—')+'</p></div></div>'+(role==='master_admin_2'?'<div class="action-row"><button class="btn primary" id="safe-view-clients">View Clients</button><button class="btn outline" id="safe-archived-clients">Archived Clients</button><button class="btn outline" id="safe-add-client">+ Add Client</button></div>':'')+'</div>';
      document.querySelector('#safe-back-companies').onclick=function(){clearCompany();renderCompanies();};
      document.querySelector('#safe-view-clients')?.addEventListener('click',function(){renderClients(false);});
      document.querySelector('#safe-archived-clients')?.addEventListener('click',function(){renderClients(true);});
      document.querySelector('#safe-add-client')?.addEventListener('click',function(){if(typeof window.navigate==='function')window.navigate('add-client');});
    }catch(e){h.innerHTML='<div class="card"><h2>Company Details</h2><p class="notice">'+esc(e.message||'Unable to load this company.')+'</p><button class="btn outline" id="safe-company-detail-retry">Try Again</button></div>';document.querySelector('#safe-company-detail-retry').onclick=renderCompany;}
  }
  async function renderClients(archived){
    var h=host();if(!h)return;var isM2=false;try{var u=await me();isM2=u&&u.role==='master_admin_2';}catch(e){}
    if(!selected()&&isM2)return renderCompanies();
    title(archived?'Archived Clients':'View Clients');activeNav(archived?'archived-clients':'active-clients');h.innerHTML='<div class="card"><h2>'+(archived?'Archived Clients':'View Clients')+'</h2><p class="muted">Loading client records…</p></div>';
    try{
      var d=await api(archived?'/api/company/clients/archived':'/api/company/clients');var rows=Array.isArray(d&&d.clients)?d.clients:[];rows=rows.filter(function(c){return c&&typeof c==='object';});if(!archived)rows=rows.filter(function(c){return !c.archived_at;});
      rows.sort(function(a,b){return safeName(a).localeCompare(safeName(b),undefined,{sensitivity:'base'});});
      h.innerHTML='<div class="card"><div class="section-head"><div><p class="eyebrow">CLIENTS</p><h2>'+(archived?'Archived Clients':'View Clients')+'</h2><p class="muted">'+rows.length+' '+(archived?'archived':'active')+' client'+(rows.length===1?'':'s')+'</p></div><button class="btn outline small" id="safe-back-company">← Back to Company</button></div><div class="search-row"><input id="safe-client-search" placeholder="Search clients by name, email, phone or address…" aria-label="Search clients"></div><div class="table-wrap"><table id="safe-client-table"><thead><tr><th>Client</th><th>Email</th><th>Contact number</th><th>Address</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+ (rows.length?rows.map(function(c){var actions='';if(archived){actions=isM2?'<button class="btn primary small" data-safe-restore="'+esc(c.id)+'">Restore</button> <button class="btn danger small" data-safe-permanent="'+esc(c.id)+'">Permanently Delete</button>':'<span class="tiny">View only</span>';}else{actions='<button class="btn outline small" data-safe-edit="'+esc(c.id)+'">Edit Client</button>';if(isM2)actions+=' <button class="btn danger small" data-safe-archive="'+esc(c.id)+'">Delete / Archive</button>';}return '<tr><td><strong>'+esc(safeName(c))+'</strong></td><td>'+esc(c.email||'—')+'</td><td>'+esc(c.phone||c.contact_number||'—')+'</td><td>'+esc(c.address||c.physical_address||'—')+'</td><td>'+esc(archived?'Archived':(c.active===false?'Paused':'Active'))+'</td><td><div class="form-actions">'+actions+'</div></td></tr>';}).join(''):'<tr><td colspan="6" class="empty">No '+(archived?'archived':'active')+' clients found.</td></tr>')+'</tbody></table></div></div>';
      var back=document.querySelector('#safe-back-company');if(back)back.onclick=function(){renderCompany();};
      var search=document.querySelector('#safe-client-search');if(search)search.oninput=function(){var q=search.value.toLowerCase().trim();h.querySelectorAll('#safe-client-table tbody tr').forEach(function(tr){tr.hidden=!!q&&!tr.textContent.toLowerCase().includes(q);});};
      h.querySelectorAll('[data-safe-edit]').forEach(function(b){b.onclick=function(){if(typeof window.companyClientsWorkspace==='function')window.companyClientsWorkspace(b.dataset.safeEdit);};});
      h.querySelectorAll('[data-safe-restore]').forEach(function(b){b.onclick=async function(){if(!confirm('Restore this client and restore app access?'))return;try{await api('/api/master/clients/'+b.dataset.safeRestore+'/restore',{method:'POST'});renderClients(true);}catch(e){alert(e.message||'Unable to restore client.');}};});
      h.querySelectorAll('[data-safe-permanent]').forEach(function(b){b.onclick=async function(){if(!confirm('PERMANENTLY DELETE this archived client? This cannot be undone.'))return;if(!confirm('Final confirmation: permanently delete this client now?'))return;try{await api('/api/master/clients/'+b.dataset.safePermanent,{method:'DELETE'});renderClients(true);}catch(e){alert(e.message||'Unable to delete client.');}};});
      h.querySelectorAll('[data-safe-archive]').forEach(function(b){b.onclick=async function(){if(!confirm('Archive this client? They will move to Archived Clients.'))return;try{await api('/api/master/clients/'+b.dataset.safeArchive+'/archive',{method:'POST'});renderClients(false);}catch(e){alert(e.message||'Unable to archive client.');}};});
    }catch(e){h.innerHTML='<div class="card"><h2>'+(archived?'Archived Clients':'View Clients')+'</h2><p class="notice">'+esc(e.message||'Unable to load client records.')+'</p><button class="btn outline" id="safe-client-retry">Try Again</button></div>';document.querySelector('#safe-client-retry').onclick=function(){renderClients(archived);};}
  }
  function intercept(){
    if(window.__es247ClientPagesFix2)return;
    window.__es247ClientPagesFix2=true;
    document.addEventListener('click',function(e){
      var b=e.target.closest&&e.target.closest('[data-page],[data-open-company]');if(!b)return;
      var page=b.dataset.page;
      if(page==='company-dashboards'){e.preventDefault();e.stopImmediatePropagation();renderCompanies();return;}
      if(page==='active-clients'){e.preventDefault();e.stopImmediatePropagation();renderClients(false);return;}
      if(page==='archived-clients'){e.preventDefault();e.stopImmediatePropagation();renderClients(true);return;}
      if(b.dataset.openCompany){e.preventDefault();e.stopImmediatePropagation();selectCompany(b.dataset.openCompany);renderCompany();return;}
    },true);
    window.es247SafeCompanyPages={companies:renderCompanies,company:renderCompany,clients:renderClients};
  }
  var tries=0;var timer=setInterval(function(){if(document.querySelector('#nav')&&document.querySelector('#content')){intercept();clearInterval(timer);}else if(++tries>500)clearInterval(timer);},20);
})();
