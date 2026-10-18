// ACD site behaviour. Every page works without this file; it only adds interaction.
(function () {
  'use strict';

  // Mobile menu: full-screen panel, closes on Esc, "Închide" or a link; focus stays inside while open.
  function initMenu() {
    var toggle = document.querySelector('.menu-toggle');
    var menu = document.getElementById('menu');
    if (!toggle || !menu) return;
    var closeBtn = menu.querySelector('.menu-close');

    function focusables() {
      return Array.prototype.slice.call(menu.querySelectorAll('a, button'));
    }
    function open() {
      menu.classList.add('open');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      focusables()[0].focus();
    }
    function close() {
      menu.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      toggle.focus();
    }
    toggle.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a') && menu.classList.contains('open')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (!menu.classList.contains('open')) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      var items = focusables(), first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  // Magnifier hero: the lens follows the mouse, or a finger dragging on touch screens
  // (vertical page scroll stays with the browser via touch-action: pan-y). Until someone
  // touches it, it drifts slowly over the headline so the effect is discoverable.
  function initLens(hero) {
    var proof = hero.querySelector('.proof');
    var revealBtn = hero.querySelector('.reveal');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var openLabel = revealBtn.textContent, closeLabel = revealBtn.getAttribute('data-close-label');
    var followed = false, used = false, t = 0, closingTimer;

    function setLens(x, y) { hero.style.setProperty('--x', x + 'px'); hero.style.setProperty('--y', y + 'px'); }
    function fromEvent(e) { var r = hero.getBoundingClientRect(); setLens(e.clientX - r.left, e.clientY - r.top); }
    function onControl(e) { return e.target.closest('a, button'); }
    function markUsed() {
      followed = true;
      if (!used) { used = true; hero.dispatchEvent(new CustomEvent('lens:use', { bubbles: true })); }
    }

    hero.addEventListener('pointermove', function (e) {
      if (hero.classList.contains('open') || onControl(e)) return;
      if (e.pointerType === 'mouse' || e.buttons) { markUsed(); fromEvent(e); }
    });
    hero.addEventListener('pointerdown', function (e) {
      if (hero.classList.contains('open') || onControl(e)) return;
      markUsed(); fromEvent(e);
    });

    // 'closing' exists only while the lens shrinks back; left in place it would animate
    // every later lens move and the lens would lag behind the pointer.
    function endClosing() { hero.classList.remove('closing'); clearTimeout(closingTimer); }
    proof.addEventListener('transitionend', function (e) { if (e.propertyName === 'clip-path') endClosing(); });
    revealBtn.addEventListener('click', function () {
      var open = !hero.classList.contains('open');
      hero.classList.toggle('open', open);
      if (open) endClosing();
      else { hero.classList.add('closing'); clearTimeout(closingTimer); closingTimer = setTimeout(endClosing, 700); }
      revealBtn.textContent = open ? closeLabel : openLabel;
      revealBtn.setAttribute('aria-pressed', String(open));
      if (open) hero.dispatchEvent(new CustomEvent('lens:reveal', { bubbles: true }));
    });

    function drift() {
      if (!followed && !hero.classList.contains('open')) {
        var r = hero.getBoundingClientRect();
        t += 0.0025;
        setLens(r.width * (0.3 + 0.16 * Math.cos(t * 2)), r.height * (0.47 + 0.1 * Math.sin(t * 3)));
      }
      window.requestAnimationFrame(drift);
    }
    // Without motion the documents are simply shown, open, with the button to go back to the lens.
    if (reduce) { hero.classList.add('open'); revealBtn.textContent = closeLabel; revealBtn.setAttribute('aria-pressed', 'true'); }
    else drift();
  }

  // Documentări filters: show the items of one type; without JS every item stays visible.
  function initFilters(group) {
    var buttons = group.querySelectorAll('button[data-filter]');
    var items = document.querySelectorAll('.doc-item');
    Array.prototype.forEach.call(buttons, function (btn) {
      btn.addEventListener('click', function () {
        var f = btn.getAttribute('data-filter');
        Array.prototype.forEach.call(buttons, function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
        Array.prototype.forEach.call(items, function (it) { it.hidden = f !== 'toate' && it.getAttribute('data-type') !== f; });
        group.dispatchEvent(new CustomEvent('acd:filter', { bubbles: true, detail: { filter: f } }));
      });
    });
  }

  // Article sharing: "Copiază linkul" copies the page URL; share links announce themselves for analytics.
  function initShare() {
    // Old-style copy for browsers that block the Clipboard API (permission denied, plain http).
    function copyFallback(text) {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(area);
      return ok;
    }
    // [data-copy-link] copies the page address; [data-copy-text] copies its own value (e.g. the e-mail address).
    Array.prototype.forEach.call(document.querySelectorAll('[data-copy-link], [data-copy-text]'), function (btn) {
      var label = btn.textContent;
      var status = btn.parentNode.querySelector('.share-status');
      function report(ok) {
        var message = btn.getAttribute(ok ? 'data-done-label' : 'data-fail-label');
        if (status) status.textContent = message;
        if (ok) btn.textContent = message;
        setTimeout(function () { btn.textContent = label; if (status) status.textContent = ''; }, ok ? 2000 : 6000);
      }
      btn.addEventListener('click', function () {
        var text = btn.hasAttribute('data-copy-text') ? btn.getAttribute('data-copy-text') : location.href;
        if (navigator.clipboard && window.isSecureContext) {
          // Some browsers leave the promise pending (permission prompt never shown): fall back after 1.5 s.
          var settled = false;
          var settle = function (ok) { if (!settled) { settled = true; report(ok); } };
          setTimeout(function () { if (!settled) settle(copyFallback(text)); }, 1500);
          navigator.clipboard.writeText(text).then(function () { settle(true); }, function () { settle(copyFallback(text)); });
        } else {
          report(copyFallback(text));
        }
        if (btn.hasAttribute('data-copy-text')) acdTrack('contact_click', { method: 'copy_address' });
        else btn.dispatchEvent(new CustomEvent('acd:share', { bubbles: true, detail: { method: 'copy' } }));
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-share]'), function (a) {
      a.addEventListener('click', function () {
        a.dispatchEvent(new CustomEvent('acd:share', { bubbles: true, detail: { method: a.getAttribute('data-share') } }));
      });
    });
  }

  // Library search: matches the readable name and the file name, ignoring case and diacritics.
  function searchKey(s) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function initLibrarySearch(input) {
    var items = Array.prototype.slice.call(document.querySelectorAll('.lib-item'));
    var groups = Array.prototype.slice.call(document.querySelectorAll('.lib-group'));
    var status = document.querySelector('.lib-status');
    var timer;
    input.addEventListener('input', function () {
      var q = searchKey(input.value.trim()), shown = 0;
      items.forEach(function (it) {
        var hit = !q || it.getAttribute('data-name').indexOf(q) !== -1;
        it.hidden = !hit;
        if (hit) shown++;
      });
      groups.forEach(function (g) { g.hidden = !g.querySelector('.lib-item:not([hidden])'); });
      status.textContent = !q ? '' : shown ? shown + (shown === 1 ? ' document găsit' : (shown % 100 >= 20 || shown % 100 === 0 ? ' de documente găsite' : ' documente găsite')) : input.getAttribute('data-empty');
      clearTimeout(timer);
      if (q) timer = setTimeout(function () {
        input.dispatchEvent(new CustomEvent('acd:search', { bubbles: true, detail: { term: input.value.trim() } }));
      }, 800);
    });
  }

  // Consent + Google Analytics (spec §14.1). The <head> sets Consent Mode v2 to 'denied';
  // gtag.js is only fetched after "Accept". The choice lives in localStorage, never on the server.
  var GA_SRC = 'https://www.googletagmanager.com/gtag/js?id=G-T8T97JEXXG';
  var CONSENT_KEY = 'acd-consent';
  var gaLoaded = false;

  function storedConsent() {
    try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; }
  }
  function storeConsent(value) {
    try { localStorage.setItem(CONSENT_KEY, value); } catch (e) { /* private mode: ask again next visit */ }
  }
  function loadAnalytics() {
    if (gaLoaded) return;
    gaLoaded = true;
    window['ga-disable-G-T8T97JEXXG'] = false;
    window.gtag('consent', 'update', { 'analytics_storage': 'granted' });
    window.gtag('js', new Date());
    window.gtag('config', 'G-T8T97JEXXG');
    var s = document.createElement('script');
    s.async = true;
    s.src = GA_SRC;
    document.head.appendChild(s);
  }
  function clearAnalyticsCookies() {
    document.cookie.split(';').forEach(function (c) {
      var name = c.split('=')[0].trim();
      if (name === '_ga' || name.indexOf('_ga_') === 0) {
        ['', '; domain=.' + location.hostname.replace(/^www\./, '')].forEach(function (domain) {
          document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + domain;
        });
      }
    });
  }
  function acdTrack(name, params) {
    if (storedConsent() === 'granted' && typeof window.gtag === 'function') window.gtag('event', name, params || {});
  }
  window.acdTrack = acdTrack;

  function initConsent() {
    var banner = document.getElementById('consent');
    if (!banner) return;
    if (storedConsent() === 'granted') loadAnalytics();
    else if (storedConsent() !== 'denied') banner.hidden = false;
    banner.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-consent]');
      if (!btn) return;
      var value = btn.getAttribute('data-consent');
      storeConsent(value);
      banner.hidden = true;
      if (value === 'granted') loadAnalytics();
      else {
        window.gtag('consent', 'update', { 'analytics_storage': 'denied' });
        window['ga-disable-G-T8T97JEXXG'] = true;  // stops a gtag.js already loaded on this page
        clearAnalyticsCookies();
      }
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-open-consent]'), function (b) {
      b.addEventListener('click', function () { banner.hidden = false; banner.querySelector('button').focus(); });
    });
  }

  // Measured events (only sent with consent).
  function initAnalyticsEvents() {
    var ownHost = location.hostname.replace(/^www\./, '');
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href');
      if (/^(mailto|tel):/i.test(href)) { acdTrack('contact_click', { method: href.split(':')[0] }); return; }
      if (a.hasAttribute('data-contact')) { acdTrack('contact_click', { method: a.getAttribute('data-contact') }); return; }
      var url = new URL(a.href, location.href);
      var internal = url.hostname.replace(/^www\./, '') === ownHost;
      if (internal && /\.(pdf|jpe?g|png)$/i.test(url.pathname)) {
        var parts = decodeURIComponent(url.pathname).split('/').filter(Boolean);
        acdTrack('file_download', { file_name: parts[parts.length - 1], folder: parts.length > 1 ? parts[0] : '/' });
      } else if (!internal && /^https?:$/.test(url.protocol) && !a.hasAttribute('data-share')) {
        acdTrack('outbound_click', { link_url: url.href });
      }
    });
    document.addEventListener('lens:use', function () { acdTrack('lens_use'); });
    document.addEventListener('lens:reveal', function () { acdTrack('reveal_documents'); });
    document.addEventListener('acd:filter', function (e) { acdTrack('filter_use', { filter: e.detail.filter }); });
    document.addEventListener('acd:search', function (e) { acdTrack('search', { search_term: e.detail.term }); });
    document.addEventListener('acd:share', function (e) { acdTrack('share', { method: e.detail.method }); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initMenu();
    initShare();
    initConsent();
    initAnalyticsEvents();
    var search = document.getElementById('cauta');
    if (search) initLibrarySearch(search);
    var filters = document.querySelector('.filters');
    if (filters) initFilters(filters);
    var hero = document.getElementById('hero');
    if (hero) initLens(hero);
  });
})();
