(function(){
  var appStarted = false;
  function loadApp() {
    if (appStarted) return;
    appStarted = true;
    var app = document.createElement('script');
    app.src = '/app.js?v=company-temp-password1';
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
  /* Start the login app independently of external map CDNs. */
  loadApp();
  var primary = document.createElement('script');
  primary.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  primary.onerror = loadFallback;
  document.head.appendChild(primary);
})();