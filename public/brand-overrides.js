(function(){
  var atlasReady=false;
  function logoMarkup(extra){
    return '<div class="es247-logo-sprite'+(extra?' '+extra:'')+'" aria-label="ES 24/7 logo"></div>';
  }
  function installLogos(){
    document.querySelectorAll('.brand-mark').forEach(function(el){
      if(el.classList.contains('es247-logo-host')) return;
      var host=document.createElement('span');
      host.className='es247-logo-host';
      host.innerHTML=logoMarkup('compact');
      el.replaceWith(host);
    });
  }
  function decodeBase64Image(text){
    var clean=String(text||'').trim();
    var raw=atob(clean);
    var bytes=new Uint8Array(raw.length);
    for(var i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    return new Blob([bytes],{type:'image/webp'});
  }
  function cropAtlas(image, sx, sy, sw, sh){
    var canvas=document.createElement('canvas');
    canvas.width=sw;canvas.height=sh;
    var ctx=canvas.getContext('2d');
    ctx.drawImage(image,sx,sy,sw,sh,0,0,sw,sh);
    return canvas.toDataURL('image/jpeg',0.94);
  }
  async function loadAtlas(){
    try{
      var r=await fetch('/assets/es247-brand-01.txt?es247-atlas-v3',{cache:'no-store'});
      if(!r.ok)throw new Error('Brand asset unavailable');
      var blob=decodeBase64Image(await r.text());
      var url=URL.createObjectURL(blob);
      var image=new Image();
      image.onload=function(){
        try{
          var root=document.documentElement;
          root.style.setProperty('--es247-atlas-url','url("'+url+'")');
          root.style.setProperty('--es247-ambulance-url','url("'+cropAtlas(image,0,474,512,475)+'")');
          root.style.setProperty('--es247-police-url','url("'+cropAtlas(image,512,474,512,475)+'")');
          root.style.setProperty('--es247-fire-url','url("'+cropAtlas(image,0,950,512,475)+'")');
          root.style.setProperty('--es247-tow-url','url("'+cropAtlas(image,512,950,512,475)+'")');
          root.classList.add('es247-atlas-ready');
          atlasReady=true;
          installLogos();
        }catch(e){console.error('ES 24/7 brand sprite failed:',e)}
      };
      image.onerror=function(){console.error('ES 24/7 brand image could not be decoded')};
      image.src=url;
    }catch(e){console.error('ES 24/7 brand atlas could not load:',e)}
  }
  function panicPage(){
    var host=document.querySelector('#content');
    if(!host)return;
    var buttons=[['Panic: Ambulance Assistance Needed','ambulance'],['Panic: Police Assistance Needed','police'],['Panic: Fire Fighter Assistance Needed','fire'],['Panic: Tow Truck Assistance Needed','tow']];
    host.innerHTML='<div class="client-home es247-client-home">'+logoMarkup('hero-logo')+'<p class="client-welcome">Welcome to ES 24/7</p><h1 class="client-urgent">Need urgent assistance?</h1><div class="client-panic-wrap"><div class="client-panic-grid">'+buttons.map(function(x){return '<button type="button" class="client-panic-button panic-'+x[1]+'" data-panic-type="'+x[0]+'"><span class="panic-vehicle-picture panic-vehicle-'+x[1]+'" aria-hidden="true"></span></button>';}).join('')+'</div><p class="notice" id="panic-error" role="alert"></p></div><footer class="client-app-footer">Created by Emergency Services 24/7</footer><div id="client-incidents" class="hidden"></div></div>';
    if(typeof loadClientIncidents==='function')loadClientIncidents();
    document.querySelectorAll('[data-panic-type]').forEach(function(b){b.onclick=async function(){
      if(b.disabled)return;b.disabled=true;var err=document.querySelector('#panic-error');if(err)err.textContent='Sending emergency alert…';
      var type=b.dataset.panicType,incidentId=null;
      try{var d=await api('/api/client/panic',{method:'POST',body:JSON.stringify({incident_type:type,activated_at:new Date().toISOString()})});incidentId=d.incident&&d.incident.id;if(!incidentId)throw new Error('The alert was sent but the incident reference was not returned.');if(typeof toast==='function')toast('Panic alert received by your security company. Live GPS tracking is starting.');if(err)err.textContent='Panic sent. Waiting for a high-accuracy GPS fix…';if(typeof loadClientIncidents==='function')await loadClientIncidents();}
      catch(e){if(err)err.textContent=e.message||'Could not send panic alert.';b.disabled=false;return;}
      b.disabled=false;if(!navigator.geolocation){if(err)err.textContent='Panic sent, but this device does not provide GPS location. Enable location access.';return;}
      if(window.__es247Watch!=null)try{navigator.geolocation.clearWatch(window.__es247Watch)}catch{};window.__es247Watch=null;var lastSent=0,goodFix=false;
      var sendFix=async function(position){var c=position.coords;if(!Number.isFinite(c.latitude)||!Number.isFinite(c.longitude))return;var accuracy=Number.isFinite(c.accuracy)?Number(c.accuracy):null;if(accuracy===null)return;var now=Date.now();if(now-lastSent<2500)return;lastSent=now;try{await api('/api/client/incidents/'+encodeURIComponent(incidentId)+'/location',{method:'POST',body:JSON.stringify({latitude:c.latitude,longitude:c.longitude,accuracy_m:accuracy,recorded_at:new Date(position.timestamp||now).toISOString()})});goodFix=true;if(err)err.textContent=accuracy<=50?'GPS location received. Accuracy ±'+Math.round(accuracy)+' metres. Keep the app open for continued updates.':'Live tracking active. Phone reports low GPS accuracy (±'+Math.round(accuracy)+' metres). Enable Precise Location/GPS.';}catch{if(err)err.textContent='Panic is active, but a live location update could not be saved. Check your connection.';}};
      try{window.__es247Watch=navigator.geolocation.watchPosition(sendFix,function(e){if(err)err.textContent='Panic is active, but GPS could not get a live fix ('+(e&&e.message?e.message:'location unavailable')+'). Enable Precise Location/GPS.';},{enableHighAccuracy:true,maximumAge:0,timeout:20000});navigator.geolocation.getCurrentPosition(sendFix,function(){},{enableHighAccuracy:true,maximumAge:0,timeout:20000});setTimeout(function(){if(!goodFix&&err)err.textContent='Panic is active, but no reliable GPS fix has arrived yet. Enable Precise Location/GPS and keep the app open.';},20000);}catch{if(err)err.textContent='Panic is active, but live GPS tracking could not start on this device.';}
    };});
  }
  window.es247BrandReady=function(){installLogos();loadAtlas();};
  window.panicPage=panicPage;
  installLogos();
  loadAtlas();
})();
