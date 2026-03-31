/* likes.js — Heart / like system backed by Supabase
 *
 * Exposes:
 *   window.Likes.fetchCounts(readingKeys)   → Promise → { key: { count, liked } }
 *   window.Likes.toggle(readingKey)          → Promise → { count, liked }
 *   window.Likes.refreshVisible()            → re-fetches counts for all visible hearts
 */
(function () {
  'use strict';

  /* ── Helpers ── */
  function getAnonId() {
    return window.getAnonId ? window.getAnonId() : (localStorage.getItem('anon_id') || '');
  }

  /* ── Fetch counts + liked status for a batch of reading keys ── */
  function fetchCounts(keys) {
    if (!window.sb || !keys || !keys.length) return Promise.resolve({});

    // Get all likes for requested keys
    return window.sb.from('likes').select('reading_key, user_id, anon_id')
      .in('reading_key', keys)
      .then(function (res) {
        if (res.error) { console.error('[likes]', res.error); return {}; }

        var result = {};
        var userId = window.currentUser && window.currentUser.id;
        var anonId = getAnonId();

        // Initialize all keys
        keys.forEach(function (k) { result[k] = { count: 0, liked: false }; });

        // Count + check liked
        (res.data || []).forEach(function (row) {
          var k = row.reading_key;
          if (!result[k]) result[k] = { count: 0, liked: false };
          result[k].count++;
          if (userId && row.user_id === userId) result[k].liked = true;
          if (!userId && anonId && row.anon_id === anonId) result[k].liked = true;
        });

        return result;
      });
  }

  /* ── Toggle like for a reading key ── */
  function toggle(readingKey) {
    if (!window.sb || !readingKey) return Promise.resolve(null);

    var userId = window.currentUser && window.currentUser.id;
    var anonId = userId ? null : getAnonId();

    // Check if already liked
    var query = window.sb.from('likes').select('id').eq('reading_key', readingKey);
    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.eq('anon_id', anonId);
    }

    return query.maybeSingle().then(function (res) {
      if (res.data) {
        // Unlike — delete the row
        return window.sb.from('likes').delete().eq('id', res.data.id)
          .then(function () {
            // Also remove from localStorage
            localStorage.removeItem('liked:' + readingKey);
            return fetchSingleCount(readingKey);
          });
      } else {
        // Like — insert
        var row = { reading_key: readingKey };
        if (userId) {
          row.user_id = userId;
        } else {
          row.anon_id = anonId;
        }
        return window.sb.from('likes').insert(row)
          .then(function (insertRes) {
            if (insertRes.error) { console.error('[likes] insert error', insertRes.error); }
            // Also save to localStorage as backup
            localStorage.setItem('liked:' + readingKey, '1');
            return fetchSingleCount(readingKey);
          });
      }
    });
  }

  /* ── Get count + liked for a single key (after toggle) ── */
  function fetchSingleCount(readingKey) {
    return fetchCounts([readingKey]).then(function (m) {
      return m[readingKey] || { count: 0, liked: false };
    });
  }

  /* ── Refresh all visible hearts on the page ── */
  function refreshVisible() {
    var btns = document.querySelectorAll('.like-btn[data-reading-key]');
    var keys = [];
    btns.forEach(function (b) {
      var k = b.getAttribute('data-reading-key');
      if (k && keys.indexOf(k) === -1) keys.push(k);
    });
    if (!keys.length) return;

    fetchCounts(keys).then(function (counts) {
      btns.forEach(function (b) {
        var k = b.getAttribute('data-reading-key');
        var info = counts[k] || { count: 0, liked: false };
        applyHeartState(b, info);
      });
    });
  }

  /* ── Apply visual state to a heart button ── */
  function applyHeartState(btn, info) {
    if (info.liked) {
      btn.classList.add('liked');
    } else {
      btn.classList.remove('liked');
    }
    var countEl = btn.querySelector('.like-count');
    if (countEl) {
      countEl.textContent = info.count > 0 ? info.count : '';
    }
  }

  /* ── Public API ── */
  window.Likes = {
    fetchCounts: fetchCounts,
    toggle: toggle,
    refreshVisible: refreshVisible,
    applyHeartState: applyHeartState
  };
})();
