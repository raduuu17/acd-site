// ACD site behaviour. Every page works without this file; it only adds interaction.
(function () {
  'use strict';

  // Mobile menu: a small dropdown under the button. The button opens and closes it ("Meniu" / "Închide");
  // Esc, a tap outside or choosing a link closes it too.
  function initMenu() {
    var toggle = document.querySelector('.menu-toggle');
    var menu = document.getElementById('menu');
    if (!toggle || !menu) return;
    var label = toggle.querySelector('.menu-label');
    var openLabel = label.textContent, closeLabel = toggle.getAttribute('data-close-label');

    function isOpen() { return menu.classList.contains('open'); }
    function setOpen(open, focusToggle) {
      menu.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      label.textContent = open ? closeLabel : openLabel;
      if (open) menu.querySelector('a').focus();
      else if (focusToggle) toggle.focus();
    }
    toggle.addEventListener('click', function () { setOpen(!isOpen(), false); });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a') && isOpen()) setOpen(false, false);
    });
    document.addEventListener('click', function (e) {
      if (isOpen() && !menu.contains(e.target) && !toggle.contains(e.target)) setOpen(false, false);
    });
    document.addEventListener('keydown', function (e) {
      if (isOpen() && e.key === 'Escape') setOpen(false, true);
    });
  }

  // Magnifier hero. Desktop: a round lens follows the mouse (or a dragging finger) and, until someone
  // touches it, drifts slowly over the headline so the effect is discoverable.
  // Phones and tablets (≤ 960px, same breakpoint as site.css): the lens is a band one headline line tall.
  // It moves from line to line by itself, one pair "declared → documented" at a time. A tap anywhere on
  // the hero shows all the documents, another tap goes back to the lens (the small button does the same
  // for keyboards and screen readers). Vertical finger drags stay a page scroll (touch-action: pan-y).
  function initLens(hero) {
    var proof = hero.querySelector('.proof');
    var ring = hero.querySelector('.lens-ring');
    var revealBtn = hero.querySelector('.reveal');
    var saidLines = hero.querySelectorAll('.said .lines span');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var phone = window.matchMedia('(max-width: 960px)');
    var openLabel = revealBtn.textContent, closeLabel = revealBtn.getAttribute('data-close-label');
    var followed = false, t = 0, closingTimer, line = 0;
    var STEP_MS = 2000;

    function isOpen() { return hero.classList.contains('open'); }
    function setLens(x, y) { hero.style.setProperty('--x', x + 'px'); hero.style.setProperty('--y', y + 'px'); }
    function fromEvent(e) { var r = hero.getBoundingClientRect(); setLens(e.clientX - r.left, e.clientY - r.top); }
    function onControl(e) { return e.target.closest('a, button'); }
    function markUsed() {
      if (!followed) hero.dispatchEvent(new CustomEvent('lens:use', { bubbles: true }));
      followed = true;
    }

    // Band mode: centre the band on headline line i and make it that line tall (+ 6px above and below).
    // A light sweeps across the band each time it lands on a new line.
    function bandTo(i) {
      var next = (i + saidLines.length) % saidLines.length;
      if (next !== line) { ring.classList.remove('sweep'); void ring.offsetWidth; ring.classList.add('sweep'); }
      line = next;
      var r = hero.getBoundingClientRect(), s = saidLines[line].getBoundingClientRect();
      hero.style.setProperty('--lens', Math.round(s.height / 2 + 6) + 'px');
      setLens(r.width / 2, s.top - r.top + s.height / 2);
    }
    // Entering band mode measures the lines; leaving it hands --lens back to the stylesheet token.
    function applyMode() {
      if (phone.matches) bandTo(line);
      else hero.style.removeProperty('--lens');
    }

    hero.addEventListener('pointermove', function (e) {
      if (phone.matches || isOpen() || onControl(e)) return;
      if (e.pointerType === 'mouse' || e.buttons) { markUsed(); fromEvent(e); }
    });
    hero.addEventListener('pointerdown', function (e) {
      if (phone.matches || isOpen() || onControl(e)) return;
      markUsed(); fromEvent(e);
    });
    // Band mode: a tap (click, so a scroll that started on the hero does not count) opens or closes the documents.
    hero.addEventListener('click', function (e) {
      if (!phone.matches || onControl(e)) return;
      setOpen(!isOpen());
    });
    window.addEventListener('resize', applyMode);
    if (phone.addEventListener) phone.addEventListener('change', applyMode); else phone.addListener(applyMode);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(applyMode);

    // 'closing' exists only while the lens shrinks back; left in place it would animate
    // every later lens move and the lens would lag behind the pointer.
    function endClosing() { hero.classList.remove('closing'); clearTimeout(closingTimer); }
    proof.addEventListener('transitionend', function (e) { if (e.propertyName === 'clip-path') endClosing(); });
    function setOpen(open) {
      hero.classList.toggle('open', open);
      if (open) endClosing();
      else { hero.classList.add('closing'); clearTimeout(closingTimer); closingTimer = setTimeout(endClosing, 700); }
      revealBtn.textContent = open ? closeLabel : openLabel;
      revealBtn.setAttribute('aria-pressed', String(open));
      if (open) hero.dispatchEvent(new CustomEvent('lens:reveal', { bubbles: true }));
    }
    revealBtn.addEventListener('click', function () { setOpen(!isOpen()); });

    // Desktop drift runs per frame; the band steps on a plain timer, which keeps going where a phone
    // browser slows or pauses animation frames.
    function drift() {
      if (!phone.matches && !followed && !isOpen()) {
        var r = hero.getBoundingClientRect();
        t += 0.0025;
        setLens(r.width * (0.3 + 0.16 * Math.cos(t * 2)), r.height * (0.47 + 0.1 * Math.sin(t * 3)));
      }
      window.requestAnimationFrame(drift);
    }
    function stepBand() {
      if (phone.matches && !isOpen()) bandTo(line + 1);
    }
    applyMode();
    // Without motion: on desktop the documents are simply shown, open, with the button to go back to the lens.
    // Phones always start on the lens; with reduced motion the band jumps from line to line without sliding.
    if (reduce && !phone.matches) setOpen(true);
    if (!reduce) drift();
    setInterval(stepBand, STEP_MS);
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
