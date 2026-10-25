(function(){
  var appStarted=false;
  function installSafeBindings(){
    try{
      if(typeof window.bindDynamic==='function'&&!window.bindDynamic.__safeGuard){
        var original=window.bindDynamic;
        var safe=function(){try{return original.apply(this,arguments)}catch(err){console.error('Optional dashboard binding skipped:',err);return undefined;}};
        safe.__safeGuard=true;
        window.bindDynamic=safe;
      }
    }catch(err){console.error('Dashboard binding guard failed:',err)}
  }
  function loadCompanyAccessFix(){
    var fix=document.createElement('script');
    fix.src='/company-access-fix.js?v=company-client-permissions-fix1';
    fix.onload=installSafeBindings;
    document.body.appendChild(fix);
  }
  function loadDashboardFixes(){
    var fix=document.createElement('script');
    fix.src='/dashboard-fixes.js?v=master-client-pages-fix3';
    fix.onload=function(){installSafeBindings();loadClientPagesFix();};
    fix.onerror=function(){loadClientPagesFix();};
    document.body.appendChild(fix);
  }
  function loadClientPagesFix(){
    var fix=document.createElement('script');
    fix.src='/client-pages-fix.js?v=master2-client-pages-fix2';
    fix.onload=function(){installSafeBindings();loadCompanyAccessFix();loadMapLocationFix();};
    fix.onerror=function(){loadCompanyAccessFix();loadMapLocationFix();};
    document.body.appendChild(fix);
  }
  function loadMapLocationFix(){
    var fix=document.createElement('script');
    fix.src='/map-location-fix.js?v=20261025-2';
    fix.onload=installSafeBindings;
    document.body.appendChild(fix);
  }
  function loadApp(){
    if(appStarted)return;
    appStarted=true;
    var app=document.createElement('script');
    app.src='/app.js?v=master2-client-pages-fix6';
    app.onload=function(){
      installSafeBindings();
      loadDashboardFixes();
      var tries=0;
      var guard=setInterval(function(){
        installSafeBindings();
        tries++;
        if(typeof window.bindDynamic==='function'&&window.bindDynamic.__safeGuard||tries>400)clearInterval(guard);
      },10);
    };
    app.onerror=function(){var e=document.getElementById('login-error');if(e)e.textContent='The sign-in application could not load. Please refresh the page.';};
    document.body.appendChild(app);
  }
  function showMapLoadError(){var map=document.getElementById('master-map');if(map)map.innerHTML='<div style="padding:24px;color:#d9e5f2">The map library could not load. Sign-in is still available; refresh later to retry the map.</div>';}
  function notifyMapReady(){try{if(window.L&&typeof window.initMap==='function'&&typeof state!=='undefined'&&state.user&&state.user.role==='controller'){setTimeout(function(){try{window.initMap()}catch(e){console.error('Map refresh failed:',e)}},100);}}catch(e){}}
  function loadFallback(){if(window.L)return;var fallback=document.createElement('script');fallback.src='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';fallback.onload=notifyMapReady;fallback.onerror=showMapLoadError;document.head.appendChild(fallback);}
  loadApp();
  var primary=document.createElement('script');
  primary.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  primary.onload=notifyMapReady;
  primary.onerror=loadFallback;
  document.head.appendChild(primary);
})();
