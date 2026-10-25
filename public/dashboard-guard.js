(function(){
  // Safety guard for dashboard controls: optional UI bindings must never replace a
  // successfully rendered page with a JavaScript error screen.
  var installed=false;
  function install(){
    try{
      if(typeof window.bindDynamic==='function' && !window.bindDynamic.__safeGuard){
        var original=window.bindDynamic;
        var safe=function(){
          try{return original.apply(this,arguments)}
          catch(err){console.error('Optional dashboard binding skipped:',err);return undefined;}
        };
        safe.__safeGuard=true;
        window.bindDynamic=safe;
        installed=true;
      }
    }catch(err){console.error('Dashboard guard install failed:',err)}
    if(installed) clearInterval(timer);
  }
  var timer=setInterval(install,25);install();
  setTimeout(function(){clearInterval(timer)},10000);
})();
