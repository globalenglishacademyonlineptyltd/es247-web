(function () {
  'use strict';

  var bound = false;

  function menu() {
    return document.getElementById('client-menu-items');
  }

  function isClientWorkspace() {
    var workspace = document.getElementById('workspace-view');
    return !!(workspace && workspace.classList.contains('client-workspace'));
  }

  function closeMenu() {
    var m = menu();
    if (m) m.classList.add('hidden');
  }

  function currentClientPage() {
    return window.location.hash ? window.location.hash.replace(/^#/, '') : 'dashboard';
  }

  function bind() {
    if (bound || !isClientWorkspace()) return;
    bound = true;

    // Close the client hamburger menu whenever the user taps anywhere outside it.
    document.addEventListener('click', function (event) {
      if (!isClientWorkspace()) return;
      var m = menu();
      if (!m || m.classList.contains('hidden')) return;
      var hamburger = document.getElementById('client-hamburger');
      if (hamburger && !hamburger.contains(event.target)) closeMenu();
    }, true);

    // Give client menu pages real browser history so Android/iOS back gestures return
    // to the previous client page (for example Profile -> Panic Home).
    document.addEventListener('click', function (event) {
      if (!isClientWorkspace()) return;
      var button = event.target.closest ? event.target.closest('[data-client-page]') : null;
      if (!button) return;

      var page = button.getAttribute('data-client-page');
      if (!page) return;
      var target = page === 'panic' ? 'dashboard' : page;
      var hash = target === 'dashboard' ? '' : '#' + target;
      var current = currentClientPage();

      if (current !== target) {
        window.history.pushState({ es247ClientPage: target }, '', window.location.pathname + hash);
      }
      closeMenu();
    }, false);

    // Android back gesture / browser back: return to the previous client page.
    window.addEventListener('popstate', function () {
      if (!isClientWorkspace() || typeof window.goToPage !== 'function') return;
      var page = currentClientPage();
      closeMenu();
      window.goToPage(page === 'panic' ? 'dashboard' : page);
    });

    if (!window.location.hash) {
      window.history.replaceState({ es247ClientPage: 'dashboard' }, '', window.location.pathname);
    }
  }

  var observer = new MutationObserver(function () {
    if (isClientWorkspace()) bind();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  var timer = setInterval(function () {
    if (isClientWorkspace()) {
      bind();
      clearInterval(timer);
    }
  }, 100);
})();
