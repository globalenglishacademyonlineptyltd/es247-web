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
  function ensureTermsButton() {
    var items = menu();
    if (!items) return;
    var existing = document.getElementById('client-menu-terms');
    if (existing) {
      existing.textContent = "T's & C's";
      existing.style.display = 'block';
      existing.style.visibility = 'visible';
      existing.style.opacity = '1';
      existing.setAttribute('data-client-page', 'terms');
      return;
    }
    var button = document.createElement('button');
    button.type = 'button';
    button.id = 'client-menu-terms';
    button.setAttribute('data-client-page', 'terms');
    button.textContent = "T's & C's";
    button.style.display = 'block';
    button.style.visibility = 'visible';
    button.style.opacity = '1';
    var logout = document.getElementById('client-menu-logout');
    if (logout && logout.parentNode === items) items.insertBefore(button, logout);
    else items.appendChild(button);
  }

  function ensureLogo() {
    var hamburger = document.getElementById('client-hamburger');
    if (!hamburger) return;
    ensureTermsButton();
    var toggle = document.getElementById('client-menu-toggle');
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

    // Required order: hamburger first, company logo second.
    if (toggle && toggle.nextElementSibling !== logo) {
      hamburger.insertBefore(logo, toggle.nextSibling);
    } else if (!toggle && hamburger.firstElementChild !== logo) {
      hamburger.insertBefore(logo, hamburger.firstChild);
    }

    var style = document.getElementById('client-navigation-fix-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'client-navigation-fix-style';
      style.textContent = '#client-hamburger{display:flex!important;align-items:center!important;gap:8px!important;z-index:1000!important}#client-brand-home{width:46px!important;height:46px!important;padding:5px!important;margin:0!important;border:1px solid rgba(255,255,255,.18)!important;border-radius:12px!important;background:#071226!important;display:flex!important;align-items:center!important;justify-content:center!important;cursor:pointer!important;box-shadow:0 5px 18px rgba(0,0,0,.25)!important}#client-brand-home img{width:100%!important;height:100%!important;object-fit:contain!important;display:block!important}.client-menu-toggle{margin:0!important}';
      document.head.appendChild(style);
    }
  }
  function bind() {
    if (bound || !isClientWorkspace()) return;
    bound = true;
    ensureLogo();

    // One capture listener handles both the hamburger and the outside-tap dismissal.
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

    // Android/iOS back gestures now travel through the client pages instead of exiting.
    window.addEventListener('popstate', function (event) {
      if (!isClientWorkspace()) return;
      event.stopImmediatePropagation();
      navigate(event.state && event.state.es247ClientPage ? event.state.es247ClientPage : 'dashboard', false);
    }, true);

    // Establish a single in-app starting point for the client workspace.
    history.replaceState({ es247ClientPage: 'dashboard' }, '', location.href);
  }

  var observer = new MutationObserver(function () {
    if (isClientWorkspace()) {
      ensureTermsButton();
      ensureLogo();
      bind();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  var timer = setInterval(function () {
    if (isClientWorkspace()) {
      ensureTermsButton();
      ensureLogo();
      bind();
      clearInterval(timer);
    }
  }, 100);
})();
