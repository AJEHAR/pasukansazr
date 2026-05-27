// ============================================================
//  SAZR Pasukan — api.js
//  Tukar GAS_URL dengan URL deployment Apps Script terbaru anda
// ============================================================

// ⚠️  TUKAR BARIS INI — salin URL dari Apps Script → Deploy → Manage deployments
var GAS_URL = 'https://script.google.com/macros/s/AKfycbyV0uBXZYIprrPMb9LRaeo3198P2Um96-L3xymCYhimzj5uGCIOmzkRHVdXgE8fuuM-lA/exec';


// ─── Jangan ubah apa-apa di bawah ─────────────────────────

(function (url) {
  'use strict';

  if (typeof google !== 'undefined' && google.script &&
      typeof google.script.run !== 'undefined' && !google.script.run._sazrShim) {
    return;
  }

  if (!url || url.indexOf('TUKAR') !== -1) {
    console.warn('[api.js] ⚠️  GAS_URL belum diisi!');
  }

  function _encode(action, args) {
    return btoa(unescape(encodeURIComponent(JSON.stringify({ action: action, args: args }))));
  }

  function _jsonpCall(action, args) {
    return new Promise(function (resolve, reject) {
      var cbName  = '_sazr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      var script  = null;
      var timer   = setTimeout(function () {
        cleanup();
        reject(new Error('Timeout 30s — semak GAS_URL dan status deployment'));
      }, 30000);

      function cleanup() {
        clearTimeout(timer);
        if (script && script.parentNode) script.parentNode.removeChild(script);
        try { delete window[cbName]; } catch(e) {}
      }

      window[cbName] = function (data) { cleanup(); resolve(data); };

      script       = document.createElement('script');
      script.async = true;
      script.src   = url + '?callback=' + encodeURIComponent(cbName) +
                         '&body='     + encodeURIComponent(_encode(action, args));
      script.onerror = function () {
        cleanup();
        reject(new Error('Gagal sambung ke Apps Script — semak GAS_URL'));
      };
      document.head.appendChild(script);
    });
  }

  function _buatRunner() {
    var _ok = null, _fail = null;
    var trap = {
      get: function (t, prop) {
        if (prop === 'withSuccessHandler') return function (fn) { _ok = fn; return new Proxy({}, trap); };
        if (prop === 'withFailureHandler') return function (fn) { _fail = fn; return new Proxy({}, trap); };
        if (prop === '_sazrShim') return true;
        return function () {
          var args = Array.prototype.slice.call(arguments);
          var act  = String(prop);
          console.log('[api.js] ▶ ' + act, args.length ? args : '');
          _jsonpCall(act, args)
            .then(function (d) { console.log('[api.js] ◀ ' + act, d); if (_ok) _ok(d); })
            .catch(function (e) { console.error('[api.js] ✗ ' + act, e.message); if (_fail) _fail(e); });
        };
      }
    };
    return new Proxy({}, trap);
  }

  Object.defineProperty(window, 'google', {
    value: { script: { get run() { return _buatRunner(); } } },
    writable: true, configurable: true
  });

  console.log('[api.js] ✅ Aktif →', url);

})((typeof window !== 'undefined' && window.GAS_URL) || GAS_URL);
