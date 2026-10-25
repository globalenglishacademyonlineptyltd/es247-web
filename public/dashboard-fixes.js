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
    style.textContent='#page-title{margin-bottom:20px!important}#company-workspace-select{margin-top:8px!important}';
    document.head.appendChild(style);
    var known=new Set();
    async function monitor(){
      if(!state.user||state.user.role!=='controller')return;
      try{
        var d=await window.api('/api/incidents');
        var inc=Array.isArray(d.incidents)?d.incidents:[];
        for(var i of inc){var id=String(i.id);if(!known.has(id)&&i.status==='Panic Received'){if(typeof window.startAlarm==='function')window.startAlarm();}}
        known=new Set(inc.map(function(i){return String(i.id);}));
      }catch(e){}
    }
    setInterval(monitor,4000);
    setTimeout(monitor,800);
    return true;
  }
  var tries=0;var timer=setInterval(function(){if(install()||++tries>500)clearInterval(timer);},20);
})();
