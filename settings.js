/* settings.js — Unified settings: localStorage for anon, Supabase for logged-in
 *
 * Exposes:
 *   window.Settings.get(key)         → value (sync, from cache)
 *   window.Settings.set(key, value)  → saves to localStorage and/or Supabase
 *   window.Settings.load()           → Promise (fetches from Supabase if logged in)
 */
(function () {
  'use strict';

  var SETTINGS_KEYS = ['lastTab', 'lastSection', 'siteLanguage'];
  var _cache = {};

  /* ── Load settings ── */
  function load() {
    // Always start with localStorage
    SETTINGS_KEYS.forEach(function (k) {
      var v = localStorage.getItem(k);
      if (v !== null) _cache[k] = v;
    });

    if (!window.sb || !window.currentUser || !window.currentUser.isLoggedIn) {
      return Promise.resolve(_cache);
    }

    // Fetch from Supabase — DB wins on conflict
    return window.sb.from('user_settings')
      .select('settings')
      .eq('user_id', window.currentUser.id)
      .maybeSingle()
      .then(function (res) {
        if (res.data && res.data.settings) {
          var db = res.data.settings;
          Object.keys(db).forEach(function (k) {
            _cache[k] = db[k];
            localStorage.setItem(k, db[k]);
          });
        }
        return _cache;
      });
  }

  /* ── Get a setting (sync, from cache) ── */
  function get(key) {
    if (_cache[key] !== undefined) return _cache[key];
    return localStorage.getItem(key);
  }

  /* ── Set a setting ── */
  function set(key, value) {
    _cache[key] = value;
    localStorage.setItem(key, value);

    if (window.sb && window.currentUser && window.currentUser.isLoggedIn) {
      // Upsert to Supabase
      var settings = {};
      SETTINGS_KEYS.forEach(function (k) {
        var v = localStorage.getItem(k);
        if (v !== null) settings[k] = v;
      });
      window.sb.from('user_settings')
        .upsert({ user_id: window.currentUser.id, settings: settings, updated_at: new Date().toISOString() })
        .then(function (res) {
          if (res.error) console.warn('[settings] save error', res.error);
        });
    }
  }

  /* ── Public API ── */
  window.Settings = {
    get: get,
    set: set,
    load: load
  };

  // Initialize from localStorage immediately
  SETTINGS_KEYS.forEach(function (k) {
    var v = localStorage.getItem(k);
    if (v !== null) _cache[k] = v;
  });
})();
