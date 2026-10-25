(function(){
  function install(){
    if(typeof window.navigate!=='function'||typeof window.enter!=='function')return false;
    if(window.__es247DashboardFixes)return true;
    window.__es247DashboardFixes=true;
    var originalNavigate=window.navigate;
    var originalEnter=window.enter;
    window.enter=function(u){
      try{history.replaceState({es247:true,page:u.role==='master_admin_2'?'company-dashboards':'dashboard'},'',location.href);}catch(e){}
      return originalEnter(u);
    };
    window.navigate=function(page){
      try{if(!window.__es247Popstate&&typeof state!=='undefined'&&state.historyReady){history.pushState({es247:true,page:page},'',location.href);}}catch(e){console.error('History navigation setup failed',e);}
      return originalNavigate(page);
    };
    window.addEventListener('popstate',function(e){
      if(!state.user)return;
      if(e.state&&e.state.es247&&e.state.page){
        window.__es247Popstate=true;
        Promise.resolve(originalNavigate(e.state.page)).finally(function(){window.__es247Popstate=false;});
      }else{
        history.pushState({es247:true,page:'dashboard'},'',location.href);
        if(state.page!=='dashboard'){
          window.__es247Popstate=true;
          Promise.resolve(originalNavigate('dashboard')).finally(function(){window.__es247Popstate=false;});
        }
      }
    });
    var style=document.createElement('style');
    style.textContent='#page-title{margin-bottom:20px!important}#company-workspace-select{margin-top:8px!important}.master-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:16px}.master-mini{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px}.master-mini small{display:block;color:var(--muted);font-size:10px;font-weight:800;letter-spacing:.08em}.master-mini strong{display:block;font:800 24px Manrope,sans-serif;margin-top:5px}.company-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.company-detail{background:#101a29;border:1px solid var(--line);border-radius:10px;padding:12px}.company-detail small{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em}.company-detail strong{display:block;margin-top:4px}@media(max-width:700px){.master-summary{grid-template-columns:1fr}.company-detail-grid{grid-template-columns:1fr}}';
    document.head.appendChild(style);

    async function companyStats(companies){
      var out={};
      if(!state.user||state.user.role!=='master_admin_2')return out;
      for(var c of companies||[]){
        try{
          state.companyContext=String(c.id);
          var d=await window.api('/api/company/clients');
          var clients=Array.isArray(d.clients)?d.clients:[];
          out[c.id]={total:clients.length,paused:clients.filter(function(x){return x.active===false;}).length};
        }catch(e){out[c.id]={total:Number(c.total_clients||0),paused:0};}
      }
      state.companyContext=null;
      return out;
    }

    window.renderNav=function(){
      var role=state.user&&state.user.role;
      var items=[];
      if(role==='master_admin'||role==='master_admin_2'){
        items=[['dashboard','Dashboard','D'],['company-dashboards','View Companies','W'],['add-company','Add Company','C'],['archive','Archived Companies','R']];
        if(role==='master_admin_2'&&state.companyContext){items.push(['incidents','Company Incidents','I'],['clients','View Clients','C'],['add-client','Add Client','+'],['archived-clients','Archived Clients','A']);}
      }else if(role==='controller')items=[['dashboard','Dashboard - Map','D'],['incidents','Incidents Map','I'],['clients','Client Panic history','H'],['add-client','Add Client','+']];
      else items=[['dashboard','My Incidents','I'],['panic','Send Panic Alert','P']];
      var nav=document.querySelector('#nav');if(!nav)return;
      nav.innerHTML=items.map(function(x){return '<button data-page="'+x[0]+'" data-short="'+x[2]+'" class="'+(state.page===x[0]?'active':'')+'"><span>'+x[1]+'</span></button>';}).join('');
      $$( '[data-page]' ).forEach(function(b){b.onclick=function(){if(role==='controller'&&b.dataset.page==='incidents'&&typeof window.stopAlarm==='function')window.stopAlarm();window.navigate(b.dataset.page);};});
    };

    window.masterOperationsMap=function(d){
      d=d||{};d.companies=Array.isArray(d.companies)?d.companies:[];d.counts=d.counts||{};
      var pausedTotal=Number(d.counts.paused_clients||0);
      var picker=d.role==='master_admin_2'?'<div style="min-width:220px;margin-top:12px"><label for="company-workspace-select">Open a company dashboard</label><select id="company-workspace-select" class="input"><option value="">Master Admin Dashboard</option>'+d.companies.map(function(c){return '<option value="'+esc(c.id)+'">'+esc(c.registered_name)+'</option>';}).join('')+'</select></div>':'';
      return '<div class="master-summary"><div class="master-mini"><small>TOTAL COMPANIES</small><strong>'+Number(d.counts.companies||d.companies.length||0)+'</strong></div><div class="master-mini"><small>TOTAL CLIENTS</small><strong>'+Number(d.counts.clients||0)+'</strong><span class="tiny">Includes paused clients</span></div><div class="master-mini"><small>CLIENTS ON PAUSE</small><strong>'+pausedTotal+'</strong><span class="tiny">Not archived</span></div></div><div class="card"><div class="section-head"><div><p class="eyebrow">MASTER ADMIN</p><h2>Dashboard — Map</h2><p class="muted">Company locations and coverage overview.</p>'+picker+'</div><div><button id="master-standard" class="btn primary small">Standard</button> <button id="master-satellite" class="btn outline small">Satellite</button></div></div><div id="master-map" class="map"></div></div>';
    };

    window.companyDashboardsPage=async function(){
      var host=document.querySelector('#content');
      var d=await window.api('/api/dashboard');
      if(!['master_admin','master_admin_2'].includes(d.role))throw new Error('Master Admin access is required.');
      var companies=Array.isArray(d.companies)?d.companies:[];
      var stats=await companyStats(companies);
      host.innerHTML='<div class="card"><p class="eyebrow">MASTER ADMIN</p><h2>View Companies</h2><p class="muted">Each company is isolated. Select a company to view its details and, for Master Admin 2, its company tools.</p><div class="table-wrap"><table><thead><tr><th>Company</th><th>Coverage areas</th><th>Total clients</th><th>On pause</th><th>Actions</th></tr></thead><tbody>'+(companies.length?companies.map(function(c){var s=stats[c.id]||{total:Number(c.total_clients||0),paused:0};return '<tr><td><button class="company-name-link" data-open-company="'+esc(c.id)+'">'+esc(c.registered_name)+'</button></td><td>'+esc(c.covering_areas||'—')+'</td><td>'+s.total+'</td><td>'+s.paused+'</td><td><button class="btn outline small" data-open-company="'+esc(c.id)+'">View Company</button></td></tr>';}).join(''):'<tr><td colspan="5" class="empty">No active companies found.</td></tr>')+'</tbody></table></div></div>';
      $$('[data-open-company]').forEach(function(b){b.onclick=function(){state.companyContext=b.dataset.openCompany;window.renderNav();window.navigate('company-detail');};});
    };

    window.companyDetailPage=async function(){
      var host=document.querySelector('#content');
      var d=await window.api('/api/dashboard');
      var c=d.company;if(!c)throw new Error('Company not found.');
      var isM2=state.user.role==='master_admin_2';
      var clients=[];
      if(isM2){var r=await window.api('/api/company/clients');clients=Array.isArray(r.clients)?r.clients:[];}
      var total=Number(d.counts&&d.counts.clients||clients.length);var paused=clients.filter(function(x){return x.active===false;}).length;
      host.innerHTML='<div class="card"><div class="section-head"><div><p class="eyebrow">COMPANY DETAILS</p><h2>'+esc(c.registered_name)+'</h2></div><button class="btn outline small" id="back-companies">← View Companies</button></div><div class="master-summary"><div class="master-mini"><small>TOTAL CLIENTS</small><strong>'+total+'</strong><span class="tiny">Includes paused clients</span></div><div class="master-mini"><small>CLIENTS ON PAUSE</small><strong>'+paused+'</strong><span class="tiny">Not archived</span></div><div class="master-mini"><small>COVERAGE AREAS</small><strong>'+esc(String(c.covering_areas||'—'))+'</strong></div></div><div class="company-detail-grid"><div class="company-detail"><small>Company name</small><strong>'+esc(c.registered_name)+'</strong></div><div class="company-detail"><small>CIPC number</small><strong>'+esc(c.cipc_number||'—')+'</strong></div><div class="company-detail"><small>PSIRA number</small><strong>'+esc(c.psira_number||'—')+'</strong></div><div class="company-detail"><small>Contact</small><strong>'+esc(c.contact_number||'—')+'</strong></div><div class="company-detail"><small>Email</small><strong>'+esc(c.contact_email||'—')+'</strong></div><div class="company-detail"><small>Tax number</small><strong>'+esc(c.tax_number||'—')+'</strong></div><div class="company-detail"><small>VAT number</small><strong>'+esc(c.vat_number||'—')+'</strong></div><div class="company-detail"><small>Covering areas</small><strong>'+esc(c.covering_areas||'—')+'</strong></div></div>'+(isM2?'<div class="action-row"><button class="btn primary" id="m2-add-client">+ Add Client</button><button class="btn outline" id="m2-clients">View Clients</button><button class="btn outline" id="m2-archived">Archived Clients</button></div>':'')+'</div>';
      document.querySelector('#back-companies').onclick=function(){state.companyContext=null;window.renderNav();window.navigate('company-dashboards');};
      if(isM2){document.querySelector('#m2-add-client').onclick=function(){window.navigate('add-client');};document.querySelector('#m2-clients').onclick=function(){window.navigate('clients');};document.querySelector('#m2-archived').onclick=function(){window.navigate('archived-clients');};}
    };

    var oldNavigate=window.navigate;
    window.navigate=async function(page){
      if(page==='company-detail'){state.page=page;window.renderNav();document.querySelector('#page-title').textContent='Company Details';var host=document.querySelector('#content');host.innerHTML='';try{return await window.companyDetailPage();}catch(e){host.innerHTML='<div class="card"><h2>Unable to load this page</h2><p class="notice">'+esc(e.message)+'</p></div>';return;}}
      return oldNavigate(page);
    };

    var known=new Set();
    async function monitor(){
      if(!state.user||state.user.role!=='controller')return;
      try{var d=await window.api('/api/incidents');var inc=Array.isArray(d.incidents)?d.incidents:[];for(var i of inc){var id=String(i.id);if(!known.has(id)&&i.status==='Panic Received'){if(typeof window.startAlarm==='function')window.startAlarm();}}known=new Set(inc.map(function(i){return String(i.id);}));}catch(e){}
    }
    setInterval(monitor,4000);setTimeout(monitor,800);
    return true;
  }
  var tries=0;var timer=setInterval(function(){if(install()||++tries>500)clearInterval(timer);},20);
})();
