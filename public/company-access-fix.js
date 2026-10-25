(function(){
  function install(){
    try{
      if(typeof window.api==='function'&&!window.api.__companyAccessFix){
        const originalApi=window.api;
        const safeApi=async function(url,options={}){
          if(window.state?.user?.role==='controller'&&options.headers){
            const headers={...options.headers};
            delete headers['x-company-context'];
            delete headers['X-Company-Context'];
            options={...options,headers};
          }
          return originalApi(url,options);
        };
        safeApi.__companyAccessFix=true;
        window.api=safeApi;
      }

      if(typeof window.companyViewClientsPage==='function'&&!window.companyViewClientsPage.__companyAccessFix){
        window.companyViewClientsPage=async function(){
          const r=await api('/api/company/clients');
          const rawClients=Array.isArray(r?.clients)?r.clients:(Array.isArray(r)?r:[]);
          const clients=rawClients.filter(c=>c&&typeof c==='object'&&!c.archived_at);
          clients.sort((x,y)=>String(x.full_name||'').localeCompare(String(y.full_name||'')));
          $('#content').innerHTML='<div class="card"><div class="section-head"><div><h2>View Clients</h2><p class="muted">View and edit clients belonging to your company.</p></div></div><div class="stats"><div class="stat"><small>TOTAL CLIENTS (ACTIVE + PAUSED)</small><strong>'+clients.length+'</strong></div><div class="stat"><small>CLIENTS ON PAUSE</small><strong>'+clients.filter(c=>!c.active).length+'</strong></div></div><div class="search-row"><input data-table-search="company-view-clients-table" placeholder="Search name, email, phone or address…" aria-label="Search clients"></div><div class="table-wrap"><table id="company-view-clients-table"><thead><tr><th>Client</th><th>Contact number</th><th>Address</th><th>Access</th><th>Actions</th></tr></thead><tbody>'+(clients.length?clients.map(c=>'<tr><td><button class="company-name-link" data-view-client="'+esc(c.id)+'">'+esc(c.full_name||'—')+'</button><br><small>'+esc(c.email||'')+'</small></td><td>'+esc(c.phone||'—')+'</td><td>'+esc(c.address||'—')+'</td><td>'+(c.active?'<span class="pill green">Active</span>':'<span class="pill">Paused</span>')+'</td><td><button class="btn outline small" data-company-edit-client="'+c.id+'">Edit Client</button></td></tr>').join(''):'<tr><td colspan="5" class="empty">No active clients have been added yet.</td></tr>')+'</tbody></table></div></div>';
          bindTableSearches();
          $$('[data-view-client]').forEach(b=>b.onclick=()=>companyClientDetails(b.dataset.viewClient));
          $$('[data-company-edit-client]').forEach(b=>b.onclick=()=>companyClientsWorkspace(b.dataset.companyEditClient));
        };
        window.companyViewClientsPage.__companyAccessFix=true;
      }

      if(typeof window.archivedClientsPage==='function'&&!window.archivedClientsPage.__companyAccessFix){
        const originalArchived=window.archivedClientsPage;
        window.archivedClientsPage=async function(){
          if(window.state?.user?.role==='controller'){
            const response=await api('/api/company/clients/archived');
            const rows=Array.isArray(response?.clients)?response.clients:[];
            $('#content').innerHTML='<div class="card"><div class="section-head"><h2>Archived Clients</h2><span class="pill">'+rows.length+' archived</span></div><div class="search-row"><input data-table-search="archived-clients-table" placeholder="Search archived clients…" aria-label="Search archived clients"></div><div class="table-wrap"><table id="archived-clients-table"><thead><tr><th>Client</th><th>Email</th><th>Phone</th><th>Archived</th></tr></thead><tbody>'+(rows.length?rows.map(c=>'<tr><td>'+esc(c.full_name||'—')+'</td><td>'+esc(c.email||'—')+'</td><td>'+esc(c.phone||'—')+'</td><td>'+date(c.archived_at)+'</td></tr>').join(''):'<tr><td colspan="4" class="empty">No archived clients for this company.</td></tr>')+'</tbody></table></div><p class="tiny">Archived clients are view-only for company users. Restore and permanent deletion are available only to the Master Administrator.</p></div>';
            bindTableSearches();
            return;
          }
          return originalArchived.apply(this,arguments);
        };
        window.archivedClientsPage.__companyAccessFix=true;
      }
    }catch(err){console.error('Company access fix failed:',err);}
  }
  install();
  let tries=0;
  const timer=setInterval(()=>{install();tries++;if(tries>200)clearInterval(timer);},25);
})();
