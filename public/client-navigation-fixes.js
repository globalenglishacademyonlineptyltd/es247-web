(function () {
  'use strict';

  var bound = false;
  var logoSrc = '/ChatGPT%20Image%20Oct%2028%2C%202026%2C%2012_54_29%20PM.png';

  function menu() { return document.getElementById('client-menu-items'); }
  function isClientWorkspace() {
    var workspace = document.getElementById('workspace-view');
    return !!(workspace && workspace.classList.contains('client-workspace'));
  }
  function closeMenu() {
    var m = menu();
    if (m) m.classList.add('hidden');
    var toggle = document.getElementById('client-menu-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }
  function currentPage() {
    var s = history.state;
    return s && s.es247ClientPage ? s.es247ClientPage : 'dashboard';
  }
  function navigate(page, addHistory) {
    var target = page === 'panic' ? 'dashboard' : page;
    if (addHistory && currentPage() !== target) {
      history.pushState({ es247ClientPage: target }, '', location.href);
    }
    closeMenu();
    if (typeof window.goToPage === 'function') {
      window.__es247Popstate = true;
      Promise.resolve(window.goToPage(target)).finally(function () {
        window.__es247Popstate = false;
      });
    }
  }

  function ensureLogo() {
    var toggle = document.getElementById('client-menu-toggle');
    if (!toggle) return;

    var hamburger = document.getElementById('client-hamburger');
    if (!hamburger) hamburger = toggle.parentElement;
    if (!hamburger) return;

    var logo = document.getElementById('client-brand-home');
    if (!logo) {
      logo = document.createElement('button');
      logo.type = 'button';
      logo.id = 'client-brand-home';
      logo.setAttribute('aria-label', 'Panic Home');
      logo.setAttribute('title', 'Panic Home');
      logo.setAttribute('data-client-page', 'panic');
      logo.innerHTML = '<img src="' + logoSrc + '" alt="ES 24/7 company logo">';
    }

    // Put the two controls in one compact group. The hamburger MUST be first,
    // and the logo MUST be its immediate next sibling.
    if (logo.parentElement !== hamburger) hamburger.appendChild(logo);
    if (toggle.parentElement !== hamburger) hamburger.appendChild(toggle);
    hamburger.insertBefore(toggle, hamburger.firstChild);
    hamburger.insertBefore(logo, toggle.nextSibling);

    var style = document.getElementById('client-navigation-fix-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'client-navigation-fix-style';
      document.head.appendChild(style);
    }
    style.textContent = '\n#client-hamburger{display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:flex-start!important;gap:8px!important;position:fixed!important;top:16px!important;left:16px!important;width:max-content!important;height:auto!important;margin:0!important;padding:0!important;z-index:10000!important}\n#client-hamburger #client-menu-toggle{display:flex!important;position:relative!important;order:1!important;flex:0 0 auto!important;transform:none!important;margin:0!important}\n#client-hamburger #client-brand-home{display:flex!important;position:relative!important;order:2!important;flex:0 0 auto!important;width:46px!important;height:46px!important;padding:5px!important;margin:0!important;border:1px solid rgba(255,255,255,.18)!important;border-radius:12px!important;background:#071226!important;align-items:center!important;justify-content:center!important;cursor:pointer!important;box-shadow:0 5px 18px rgba(0,0,0,.25)!important}\n#client-hamburger #client-brand-home img{display:block!important;width:100%!important;height:100%!important;object-fit:contain!important;margin:0!important}\n';
  }

  function bind() {
    if (bound || !isClientWorkspace()) return;
    bound = true;
    ensureLogo();

    document.addEventListener('click', function (event) {
      if (!isClientWorkspace()) return;
      var hamburger = document.getElementById('client-hamburger');
      var items = menu();
      if (!hamburger || !items) return;

      var toggle = event.target.closest ? event.target.closest('#client-menu-toggle') : null;
      var pageButton = event.target.closest ? event.target.closest('[data-client-page]') : null;

      if (toggle) {
        event.preventDefault();
        event.stopImmediatePropagation();
        var opening = items.classList.contains('hidden');
        items.classList.toggle('hidden');
        toggle.setAttribute('aria-expanded', String(opening));
        return;
      }

      if (pageButton && hamburger.contains(pageButton)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        navigate(pageButton.getAttribute('data-client-page'), true);
        return;
      }

      if (!items.classList.contains('hidden') && !hamburger.contains(event.target)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeMenu();
      }
    }, true);

    window.addEventListener('popstate', function (event) {
      if (!isClientWorkspace()) return;
      event.stopImmediatePropagation();
      navigate(event.state && event.state.es247ClientPage ? event.state.es247ClientPage : 'dashboard', false);
    }, true);

    history.replaceState({ es247ClientPage: 'dashboard' }, '', location.href);
  }

  var observer = new MutationObserver(function () {
    if (isClientWorkspace()) {
      ensureLogo();
      bind();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  var timer = setInterval(function () {
    if (isClientWorkspace()) {
      ensureLogo();
      bind();
      clearInterval(timer);
    }
  }, 100);
})();
