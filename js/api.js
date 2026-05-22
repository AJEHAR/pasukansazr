// ============================================================
//  SAZR Pasukan — api.js  (v2.1 — CORS Fix Edition)
//
//  FIX: Tukar POST → GET dengan payload Base64 dalam ?body=
//
//  Kenapa ini fix CORS?
//  ┌─────────────────────────────────────────────────────────┐
//  │  POST → script.google.com → 302 (tiada CORS) → BLOCK ❌ │
//  │  GET  → script.google.com → 302 → follow → CORS OK ✅   │
//  └─────────────────────────────────────────────────────────┘
//
//  Cara encode payload:
//    JSON({action, args}) → UTF-8 bytes → Base64 → ?body=...
//
//  Apps Script decode:
//    Utilities.base64Decode() → Blob.getDataAsString('UTF-8') → JSON.parse()
//
//  ─── KONFIGURASI ────────────────────────────────────────────
//  Tukar GAS_URL dengan URL deployment Apps Script anda.
//  Apps Script Editor → Deploy → Manage Deployments → URL (/exec)
// ============================================================

// ┌─────────────────────────────────────────────────────────┐
// │  ⚙️  TUKAR URL INI DENGAN DEPLOYMENT URL ANDA           │
// └─────────────────────────────────────────────────────────┘
var GAS_URL = 'https://script.google.com/macros/s/AKfycbwQgAWOGrNwVRetQEHCnUsjFnXCR6dIpz3_sqqaiOQXNXJRMDXoBa0VRoXPUc01sGSvaw/exec';

// Contoh:
// var GAS_URL = 'https://script.google.com/macros/s/AKfycbwQgAWO.../exec';


// ─────────────────────────────────────────────────────────────
//  Jangan ubah di bawah
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
    console.warn('[api.js] ⚠️  GAS_URL belum dikonfigurasi! Buka js/api.js dan isi URL deployment.');
  }


  // ────────────────────────────────────────────────────────
  //  _encodePayload(action, args)
  //
  //  Encode payload untuk dihantar sebagai GET query param.
  //
  //  Steps:
  //  1. JSON.stringify → string
  //  2. encodeURIComponent → escape Unicode
  //  3. unescape → byte string (hack untuk TextEncoder polyfill)
  //  4. btoa() → Base64
  //
  //  Apps Script decode dengan:
  //    Utilities.base64Decode() + Blob.getDataAsString('UTF-8')
  // ────────────────────────────────────────────────────────
  function _encodePayload(action, args) {
    var jsonStr = JSON.stringify({ action: action, args: args });
    // Encode Unicode → bytes yang boleh btoa() handle
    var encoded = btoa(unescape(encodeURIComponent(jsonStr)));
    return encoded;
  }


  // ────────────────────────────────────────────────────────
  //  _buatRunner()
  //
  //  Sama seperti v2.0 tapi guna GET + ?body= bukannya POST.
  //  Setiap akses pada google.script.run = runner baru.
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

        // ── Panggilan fungsi ─────────────────────────────
        return function () {
          var args       = Array.prototype.slice.call(arguments);
          var actionName = String(prop);

          console.log('[api.js] ▶ ' + actionName + '()', args.length ? args : '');

          // Encode payload → Base64
          var b64;
          try {
            b64 = _encodePayload(actionName, args);
          } catch (encErr) {
            console.error('[api.js] ✗ Encode error:', encErr);
            if (_onFailure) _onFailure(encErr);
            return;
          }

          // GET request dengan ?body=BASE64
          // GET tidak trigger preflight, redirect di-follow dengan betul
          fetch(url + '?body=' + encodeURIComponent(b64), {
            method : 'GET',
            headers: { 'Accept': 'application/json' }
          })
          .then(function (response) {
            if (!response.ok) {
              throw new Error('HTTP ' + response.status + ' — ' + response.statusText);
            }
            return response.json();
          })
          .then(function (data) {
            console.log('[api.js] ◀ ' + actionName + '()', data);
            if (_onSuccess) _onSuccess(data);
          })
          .catch(function (err) {
            console.error('[api.js] ✗ ' + actionName + '() RALAT:', err);
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
  //  Pasang window.google
  // ────────────────────────────────────────────────────────
  Object.defineProperty(window, 'google', {
    value: {
      script: {
        get run() {
          return _buatRunner();
        },
        url: {
          getScriptUrl: function () { return url; },
          getActiveUserLocale: function () { return 'ms'; }
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

  console.log('[api.js] ✅ Shim aktif (GET mode — CORS fix)');
  console.log('[api.js] 🎯 Endpoint: ' + url);

})(
  (typeof window !== 'undefined' && window.GAS_URL) || GAS_URL
);
