(function(){
  var ASSETS={
    logo:'/ChatGPT%20Image%20Oct%2028%2C%202026%2C%2012_54_29%20PM.png',
    ambulance:'/ChatGPT%20Image%20Oct%2028%2C%202026%2C%2012_24_44%20PM.png',
    police:'/ChatGPT%20Image%20Oct%2028%2C%202026%2C%2012_24_51%20PM.png',
    fire:'/ChatGPT%20Image%20Oct%2028%2C%202026%2C%2012_25_00%20PM.png',
    tow:'/ChatGPT%20Image%20Oct%2028%2C%202026%2C%2012_25_05%20PM.png'
  };

  function logoMarkup(extra){
    return '<img class="es247-logo-image'+(extra?' '+extra:'')+'" src="'+ASSETS.logo+'" alt="ES 24/7 logo">';
  }

  function installLogos(){
    document.querySelectorAll('.brand-mark').forEach(function(el){
      if(el.classList.contains('es247-logo-host')) return;
      var host=document.createElement('span');
      host.className='es247-logo-host';
      host.innerHTML=logoMarkup('compact-logo');
      el.replaceWith(host);
    });
  }

  function panicPage(){
    var host=document.querySelector('#content');
    if(!host)return;
    var buttons=[
      ['Panic: Ambulance Assistance Needed','ambulance'],
      ['Panic: Police Assistance Needed','police'],
      ['Panic: Fire Fighter Assistance Needed','fire'],
      ['Panic: Tow Truck Assistance Needed','tow']
    ];

    host.innerHTML='<div class="client-home es247-client-home">'+
      logoMarkup('hero-logo')+
      '<p class="client-welcome">Welcome to ES 24/7</p>'+ 
      '<h1 class="client-urgent">Need urgent assistance?</h1>'+ 
      '<div class="client-panic-wrap"><div class="client-panic-grid">'+
      buttons.map(function(x){
        return '<button type="button" class="client-panic-button panic-'+x[1]+'" data-panic-type="'+x[0]+'">'+
          '<img class="panic-vehicle-picture" src="'+ASSETS[x[1]]+'" alt="'+x[1]+' emergency assistance">'+
        '</button>';
      }).join('')+
      '</div><p class="notice" id="panic-error" role="alert"></p></div>'+
      '<p class="es247-client-footer">Created by Emergency Services 24/7</p>'+
      '</div>';

    if(typeof loadClientIncidents==='function')loadClientIncidents();

    document.querySelectorAll('[data-panic-type]').forEach(function(b){b.onclick=async function(){
      if(b.disabled)return;
      b.disabled=true;
      var err=document.querySelector('#panic-error');
      if(err)err.textContent='Sending emergency alert…';
      var type=b.dataset.panicType,incidentId=null;
      try{
        var d=await api('/api/client/panic',{method:'POST',body:JSON.stringify({incident_type:type,activated_at:new Date().toISOString()})});
        incidentId=d.incident&&d.incident.id;
        if(!incidentId)throw new Error('The alert was sent but the incident reference was not returned.');
        if(typeof toast==='function')toast('Panic alert received by your security company. Live GPS tracking is starting.');
        if(err)err.textContent='Panic sent. Waiting for a high-accuracy GPS fix…';
        if(typeof loadClientIncidents==='function')await loadClientIncidents();
      }catch(e){
        if(err)err.textContent=e.message||'Could not send panic alert.';
        b.disabled=false;
        return;
      }
      b.disabled=false;
      if(!navigator.geolocation){
        if(err)err.textContent='Panic sent, but this device does not provide GPS location. Enable location access.';
        return;
      }
      if(window.__es247Watch!=null)try{navigator.geolocation.clearWatch(window.__es247Watch)}catch{};
      window.__es247Watch=null;
      var lastSent=0,goodFix=false;
      var sendFix=async function(position){
        var c=position.coords;
        if(!Number.isFinite(c.latitude)||!Number.isFinite(c.longitude))return;
        var accuracy=Number.isFinite(c.accuracy)?Number(c.accuracy):null;
        if(accuracy===null)return;
        var now=Date.now();
        if(now-lastSent<2500)return;
        lastSent=now;
        try{
          await api('/api/client/incidents/'+encodeURIComponent(incidentId)+'/location',{method:'POST',body:JSON.stringify({latitude:c.latitude,longitude:c.longitude,accuracy_m:accuracy,recorded_at:new Date(position.timestamp||now).toISOString()})});
          goodFix=true;
          if(err)err.textContent=accuracy<=50?'GPS location received. Accuracy ±'+Math.round(accuracy)+' metres. Keep the app open for continued updates.':'Live tracking active. Phone reports low GPS accuracy (±'+Math.round(accuracy)+' metres). Enable Precise Location/GPS.';
        }catch{
          if(err)err.textContent='Panic is active, but a live location update could not be saved. Check your connection.';
        }
      };
      try{
        window.__es247Watch=navigator.geolocation.watchPosition(sendFix,function(e){
          if(err)err.textContent='Panic is active, but GPS could not get a live fix ('+(e&&e.message?e.message:'location unavailable')+'). Enable Precise Location/GPS.';
        },{enableHighAccuracy:true,maximumAge:0,timeout:20000});
        navigator.geolocation.getCurrentPosition(sendFix,function(){},{enableHighAccuracy:true,maximumAge:0,timeout:20000});
        setTimeout(function(){if(!goodFix&&err)err.textContent='Panic is active, but no reliable GPS fix has arrived yet. Enable Precise Location/GPS and keep the app open.';},20000);
      }catch{
        if(err)err.textContent='Panic is active, but live GPS tracking could not start on this device.';
      }
    };});
  }

  window.es247BrandReady=function(){installLogos();};
  window.panicPage=panicPage;
  installLogos();
})();

// Company-local panic numbering: the database keeps a persistent incident_number
// for each company, while the internal incident id remains globally unique.
(function(){
  function localNumber(i){return i&&i.incident_number!=null?i.incident_number:i&&i.id;}

  if(typeof incidentTable==='function'){
    window.incidentTable=function(inc){
      inc=Array.isArray(inc)?inc:[];
      return '<div class="section-head"><h2>Incidents and panic records</h2><input id="incident-search" placeholder="Search panics…" style="max-width:250px;background:#0b1421;border:1px solid var(--line);padding:10px;border-radius:9px;color:var(--text)"></div><div class="table-wrap" id="incident-table"><table><thead><tr><th>Panic</th><th>Client</th><th>Activated by client</th><th>Received by company</th><th>Status</th><th></th></tr></thead><tbody>'+(inc.length?inc.map(function(i){return '<tr><td><strong>'+esc(i.incident_type)+'</strong><br><small class="muted">#'+esc(localNumber(i))+'</small></td><td><button class="company-name-link" data-incident="'+i.id+'">'+esc(i.client_name||'Client')+'</button></td><td>'+date(i.client_activated_at||i.panic_at)+'</td><td>'+date(i.panic_at)+'</td><td>'+pill(i.status)+'</td><td><button class="btn outline small" data-incident="'+i.id+'">Open panic</button></td></tr>';}).join(''):'<tr><td colspan="6" class="empty">No panics have been received.</td></tr>')+'</tbody></table></div>';
    };
  }

  if(typeof incidentPopup==='function'){
    window.incidentPopup=function(i){
      var accuracy=i.location_accuracy_m!=null?'Device-reported accuracy: ±'+Math.round(Number(i.location_accuracy_m))+' m':'GPS accuracy not reported';
      return '<strong>'+esc(i.incident_type)+' #'+esc(localNumber(i))+'</strong><br>'+esc(i.client_name||'Client')+'<br>'+esc(i.status)+'<br>'+esc(accuracy);
    };
  }

  if(typeof openIncident==='function'){
    var originalOpenIncident=window.openIncident;
    window.openIncident=async function(id){
      await originalOpenIncident(id);
      var i=(state.incidents||[]).find(function(x){return String(x.id)===String(id);});
      if(i&&document.querySelector('#dialog-title')){
        document.querySelector('#dialog-title').textContent=i.incident_type+' · #'+localNumber(i);
      }
    };
  }

  if(typeof loadClientIncidents==='function'){
    window.loadClientIncidents=async function(){
      try{
        var d=await api('/api/client/incidents');
        d.incidents=Array.isArray(d&&d.incidents)?d.incidents:[];
        var host=document.querySelector('#client-incidents');
        if(!host)return;
        host.innerHTML='<div class="card" style="margin-top:18px"><h2>My Incident History</h2>'+(d.incidents.length?d.incidents.map(function(i){return '<p>'+pill(i.status)+' <strong>'+esc(i.incident_type)+' #'+esc(localNumber(i))+'</strong><br><small class="muted">'+date(i.panic_at)+' · '+esc(i.location_text||'Location unavailable')+'</small></p>';}).join(''):'<p class="empty">No incidents yet.</p>')+'</div>';
      }catch{}
    };
  }
})();
