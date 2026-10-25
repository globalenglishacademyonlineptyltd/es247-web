(function(){
  function install(){
    if(typeof window.api!=='function'||typeof window.navigate!=='function'||typeof state==='undefined')return false;
    if(window.__es247MasterCompanyFix)return true;
    window.__es247MasterCompanyFix=true;
    window.companyDashboardsPage=async function(){
      var host=document.querySelector('#content');
      var d=await window.api('/api/dashboard');
      if(!['master_admin','master_admin_2'].includes(d.role))throw new Error('Master Admin access is required.');
      var companies=Array.isArray(d.companies)?d.companies:[];
      host.innerHTML='<div class="card"><p class="eyebrow">MASTER ADMIN</p><h2>View Companies</h2><p class="muted">Each company is separate. Click a company to view its details. Master Admin 2 can open its company tools.</p><div class="table-wrap"><table><thead><tr><th>Company</th><th>Coverage areas</th><th>Total clients</th><th>On pause</th><th></th></tr></thead><tbody>'+(companies.length?companies.map(function(c){return '<tr><td><button class="company-name-link" data-open-company="'+esc(c.id)+'">'+esc(c.registered_name)+'</button></td><td>'+esc(c.covering_areas||'—')+'</td><td>'+Number(c.total_clients||0)+'</td><td>'+Number(c.paused_clients||0)+'</td><td><button class="btn outline small" data-open-company="'+esc(c.id)+'">View Company</button></td></tr>';}).join(''):'<tr><td colspan="5" class="empty">No active companies found.</td></tr>')+'</tbody></table></div></div>';
      $$('[data-open-company]').forEach(function(b){b.onclick=function(){state.companyContext=b.dataset.openCompany;window.renderNav();window.navigate('company-detail');};});
    };
    window.companyDetailPage=async function(){
      var host=document.querySelector('#content');
      if(!state.companyContext)throw new Error('Select a company first.');
      var d=await window.api('/api/dashboard');
      var c=d.company;
      if(!c){var all=Array.isArray(d.companies)?d.companies:[];c=all.find(function(x){return String(x.id)===String(state.companyContext);});}
      if(!c)throw new Error('Company not found.');
      var isM2=state.user.role==='master_admin_2';
      var clients=[];
      if(isM2){var r=await window.api('/api/company/clients');clients=Array.isArray(r.clients)?r.clients:[];}
      var total=Number(c.total_clients||d.counts?.clients||clients.length);var paused=Number(c.paused_clients||d.counts?.paused_clients||clients.filter(function(x){return x.active===false;}).length);
      host.innerHTML='<div class="card"><div class="section-head"><div><p class="eyebrow">COMPANY DETAILS</p><h2>'+esc(c.registered_name)+'</h2></div><button class="btn outline small" id="back-companies">← View Companies</button></div><div class="master-summary"><div class="master-mini"><small>TOTAL CLIENTS</small><strong>'+total+'</strong><span class="tiny">Includes paused clients</span></div><div class="master-mini"><small>CLIENTS ON PAUSE</small><strong>'+paused+'</strong><span class="tiny">Not archived</span></div><div class="master-mini"><small>COVERAGE AREAS</small><strong>'+esc(String(c.covering_areas||'—'))+'</strong></div></div><div class="company-detail-grid"><div class="company-detail"><small>Company name</small><strong>'+esc(c.registered_name)+'</strong></div><div class="company-detail"><small>CIPC number</small><strong>'+esc(c.cipc_number||'—')+'</strong></div><div class="company-detail"><small>PSIRA number</small><strong>'+esc(c.psira_number||'—')+'</strong></div><div class="company-detail"><small>Contact number</small><strong>'+esc(c.contact_number||'—')+'</strong></div><div class="company-detail"><small>Email</small><strong>'+esc(c.contact_email||'—')+'</strong></div><div class="company-detail"><small>Tax number</small><strong>'+esc(c.tax_number||'—')+'</strong></div><div class="company-detail"><small>VAT number</small><strong>'+esc(c.vat_number||'—')+'</strong></div><div class="company-detail"><small>Coverage areas</small><strong>'+esc(c.covering_areas||'—')+'</strong></div></div>'+(isM2?'<div class="action-row"><button class="btn primary" id="m2-add-client">+ Add Client</button><button class="btn outline" id="m2-clients">View Clients</button><button class="btn outline" id="m2-archived">Archived Clients</button></div>':'')+'</div>';
      document.querySelector('#back-companies').onclick=function(){state.companyContext=null;window.renderNav();window.navigate('company-dashboards');};
      if(isM2){document.querySelector('#m2-add-client').onclick=function(){window.navigate('add-client');};document.querySelector('#m2-clients').onclick=function(){window.navigate('clients');};document.querySelector('#m2-archived').onclick=function(){window.navigate('archived-clients');};}
    };
    return true;
  }
  var tries=0;var timer=setInterval(function(){if(install()||++tries>500)clearInterval(timer);},20);
})();
