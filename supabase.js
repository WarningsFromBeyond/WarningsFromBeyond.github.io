/* supabase.js — Supabase client initialization (loaded before app.js) */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://ngrdyxbwdamzwficlten.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_hUuNRZ9iukgPhtYbePXP9w_0tEYfuYP';

  if (typeof supabase === 'undefined' || !supabase.createClient) {
    console.error('[supabase.js] Supabase SDK not loaded — check index.html script order');
    window.sb = null;
    return;
  }

  window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
})();
