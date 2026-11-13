(function () {
  'use strict';
  var key = 'adak-theme';
  var root = document.documentElement;
  var initial = 'dark';
  try {
    var saved = localStorage.getItem(key);
    if (saved === 'light' || saved === 'dark') initial = saved;
  } catch (err) {}

  function syncControls() {
    var theme = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    var buttons = document.querySelectorAll('.theme-toggle');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-label', theme === 'dark' ? 'فعال‌سازی حالت روز' : 'فعال‌سازی حالت شب');
      buttons[i].setAttribute('title', theme === 'dark' ? 'حالت روز' : 'حالت شب');
      buttons[i].setAttribute('aria-pressed', String(theme === 'light'));
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#07131F' : '#F3F5F6');
  }

  function applyTheme(theme, save) {
    theme = theme === 'light' ? 'light' : 'dark';
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
    if (save) {
      try { localStorage.setItem(key, theme); } catch (err) {}
    }
    syncControls();
  }

  applyTheme(initial, false);
  document.addEventListener('DOMContentLoaded', syncControls);
  document.addEventListener('click', function (event) {
    var target = event.target;
    if (target && target.nodeType !== 1) target = target.parentElement;
    var button = target && target.closest ? target.closest('.theme-toggle') : null;
    if (!button) return;
    event.preventDefault();
    applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true);
  });
  window.addEventListener('storage', function (event) {
    if (event.key === key) applyTheme(event.newValue, false);
  });
})();
