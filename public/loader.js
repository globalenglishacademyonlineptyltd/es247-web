(function(){
  var appStarted = false;
  function loadApp() {
    if (appStarted) return;
    appStarted = true;
    var app = document.createElement('script');
    app.src = '/app.js?v=session-restore2';
    app.onload = function () {
      // The dashboard pages render first and then bind their controls. If one optional
      // control is missing, do not let that binding error replace the already-rendered page.
      var tries = 0;
      var guard = setInterval(function(){
        tries++;
        if (typeof window.bindDynamic === 'function') {
          var original = window.bindDynamic;
          window.bindDynamic = function(){
            try { return original.apply(this, arguments); }
            catch (err) { console.error('Optional dashboard control binding failed:', err); }
          };
          clearInterval(guard);
        } else if (tries > 100) clearInterval(guard);
      }, 10);
    };
    app.onerror = function () {
      var e = document.getElementById('login-error');
      if (e) e.textContent = 'The sign-in application could not load. Please refresh the page.';
    };
    document.body.appendChild(app);
  }
  function showMapLoadError() {
    var map = document.getElementById('master-map');
    if (map) map.innerHTML = '<div style="padding:24px;color:#d9e5f2">The map library could not load. Sign-in is still available; refresh later to retry the map.</div>';
  }
  function loadFallback() {
    if (window.L) return;
    var fallback = document.createElement('script');
    fallback.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
    fallback.onerror = showMapLoadError;
    document.head.appendChild(fallback);
  }
  loadApp();
  var primary = document.createElement('script');
  primary.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  primary.onerror = loadFallback;
  document.head.appendChild(primary);
})();