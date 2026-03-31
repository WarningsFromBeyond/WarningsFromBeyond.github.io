/* auth.js — Supabase auth state + login/signup modal
 *
 * Exposes:
 *   window.currentUser = { id, email, role, isAdmin, isLoggedIn }
 *   window.Auth.showLoginModal()
 *   window.Auth.signOut()
 *   window.Auth.onReady(cb)   — fires once profile is loaded (or anon confirmed)
 *   window.Auth.onChange(cb)   — fires on every auth state change
 */
(function () {
  'use strict';

  /* ── State ── */
  window.currentUser = { id: null, email: null, role: 'anon', isAdmin: false, isLoggedIn: false };
  var _readyCbs = [];
  var _changeCbs = [];
  var _ready = false;

  /* ── Anonymous ID (stable per browser) ── */
  function getAnonId() {
    var id = localStorage.getItem('anon_id');
    if (!id) {
      id = 'anon-' + crypto.randomUUID();
      localStorage.setItem('anon_id', id);
    }
    return id;
  }
  window.getAnonId = getAnonId;

  /* ── Internal: load profile from Supabase ── */
  function loadProfile(userId, email, cb) {
    if (!window.sb) { cb(null); return; }
    window.sb.from('profiles').select('role').eq('id', userId).single()
      .then(function (res) {
        if (res.error || !res.data) {
          // Profile might not exist yet (trigger delay) — default to 'free'
          cb({ id: userId, email: email, role: 'free', isAdmin: false, isLoggedIn: true });
        } else {
          var role = res.data.role || 'free';
          cb({ id: userId, email: email, role: role, isAdmin: role === 'admin', isLoggedIn: true });
        }
      });
  }

  /* ── Set user state + fire callbacks ── */
  function setUser(u) {
    window.currentUser = u || { id: null, email: null, role: 'anon', isAdmin: false, isLoggedIn: false };
    _changeCbs.forEach(function (fn) { fn(window.currentUser); });
    if (!_ready) {
      _ready = true;
      _readyCbs.forEach(function (fn) { fn(window.currentUser); });
    }
    updateAuthUI();
    updateLoginWall();
  }

  /* ── Listen for auth changes ── */
  function initAuth() {
    if (!window.sb) {
      setUser(null);
      return;
    }
    // Restore session
    window.sb.auth.getSession().then(function (res) {
      var session = res.data && res.data.session;
      if (session && session.user) {
        loadProfile(session.user.id, session.user.email, setUser);
      } else {
        setUser(null);
      }
    });

    // Live changes
    window.sb.auth.onAuthStateChange(function (_event, session) {
      if (session && session.user) {
        loadProfile(session.user.id, session.user.email, setUser);
      } else {
        setUser(null);
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════════
   *  LOGIN / SIGNUP MODAL
   * ══════════════════════════════════════════════════════════════════ */
  function isLoginWallVisible() {
    var wall = document.getElementById('login-wall');
    return wall && !wall.classList.contains('hidden');
  }

  function showLoginModal(startAsSignUp) {
    // Remove existing
    var old = document.getElementById('auth-overlay');
    if (old) old.remove();

    var isSignUp = !!startAsSignUp;
    var wallActive = isLoginWallVisible();

    var overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.className = 'auth-overlay';

    var modal = document.createElement('div');
    modal.className = 'auth-modal';

    function render() {
      var cancelHtml = wallActive ? '' : '<button class="auth-btn cancel" id="auth-cancel">Cancel</button>';
      modal.innerHTML =
        '<div class="auth-title">' + (isSignUp ? 'Create Account' : 'Sign In') + '</div>' +
        '<input type="email" class="auth-input" id="auth-email" placeholder="Email" autocomplete="email">' +
        '<div class="auth-pw-wrap">' +
          '<input type="password" class="auth-input" id="auth-password" placeholder="Password" autocomplete="' + (isSignUp ? 'new-password' : 'current-password') + '">' +
          '<button type="button" class="auth-pw-toggle" id="auth-pw-toggle" tabindex="-1" title="Show password">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="auth-error" id="auth-error"></div>' +
        '<div class="auth-actions">' +
          cancelHtml +
          '<button class="auth-btn submit" id="auth-submit">' + (isSignUp ? 'Sign Up' : 'Sign In') + '</button>' +
        '</div>' +
        '<div class="auth-toggle">' +
          (isSignUp
            ? 'Already have an account? <a href="#" id="auth-switch">Sign In</a>'
            : 'No account? <a href="#" id="auth-switch">Create one</a>') +
        '</div>';

      // Password show/hide toggle
      modal.querySelector('#auth-pw-toggle').addEventListener('click', function () {
        var pw = modal.querySelector('#auth-password');
        var isHidden = pw.type === 'password';
        pw.type = isHidden ? 'text' : 'password';
        this.innerHTML = isHidden
          ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
          : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
        this.title = isHidden ? 'Hide password' : 'Show password';
      });

      modal.querySelector('#auth-cancel') && modal.querySelector('#auth-cancel').addEventListener('click', function () { overlay.remove(); });
      modal.querySelector('#auth-switch').addEventListener('click', function (e) {
        e.preventDefault();
        isSignUp = !isSignUp;
        render();
      });
      modal.querySelector('#auth-submit').addEventListener('click', doSubmit);
      // Enter key submits
      modal.querySelectorAll('.auth-input').forEach(function (inp) {
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSubmit(); });
      });

      // Focus email field
      setTimeout(function () { modal.querySelector('#auth-email').focus(); }, 50);
    }

    function doSubmit() {
      var email = modal.querySelector('#auth-email').value.trim();
      var password = modal.querySelector('#auth-password').value;
      var errEl = modal.querySelector('#auth-error');
      errEl.textContent = '';

      if (!email || !password) { errEl.textContent = 'Email and password required'; return; }
      if (password.length < 6) { errEl.textContent = 'Password must be at least 6 characters'; return; }

      var submitBtn = modal.querySelector('#auth-submit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Working...';

      var promise = isSignUp
        ? window.sb.auth.signUp({ email: email, password: password })
        : window.sb.auth.signInWithPassword({ email: email, password: password });

      promise.then(function (res) {
        if (res.error) {
          errEl.textContent = res.error.message;
          submitBtn.disabled = false;
          submitBtn.textContent = isSignUp ? 'Sign Up' : 'Sign In';
        } else {
          if (isSignUp && res.data && res.data.user && !res.data.session) {
            // Email confirmation required
            errEl.style.color = '#2a7';
            errEl.textContent = 'Check your email to confirm your account.';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign Up';
          } else {
            overlay.remove();
          }
        }
      });
    }

    if (!wallActive) {
      overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    }
    render();
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  /* ── Sign out ── */
  function signOut() {
    if (!window.sb) return;
    window.sb.auth.signOut();
  }

  /* ══════════════════════════════════════════════════════════════════
   *  HEADER AUTH UI — user icon or "Sign In" button in navbar
   * ══════════════════════════════════════════════════════════════════ */
  function updateAuthUI() {
    var nav = document.getElementById('top-nav');
    if (!nav) return;

    // Remove old auth element
    var old = nav.querySelector('.nav-auth-wrap');
    if (old) old.remove();

    var wrap = document.createElement('div');
    wrap.className = 'nav-auth-wrap';

    // Insert into .nav-right-group if it exists, otherwise nav itself
    var rightGroup = nav.querySelector('.nav-right-group');
    var authParent = rightGroup || nav;

    if (window.currentUser.isLoggedIn) {
      var initial = (window.currentUser.email || '?').charAt(0).toUpperCase();
      var circle = document.createElement('button');
      circle.className = 'auth-avatar-btn';
      circle.textContent = initial;
      if (window.currentUser.isAdmin) circle.classList.add('admin');
      circle.title = window.currentUser.email + (window.currentUser.isAdmin ? ' (Admin)' : '');

      // Dropdown
      circle.addEventListener('click', function (e) {
        e.stopPropagation();
        var existing = document.getElementById('auth-dropdown');
        if (existing) { existing.remove(); return; }
        var dd = document.createElement('div');
        dd.id = 'auth-dropdown';
        dd.className = 'auth-dropdown';
        dd.innerHTML =
          '<div class="auth-dd-email">' + escHtml(window.currentUser.email) + '</div>' +
          (window.currentUser.isAdmin ? '<div class="auth-dd-badge">Admin</div>' : '') +
          '<div class="auth-dd-item" id="auth-dd-signout">Sign Out</div>';
        dd.querySelector('#auth-dd-signout').addEventListener('click', function () {
          dd.remove();
          signOut();
        });
        // Position below button
        var rect = circle.getBoundingClientRect();
        dd.style.top = (rect.bottom + 4) + 'px';
        dd.style.right = (window.innerWidth - rect.right) + 'px';
        document.body.appendChild(dd);
        // Close on outside click
        setTimeout(function () {
          document.addEventListener('click', function closeDD(ev) {
            if (!dd.contains(ev.target)) { dd.remove(); document.removeEventListener('click', closeDD); }
          });
        }, 0);
      });

      wrap.appendChild(circle);
    } else {
      var btn = document.createElement('button');
      btn.className = 'auth-signin-btn';
      btn.textContent = 'Sign In';
      btn.addEventListener('click', function () { showLoginModal(); });
      wrap.appendChild(btn);
    }

    authParent.appendChild(wrap);
  }

  // Minimal escHtml (auth.js may load before app.js)
  function escHtml(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  /* ══════════════════════════════════════════════════════════════════
   *  LOGIN WALL — blocks page until authenticated
   * ══════════════════════════════════════════════════════════════════ */
  function initLoginWall() {
    var wall = document.getElementById('login-wall');
    if (!wall) return;
    wall.innerHTML =
      '<div class="wall-buttons">' +
        '<button class="wall-btn primary" id="wall-signin">Sign In</button>' +
        '<button class="wall-btn" id="wall-signup">Create Account</button>' +
      '</div>';
    wall.querySelector('#wall-signin').addEventListener('click', function () { showLoginModal(); });
    wall.querySelector('#wall-signup').addEventListener('click', function () { showLoginModal(true); });
  }

  function updateLoginWall() {
    var wall = document.getElementById('login-wall');
    if (!wall) return;
    if (window.currentUser.isLoggedIn) {
      wall.classList.add('hidden');
    } else {
      wall.classList.remove('hidden');
    }
  }

  /* ── Public API ── */
  window.Auth = {
    showLoginModal: showLoginModal,
    signOut: signOut,
    onReady: function (cb) { if (_ready) cb(window.currentUser); else _readyCbs.push(cb); },
    onChange: function (cb) { _changeCbs.push(cb); },
    getAnonId: getAnonId,
    updateUI: updateAuthUI
  };

  // Initialize on load
  initLoginWall();
  initAuth();
})();
