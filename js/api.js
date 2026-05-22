// ============================================================
//  SAZR Pasukan — api.js  (v2.2 — JSONP Edition)
//
//  FIX CORS SEBENAR: Guna JSONP (<script> tag) bukannya fetch()
//
//  Kenapa JSONP?
//  ┌───────────────────────────────────────────────────────┐
//  │  fetch()       → 302 (tiada CORS header) → BLOCK ✗   │
//  │  <script src=> → tiada CORS restriction  → OK ✓      │
//  └───────────────────────────────────────────────────────┘
//
//  Cara kerja JSONP:
//  1. api.js cipta <script src="GAS_URL?callback=_fn123&body=BASE64">
//  2. Browser load script itu (tiada CORS check untuk script tag)
//  3. Apps Script balas:  _fn123({"status":"OK",...});
//  4. Browser execute → _fn123() dipanggil → successHandler runs
//
//  ─── KONFIGURASI ──────────────────────────────────────────
//  Tukar GAS_URL dengan URL deployment Apps Script anda.
// ============================================================

// ┌─────────────────────────────────────────────────────────┐
// │  ⚙️  TUKAR URL INI DENGAN DEPLOYMENT URL ANDA           │
// └─────────────────────────────────────────────────────────┘
var GAS_URL = 'https://script.google.com/macros/s/AKfycbyV0uBXZYIprrPMb9LRaeo3198P2Um96-L3xymCYhimzj5uGCIOmzkRHVdXgE8fuuM-lA/exec';


// ─────────────────────────────────────────────────────────────
(function (url) {
  'use strict';

  // Guard: dalam Apps Script native — skip
  if (
    typeof google !== 'undefined' &&
    google.script &&
    typeof google.script.run !== 'undefined' &&
    !google.script.run._sazrShim
  ) {
    console.log('[api.js] Apps Script native — shim tidak dipasang.');
    return;
  }

  if (!url || url.indexOf('TUKAR_ID_INI') !== -1) {
    console.warn('[api.js] ⚠️  GAS_URL belum dikonfigurasi!');
  }


  // ────────────────────────────────────────────────────────
  //  _encodePayload(action, args)
  //  JSON → UTF-8 → Base64 untuk dihantar dalam ?body=
  // ────────────────────────────────────────────────────────
  function _encodePayload(action, args) {
    var json = JSON.stringify({ action: action, args: args });
    // encodeURIComponent + unescape = cara encode UTF-8 ke byte string
    // untuk btoa() yang hanya terima Latin-1
    return btoa(unescape(encodeURIComponent(json)));
  }


  // ────────────────────────────────────────────────────────
  //  _jsonpCall(action, args) → Promise
  //
  //  Buat JSONP request:
  //  1. Jana nama callback unik: _sazr_<timestamp>_<random>
  //  2. Register window[callbackName] = resolve function
  //  3. Inject <script src="URL?callback=name&body=base64">
  //  4. Apps Script execute callback dengan data
  //  5. Cleanup script tag dan global function
  // ────────────────────────────────────────────────────────
  function _jsonpCall(action, args) {
    return new Promise(function (resolve, reject) {

      // Nama callback unik — elak konflik panggilan serentak
      var cbName = '_sazr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

      var script  = null;
      var timeout = null;

      // Cleanup: buang script tag dan global function
      function _cleanup() {
        clearTimeout(timeout);
        if (script && script.parentNode) {
          script.parentNode.removeChild(script);
        }
        try { delete window[cbName]; } catch(e) { window[cbName] = undefined; }
      }

      // Timeout 30 saat
      timeout = setTimeout(function () {
        _cleanup();
        reject(new Error('Timeout — tiada response selepas 30 saat.'));
      }, 30000);

      // Register callback global
      window[cbName] = function (data) {
        _cleanup();
        resolve(data);
      };

      // Bina URL: GAS_URL?callback=cbName&body=BASE64
      var b64 = _encodePayload(action, args);
      var src = url
        + '?callback=' + encodeURIComponent(cbName)
        + '&body='     + encodeURIComponent(b64);

      // Inject script tag
      script = document.createElement('script');
      script.src   = src;
      script.async = true;

      script.onerror = function () {
        _cleanup();
        reject(new Error('Gagal load script dari Apps Script. Semak GAS_URL dan status deployment.'));
      };

      document.head.appendChild(script);
    });
  }


  // ────────────────────────────────────────────────────────
  //  _buatRunner()
  //  Proxy untuk intercept google.script.run.xyz(args)
  //  Guna _jsonpCall() dalaman
  // ────────────────────────────────────────────────────────
  function _buatRunner() {
    var _onSuccess = null;
    var _onFailure = null;

    var trap = {
      get: function (target, prop) {

        if (prop === 'withSuccessHandler') {
          return function (fn) {
            _onSuccess = typeof fn === 'function' ? fn : null;
            return new Proxy({}, trap);
          };
        }

        if (prop === 'withFailureHandler') {
          return function (fn) {
            _onFailure = typeof fn === 'function' ? fn : null;
            return new Proxy({}, trap);
          };
        }

        if (prop === '_sazrShim') return true;

        // ── Panggilan fungsi sebenar ─────────────────────
        return function () {
          var args       = Array.prototype.slice.call(arguments);
          var actionName = String(prop);

          console.log('[api.js] ▶ JSONP: ' + actionName + '()', args.length ? args : '');

          _jsonpCall(actionName, args)
            .then(function (data) {
              console.log('[api.js] ◀ ' + actionName + '()', data);
              if (_onSuccess) _onSuccess(data);
            })
            .catch(function (err) {
              console.error('[api.js] ✗ ' + actionName + '():', err.message);
              if (_onFailure) {
                _onFailure(err);
              } else {
                console.warn('[api.js] (tiada withFailureHandler untuk ' + actionName + ')');
              }
            });
        };
      }
    };

    return new Proxy({}, trap);
  }


  // ────────────────────────────────────────────────────────
  //  Pasang window.google.script.run
  // ────────────────────────────────────────────────────────
  Object.defineProperty(window, 'google', {
    value: {
      script: {
        get run() {
          return _buatRunner();
        },
        url: {
          getScriptUrl         : function () { return url; },
          getActiveUserLocale  : function () { return 'ms'; }
        },
        history: {
          push   : function () {},
          replace: function () {}
        }
      }
    },
    writable    : true,
    enumerable  : true,
    configurable: true
  });

  console.log('[api.js] ✅ JSONP shim aktif');
  console.log('[api.js] 🎯 Endpoint: ' + url);

})(
  (typeof window !== 'undefined' && window.GAS_URL) || GAS_URL
);
