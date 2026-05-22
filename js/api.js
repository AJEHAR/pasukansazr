// ============================================================
//  SAZR Pasukan — api.js  (v3.0 — Cloudflare Worker Edition)
//
//  Penyelesaian KEKAL: hantar request ke Cloudflare Worker
//  Worker forward ke Apps Script (server-to-server, tiada CORS)
//
//  ─── KONFIGURASI ──────────────────────────────────────────
//  Tukar PROXY_URL dengan URL Cloudflare Worker anda.
//  Dapatkan URL dari: Cloudflare Dashboard → Workers → worker anda
//  Format: https://sazr-proxy.NAMAKAMU.workers.dev
// ============================================================

// ┌─────────────────────────────────────────────────────────┐
// │  ⚙️  TUKAR URL INI DENGAN URL CLOUDFLARE WORKER ANDA    │
// └─────────────────────────────────────────────────────────┘
var PROXY_URL = 'https://sazr-proxy.g-39150004.workers.dev';

// Contoh:
// var PROXY_URL = 'https://sazr-proxy.ajehar.workers.dev';


// ─────────────────────────────────────────────────────────────
(function (proxyUrl) {
  'use strict';

  // Guard: dalam Apps Script native — tidak perlu shim
  if (
    typeof google !== 'undefined' &&
    google.script &&
    typeof google.script.run !== 'undefined' &&
    !google.script.run._sazrShim
  ) {
    console.log('[api.js] Apps Script native — shim tidak dipasang.');
    return;
  }

  if (!proxyUrl || proxyUrl.indexOf('NAMAKAMU') !== -1) {
    console.warn(
      '[api.js] ⚠️  PROXY_URL belum dikonfigurasi!\n' +
      'Buka js/api.js dan tukar PROXY_URL dengan URL Cloudflare Worker anda.'
    );
  }


  // ────────────────────────────────────────────────────────
  //  _apicall(action, args) → Promise
  //
  //  Hantar POST ke Cloudflare Worker.
  //  Worker ada CORS header — tiada masalah CORS.
  //  Worker forward ke Apps Script server-side.
  // ────────────────────────────────────────────────────────
  function _apiCall(action, args) {
    return fetch(proxyUrl, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ action: action, args: args })
    })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('HTTP ' + response.status + ' dari Worker');
      }
      return response.json();
    });
  }


  // ────────────────────────────────────────────────────────
  //  _buatRunner()
  //  Proxy untuk google.script.run API
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

          _apiCall(actionName, args)
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
          getScriptUrl       : function () { return proxyUrl; },
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

  console.log('[api.js] ✅ Proxy shim aktif (via Cloudflare Worker)');
  console.log('[api.js] 🎯 Proxy: ' + proxyUrl);

})(
  (typeof window !== 'undefined' && window.PROXY_URL) || PROXY_URL
);
