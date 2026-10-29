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
  function loadBrandOverrides(){
    var css=document.createElement('link');css.rel='stylesheet';css.href='/brand-overrides.css?v=es247-uploaded-artwork-final5';document.head.appendChild(css);
    var brand=document.createElement('script');brand.src='/brand-overrides.js?v=es247-uploaded-artwork-final5';brand.onload=function(){
      if(typeof window.es247BrandReady==='function')window.es247BrandReady();
      /* The client workspace can render before the asynchronously loaded brand
         override arrives. Re-render the client home once the exact artwork code
         is available so the original emoji/card UI can never replace it. */
      if(document.querySelector('#workspace-view.client-workspace')&&typeof window.panicPage==='function'){
        window.panicPage();
      }
    };document.body.appendChild(brand);
  }
  function loadDashboardFixes(){
    var fix=document.createElement('script');
    fix.src='/dashboard-fixes.js?v=sidebar-delegation-fix1';
    fix.onload=function(){installSafeBindings();loadBrandOverrides();};
    document.body.appendChild(fix);
  }
  function loadApp(){
    if(appStarted)return;
    appStarted=true;
    var app=document.createElement('script');
    app.src='/app.js?v=signin-transition-fix1';
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
  function loadFallback(){if(window.L)return;var fallback=document.createElement('script');fallback.src='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';fallback.onerror=showMapLoadError;document.head.appendChild(fallback);}
  loadApp();
  var primary=document.createElement('script');
  primary.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  primary.onerror=loadFallback;
  document.head.appendChild(primary);
  var clientNavigation=document.createElement('script');
  clientNavigation.src='/client-navigation-fixes.js?v=client-terms-force-menu-fix4';
  document.body.appendChild(clientNavigation);
})();
