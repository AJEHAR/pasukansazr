// ============================================================
//  SAZR Pasukan — api.js  (FASA 2: google.script.run Shim)
//
//  Fail ini mencipta semula google.script.run API menggunakan
//  fetch() biasa, supaya SEMUA kod dalam index.html berfungsi
//  TANPA sebarang perubahan.
//
//  Cara kerja:
//  1. Proxy intercept setiap .namaFungsi(args) call
//  2. Hantar sebagai POST ke Apps Script Web App URL
//  3. Panggil successHandler/failureHandler mengikut response
//
//  ─── KONFIGURASI ───────────────────────────────────────────
//  Tukar nilai GAS_URL di bawah dengan URL deployment anda.
//  Dapatkan URL dari:
//    Apps Script Editor → Deploy → Manage Deployments
//    → (klik deployment) → URL (bentuk .../exec)
// ============================================================

// ┌─────────────────────────────────────────────────────────┐
// │  ⚙️  TUKAR URL INI DENGAN DEPLOYMENT URL ANDA           │
// └─────────────────────────────────────────────────────────┘
var GAS_URL = 'https://script.google.com/macros/s/AKfycbwQgAWOGrNwVRetQEHCnUsjFnXCR6dIpz3_sqqaiOQXNXJRMDXoBa0VRoXPUc01sGSvaw/exec';


// ─────────────────────────────────────────────────────────────
//  Jangan ubah apa-apa di bawah kecuali anda faham cara kerja
// ─────────────────────────────────────────────────────────────

(function (url) {
  'use strict';

  // Guard: kalau dah dalam Apps Script native (doGet serve),
  // google.script.run sudah ada — shim tidak diperlukan.
  if (
    typeof google !== 'undefined' &&
    google.script &&
    typeof google.script.run !== 'undefined' &&
    !google.script.run._sazrShim
  ) {
    console.log('[api.js] Dalam Apps Script native — shim tidak dipasang.');
    return;
  }

  // Amaran jika URL belum dikonfigurasi
  if (!url || url.indexOf('TUKAR_ID_INI') !== -1) {
    console.warn(
      '[api.js] ⚠️  GAS_URL belum dikonfigurasi!\n' +
      'Buka js/api.js dan tukar nilai GAS_URL dengan URL deployment Apps Script anda.'
    );
  }

  // ────────────────────────────────────────────────────────
  //  _buatRunner()
  //
  //  Mencipta satu "runner" context untuk satu chain panggilan:
  //    google.script.run
  //      .withSuccessHandler(fn)    ← stored dalam runner ini
  //      .withFailureHandler(fn)    ← stored dalam runner ini
  //      .namaFungsi(arg0, arg1)    ← execute fetch
  //
  //  Setiap kali .run diakses, runner BARU dicipta supaya
  //  handler tidak bercampur antara panggilan berbeza.
  // ────────────────────────────────────────────────────────
  function _buatRunner() {
    var _onSuccess = null;
    var _onFailure = null;

    // Proxy trap — intercept semua property access pada runner
    var trap = {
      get: function (target, prop) {

        // ── Setter: .withSuccessHandler(fn) ───────────────
        if (prop === 'withSuccessHandler') {
          return function (fn) {
            _onSuccess = typeof fn === 'function' ? fn : null;
            return new Proxy({}, trap);
          };
        }

        // ── Setter: .withFailureHandler(fn) ───────────────
        if (prop === 'withFailureHandler') {
          return function (fn) {
            _onFailure = typeof fn === 'function' ? fn : null;
            return new Proxy({}, trap);
          };
        }

        // ── Marker untuk guard check di atas ──────────────
        if (prop === '_sazrShim') return true;

        // ── Panggilan fungsi sebenar ───────────────────────
        // prop    = nama fungsi (cth: 'prosesLogin', 'dbTambahPeserta')
        // ...args = semua argument yang dihantar
        return function () {
          var args = Array.prototype.slice.call(arguments);
          var actionName = String(prop);

          // Log panggilan (boleh disable dalam production)
          console.log('[api.js] ▶ ' + actionName + '()', args.length > 0 ? args : '');

          // Hantar ke Apps Script REST API
          fetch(url, {
            method : 'POST',
            // Content-Type: text/plain — elak CORS preflight OPTIONS request
            // Body tetap JSON string yang valid
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body   : JSON.stringify({ action: actionName, args: args })
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
              // Kalau tiada failure handler, log sahaja
              console.error('[api.js] (tiada withFailureHandler dipasang untuk ' + actionName + ')');
            }
          });
        };
      }
    };

    return new Proxy({}, trap);
  }


  // ────────────────────────────────────────────────────────
  //  Pasang window.google
  //
  //  google.script.run menggunakan getter supaya setiap kali
  //  .run diakses, runner BARU dicipta (context bersih).
  //  Ini sama dengan tingkah laku Google Apps Script native.
  // ────────────────────────────────────────────────────────
  Object.defineProperty(window, 'google', {
    value: {
      script: {
        get run() {
          return _buatRunner();
        },
        // Stub untuk google.script.url.getScriptUrl() jika dipanggil
        url: {
          getScriptUrl: function () { return url; },
          getActiveUserLocale: function () { return 'ms'; }
        },
        // Stub untuk history API (kadang digunakan dalam GAS apps)
        history: {
          push: function () {},
          replace: function () {}
        }
      }
    },
    writable  : true,
    enumerable: true,
    configurable: true
  });

  console.log('[api.js] ✅ google.script.run shim aktif');
  console.log('[api.js] 🎯 Endpoint: ' + url);

})(
  // Ambil GAS_URL dari window.GAS_URL (boleh override dalam HTML)
  // atau guna nilai yang ditetapkan di atas
  (typeof window !== 'undefined' && window.GAS_URL) || GAS_URL
);
