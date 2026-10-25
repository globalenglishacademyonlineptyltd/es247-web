(function(){
  function esc(v){return String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));}
  function fmt(v){if(!v)return '—';try{return new Intl.DateTimeFormat('en-ZA',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v));}catch{return String(v);}}
  function rowsFrom(d){return Array.isArray(d?.clients)?d.clients:(Array.isArray(d)?d:[]);}
  async function safeClientsPage(archived){
    const host=document.querySelector('#content');
    if(!host)return;
    host.innerHTML='<div class="card"><h2>Loading '+(archived?'Archived Clients':'View Clients')+'…</h2></div>';
    try{
      const endpoint=archived?'/api/company/clients/archived':'/api/company/clients';
      const d=await window.api(endpoint);
      let clients=rowsFrom(d).filter(c=>c&&typeof c==='object');
      if(!archived)clients=clients.filter(c=>!c.archived_at);
      clients.sort((a,b)=>String(a.full_name||((a.name||'')+' '+(a.surname||''))).localeCompare(String(b.full_name||((b.name||'')+' '+(b.surname||''))),undefined,{sensitivity:'base'}));
      const isM2=window.state?.user?.role==='master_admin_2';
      const title=archived?'Archived Clients':'View Clients';
      host.innerHTML='<div class="card"><div class="section-head"><div><p class="eyebrow">CLIENTS</p><h2>'+title+'</h2><p class="muted">'+clients.length+' '+(archived?'archived':'active')+' client'+(clients.length===1?'':'s')+'</p></div></div><div class="search-row"><input id="safe-client-search" placeholder="Search clients…" aria-label="Search clients"></div><div class="table-wrap"><table id="safe-client-table"><thead><tr><th>Client</th><th>Contact</th><th>Email</th><th>Address</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+ (clients.length?clients.map(c=>{const name=c.full_name||((c.name||'')+' '+(c.surname||'')).trim()||'Unnamed client';const actions=archived?(isM2?'<button class="btn primary small" data-safe-restore="'+esc(c.id)+'">Restore</button> <button class="btn danger small" data-safe-delete="'+esc(c.id)+'">Permanently Delete</button>':'<span class="tiny">Master Admin 2 only</span>'):'<button class="btn outline small" data-safe-edit="'+esc(c.id)+'">Edit Client</button> <button class="btn outline small" data-safe-pause="'+esc(c.id)+'">'+(c.active===false?'Un-Pause Client Access':'Pause Client Access')+'</button>'+(isM2?' <button class="btn danger small" data-safe-delete="'+esc(c.id)+'">Delete</button>':'');return '<tr><td><strong>'+esc(name)+'</strong></td><td>'+esc(c.phone||c.contact_number||'—')+'</td><td>'+esc(c.email||c.contact_email||'—')+'</td><td>'+esc(c.address||c.physical_address||c.resident_address||'—')+'</td><td>'+esc(archived?'Archived':(c.active===false?'Paused':'Active'))+'</td><td>'+actions+'</td></tr>';}).join(''):'<tr><td colspan="6" class="empty">No '+(archived?'archived':'active')+' clients found.</td></tr>')+'</tbody></table></div></div>';
      const search=document.querySelector('#safe-client-search');if(search)search.oninput=()=>{const q=search.value.toLowerCase().trim();document.querySelectorAll('#safe-client-table tbody tr').forEach(tr=>tr.style.display=tr.textContent.toLowerCase().includes(q)?'':'none');};
      if(isM2&&archived){document.querySelectorAll('[data-safe-restore]').forEach(b=>b.onclick=async()=>{if(!confirm('Restore this client?'))return;try{await window.api('/api/master/clients/'+b.dataset.safeRestore+'/restore',{method:'POST'});await safeClientsPage(true);}catch(e){alert(e.message||'Unable to restore client.');}});document.querySelectorAll('[data-safe-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('Permanently delete this archived client? This cannot be undone.'))return;try{await window.api('/api/master/clients/'+b.dataset.safeDelete,{method:'DELETE'});await safeClientsPage(true);}catch(e){alert(e.message||'Unable to delete client.');}});}
      if(isM2&&!archived)document.querySelectorAll('[data-safe-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('Archive this client?'))return;try{await window.api('/api/master/clients/'+b.dataset.safeDelete,{method:'DELETE'});await safeClientsPage(false);}catch(e){alert(e.message||'Unable to archive client.');}});
    }catch(e){host.innerHTML='<div class="card"><h2>'+ (archived?'Archived Clients':'View Clients') +'</h2><p class="muted">No client records are available for this company yet.</p></div>';console.error('Client page load:',e);}
  }
  function install(){
    if(typeof window.navigate!=='function'||!window.state)return false;
    if(window.__es247ClientPagesFix)return true;
    const original=window.navigate;
    window.navigate=async function(page){
      if(page==='active-clients'){
        window.state.page=page;window.renderNav();const t=document.querySelector('#page-title');if(t)t.textContent='View Clients';return safeClientsPage(false);
      }
      if(page==='archived-clients'){
        window.state.page=page;window.renderNav();const t=document.querySelector('#page-title');if(t)t.textContent='Archived Clients';return safeClientsPage(true);
      }
      return original(page);
    };
    window.__es247ClientPagesFix=true;return true;
  }
  let n=0;const timer=setInterval(()=>{if(install()||++n>500)clearInterval(timer)},20);
})();
