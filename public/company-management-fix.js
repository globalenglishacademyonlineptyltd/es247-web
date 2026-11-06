(function(){
  function install(){
    if(typeof window.companyDetailPage!=='function'||typeof window.api!=='function'||typeof state==='undefined')return false;
    if(window.__es247CompanyManagementFix)return true;
    window.__es247CompanyManagementFix=true;
    var original=window.companyDetailPage;
    window.companyDetailPage=async function(){
      await original.apply(this,arguments);
      if(state.user?.role!=='master_admin_2'||!state.companyContext)return;
      var row=document.querySelector('#content .card .action-row');
      if(!row||document.querySelector('#m2-archive-company'))return;
      var button=document.createElement('button');
      button.type='button';button.id='m2-archive-company';button.className='btn danger';button.textContent='Archive Company';
      row.appendChild(button);
      button.addEventListener('click',async function(){
        var id=state.companyContext;
        if(!id||!window.confirm('Archive this company? It will be removed from active company totals, but its clients and incident history will be retained.'))return;
        button.disabled=true;
        try{
          await window.api('/api/master/companies/'+encodeURIComponent(id)+'/archive',{method:'POST'});
          if(typeof window.toast==='function')window.toast('Company archived. Its records have been retained.');
          state.companyContext=null;
          if(typeof window.renderNav==='function')window.renderNav();
          await window.goToPage('company-dashboards');
        }catch(error){
          button.disabled=false;
          if(typeof window.toast==='function')window.toast(error.message||'Unable to archive company.',true);
          else window.alert(error.message||'Unable to archive company.');
        }
      });
    };
    return true;
  }
  var tries=0;var timer=setInterval(function(){if(install()||++tries>500)clearInterval(timer);},20);
})();