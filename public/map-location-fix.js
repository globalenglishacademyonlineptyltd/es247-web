(function(){
  function install(){
    if(typeof window.initMap!=='function'||typeof window.controllerDashboard!=='function'||typeof window.addCoverageAreas!=='function')return false;
    if(window.__es247MapLocationFix)return true;
    window.__es247MapLocationFix=true;
    var originalInitMap=window.initMap;
    var originalControllerDashboard=window.controllerDashboard;
    window.controllerDashboard=function(d,inc){
      var html=originalControllerDashboard(d,inc);
      var coverage=String(d&&d.company&&d.company.covering_areas||'').trim();
      var latest=(Array.isArray(inc)?inc:[]).find(function(i){return i&&i.status!=='Incident Resolved'&&i.latitude!=null&&i.longitude!=null&&Number.isFinite(Number(i.latitude))&&Number.isFinite(Number(i.longitude));});
      var locationCard=latest
        ? '<div class="card" style="margin-bottom:18px;border:2px solid #ff2438"><div class="section-head"><div><p class="eyebrow">LIVE PANIC LOCATION</p><h2 style="color:#ff6673">Client GPS Location</h2><p class="muted">The latest unresolved panic has a device-reported GPS position.</p></div><span class="pill red">GPS FIX</span></div><p><strong>Client:</strong> '+window.esc(latest.client_name||'Client')+'<br><strong>Coordinates:</strong> '+Number(latest.latitude).toFixed(6)+', '+Number(latest.longitude).toFixed(6)+(latest.location_accuracy_m!=null?' · accuracy ±'+Math.round(Number(latest.location_accuracy_m))+' m':'')+'<br><a href="https://www.google.com/maps?q='+encodeURIComponent(latest.latitude+','+latest.longitude)+'" target="_blank" rel="noopener">Open exact location in Google Maps →</a></p></div>'
        : '<div class="card" style="margin-bottom:18px"><p class="eyebrow">CLIENT LOCATION</p><p class="muted">No unresolved panic currently has GPS coordinates. A client panic will appear here as soon as the phone supplies a GPS fix.</p></div>';
      if(coverage){
        var mapCard='<div class="card" style="margin-bottom:18px"><div class="section-head"><div><p class="eyebrow">COMPANY COVERAGE</p><h2>Coverage Areas</h2><p class="muted">Blue circles show the company service areas.</p></div></div><div id="company-coverage-map" class="map"></div></div>';
        return locationCard+mapCard+html;
      }
      return locationCard+html;
    };
    window.initMap=function(){
      originalInitMap();
      var el=document.querySelector('#incident-map');
      var coverageMap=document.querySelector('#company-coverage-map');
      if(!coverageMap||!window.L)return;
      if(window.__es247CoverageMap){try{window.__es247CoverageMap.remove()}catch(e){}}
      var map=L.map(coverageMap,{zoomControl:true,preferCanvas:true}).setView([-29,24],5);window.__es247CoverageMap=map;
      var standard=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}',{maxZoom:19,attribution:'Tiles © Esri and its contributors'}).addTo(map);
      var satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Imagery © Esri and its contributors'});
      var active='standard';
      var host=coverageMap.parentElement;host.querySelectorAll('#company-coverage-standard,#company-coverage-satellite').forEach(function(x){x.remove()});
      var company=state.data&&state.data.company?state.data.company:null;
      var companies=company?[company]:[];
      var buttons=document.createElement('div');buttons.style.cssText='position:absolute;z-index:1000;right:12px;top:12px';buttons.innerHTML='<button id="company-coverage-standard" class="btn primary small">Standard</button> <button id="company-coverage-satellite" class="btn outline small">Satellite</button>';
      coverageMap.style.position='relative';coverageMap.appendChild(buttons);
      var set=function(which){active=which;if(which==='satellite'){if(map.hasLayer(standard))map.removeLayer(standard);satellite.addTo(map)}else{if(map.hasLayer(satellite))map.removeLayer(satellite);standard.addTo(map)}buttons.querySelector('#company-coverage-standard').className='btn '+(active==='standard'?'primary':'outline')+' small';buttons.querySelector('#company-coverage-satellite').className='btn '+(active==='satellite'?'primary':'outline')+' small'};
      buttons.querySelector('#company-coverage-standard').onclick=function(){set('standard')};buttons.querySelector('#company-coverage-satellite').onclick=function(){set('satellite')};
      window.addCoverageAreas(map,companies,[],0);
      setTimeout(function(){map.invalidateSize(true)},100);setTimeout(function(){map.invalidateSize(true)},500);
    };
    return true;
  }
  var tries=0;var timer=setInterval(function(){if(install()||++tries>500)clearInterval(timer)},20);
  window.addEventListener('load',function(){setTimeout(function(){if(window.state&&window.state.user&&window.state.user.role==='controller'&&window.L&&typeof window.initMap==='function')window.initMap()},250)});
})();
