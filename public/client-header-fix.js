(function(){
  'use strict';

  function alignHeader(){
    var toggle=document.getElementById('client-menu-toggle');
    var logo=document.getElementById('client-brand-home');
    if(!toggle || !logo) return;

    var parent=toggle.parentElement;
    if(!parent || logo.parentElement!==parent) return;

    parent.style.display='flex';
    parent.style.flexDirection='row';
    parent.style.alignItems='center';
    parent.style.justifyContent='flex-start';
    parent.style.gap='8px';
    parent.style.flexWrap='nowrap';

    toggle.style.order='1';
    logo.style.order='2';
    toggle.style.margin='0';
    logo.style.margin='0';
    toggle.style.transform='none';
    logo.style.transform='none';

    if(toggle.nextElementSibling!==logo){
      parent.insertBefore(toggle,logo);
    }
  }

  var timer=null;
  function schedule(){
    clearTimeout(timer);
    timer=setTimeout(alignHeader,50);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',schedule);
  else schedule();

  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('resize',schedule);
})();
