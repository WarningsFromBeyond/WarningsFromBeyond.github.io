/*  app.js  –  Drives the site from books.json + avatars.json + BooksOut .txt files
 *
 *  Everything is filesystem-driven:
 *    - Book tabs ordered by numeric prefix on BooksOut folders (1-, 2-, …)
 *    - Chapter sidebar ordered by numeric prefix on subfolders
 *    - Readings ordered by numeric prefix on .txt filenames
 *    - Avatar display data from avatars.json (generated from avatar.vb)
 *
 *  Books have chapters (subdirectories), each containing .txt reading files.
 *  Sidebar shows chapters.  Clicking a chapter loads ALL its readings.
 *  ──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var books = [];
  var avatars = {};
  var activeBook = null;
  var activeChapterIdx = -1;  // for nested/chapter mode
  var activeReadingIdx = -1;  // for book-view mode
  var viewMode = 'chapter';   // 'chapter' = all readings at once, 'book' = one at a time
  var flatReadings = [];      // flattened reading list for book-view navigation
  var _activeSection = localStorage.getItem('lastSection') || null;

  /* ── Language dropdown (Google Translate) ── */
  var NAV_LANGUAGES = [
    { code: 'en',      label: 'English' },
    { code: 'es',      label: 'Espa\u00f1ol' },
    { code: 'pt',      label: 'Portugu\u00eas' },
    { code: 'fr',      label: 'Fran\u00e7ais' },
    { code: 'de',      label: 'Deutsch' },
    { code: 'it',      label: 'Italiano' },
    { code: 'pl',      label: 'Polski' },
    { code: 'nl',      label: 'Nederlands' },
    { code: 'ru',      label: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439' },
    { code: 'ja',      label: '\u65e5\u672c\u8a9e' },
    { code: 'zh-CN',   label: '\u7b80\u4f53\u4e2d\u6587' },
    { code: 'zh-TW',   label: '\u7e41\u9ad4\u4e2d\u6587' },
    { code: 'ko',      label: '\ud55c\uad6d\uc5b4' },
    { code: 'tr',      label: 'T\u00fcrk\u00e7e' },
    { code: 'id',      label: 'Bahasa Indonesia' },
    { code: 'uk',      label: '\u0423\u043a\u0440\u0430\u0457\u043d\u0441\u044c\u043a\u0430' },
    { code: 'sk',      label: 'Sloven\u010dina' },
    { code: 'cs',      label: '\u010ce\u0161tina' },
    { code: 'hu',      label: 'Magyar' },
    { code: 'ro',      label: 'Rom\u00e2n\u0103' },
    { code: 'sv',      label: 'Svenska' },
    { code: 'da',      label: 'Dansk' },
    { code: 'fi',      label: 'Suomi' },
    { code: 'no',      label: 'Norsk' },
    { code: 'el',      label: '\u0395\u03bb\u03bb\u03b7\u03bd\u03b9\u03ba\u03ac' },
    { code: 'bg',      label: '\u0411\u044a\u043b\u0433\u0430\u0440\u0441\u043a\u0438' },
    { code: 'et',      label: 'Eesti' },
    { code: 'lv',      label: 'Latvie\u0161u' },
    { code: 'lt',      label: 'Lietuvi\u0173' },
    { code: 'sl',      label: 'Sloven\u0161\u010dina' },
    { code: 'ar',      label: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629' },
    { code: 'vi',      label: 'Ti\u1ebfng Vi\u1ec7t' }
  ];

  /* ── Google Translate integration ── */
  function getSavedLanguage() {
    try { return localStorage.getItem('siteLanguage') || ''; }
    catch (e) { return ''; }
  }

  /* ── Per-language avatar images ── */
  var LANG_TO_IMAGE_LANG = {
    en:'en', ja:'en', 'zh-CN':'en', 'zh-TW':'en', ko:'en', id:'en', fi:'en', et:'en', tr:'en', el:'en',
    fr:'fr', ar:'fr', vi:'fr',
    de:'de', nl:'de', sv:'de', da:'de', no:'de', hu:'de',
    es:'es',
    it:'it', ro:'it',
    pt:'pt',
    pl:'pl', ru:'pl', uk:'pl', sk:'pl', cs:'pl', bg:'pl', lv:'pl', lt:'pl', sl:'pl'
  };

  function avatarImage(avatar) {
    if (!avatar.images) return avatar.image;
    var lang = getSavedLanguage() || 'en';
    var imgLang = LANG_TO_IMAGE_LANG[lang] || 'en';
    return avatar.images[imgLang] || avatar.image;
  }

  function setPageLanguage(code) {
    try { localStorage.setItem('siteLanguage', code); } catch (e) {}

    if (code === 'en') {
      // Remove translation — clear cookies and reload
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + window.location.hostname;
      var parts = window.location.hostname.split('.');
      if (parts.length > 1) {
        var rootDomain = '.' + parts.slice(-2).join('.');
        document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + rootDomain;
      }
      window.location.reload();
      return;
    }
    // Set the googtrans cookie for Google Translate
    var val = '/en/' + code;
    document.cookie = 'googtrans=' + val + '; path=/';
    document.cookie = 'googtrans=' + val + '; path=/; domain=' + window.location.hostname;
    var parts2 = window.location.hostname.split('.');
    if (parts2.length > 1) {
      var rootDomain2 = '.' + parts2.slice(-2).join('.');
      document.cookie = 'googtrans=' + val + '; path=/; domain=' + rootDomain2;
    }
    window.location.reload();
  }

  var BOOK_UI_DEFAULTS = {
    DisplaysNumbers: true,
    AreDemonsRed: true,
    ShowAvatars: true,
    ShowReadingsInThisChapter: true,
    ShowReadingsInThisChapterText: 'Readings in this Chapter'
  };
 // active section within Warnings book


  /* ── Cache-busting helper for dev ── */
  function nocache(url) { return url + (url.indexOf('?') === -1 ? '?' : '&') + '_t=' + Date.now(); }

  /* ── Published mode detection: set by about.json presence or _content in books ── */
  var _publishedMode = false;

  function booksOutUrl(relPath) {
    var prefix = _publishedMode ? './BooksOut/' : '../BooksOut/';
    return prefix + relPath.split('/').map(function (segment) {
      return encodeURIComponent(segment);
    }).join('/');
  }

  /* ── Load reading text: use pre-baked _content if available, else fetch ── */
  function loadReadingText(rd) {
    if (rd._content != null) {
      return Promise.resolve(rd._content);
    }
    return fetch(nocache(booksOutUrl(rd.path)))
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.arrayBuffer();
      })
      .then(function (buf) { return decodeText(buf); });
  }

  function loadSummaryText(ch) {
    if (ch._summaryContent != null) return Promise.resolve(ch._summaryContent);
    if (!ch.summaryPath) return Promise.resolve('');
    return fetch(nocache(booksOutUrl(ch.summaryPath)))
      .then(function (r) { return r.ok ? r.arrayBuffer() : ''; })
      .then(function (buf) { return typeof buf === 'string' ? buf : decodeText(buf); })
      .catch(function () { return ''; });
  }


  /* ── Boot: load both JSON files, then render ── */
  Promise.all([
    fetch(nocache('books.json')).then(function (r) { return r.json(); }),
    fetch(nocache('avatars.json')).then(function (r) { return r.json(); }),
    fetch('about.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
  ])
  .then(function (results) {
    books = results[0];
    avatars = results[1];
    window._avatarsDict = avatars;
    // Detect published mode: if first reading has _content, we're pre-baked
    var firstBook = books[0];
    if (firstBook && firstBook.chapters && firstBook.chapters[0] &&
        firstBook.chapters[0].readings && firstBook.chapters[0].readings[0] &&
        firstBook.chapters[0].readings[0]._content != null) {
      _publishedMode = true;
    }
    // Load pre-baked about text if available
    if (results[2] && results[2].text) {
      window._aboutText = results[2].text;
    }
    renderNavbar();
    // Restore last tab or default to Welcome (book 0)
    var savedTab = parseInt(localStorage.getItem('lastTab'));
    var first = (!isNaN(savedTab) && books.find(function (b) { return b.num === savedTab; }))
             || books.find(function (b) { return b.num === 0; })
             || books.find(function (b) { return b.totalReadings > 0; });
    if (first) selectBook(first.num);
  })
  .catch(function (err) {
    console.error('Failed to load data', err);
    document.getElementById('content').innerHTML =
      '<p class="error">Could not load books.json or avatars.json</p>';
  });

  /* ── About link in sidebar footer ── */
  (function () {
    var aboutLink = document.getElementById('footer-about');
    if (aboutLink) {
      aboutLink.addEventListener('click', function (e) {
        e.preventDefault();
        var aboutPromise;
        if (window._aboutText) {
          aboutPromise = Promise.resolve(window._aboutText);
        } else {
          aboutPromise = fetch(nocache('../BooksOut/About.txt'))
            .then(function (r) { return r.ok ? r.text() : 'About page not found.'; });
        }
        aboutPromise.then(function (text) {
            var content = document.getElementById('content');
            var lines = text.split(/\r?\n/);
            var nav = '<div class="header-nav">'
              + '<span class="nav-btn disabled">&larr; Previous</span>'
              + '<span class="nav-pos">About</span>'
              + '<span class="nav-btn disabled">Next &rarr;</span>'
              + '</div>';
            var adminAvatar = avatars['Admin'] || null;
            var adminParsed = { avatarId: 'Admin', num: 0, slug: 'about', displayTitle: '', separator: false };
            var avatarHtml = renderAvatarRow(adminAvatar, adminParsed, 'About This Website', '', false, true);
            var html = nav + '<div class="reading-block">' + avatarHtml + '<div class="reading-body about-page">';
            for (var i = 0; i < lines.length; i++) {
              var line = lines[i].trim();
              if (!line) { html += '<br>'; continue; }
              html += '<p>' + escHtml(line) + '</p>';
            }
            html += '</div></div>';
            html += nav.replace('header-nav', 'footer-nav');
            content.className = 'content';
            content.innerHTML = html;
          })
          .catch(function () {
            document.getElementById('content').innerHTML = '<p class="error">Could not load About page.</p>';
          });
      });
    }
  })();

  function isEnterFinalBattleBook() {
    return !!activeBook && activeBook.num === 9;
  }

  function getBookUi(book) {
    var ui = (book && book.ui) ? book.ui : {};
    return {
      DisplaysNumbers: ui.DisplaysNumbers !== undefined ? !!ui.DisplaysNumbers : BOOK_UI_DEFAULTS.DisplaysNumbers,
      AreDemonsRed: ui.AreDemonsRed !== undefined ? !!ui.AreDemonsRed : BOOK_UI_DEFAULTS.AreDemonsRed,
      ShowAvatars: ui.ShowAvatars !== undefined ? !!ui.ShowAvatars : BOOK_UI_DEFAULTS.ShowAvatars,
      ShowReadingsInThisChapter: ui.ShowReadingsInThisChapter !== undefined ? !!ui.ShowReadingsInThisChapter : BOOK_UI_DEFAULTS.ShowReadingsInThisChapter,
      ShowReadingsInThisChapterText: ui.ShowReadingsInThisChapterText || BOOK_UI_DEFAULTS.ShowReadingsInThisChapterText,
      SidebarLevels: typeof ui.SidebarLevels === 'number' ? ui.SidebarLevels : 2,
      AvatarLevel: ui.AvatarLevel || null
    };
  }

  function getBookStyle(book) {
    return (book && book.style) ? book.style : {};
  }

  function shouldShowAvatars() {
    return getBookUi(activeBook).ShowAvatars && !isEnterFinalBattleBook();
  }

  function shouldShowReadingsIndex() {
    return getBookUi(activeBook).ShowReadingsInThisChapter && !isEnterFinalBattleBook();
  }

  function refreshActiveView() {
    if (!activeBook) return;
    if (viewMode === 'book') {
      var total = flatReadings.length;
      var idx = activeReadingIdx;
      if (idx < 0) idx = 0;
      if (idx >= total) idx = Math.max(0, total - 1);
      renderSidebar();
      if (total > 0) selectReading(idx);
      return;
    }
    var chIdx = activeChapterIdx;
    if (chIdx < 0) chIdx = 0;
    if (chIdx >= activeBook.chapters.length) chIdx = Math.max(0, activeBook.chapters.length - 1);
    renderSidebar();
    if (activeBook.chapters.length) selectChapter(chIdx);
  }

  function attachHeaderContextMenu(el) {
    if (!el) return;
    el.addEventListener('contextmenu', function (e) {
      if (!window.currentUser || !window.currentUser.isAdmin) return;
      el.classList.add('book-title-editable');
      e.preventDefault();
      openBookPropertiesModal(e.clientX, e.clientY);
    });
  }

  function openBookPropertiesModal() {
    if (!activeBook) return;
    var ui = getBookUi(activeBook);
    var overlay = document.createElement('div');
    overlay.className = 'book-props-overlay';
    var modal = document.createElement('div');
    modal.className = 'book-props-modal';

    var title = document.createElement('div');
    title.className = 'book-props-title';
    title.textContent = 'Book Properties';
    modal.appendChild(title);

    var subtitle = document.createElement('div');
    subtitle.className = 'book-props-subtitle';
    subtitle.textContent = activeBook.displayTitle || activeBook.name;
    modal.appendChild(subtitle);

    var fields = [
      { key: '_book',                          label: 'Book Title',                           type: 'text', val: activeBook.displayTitle || activeBook.name },
      { key: 'DisplaysNumbers',              label: 'Displays Numbers',                     type: 'bool', val: ui.DisplaysNumbers },
      { key: 'AreDemonsRed',                  label: 'Are Demons Red',                       type: 'bool', val: ui.AreDemonsRed },
      { key: 'ShowAvatars',                   label: 'Show Avatars',                         type: 'bool', val: ui.ShowAvatars },
      { key: 'ShowReadingsInThisChapter',     label: 'Show Readings In This Chapter',        type: 'bool', val: ui.ShowReadingsInThisChapter },
      { key: 'ShowReadingsInThisChapterText', label: 'Show Readings In This Chapter Text',   type: 'text', val: ui.ShowReadingsInThisChapterText },
      { key: 'SidebarHeaderRBG',               label: 'Sidebar Header RGB',                     type: 'text', val: getBookStyle(activeBook).SidebarHeaderRBG || '' }
    ];

    var inputs = {};
    fields.forEach(function (f) {
      var row = document.createElement('label');
      row.className = 'book-props-row';
      var span = document.createElement('span');
      span.textContent = f.label;
      row.appendChild(span);
      if (f.type === 'bool') {
        var sel = document.createElement('select');
        sel.className = 'book-props-input';
        ['Yes', 'No'].forEach(function (v) {
          var opt = document.createElement('option');
          opt.value = v;
          opt.textContent = v;
          if ((v === 'Yes') === f.val) opt.selected = true;
          sel.appendChild(opt);
        });
        inputs[f.key] = sel;
        row.appendChild(sel);
      } else {
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'book-props-input';
        inp.value = f.val;
        inputs[f.key] = inp;
        row.appendChild(inp);
      }
      modal.appendChild(row);
    });

    var actions = document.createElement('div');
    actions.className = 'book-props-actions';

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'book-props-btn cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function () { document.body.removeChild(overlay); });
    actions.appendChild(cancelBtn);

    var saveBtn = document.createElement('button');
    saveBtn.className = 'book-props-btn save';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', function () {
      var uiPayload = {};
      fields.forEach(function (f) {
        uiPayload[f.key] = inputs[f.key].value;
      });
      var payload = { bookFolder: activeBook.folder, ui: uiPayload };
      fetch('/save-book-properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.ok) {
          document.body.removeChild(overlay);
          // reload books.json and refresh
          fetch(nocache('books.json')).then(function (r) { return r.json(); }).then(function (bks) {
            books = bks;
            activeBook = books.find(function (b) { return b.num === activeBook.num; }) || activeBook;
            renderNavbar();
            // Re-highlight active tab
            document.querySelectorAll('.nav-tab').forEach(function (t) {
              t.classList.toggle('active', parseInt(t.dataset.book) === activeBook.num);
            });
            refreshActiveView();
          });
        } else {
          alert('Save failed: ' + (data.error || 'unknown'));
        }
      })
      .catch(function (err) { alert('Save error: ' + err); });
    });
    actions.appendChild(saveBtn);
    modal.appendChild(actions);
    overlay.appendChild(modal);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) document.body.removeChild(overlay);
    });
    document.body.appendChild(overlay);
  }


  /* ── Repost (Quote Tweet) on X handler ── */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.repost-btn');
    if (!btn) return;
    e.preventDefault();

    // Walk up to the reading-block to gather content
    var block = btn.closest('.reading-block');
    if (!block) return;

    // Title
    var titleEl = block.querySelector('.reading-title');
    if (!titleEl) titleEl = block.querySelector('.avatar-reading-title');
    var title = titleEl ? titleEl.textContent.trim() : '';

    // By line (avatar name)
    var nameEl = block.querySelector('.avatar-name');
    var byLine = nameEl ? nameEl.textContent.trim() : '';

    // Body text (all paragraphs)
    var bodyEl = block.querySelector('.reading-body');
    var bodyText = '';
    if (bodyEl) {
      var paras = bodyEl.querySelectorAll('p');
      var parts = [];
      paras.forEach(function (p) { parts.push(p.textContent.trim()); });
      bodyText = parts.join('\n\n');
    }

    // Build the post text
    var postText = title;
    if (byLine) postText += '\nby ' + byLine;
    if (bodyText) postText += '\n\n' + bodyText;

    // X intent URL — always include site URL so Twitter Card image appears
    var intentUrl = 'https://x.com/intent/post?text=' + encodeURIComponent(postText)
      + '&url=' + encodeURIComponent('https://warningsfrombeyond.com');

    window.open(intentUrl, '_blank', 'noopener,noreferrer');
  });

  /* ── Share button handler (event delegation on content) ── */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.share-btn');
    if (!btn) return;
    e.preventDefault();
    var title = btn.dataset.shareTitle || 'Reading';
    var url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: title, url: url }).catch(function () {});
    } else {
      // Fallback: copy URL to clipboard
      navigator.clipboard.writeText(url).then(function () {
        alert('Link copied to clipboard');
      }).catch(function () {
        prompt('Copy this link:', url);
      });
    }
  });

  /* ── Download button handler (event delegation) ── */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.download-btn');
    if (!btn) return;
    e.preventDefault();
    var path = btn.dataset.downloadPath;
    var title = btn.dataset.downloadTitle || 'reading';
    if (!path) return;
    fetch(path)
      .then(function (r) { return r.blob(); })
      .then(function (blob) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = title.replace(/[^a-zA-Z0-9 _-]/g, '') + '.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      })
      .catch(function () {
        alert('Could not download file');
      });
  });

  /* ── Copy button handler (copies reading text to clipboard) ── */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.copy-btn');
    if (!btn) return;
    e.preventDefault();
    var block = btn.closest('.reading-block');
    if (!block) return;
    var body = block.querySelector('.reading-body');
    if (!body) return;
    var text = body.innerText || body.textContent || '';
    navigator.clipboard.writeText(text.trim()).then(function () {
      btn.style.color = '#4a9'; 
      setTimeout(function () { btn.style.color = ''; }, 1200);
    }).catch(function () {
      // Fallback for older browsers
      var ta = document.createElement('textarea');
      ta.value = text.trim();
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      btn.style.color = '#4a9';
      setTimeout(function () { btn.style.color = ''; }, 1200);
    });
  });

  /* ── Like (heart) button handler (event delegation) ── */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.like-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    var key = btn.getAttribute('data-reading-key');
    if (!key || !window.Likes) return;
    btn.classList.add('like-pulse');
    window.Likes.toggle(key).then(function (info) {
      if (!info) return;
      // Sync ALL hearts with the same reading key
      document.querySelectorAll('.like-btn[data-reading-key="' + CSS.escape(key) + '"]').forEach(function (b) {
        window.Likes.applyHeartState(b, info);
      });
      // Sync sidebar heart with the same reading key
      document.querySelectorAll('.sidebar-heart-rd[data-reading-key="' + CSS.escape(key) + '"]').forEach(function (sb) {
        if (info.liked) sb.classList.add('liked');
        else sb.classList.remove('liked');
        var chLi = sb.closest('li.sidebar-chapter');
        if (chLi) _updateChapterHeart(chLi);
      });
      setTimeout(function () { btn.classList.remove('like-pulse'); }, 300);
    });
  });

  /* ══════════════════════════════════════════════════════════════════
   *  FEEDBACK MODAL — Contact Us form
   * ══════════════════════════════════════════════════════════════════ */
  function showFeedbackModal() {
    var old = document.getElementById('feedback-overlay');
    if (old) old.remove();

    var overlay = document.createElement('div');
    overlay.id = 'feedback-overlay';
    overlay.className = 'auth-overlay';

    var modal = document.createElement('div');
    modal.className = 'auth-modal feedback-modal';
    modal.innerHTML =
      '<div class="auth-title">Contact Us</div>' +
      '<textarea class="feedback-textarea" id="feedback-text" placeholder="Your feedback, questions, or suggestions..." rows="6"></textarea>' +
      '<div class="feedback-error" id="feedback-error"></div>' +
      '<div class="auth-actions">' +
        '<button class="auth-btn cancel" id="feedback-cancel">Cancel</button>' +
        '<button class="auth-btn submit" id="feedback-submit">Submit</button>' +
      '</div>';

    modal.querySelector('#feedback-cancel').addEventListener('click', function () { overlay.remove(); });
    modal.querySelector('#feedback-submit').addEventListener('click', function () {
      var text = modal.querySelector('#feedback-text').value.trim();
      var errEl = modal.querySelector('#feedback-error');
      if (!text) { errEl.textContent = 'Please enter your feedback'; return; }

      var submitBtn = modal.querySelector('#feedback-submit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';

      var payload = {
        message: text,
        email: window.currentUser && window.currentUser.email || null,
        user_id: window.currentUser && window.currentUser.id || null,
        page: location.hash || '#',
        timestamp: new Date().toISOString()
      };

      if (window.sb) {
        window.sb.from('feedback').insert([payload]).then(function (res) {
          if (res.error) {
            errEl.textContent = 'Could not send — try again later';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit';
          } else {
            modal.innerHTML =
              '<div class="auth-title">Thank You!</div>' +
              '<p style="text-align:center;color:#555;margin:20px 0;">Your feedback has been received.</p>' +
              '<div class="auth-actions"><button class="auth-btn submit" id="feedback-close">Close</button></div>';
            modal.querySelector('#feedback-close').addEventListener('click', function () { overlay.remove(); });
          }
        });
      } else {
        errEl.textContent = 'Service unavailable';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';
      }
    });

    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    setTimeout(function () { modal.querySelector('#feedback-text').focus(); }, 50);
  }

  /* ══════════════════════════════════════════════════════════════════
   *  NAVBAR — tabs, ordered by BooksOut folder number
   * ══════════════════════════════════════════════════════════════════ */
  function renderNavbar() {
    var nav = document.getElementById('top-nav');
    nav.innerHTML = '';
    books.forEach(function (b) {
      if (b.num === 11 || b.num === 10) return; // Search & Shop — not displayed as tabs
      var btn = document.createElement('button');
      btn.className = 'nav-tab';
      btn.textContent = b.name;
      btn.dataset.book = b.num;

      if (b.num !== 10 && b.num !== 4) {
        if (b.totalReadings === 0) btn.classList.add('empty');
      }

      btn.addEventListener('click', function () { selectBook(b.num); });
      btn.addEventListener('contextmenu', function (e) {
        if (!window.currentUser || !window.currentUser.isAdmin) return;
        e.preventDefault();
        hideChapterCtxMenu();
        hideReadingCtxMenu();
        showBookCtxMenu(e.clientX, e.clientY, b.folder);
      });
      nav.appendChild(btn);
    });

    // ── Right-aligned group: language, contact, auth ──
    var rightGroup = document.createElement('div');
    rightGroup.className = 'nav-right-group';

    // Language dropdown
    var langWrap = document.createElement('div');
    langWrap.className = 'nav-lang-wrap';
    var langSelect = document.createElement('select');
    langSelect.className = 'nav-lang-select';
    langSelect.id = 'nav-lang-select';
    langSelect.setAttribute('aria-label', 'Translate page');
    langSelect.classList.add('notranslate');
    langSelect.setAttribute('translate', 'no');
    NAV_LANGUAGES.forEach(function (lang) {
      var opt = document.createElement('option');
      opt.value = lang.code;
      opt.textContent = lang.label;
      opt.classList.add('notranslate');
      langSelect.appendChild(opt);
    });
    var saved = getSavedLanguage();
    langSelect.value = saved || 'en';
    langSelect.addEventListener('change', function () {
      setPageLanguage(langSelect.value);
    });
    langWrap.appendChild(langSelect);
    rightGroup.appendChild(langWrap);

    // Contact Us button
    var contactBtn = document.createElement('button');
    contactBtn.className = 'nav-contact-btn';
    contactBtn.title = 'Contact Us';
    contactBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><line x1="8" y1="9" x2="16" y2="9"></line><line x1="8" y1="13" x2="14" y2="13"></line></svg>';
    contactBtn.addEventListener('click', function () { showFeedbackModal(); });
    rightGroup.appendChild(contactBtn);

    nav.appendChild(rightGroup);

    // Re-add auth Sign In / avatar button after navbar rebuild
    if (window.Auth && window.Auth.updateUI) window.Auth.updateUI();
  }

  /* ══════════════════════════════════════════════════════════════════
   *  MOBILE BARS — two compact bars for phone layout
   *  Bar 1: ☰ menu | Book Name | ◀ ▶ book arrows
   *  Bar 2: avatar | reading title | ◀ ▶ reading arrows
   * ══════════════════════════════════════════════════════════════════ */
  function isMobile() {
    return window.innerWidth <= 768;
  }

  function updateMobileBars() {
    if (!isMobile()) return;
    var bar1 = document.getElementById('mobile-bar1');
    var bar2 = document.getElementById('mobile-bar2');
    if (!bar1 || !bar2) return;

    // ── Bar 1: Book Name + Book Prev/Next ──
    var bookIdx = activeBook ? books.indexOf(activeBook) : -1;
    var visBooks = books.filter(function (b) { return b.num !== 11 && b.num !== 10; });
    var viIdx = activeBook ? visBooks.indexOf(activeBook) : -1;
    var hasPrevBook = viIdx > 0;
    var hasNextBook = viIdx < visBooks.length - 1;

    bar1.innerHTML =
      '<span class="mob-book-name">' + escHtml(activeBook ? activeBook.name : '') + '</span>' +
      '<button class="mob-book-nav' + (hasPrevBook ? '' : ' disabled') + '" id="mob-book-prev" title="Previous book">&#9664;</button>' +
      '<button class="mob-book-nav' + (hasNextBook ? '' : ' disabled') + '" id="mob-book-next" title="Next book">&#9654;</button>';

    // Book prev/next
    if (hasPrevBook) {
      bar1.querySelector('#mob-book-prev').addEventListener('click', function () {
        selectBook(visBooks[viIdx - 1].num);
      });
    }
    if (hasNextBook) {
      bar1.querySelector('#mob-book-next').addEventListener('click', function () {
        selectBook(visBooks[viIdx + 1].num);
      });
    }

    // ── Bar 2: Menu + Chapter Name + Chapter Prev/Next ──
    var chIdx = activeChapterIdx;
    var prevCh = (chIdx >= 0) ? findAdjacentChapter(chIdx, -1) : null;
    var nextCh = (chIdx >= 0) ? findAdjacentChapter(chIdx, 1) : null;

    var chTitle = '';
    if (chIdx >= 0 && activeBook && activeBook.chapters[chIdx]) {
      var curCh = activeBook.chapters[chIdx];
      chTitle = curCh.displayTitle || curCh.title || curCh.folder || '';
    }

    bar2.innerHTML =
      '<button class="mob-menu-btn" id="mob-menu-btn" title="Menu">&#9776;</button>' +
      '<span class="mob-reading-name">' + escHtml(chTitle) + '</span>' +
      '<button class="mob-reading-nav' + (prevCh !== null ? '' : ' disabled') + '" id="mob-ch-prev" title="Previous chapter">&#9664;</button>' +
      '<button class="mob-reading-nav' + (nextCh !== null ? '' : ' disabled') + '" id="mob-ch-next" title="Next chapter">&#9654;</button>';

    // Menu button → toggle sidebar drawer
    bar2.querySelector('#mob-menu-btn').addEventListener('click', toggleMobileDrawer);
    if (prevCh !== null) {
      bar2.querySelector('#mob-ch-prev').addEventListener('click', function () {
        selectChapter(prevCh);
      });
    }
    if (nextCh !== null) {
      bar2.querySelector('#mob-ch-next').addEventListener('click', function () {
        selectChapter(nextCh);
      });
    }
  }

  function toggleMobileDrawer() {
    var sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    var isOpen = sidebar.classList.contains('drawer-open');
    if (isOpen) {
      closeMobileDrawer();
    } else {
      sidebar.classList.add('drawer-open');
      // Add backdrop
      var backdrop = document.createElement('div');
      backdrop.className = 'sidebar-backdrop';
      backdrop.id = 'sidebar-backdrop';
      backdrop.addEventListener('click', closeMobileDrawer);
      document.body.appendChild(backdrop);
    }
  }

  function closeMobileDrawer() {
    var sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('drawer-open');
    var backdrop = document.getElementById('sidebar-backdrop');
    if (backdrop) backdrop.remove();
  }

  /* ══════════════════════════════════════════════════════════════════
   *  SELECT BOOK → populate sidebar, auto-open first item
   * ══════════════════════════════════════════════════════════════════ */
  function selectBook(num) {
    activeBook = books.find(function (b) { return b.num === num; });
    if (!activeBook) return;

    // Remember last tab
    localStorage.setItem('lastTab', num);

    // Highlight active tab
    document.querySelectorAll('.nav-tab').forEach(function (t) {
      t.classList.toggle('active', parseInt(t.dataset.book) === num);
    });

    if (activeBook.totalReadings === 0) {
      viewMode = 'book';
      flatReadings = [];
      renderSidebar();
      document.getElementById('content').innerHTML =
        '<p class="placeholder">This book has no readings yet.</p>';
      updateMobileBars();
      closeMobileDrawer();
      return;
    }

    // Build flat reading list for book-view navigation (exclude separators and headers, sort by file num)
    flatReadings = [];
    activeBook.chapters.forEach(function (ch, chIdx) {
      ch.readings.forEach(function (rd) {
        var p = parseFilename(rd.file);
        if (!p.separator && !/^header\.txt$/i.test(rd.file)) {
          flatReadings.push({ rd: rd, ch: ch, _chIdx: chIdx });
        }
      });
    });
    flatReadings.sort(function (a, b) {
      if (a._chIdx !== b._chIdx) return a._chIdx - b._chIdx;
      return parseFilename(a.rd.file).num - parseFilename(b.rd.file).num;
    });

    // Set viewMode BEFORE renderSidebar so it picks the correct layout
    viewMode = 'chapter';

    // Reset active section if it doesn't match this book's sections
    if (activeBook.sections && activeBook.sections.length) {
      if (!_activeSection || activeBook.sections.indexOf(_activeSection) < 0) {
        _activeSection = activeBook.sections[0];
      }
      localStorage.setItem('lastSection', _activeSection);
    }

    renderSidebar();

    // Check for a saved chapter from last visit
    var savedChIdx = parseInt(localStorage.getItem('lastChapter_' + num));
    if (!isNaN(savedChIdx) && savedChIdx >= 0 && savedChIdx < activeBook.chapters.length
        && activeBook.chapters[savedChIdx].readings && activeBook.chapters[savedChIdx].readings.length > 0) {
      selectChapter(savedChIdx);
      updateMobileBars();
      closeMobileDrawer();
      return;
    }

    if (activeBook.sections && activeBook.sections.length) {
      // Sectioned book: select first chapter in active section
      var sectionChapters = activeBook.chapters.filter(function (c) { return c.section === _activeSection; });
      var firstWithReadings = sectionChapters.find(function (c) { return c.readings && c.readings.length > 0; });
      if (firstWithReadings) {
        var idx = activeBook.chapters.indexOf(firstWithReadings);
        if (idx >= 0) selectChapter(idx);
      } else {
        document.getElementById('content').innerHTML = '<p class="placeholder">No readings in this section yet.</p>';
      }
    } else {
      // Nested: default to first chapter with readings
      // Welcome (book 0) defaults to "Prayers Before Reading" (chapter index 1)
      var startIdx = (activeBook.chapters.length > 1 && activeBook.chapters[0].num === 0) ? 1 : 0;
      for (var i = startIdx; i < activeBook.chapters.length; i++) {
        if (activeBook.chapters[i].readings.length > 0) {
          selectChapter(i);
          updateMobileBars();
          closeMobileDrawer();
          return;
        }
      }
    }
    updateMobileBars();
    closeMobileDrawer();
  }

  /* ══════════════════════════════════════════════════════════════════
   *  SIDEBAR
   * ══════════════════════════════════════════════════════════════════ */
  var _sidebarGen = 0; // generation counter to cancel stale async sidebar fetches
  function renderSidebar() {
    _sidebarGen++; // invalidate any pending async callbacks from previous render
    var sidebar = document.getElementById('sidebar');
    var header = document.getElementById('sidebar-header');
    var list = document.getElementById('sidebar-list');
    header.innerHTML = '';
    list.innerHTML = '';
    // Remove any previous section-button rows
    var oldBtns = sidebar.querySelectorAll('.warnings-section-btns');
    oldBtns.forEach(function (el) { el.parentNode.removeChild(el); });

    // Apply per-book class so CSS can scope styles per book
    sidebar.className = 'sidebar book-' + activeBook.num;

    header.textContent = activeBook.displayTitle || activeBook.name;
    if (activeBook.subtitle) {
      var sub = document.createElement('div');
      sub.className = 'sidebar-subtitle';
      sub.textContent = activeBook.subtitle;
      header.appendChild(sub);
    }
    attachHeaderContextMenu(header);

    var sidebarHtml = activeBook._sidebarHtml;

    if (activeBook.sections && activeBook.sections.length) {
      // Render section toggle buttons
      var btnRow = document.createElement('div');
      btnRow.className = 'warnings-section-btns';
      activeBook.sections.forEach(function (sec) {
        var btn = document.createElement('button');
        btn.className = 'section-btn' + (sec === _activeSection ? ' active' : '');
        btn.textContent = sec;
        btn.addEventListener('click', function () {
          _activeSection = sec;
          localStorage.setItem('lastSection', _activeSection);
          renderSidebar();
          // Auto-select first chapter in this section
          var sectionChapters = activeBook.chapters.filter(function (c) { return c.section === _activeSection; });
          var firstWithReadings = sectionChapters.find(function (c) { return c.readings && c.readings.length > 0; });
          if (firstWithReadings) {
            var idx = activeBook.chapters.indexOf(firstWithReadings);
            if (idx >= 0) selectChapter(idx);
          } else {
            document.getElementById('content').innerHTML = '<p class="placeholder">No readings in this section yet.</p>';
          }
        });
        btnRow.appendChild(btn);
      });
      list.parentNode.insertBefore(btnRow, list);

      // Use pre-baked section HTML
      if (sidebarHtml && typeof sidebarHtml === 'object' && sidebarHtml[_activeSection]) {
        list.innerHTML = sidebarHtml[_activeSection];
      }
    } else if (typeof sidebarHtml === 'string') {
      // Use pre-baked flat HTML
      list.innerHTML = sidebarHtml;
    } else {
      // Fallback: build dynamically (should not happen with generate script)
      if (viewMode === 'book') {
        renderSidebarFlat(list);
      } else {
        renderSidebarNested(list);
      }
    }

    // Attach delegated click handler for all sidebar links
    _attachSidebarDelegation(list);

    // Inject heart buttons into sidebar readings and chapters
    _injectSidebarHearts(list);

    // Apply SidebarHeaderRBG style from book properties
    var bookStyle = getBookStyle(activeBook);
    if (bookStyle.SidebarHeaderRBG) {
      var rgb = bookStyle.SidebarHeaderRBG;
      list.style.setProperty('--sidebar-header-color', 'rgb(' + rgb + ')');
    } else {
      list.style.removeProperty('--sidebar-header-color');
    }
  }

  /* ── Sidebar hearts ── */
  var _heartSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>';

  function _getReadingKey(chIdx, rdIdx) {
    if (!activeBook) return '';
    var ch = activeBook.chapters[chIdx];
    if (!ch || rdIdx >= ch.readings.length) return '';
    return ch.readings[rdIdx].path || '';
  }

  function _readingKeyToLikeKey(rdPath) {
    return booksOutUrl(rdPath);
  }

  function _isHearted(rdPath) {
    var likeKey = _readingKeyToLikeKey(rdPath);
    return !!localStorage.getItem('liked:' + likeKey);
  }

  function _updateChapterHeart(chLi) {
    var chHeart = chLi.querySelector('.sidebar-heart-ch');
    if (!chHeart) return;
    var rdHearts = chLi.querySelectorAll('.sidebar-heart-rd');
    if (!rdHearts.length) { chHeart.classList.remove('liked'); return; }
    var allLiked = true;
    rdHearts.forEach(function (h) { if (!h.classList.contains('liked')) allLiked = false; });
    if (allLiked) chHeart.classList.add('liked');
    else chHeart.classList.remove('liked');
  }

  function _injectSidebarHearts(list) {
    // Add hearts to reading links
    list.querySelectorAll('a.reading-link[data-ch][data-rd]').forEach(function (link) {
      var chIdx = parseInt(link.dataset.ch, 10);
      var rdIdx = parseInt(link.dataset.rd, 10);
      var rdPath = _getReadingKey(chIdx, rdIdx);
      if (!rdPath) return;
      var likeKey = _readingKeyToLikeKey(rdPath);
      var btn = document.createElement('button');
      btn.className = 'sidebar-heart sidebar-heart-rd' + (_isHearted(rdPath) ? ' liked' : '');
      btn.setAttribute('data-heart-key', rdPath);
      btn.setAttribute('data-reading-key', likeKey);
      btn.innerHTML = _heartSvg;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.add('like-pulse');
        setTimeout(function () { btn.classList.remove('like-pulse'); }, 300);
        if (window.Likes) {
          window.Likes.toggle(likeKey).then(function (info) {
            if (!info) return;
            // Sync content-area hearts
            document.querySelectorAll('.like-btn[data-reading-key="' + CSS.escape(likeKey) + '"]').forEach(function (b) {
              window.Likes.applyHeartState(b, info);
            });
            // Sync this sidebar heart
            if (info.liked) btn.classList.add('liked');
            else btn.classList.remove('liked');
            var chLi = btn.closest('li.sidebar-chapter');
            if (chLi) _updateChapterHeart(chLi);
          });
        } else {
          // Fallback: toggle localStorage only
          var liked = _isHearted(rdPath);
          if (!liked) localStorage.setItem('liked:' + likeKey, '1');
          else localStorage.removeItem('liked:' + likeKey);
          btn.classList.toggle('liked');
          var chLi = btn.closest('li.sidebar-chapter');
          if (chLi) _updateChapterHeart(chLi);
        }
      });
      link.parentNode.appendChild(btn);
    });

    // Add hearts to chapter headings (2-level mode)
    list.querySelectorAll('li.sidebar-chapter').forEach(function (chLi) {
      var heading = chLi.querySelector('a.chapter-heading[data-ch]');
      if (!heading) return;
      var rdLinks = chLi.querySelectorAll('a.reading-link[data-ch][data-rd]');
      if (!rdLinks.length) return;
      var btn = document.createElement('button');
      btn.className = 'sidebar-heart sidebar-heart-ch';
      btn.innerHTML = _heartSvg;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        // Toggle all readings in this chapter
        var rdHearts = chLi.querySelectorAll('.sidebar-heart-rd');
        var allLiked = true;
        rdHearts.forEach(function (h) { if (!h.classList.contains('liked')) allLiked = false; });
        var newState = !allLiked;
        var promises = [];
        rdHearts.forEach(function (h) {
          var likeKey = h.getAttribute('data-reading-key');
          var isLiked = h.classList.contains('liked');
          if (isLiked !== newState) {
            if (window.Likes) {
              promises.push(window.Likes.toggle(likeKey).then(function (info) {
                if (!info) return;
                if (info.liked) h.classList.add('liked');
                else h.classList.remove('liked');
                document.querySelectorAll('.like-btn[data-reading-key="' + CSS.escape(likeKey) + '"]').forEach(function (b) {
                  window.Likes.applyHeartState(b, info);
                });
              }));
            } else {
              if (newState) localStorage.setItem('liked:' + likeKey, '1');
              else localStorage.removeItem('liked:' + likeKey);
              if (newState) h.classList.add('liked');
              else h.classList.remove('liked');
            }
          }
        });
        if (promises.length) {
          Promise.all(promises).then(function () { _updateChapterHeart(chLi); });
        } else {
          _updateChapterHeart(chLi);
        }
      });
      heading.appendChild(btn);
      _updateChapterHeart(chLi);
    });
  }

  /* ── Delegated click handler for pre-baked sidebar HTML ── */
  function _attachSidebarDelegation(list) {
    list.addEventListener('click', function (e) {
      var link = e.target.closest('a[data-ch]');
      if (!link) return;
      e.preventDefault();
      var chIdx = parseInt(link.dataset.ch, 10);
      var rdIdx = link.dataset.rd !== undefined ? parseInt(link.dataset.rd, 10) : -1;

      var ui = getBookUi(activeBook);

      if (ui.SidebarLevels === 2 && rdIdx === -1) {
        // Chapter heading click in 2-level mode — expand + load
        var parentLi = link.closest('li.sidebar-chapter');
        if (parentLi) {
          var subUl = parentLi.querySelector('ul.sidebar-readings');
          if (subUl) {
            var isOpen = parentLi.classList.contains('expanded');
            // Collapse all other chapters
            list.querySelectorAll('li.sidebar-chapter.expanded').forEach(function (li) {
              li.classList.remove('expanded');
            });
            if (!isOpen) {
              parentLi.classList.add('expanded');
              selectChapter(chIdx);
            }
            return;
          }
        }
        selectChapter(chIdx);
      } else if (ui.SidebarLevels === 2 && rdIdx >= 0) {
        // Reading sub-item click in 2-level mode
        _selectReadingByChRd(chIdx, rdIdx);
      } else {
        // 1-level mode — each sidebar item is a chapter
        selectChapter(chIdx);
      }
    });

    // Delegated right-click context menu for sidebar items (admin only)
    list.addEventListener('contextmenu', function (e) {
      if (!window.currentUser || !window.currentUser.isAdmin) return;

      // Check for separator right-click
      var sepEl = e.target.closest('li.sidebar-separator');
      if (sepEl) {
        var sepIdx = parseInt(sepEl.dataset.idx, 10);
        if (!isNaN(sepIdx) && activeBook.chapters[sepIdx]) {
          e.preventDefault();
          e.stopPropagation();
          hideReadingCtxMenu();
          var sepCh = activeBook.chapters[sepIdx];
          showChapterCtxMenu(e.clientX, e.clientY, {
            bookFolder: activeBook.folder,
            section: sepCh.section || '',
            chapterFolder: sepCh.folder,
            displayTitle: sepCh.displayTitle || '',
            isSeparator: true,
            chapterIdx: sepIdx
          });
        }
        return;
      }

      var link = e.target.closest('a[data-ch]');
      if (!link) return;
      e.preventDefault();
      e.stopPropagation();
      hideChapterCtxMenu();

      var chIdx = parseInt(link.dataset.ch, 10);
      var rdIdx = link.dataset.rd !== undefined ? parseInt(link.dataset.rd, 10) : -1;
      var ui = getBookUi(activeBook);
      var ch = activeBook.chapters[chIdx];
      if (!ch) return;

      if (ui.SidebarLevels === 2 && rdIdx === -1) {
        // Right-click on chapter heading → chapter context menu
        showChapterCtxMenu(e.clientX, e.clientY, {
          bookFolder: activeBook.folder,
          section: ch.section || '',
          chapterFolder: ch.folder,
          displayTitle: ch.displayTitle || ch.title || '',
          isSeparator: false,
          chapterIdx: chIdx
        });
      } else if (ui.SidebarLevels === 2 && rdIdx >= 0) {
        // Right-click on reading sub-item → reading context menu
        var rd = ch.readings[rdIdx];
        if (rd) {
          var target = buildCtxTarget(rd, rdIdx, ch, chIdx);
          showReadingCtxMenu(e.clientX, e.clientY, target);
        }
      } else if (ui.SidebarLevels === 1) {
        // 1-level: each item is a chapter with one reading
        // Show chapter context menu for move up/down + properties
        showChapterCtxMenu(e.clientX, e.clientY, {
          bookFolder: activeBook.folder,
          section: ch.section || '',
          chapterFolder: ch.folder,
          displayTitle: ch.displayTitle || ch.title || '',
          isSeparator: false,
          chapterIdx: chIdx
        });
      }
    });
  }

  /* ── Select a reading by chapter index + reading index within chapter ── */
  function _selectReadingByChRd(chIdx, rdIdx) {
    var ch = activeBook.chapters[chIdx];
    if (!ch || rdIdx >= ch.readings.length) return;
    // Find the flat reading index
    var targetRd = ch.readings[rdIdx];
    for (var i = 0; i < flatReadings.length; i++) {
      if (flatReadings[i].rd === targetRd) {
        selectReading(i);
        return;
      }
    }
    // Fallback: select the chapter and reading directly
    activeChapterIdx = chIdx;
    var content = document.getElementById('content');
    content.innerHTML = '<p class="loading">Loading\u2026</p>';
    loadReadingText(targetRd)
      .then(function (text) {
        renderSingleReading(targetRd, text, 0, 1);
      })
      .catch(function () {
        content.innerHTML = '<p class="error">Could not load reading.</p>';
      });
  }

  /* ── Book-view mode: each reading is a sidebar row ── */
  function isDemon(avatarId, avatarObj) {
    var av = avatarObj || avatars[avatarId];
    return av && av.color === 'burgundy';
  }

  /* Parse crop string "X% Y%" or "X% Y% Z%" → {position, zoom, xPct, yPct} */
  function parseCrop(crop) {
    if (!crop) return { position: '', zoom: 1, xPct: 50, yPct: 50 };
    var parts = crop.trim().split(/\s+/);
    var xp = parseFloat(parts[0]) || 50;
    var yp = parseFloat(parts[1]) || 50;
    var pos = xp + '% ' + yp + '%';
    var z = 1;
    if (parts[2]) z = parseFloat(parts[2]) / 100 || 1;
    return { position: pos, zoom: z, xPct: xp, yPct: yp };
  }

  /* Get pre-cropped thumbnail path from full image path */
  function thumbPath(imagePath) {
    return imagePath.replace(/(\.[^.]+)$/, '_thumb.jpg');
  }

  function renderSidebarFlat(list) {
    var bookKey = activeBook.num;
    var readings;
    readings = flatReadings.map(function (fr) { return fr.rd; });

    // Helper: get sort number from filename OR folder path
    function flatSortNum(rd) {
      var p = parseFilename(rd.file);
      if (p.num !== 0 || p.separator) return p.num;
      // Fallback: parse numeric prefix from parent folder in rd.path
      if (rd.path) {
        var parts = rd.path.replace(/\\/g, '/').split('/');
        var folder = parts.length >= 2 ? parts[parts.length - 2] : '';
        var m = folder.match(/^(\d+)/);
        if (m) {
          var n = parseInt(m[1]);
          // Check if it's a separator folder
          if (/^(\d+)a(?:$|-)/.test(folder)) return n + 0.5;
          return n;
        }
      }
      return p.num;
    }

    // Sort by numeric prefix parsed from filename or folder
    readings = readings.slice().sort(function (a, b) {
      return flatSortNum(a) - flatSortNum(b);
    });
    // Filter out separators for selectReading indexing; render them inline
    var realReadings = [];
    var renderOrder = []; // { type: 'sep'|'rd', rd, realIdx }
    readings.forEach(function (rd) {
      var p = parseFilename(rd.file);
      // Also check folder name for separator pattern (e.g., rd.path = "0-Welcome/10a/reading.txt")
      if (!p.separator && rd.path) {
        var parts = rd.path.replace(/\\/g, '/').split('/');
        var folder = parts.length >= 2 ? parts[parts.length - 2] : '';
        var folderSep = folder.match(/^(\d+)a(?:$|-)/);
        if (folderSep) {
          p.separator = true;
          p.num = parseInt(folderSep[1]) + 0.5;
        }
      }
      // Skip x-prefixed files
      if (/^x/i.test(rd.file)) return;
      if (p.separator) {
        renderOrder.push({ type: 'sep', rd: rd, parsed: p, realIdx: -1 });
      } else {
        var ri = realReadings.length;
        realReadings.push(rd);
        renderOrder.push({ type: 'rd', rd: rd, parsed: p, realIdx: ri });
      }
    });

    var isAvatarSidebar = activeBook && getBookUi(activeBook).ShowAvatars;
    var chapterNum = 0; // running chapter number for non-avatar flat books

    renderOrder.forEach(function (item) {
      var li = document.createElement('li');

      if (item.type === 'sep') {
        li.className = 'sidebar-separator';
        var span = document.createElement('span');
        span.className = 'separator-text';
        // Load separator text from file content (source of truth)
        var fallback = item.rd.displayTitle || item.parsed.displayTitle || '';
        span.textContent = fallback;
        li.appendChild(span);
        list.appendChild(li);
        // Fetch the actual file to get the real separator text
        (function (sp, rd) {
          loadReadingText(rd)
            .then(function (text) {
              if (text && text.trim()) sp.textContent = text.trim();
            })
            .catch(function () {});
        })(span, item.rd);
        return;
      }

      var rd = item.rd;
      var p = item.parsed;
      var idx = item.realIdx;

      // Non-avatar flat books: render as chapter headings (same style as nested books)
      if (!isAvatarSidebar) {
        chapterNum++;
        // Use per-book chapter number if available (e.g., Imitation multi-book files)
        var displayNum = (typeof p.chapterNum === 'number' && p.chapterNum > 0) ? p.chapterNum : chapterNum;
        li.className = 'sidebar-chapter';
        var a = document.createElement('a');
        a.href = '#';
        a.className = 'chapter-heading';
        a.dataset.idx = idx;
        a.dataset.filenum = p.num;
        var titleText = rd.displayTitle || p.displayTitle || titleCase(p.slug.replace(/-/g, ' '));
        var titleHtml = titleToHtml(titleText);
        var showNums = getBookUi(activeBook).DisplaysNumbers;
        if (!showNums) {
          a.innerHTML = '<span class="chapter-text">' + titleHtml + '</span>';
        } else {
          a.innerHTML = '<span class="chapter-num">' + escHtml(String(displayNum)) + '.</span><span class="chapter-text">' + titleHtml + '</span>';
        }
        a.addEventListener('click', function (e) {
          e.preventDefault();
          selectReading(idx);
        });
        // Context menu for non-avatar flat readings
        (function (aEl, rdObj, rdI) {
          var fr = flatReadings.find(function (f) { return f.rd === rdObj; });
          if (fr) {
            var ch = fr.ch;
            var chIdx = activeBook.chapters.indexOf(ch);
            var rdInCh = ch.readings.indexOf(rdObj);
            attachReadingContextMenu(aEl, rdObj, rdInCh, ch, chIdx);
          }
        })(a, rd, idx);
        li.appendChild(a);
        list.appendChild(li);
        return;
      }

      // Avatar sidebar rendering (Welcome, Hell, etc.)
      li.className = 'sidebar-item';
      var a = document.createElement('a');
      a.href = '#';
      a.dataset.idx = idx;
      var avatarObj = avatars[p.avatarId];
      // Mark demon avatars
      if (isDemon(p.avatarId, avatarObj)) a.classList.add('demon');
      var titleText = (avatarObj && avatarObj.name) || rd.displayTitle || p.displayTitle || titleCase(p.slug.replace(/-/g, ' '));
      var titleHtml = (avatarObj && avatarObj.name) ? escHtml(titleText) : titleToHtml(titleText);

      if (avatarObj && avatarObj.id !== 'None') {
        a.classList.add('sidebar-row');
        if (avatarObj.image) {
          var clip = document.createElement('div');
          clip.className = 'sidebar-avatar-clip';
          var img = document.createElement('img');
          img.className = 'sidebar-avatar-img';
          img.src = thumbPath(avatarImage(avatarObj));
          img.alt = avatarObj.name || '';
          clip.appendChild(img);
          a.appendChild(clip);
        } else {
          var ph = document.createElement('div');
          ph.className = 'sidebar-avatar-clip sidebar-avatar-placeholder';
          ph.textContent = (avatarObj.name || p.avatarId).charAt(0);
          a.appendChild(ph);
        }
      }
      {
        var textWrap = document.createElement('div');
        textWrap.className = 'sidebar-text';
        var titleSpan = document.createElement('span');
        titleSpan.className = 'sidebar-title';
        titleSpan.innerHTML = titleHtml;
        textWrap.appendChild(titleSpan);
        // SPECIAL: Welcome page overrides — DO NOT TOUCH these subtitles.
        // They are set via filename _DisplayTitle_CustomSubtitle convention:
        //   1. "Prayers Before Reading" → subtitle "In honor of the Holy Spirit" (HolySpirit avatar)
        //   2. "Welcome"               → subtitle "Beelzebub"                (Beelzebub2 avatar)
        //   3. "Forward"                → subtitle "Beelzebub"                  (Judas2 avatar)
        // These override the default avatar .title and must remain as-is.
        var subText = p.customSubtitle || (avatarObj && avatarObj.title || '');
        if (subText) {
          var avTitle = document.createElement('span');
          avTitle.className = 'sidebar-subtitle';
          avTitle.textContent = subText;
          textWrap.appendChild(avTitle);
        }
        a.appendChild(textWrap);
      }

      a.addEventListener('click', function (e) {
        e.preventDefault();
        selectReading(idx);
      });
      // Context menu for avatar flat readings
      (function (aEl, rdObj, rdI) {
        var fr = flatReadings.find(function (f) { return f.rd === rdObj; });
        if (fr) {
          var ch = fr.ch;
          var chIdx = activeBook.chapters.indexOf(ch);
          var rdInCh = ch.readings.indexOf(rdObj);
          attachReadingContextMenu(aEl, rdObj, rdInCh, ch, chIdx);
        }
      })(a, rd, idx);

      li.appendChild(a);
      list.appendChild(li);
    });
  }

  /* ── Nested mode: flat list of chapters (no expand/collapse) ── */
  function renderSidebarNested(list) {
    var isAvatarSidebar = activeBook && getBookUi(activeBook).ShowAvatars;

    activeBook.chapters.forEach(function (ch, idx) {
      var li = document.createElement('li');
      var folder = ch.folder || '';

      // Section-label folders (e.g. 0a, 10a, 0a-Welcome, 16a-jesus)
      var isSectionLabel = /^\d+a(?:$|-)/.test(folder);
      if (isSectionLabel) {
        li.className = 'sidebar-separator';
        var span = document.createElement('span');
        span.className = 'separator-text';
        // Extract human-readable title from folder slug
        var slug = folder.replace(/^\d+a-?/, '');
        var title = ch.displayTitle || (slug ? titleCase(slug.replace(/-/g, ' ')) : '');
        span.textContent = title;
        li.appendChild(span);
        list.appendChild(li);
        // If the separator folder has a .txt file, fetch its content as the header text
        if (ch.readings.length > 0) {
          (function (sp, rd) {
            loadReadingText(rd)
              .then(function (text) {
                if (text && text.trim()) sp.textContent = text.trim();
              })
              .catch(function () {});
          })(span, ch.readings[0]);
        }
        attachSeparatorContextMenu(li, ch, idx);
        return;
      }

      // Avatar sidebar rendering (when ShowAvatars is Yes)
      if (isAvatarSidebar) {
        // Derive avatar from first reading's filename, or from folder name
        var avatarId = '';
        if (ch.readings.length > 0) {
          var p = parseFilename(ch.readings[0].file);
          avatarId = p.avatarId;
        }
        if (!avatarId) {
          var fm = folder.match(/^\d+-([A-Za-z]\w*)/);
          if (fm) avatarId = fm[1];
        }
        var avatarObj = avatars[avatarId];

        li.className = 'sidebar-item';
        var a = document.createElement('a');
        a.href = '#';
        a.dataset.idx = idx;
        if (isDemon(avatarId, avatarObj)) a.classList.add('demon');
        var titleText = (avatarObj && avatarObj.name) || ch.displayTitle || ch.title || folder;
        // Sidebar-only label overrides for Welcome book
        if (avatarId === 'Beelzebub2') titleText = 'Welcome';
        if (avatarId === 'Judas2') titleText = 'Introduction';
        var titleHtml = (avatarObj && avatarObj.name) ? escHtml(titleText) : titleToHtml(titleText);

        if (avatarObj && avatarObj.id !== 'None') {
          a.classList.add('sidebar-row');
          if (avatarObj.image) {
            var clip = document.createElement('div');
            clip.className = 'sidebar-avatar-clip';
            var img = document.createElement('img');
            img.className = 'sidebar-avatar-img';
            img.src = thumbPath(avatarImage(avatarObj));
            img.alt = avatarObj.name || '';
            clip.appendChild(img);
            a.appendChild(clip);
          } else {
            var ph = document.createElement('div');
            ph.className = 'sidebar-avatar-clip sidebar-avatar-placeholder';
            ph.textContent = (avatarObj.name || avatarId).charAt(0);
            a.appendChild(ph);
          }
        }
        var textWrap = document.createElement('div');
        textWrap.className = 'sidebar-text';
        var titleSpan = document.createElement('span');
        titleSpan.className = 'sidebar-title';
        titleSpan.innerHTML = titleHtml;
        textWrap.appendChild(titleSpan);
        // Sidebar subtitle overrides for Beelzebub2 and Judas2
        var subText = (avatarId === 'Beelzebub2') ? 'Beelzebub' :
                      (avatarId === 'Judas2') ? 'Judas Iscariot' :
                      (p && p.customSubtitle) || (avatarObj && avatarObj.title) || '';
        if (subText) {
          var avTitle = document.createElement('span');
          avTitle.className = 'sidebar-subtitle';
          avTitle.textContent = subText;
          textWrap.appendChild(avTitle);
        }
        a.appendChild(textWrap);

        a.addEventListener('click', function (e) {
          e.preventDefault();
          selectChapter(idx);
        });
        // Context menu for the first reading in this chapter
        if (ch.readings.length > 0) {
          (function (aEl, reading, chapter, chapterIdx) {
            attachReadingContextMenu(aEl, reading, 0, chapter, chapterIdx);
          })(a, ch.readings[0], ch, idx);
        }
        li.appendChild(a);
        list.appendChild(li);
        return;
      }

      // Default: chapter-heading style
      li.className = 'sidebar-chapter';

      var a = document.createElement('a');
      a.href = '#';
      a.className = 'chapter-heading';
      a.dataset.idx = idx;

      var label = prettyFolderName(folder, ch.num, ch.title, ch.displayTitle);
      if (ch.readings.length > 1) {
        // Insert count inside the chapter-text span (before closing </span>)
        label = label.replace(/<\/span>$/, ' <span class="chapter-count">(' + ch.readings.length + ')</span></span>');
      }
      a.innerHTML = label;

      if (ch.readings.length === 0) {
        a.classList.add('empty-chapter');
      }

      a.addEventListener('click', function (e) {
        e.preventDefault();
        selectChapter(idx);
      });
      attachChapterContextMenu(a, ch, idx);

      li.appendChild(a);
      list.appendChild(li);
    });
  }

  /* ── Warnings TOC sidebar: dates as grey headers, readings + section headings as items ── */
  function renderSidebarWarnings(list) {
    activeBook.chapters.forEach(function (ch, chIdx) {
      var folder = ch.folder || '';

      // Skip chapters whose folder starts with 'x' (e.g. x0-front-matter)
      if (/^x/i.test(folder)) return;

      // Date header: "Session N - YYYY-MM-DD"
      var headerLi = document.createElement('li');
      headerLi.className = 'sidebar-separator warnings-date-header';
      var headerSpan = document.createElement('span');
      headerSpan.className = 'separator-text warnings-date-text';
      var sessionNum = folder.match(/^(\d+)-/) ? folder.match(/^(\d+)-/)[1] : '';
      var dateText = formatWarningsDate(folder, sessionNum);
      headerSpan.textContent = dateText;
      headerLi.appendChild(headerSpan);
      list.appendChild(headerLi);

      if (!ch.readings.length) return;

      // For each reading in this chapter, create a reading-title entry
      // then lazy-fetch to get section headings
      ch.readings.forEach(function (rd, rdIdx) {
        // Skip readings whose filename starts with 'x'
        if (/^x/i.test(rd.file)) return;

        var parsed = parseFilename(rd.file);
        var readingTitle = rd.displayTitle || parsed.displayTitle || titleCase(parsed.slug.replace(/-/g, ' '));
        readingTitle = readingTitle.replace(/~/g, '-').replace(/\^/g, ' ');

        // Reading title item (hidden — used only as insertion anchor for section headings)
        var rdLi = document.createElement('li');
        rdLi.className = 'sidebar-item warnings-reading-item';
        rdLi.style.display = 'none';
        list.appendChild(rdLi);

        // Lazy-fetch file content to extract section headings
        (function (parentList, afterElement, cIdx, rIdx, reading, gen) {
          loadReadingText(reading)
            .then(function (text) {
              if (!text) return;
              // Bail if sidebar was re-rendered since this fetch started
              if (gen !== _sidebarGen) return;
              var lines = text.split(/\r?\n/);
              var titleLineIdx = -1;
              for (var i = 0; i < lines.length && i < 20; i++) {
                if (lines[i].trim()) { titleLineIdx = i; break; }
              }
              var headings = extractSectionHeadings(lines, titleLineIdx);
              // Insert section heading items after the reading entry
              var insertAfter = afterElement;
              headings.forEach(function (sh, shIdx) {
                var shLi = document.createElement('li');
                shLi.className = 'sidebar-item warnings-heading-item';
                var shLink = document.createElement('a');
                shLink.href = '#';
                shLink.className = 'warnings-heading-link';
                shLink.textContent = titleCase(sh.title);
                shLink.dataset.chIdx = cIdx;
                shLink.dataset.rdIdx = rIdx;
                shLink.dataset.shIdx = shIdx;
                shLink.addEventListener('click', function (e) {
                  e.preventDefault();
                  selectChapterThenScrollHeading(cIdx, rIdx, shIdx);
                  highlightWarningSidebar(cIdx, rIdx, shIdx);
                });
                shLi.appendChild(shLink);
                // Insert after the reading title (or after previous heading)
                if (insertAfter.nextSibling) {
                  parentList.insertBefore(shLi, insertAfter.nextSibling);
                } else {
                  parentList.appendChild(shLi);
                }
                insertAfter = shLi;
              });
            })
            .catch(function () {});
        })(list, rdLi, chIdx, rdIdx, rd, _sidebarGen);
      });
    });
  }

  /* ── Warnings section sidebar: same as renderSidebarWarnings but for filtered chapters ── */
  function renderSidebarWarningsSection(list, sectionChapters) {
    sectionChapters.forEach(function (ch) {
      var chIdx = activeBook.chapters.indexOf(ch);
      var folder = ch.folder || '';
      if (/^x/i.test(folder)) return;

      // Separator-style folders (e.g. "50a-The Sacraments") → render as section label
      var isSectionLabel = /^\d+a(?:$|[-\s])/.test(folder) && ch.readings.length === 0;
      if (isSectionLabel) {
        var sepLi = document.createElement('li');
        sepLi.className = 'sidebar-separator';
        var sepSpan = document.createElement('span');
        sepSpan.className = 'separator-text';
        var slug = folder.replace(/^\d+a[-\s]?/, '');
        var title = ch.displayTitle || (slug ? titleCase(slug.replace(/-/g, ' ')) : '');
        sepSpan.textContent = title;
        sepLi.appendChild(sepSpan);
        list.appendChild(sepLi);
        return;
      }

      var headerLi = document.createElement('li');
      headerLi.className = 'sidebar-separator warnings-date-header';
      var headerSpan = document.createElement('span');
      headerSpan.className = 'separator-text warnings-date-text';
      var sessionNum = folder.match(/^(\d+)-/) ? folder.match(/^(\d+)-/)[1] : '';
      if (!sessionNum) return;
      var slug = folder.replace(/^\d+-/, '');
      var isDateFolder = /^[a-z]+-\d{1,2}-\d{4}$/i.test(slug);
      if (isDateFolder) {
        headerSpan.textContent = formatWarningsDate(folder, sessionNum);
      } else {
        var chTitle = ch.displayTitle || titleCase(slug.replace(/-/g, ' '));
        headerSpan.textContent = chTitle;
      }
      headerLi.appendChild(headerSpan);
      // Mark source-linked chapters as navigable (navy blue)
      var hasSource = ch.readings.length && ch.readings.some(function (rd) { return rd.source; });
      if (hasSource) headerLi.classList.add('has-source');
      // Make header clickable so it loads the chapter
      if (ch.readings.length) {
        headerLi.style.cursor = 'pointer';
        (function (ci) {
          headerLi.addEventListener('click', function () { selectChapter(ci); });
        })(chIdx);
      }
      list.appendChild(headerLi);

      // Show displayTitle as a regular heading item below the date header
      if (ch.displayTitle) {
        var dtLi = document.createElement('li');
        dtLi.className = 'sidebar-item warnings-heading-item';
        var dtLink = document.createElement('a');
        dtLink.href = '#';
        dtLink.className = 'warnings-heading-link';
        dtLink.textContent = ch.displayTitle;
        dtLink.addEventListener('click', function (e) {
          e.preventDefault();
          selectChapter(chIdx);
        });
        dtLi.appendChild(dtLink);
        list.appendChild(dtLi);
      }

      if (!ch.readings.length) {
        // No readings to extract headings from — render as clickable chapter link
        // (for "Best of" topic folders that are empty placeholders)
        return;
      }

      ch.readings.forEach(function (rd, rdIdx) {
        if (/^x/i.test(rd.file)) return;
        var parsed = parseFilename(rd.file);

        var rdLi = document.createElement('li');
        rdLi.className = 'sidebar-item warnings-reading-item';
        rdLi.style.display = 'none';
        list.appendChild(rdLi);

        (function (parentList, afterElement, cIdx, rIdx, reading, gen) {
          loadReadingText(reading)
            .then(function (text) {
              if (!text) return;
              if (gen !== _sidebarGen) return;
              var lines = text.split(/\r?\n/);
              var lines = text.split(/\r?\n/);
              var titleLineIdx = -1;
              for (var i = 0; i < lines.length && i < 20; i++) {
                if (lines[i].trim()) { titleLineIdx = i; break; }
              }
              var headings = extractSectionHeadings(lines, titleLineIdx);
              var insertAfter = afterElement;
              headings.forEach(function (sh, shIdx) {
                var shLi = document.createElement('li');
                shLi.className = 'sidebar-item warnings-heading-item';
                var shLink = document.createElement('a');
                shLink.href = '#';
                shLink.className = 'warnings-heading-link';
                shLink.textContent = titleCase(sh.title);
                shLink.dataset.chIdx = cIdx;
                shLink.dataset.rdIdx = rIdx;
                shLink.dataset.shIdx = shIdx;
                shLink.addEventListener('click', function (e) {
                  e.preventDefault();
                  selectChapterThenScrollHeading(cIdx, rIdx, shIdx);
                  highlightWarningSidebar(cIdx, rIdx, shIdx);
                });
                shLi.appendChild(shLink);
                if (insertAfter.nextSibling) {
                  parentList.insertBefore(shLi, insertAfter.nextSibling);
                } else {
                  parentList.appendChild(shLi);
                }
                insertAfter = shLi;
              });
            })
            .catch(function () {});
        })(list, rdLi, chIdx, rdIdx, rd, _sidebarGen);
      });
    });
  }

  /* ── Nested section sidebar: chapter headings for a filtered list of chapters ── */
  function renderSidebarNestedSection(list, sectionChapters) {
    sectionChapters.forEach(function (ch) {
      var idx = activeBook.chapters.indexOf(ch);
      var folder = ch.folder || '';

      var isSectionLabel = /^\d+a(?:$|-)/.test(folder) && ch.readings.length === 0;
      if (isSectionLabel) {
        var li = document.createElement('li');
        li.className = 'sidebar-separator';
        var span = document.createElement('span');
        span.className = 'separator-text';
        var slug = folder.replace(/^\d+a-?/, '');
        var title = ch.displayTitle || (slug ? titleCase(slug.replace(/-/g, ' ')) : '');
        span.textContent = title;
        li.appendChild(span);
        list.appendChild(li);
        return;
      }

      var li = document.createElement('li');
      li.className = 'sidebar-chapter';
      var a = document.createElement('a');
      a.href = '#';
      a.className = 'chapter-heading';
      a.dataset.idx = idx;

      // Hide chapter numbers for Rosary and Apocolypse sections
      var hideNum = _activeSection && _activeSection !== 'All' && _activeSection !== 'Guests';
      var label = prettyFolderName(folder, hideNum ? 0 : ch.num, ch.title, ch.displayTitle);
      if (ch.readings.length > 1) {
        label = label.replace(/<\/span>$/, ' <span class="chapter-count">(' + ch.readings.length + ')</span></span>');
      }
      a.innerHTML = label;

      if (ch.readings.length === 0) {
        a.classList.add('empty-chapter');
      }

      a.addEventListener('click', function (e) {
        e.preventDefault();
        selectChapter(idx);
      });

      li.appendChild(a);
      list.appendChild(li);
    });
  }

  /* Navigate to a chapter, load it, then scroll to a specific section heading */
  function selectChapterThenScrollHeading(chIdx, rdIdx, shIdx) {
    activeChapterIdx = chIdx;
    var ch = activeBook.chapters[chIdx];
    highlightSidebar(chIdx);

    if (!ch.readings.length) return;

    var content = document.getElementById('content');
    content.innerHTML = '<p class="loading">Loading\u2026</p>';

    var fetches = ch.readings.map(function (rd) {
      return loadReadingText(rd)
        .then(function (text) {
          return { rd: rd, text: text };
        })
        .catch(function () {
          return { rd: rd, text: null };
        });
    });

    Promise.all(fetches).then(function (results) {
      renderChapter(ch, results, chIdx);
      // If it's the very first heading of the first reading, don't scroll —
      // keep the page at the top so the gallery / speaker image is fully shown
      if (rdIdx === 0 && shIdx === 0) {
        document.getElementById('content').scrollTop = 0;
        return;
      }
      // Scroll to the section heading anchor: reading-{rdIdx}-sh-{shIdx}
      setTimeout(function () {
        var anchorId = 'reading-' + rdIdx + '-sh-' + shIdx;
        var el = document.getElementById(anchorId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          // Fallback: scroll to reading
          scrollToReading(rdIdx);
        }
      }, 50);
    });
  }

  /* Highlight active item in the Warnings TOC sidebar */
  function highlightWarningSidebar(chIdx, rdIdx, shIdx) {
    document.querySelectorAll('.warnings-reading-link, .warnings-heading-link').forEach(function (a) {
      var match = false;
      if (shIdx !== null) {
        match = a.classList.contains('warnings-heading-link') &&
                parseInt(a.dataset.chIdx) === chIdx &&
                parseInt(a.dataset.rdIdx) === rdIdx &&
                parseInt(a.dataset.shIdx) === shIdx;
      } else {
        match = a.classList.contains('warnings-reading-link') &&
                parseInt(a.dataset.chIdx) === chIdx &&
                parseInt(a.dataset.rdIdx) === rdIdx;
      }
      a.classList.toggle('active', match);
    });
    var active = document.querySelector('.warnings-reading-link.active, .warnings-heading-link.active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  function highlightSidebar(idx) {
    var list = document.getElementById('sidebar-list');
    if (!list) return;
    // Clear all active + expanded states
    list.querySelectorAll('.active').forEach(function (el) { el.classList.remove('active'); });
    list.querySelectorAll('li.sidebar-chapter.expanded').forEach(function (li) { li.classList.remove('expanded'); });
    // Highlight chapter heading by data-ch
    list.querySelectorAll('.chapter-heading').forEach(function (a) {
      var chIdx = parseInt(a.dataset.ch, 10);
      if (isNaN(chIdx)) chIdx = parseInt(a.dataset.idx, 10); // fallback for old dynamic HTML
      var isActive = chIdx === idx;
      a.classList.toggle('active', isActive);
      if (isActive) {
        var parentLi = a.closest('li.sidebar-chapter');
        if (parentLi) parentLi.classList.add('expanded');
      }
    });
    // Highlight flat sidebar items by data-ch (Welcome-style avatars)
    list.querySelectorAll('.sidebar-item a').forEach(function (a) {
      var chIdx = parseInt(a.dataset.ch, 10);
      if (isNaN(chIdx)) chIdx = parseInt(a.dataset.idx, 10); // fallback
      a.classList.toggle('active', chIdx === idx);
    });
    var active = list.querySelector('.active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  /* ── Load a chapter then scroll to a specific reading ── */
  function selectChapterThenScroll(chIdx, rdIdx) {
    activeChapterIdx = chIdx;
    var ch = activeBook.chapters[chIdx];
    highlightSidebar(chIdx);

    if (!ch.readings.length) return;

    var content = document.getElementById('content');
    content.innerHTML = '<p class="loading">Loading\u2026</p>';

    var fetches = ch.readings.map(function (rd) {
      return loadReadingText(rd)
        .then(function (text) {
          return { rd: rd, text: text };
        })
        .catch(function () {
          return { rd: rd, text: null };
        });
    });

    Promise.all(fetches).then(function (results) {
      renderChapter(ch, results, chIdx);
      // Scroll to the specific reading after render
      setTimeout(function () { scrollToReading(rdIdx); }, 50);
    });
  }

  function scrollToReading(rdIdx) {
    var el = document.getElementById('reading-' + rdIdx);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ══════════════════════════════════════════════════════════════════
   *  TOGGLE VIEW MODE (nested books only)
   * ══════════════════════════════════════════════════════════════════ */
  function toggleView() {
    if (viewMode === 'chapter') {
      // Switch to book-view: find the flat index of the first reading
      // in the currently active chapter
      viewMode = 'book';
      var targetFlatIdx = 0;
      if (activeChapterIdx >= 0) {
        var ch = activeBook.chapters[activeChapterIdx];
        if (ch.readings.length > 0) {
          var firstPath = ch.readings[0].path;
          for (var i = 0; i < flatReadings.length; i++) {
            if (flatReadings[i].rd.path === firstPath) { targetFlatIdx = i; break; }
          }
        }
      }
      renderSidebar();
      selectReading(targetFlatIdx);
    } else {
      // Switch to chapter-view: find which chapter the current reading belongs to
      viewMode = 'chapter';
      var chIdx = 0;
      if (activeReadingIdx >= 0 && activeReadingIdx < flatReadings.length) {
        var curCh = flatReadings[activeReadingIdx].ch;
        for (var j = 0; j < activeBook.chapters.length; j++) {
          if (activeBook.chapters[j] === curCh) { chIdx = j; break; }
        }
      }
      renderSidebar();
      selectChapter(chIdx);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
   *  BOOK VIEW — select a single reading by flat index
   * ══════════════════════════════════════════════════════════════════ */
  function selectReading(rdIdx) {
    activeReadingIdx = rdIdx;
    var rd, total;

    rd = flatReadings[rdIdx].rd;
    total = flatReadings.length;

    // Map flat reading index → chapter index for sidebar highlight
    var highlightIdx = activeBook.chapters.indexOf(flatReadings[rdIdx].ch);
    highlightSidebar(highlightIdx);

    var content = document.getElementById('content');
    content.innerHTML = '<p class="loading">Loading\u2026</p>';

    loadReadingText(rd)
      .then(function (text) {
        renderSingleReading(rd, text, rdIdx, total);
        updateMobileBars();
      })
      .catch(function () {
        content.innerHTML = '<p class="error">Could not load: ' + escHtml(rd.path) + '</p>';
      });
  }

  /* ── Render one reading (book-view) with avatar header + prev/next ── */
  function renderSingleReading(rd, text, rdIdx, total) {
    var content = document.getElementById('content');
    var parsed = parseFilename(rd.file);
    var avatar = avatars[parsed.avatarId] || null;

    // Welcome book fallback: derive avatar from chapter folder when filename is generic (e.g. "reading.txt")
    if (!avatar && flatReadings[rdIdx]) {
      var ch = flatReadings[rdIdx].ch;
      if (ch && ch.folder) {
        var fm = ch.folder.match(/^\d+-([A-Za-z]\w*)/);
        if (fm) {
          parsed.avatarId = fm[1];
          avatar = avatars[parsed.avatarId] || null;
        }
      }
    }

    var lines = text.split(/\r?\n|\r/);
    var colorClass = getColorClass(parsed.avatarId);

    var titleLineIdx = -1;
    var title = rd.displayTitle || parsed.displayTitle || '';
    if (!title && parsed.slug) {
      title = parsed.slug.replace(/-/g, ' ');
    }

    // For Welcome book (num 0) with empty files, use avatar data as content
    var isWelcome = activeBook && activeBook.num === 0;
    var hasBody = lines.some(function (l) { return l.trim() !== ''; });
    if (isWelcome && avatar && !hasBody) {
      title = avatar.name || title;
    }

    var html = '';

    // ── Prev / Next nav with view toggle ──
    html += buildNav(rdIdx > 0, rdIdx < total - 1, (rdIdx + 1) + ' of ' + total, false, 'chapter');

    // ── Chapter banner images (e.g. WFB presents) ──
    var readingCh = flatReadings[rdIdx].ch;
    var chImages = (readingCh && readingCh.images || []).map(function (p) { return booksOutUrl(p); });

    // For Welcome/prayers: show only the language-specific marquee image
    if (isWelcome && parsed.slug === 'prayers' && chImages.length) {
      var langCode = getSavedLanguage() || 'en';
      var langSuffix = 'WFB%20presents_' + encodeURIComponent(langCode) + '.jpg';
      var langImg = chImages.filter(function (src) { return src.indexOf(langSuffix) !== -1; })[0];
      if (!langImg) {
        // Fallback: try English, then the blank original
        langImg = chImages.filter(function (src) { return src.indexOf('WFB%20presents_en.jpg') !== -1; })[0];
        if (!langImg) langImg = chImages[0];
      }
      chImages = [langImg];
    }

    if (chImages.length) {
      html += '<div class="chapter-gallery">';
      html += '<div class="chapter-gallery-viewport">';
      if (chImages.length > 1) html += '<button class="gallery-btn prev" data-gallery-dir="-1">&#8249;</button>';
      chImages.forEach(function (src, i) {
        html += '<img class="chapter-gallery-img' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '" src="' + escHtml(src) + '" alt="">';
      });
      if (chImages.length > 1) html += '<button class="gallery-btn next" data-gallery-dir="1">&#8250;</button>';
      html += '</div>';
      if (chImages.length > 1) {
        html += '<div class="gallery-dots">';
        chImages.forEach(function (src, i) {
          html += '<button class="gallery-dot' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '"></button>';
        });
        html += '</div>';
      }
      html += '</div>';
    }

    // ── Reading-level images (from reading subfolder) ──
    var rdImages = (rd.images || []).map(function (p) { return booksOutUrl(p); });
    if (!chImages.length && !isWelcome) {
      html += '<div class="reading-image-area">';
      if (rdImages.length) {
        html += '<div class="chapter-gallery" style="margin-bottom:0">';
        html += '<div class="chapter-gallery-viewport">';
        if (rdImages.length > 1) html += '<button class="gallery-btn prev" data-gallery-dir="-1">&#8249;</button>';
        rdImages.forEach(function (src, i) {
          html += '<img class="chapter-gallery-img' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '" src="' + escHtml(src) + '" alt="">';
        });
        if (rdImages.length > 1) html += '<button class="gallery-btn next" data-gallery-dir="1">&#8250;</button>';
        html += '</div>';
        if (rdImages.length > 1) {
          html += '<div class="gallery-dots">';
          rdImages.forEach(function (src, i) {
            html += '<button class="gallery-dot' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '"></button>';
          });
          html += '</div>';
        }
        html += '</div>';
      }
      html += '</div>';
    }

    // ── Welcome card (circle avatar) — render ABOVE the reading block ──
    if (isWelcome) {
      html += '<!-- DEBUG: isWelcome=' + isWelcome + ' avatar=' + (avatar && avatar.id) + ' avatarNone=' + (avatar && avatar.id !== 'None') + ' chImagesLen=' + chImages.length + ' rdFile=' + rd.file + ' folder=' + (flatReadings[rdIdx] && flatReadings[rdIdx].ch.folder) + ' -->';
    }
    if (isWelcome && avatar && avatar.id !== 'None' && !chImages.length) {
      var hideFullImage = (parsed.slug === 'prayers');
      var cardAvatar = avatar;
      if (avatar.id === 'Catherine4') {
        var catPrefix = _publishedMode ? './Avatars/' : '../Avatars/';
        cardAvatar = Object.assign({}, avatar, { featured: catPrefix + 'Catherine4/image.jpg', featuredOnly: true });
      }
      if (avatar.id === 'Beelzebub2') {
        var beelAvatar = avatars['Beelzebub'];
        if (beelAvatar) cardAvatar = Object.assign({}, avatar, { image: beelAvatar.image, crop: beelAvatar.crop });
      }
      if (avatar.id === 'Judas2') {
        var judasAvatar = avatars['Judas'];
        if (judasAvatar) cardAvatar = Object.assign({}, avatar, { image: judasAvatar.image, crop: judasAvatar.crop });
      }
      html += renderWelcomeCard(cardAvatar, parsed, hideFullImage, colorClass);
    }

    // ── Reading block ──
    html += '<div class="reading-block ' + colorClass + '">';

    if (isWelcome && avatar && avatar.id !== 'None') {
      // Avatar action bar on Welcome page — always blank center title
      var welcomeTitle = '';
      html += renderAvatarRow(avatar, parsed, welcomeTitle, booksOutUrl(rd.path), false, true, rd.mp3);
      if (hasBody) {
        html += '<div class="reading-body">';
        html += renderBodyLines(lines, -1);
        html += '</div>';
      }
    } else {
      if (!avatar || avatar.id !== 'None') {
        html += renderAvatarRow(avatar, parsed, title, booksOutUrl(rd.path), false, false, rd.mp3);
      }
      var isAvatarBook = activeBook && activeBook.num === 0;
      if (!isAvatarBook) {
        html += '<h3 class="reading-title">' + titleToHtml(title) + '</h3>';
      }
      html += '<div class="reading-body">';
      html += renderBodyLines(lines, titleLineIdx);
      html += '</div>';
    }
    html += '</div>';

    // ── Footer nav ──
    html += buildNav(rdIdx > 0, rdIdx < total - 1, (rdIdx + 1) + ' of ' + total, true);

    content.innerHTML = html;
    content.className = 'content book-' + activeBook.num;
    content.scrollTop = 0;
    loadTwitterEmbeds(content);
    if (window.Likes) window.Likes.refreshVisible();

    // Wire buttons
    content.querySelectorAll('[data-dir]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var target = btn.dataset.dir === 'prev' ? rdIdx - 1 : rdIdx + 1;
        selectReading(target);
      });
    });
    // Wire view toggle
    content.querySelectorAll('[data-action="toggle"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        toggleView();
      });
    });
    // Wire crop editor on welcome avatar click (admin only)
    content.querySelectorAll('[data-crop-avatar]').forEach(function (clip) {
      clip.addEventListener('click', function () {
        if (!window.currentUser || !window.currentUser.isAdmin) return;
        var avId = clip.getAttribute('data-crop-avatar');
        var av = avatars[avId];
        if (av) openCropEditor(av);
      });
    });
    // Wire avatar links — click avatar to navigate to its Welcome page
    content.querySelectorAll('[data-avatar-link]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var avId = el.getAttribute('data-avatar-link');
        if (avId) navigateToAvatarPage(avId);
      });
    });
  }
  function selectChapter(idx) {
    activeChapterIdx = idx;
    var ch = activeBook.chapters[idx];
    // Remember last chapter for this book
    localStorage.setItem('lastChapter_' + activeBook.num, idx);
    highlightSidebar(idx);
    closeMobileDrawer();

    // Avatar-profile books (e.g. Welcome): each chapter has ~1 reading,
    // render it via selectReading so the big profile card appears.
    if (getBookUi(activeBook).ShowAvatars) {
      // Switch to book-view mode so selectReading works on the flat list
      viewMode = 'book';
      flatReadings = [];
      activeBook.chapters.forEach(function (c, ci) {
        c.readings.forEach(function (rd) {
          var p = parseFilename(rd.file);
          if (!p.separator && !/^header\.txt$/i.test(rd.file)) {
            flatReadings.push({ rd: rd, ch: c, _chIdx: ci });
          }
        });
      });
      flatReadings.sort(function (a, b) {
        if (a._chIdx !== b._chIdx) return a._chIdx - b._chIdx;
        return parseFilename(a.rd.file).num - parseFilename(b.rd.file).num;
      });
      // Find the first reading from this chapter in the sorted flat list
      var firstRd = ch.readings.find(function (rd) { return !parseFilename(rd.file).separator; });
      var globalIdx = 0;
      if (firstRd) {
        for (var fi = 0; fi < flatReadings.length; fi++) {
          if (flatReadings[fi].rd === firstRd) { globalIdx = fi; break; }
        }
      }
      selectReading(globalIdx);
      return;
    }

    if (!ch.readings.length) {
      document.getElementById('content').innerHTML =
        '<p class="placeholder">No readings in this chapter yet.</p>';
      return;
    }

    var content = document.getElementById('content');
    content.innerHTML = '<p class="loading">Loading\u2026</p>';

    var fetches = ch.readings.map(function (rd) {
      return loadReadingText(rd)
        .then(function (text) {
          return { rd: rd, text: text };
        })
        .catch(function () {
          return { rd: rd, text: null };
        });
    });

    Promise.all([Promise.all(fetches), loadSummaryText(ch)]).then(function (both) {
      renderChapter(ch, both[0], idx, both[1]);
    });
  }

  /* ── Render all readings in a chapter (nested mode) ── */
  function renderChapter(ch, results, chIdx, summaryText) {
    var content = document.getElementById('content');
    var html = '';

    var prevCh = findAdjacentChapter(chIdx, -1);
    var nextCh = findAdjacentChapter(chIdx, 1);

    // Header nav
    html += buildChapterNav(prevCh !== null, nextCh !== null, prettyFolderName(ch.folder || '', null, ch.title, ch.displayTitle), false, 'book');

    // Pre-parse all readings to get titles for the index
    var parsed_results = [];
    results.forEach(function (res) {
      if (!res.text) {
        parsed_results.push({ res: res, title: res.rd.file, parsed: null, avatar: null, lines: null, colorClass: '', titleLineIdx: -1 });
        return;
      }
      var parsed = parseFilename(res.rd.file);
      var avatar = avatars[parsed.avatarId] || null;
      var lines = res.text.split(/\r?\n|\r/);
      var colorClass = getColorClass(parsed.avatarId);
      var titleLineIdx = -1;
      var title = res.rd.displayTitle || parsed.displayTitle || '';
      if (!title && parsed.slug) {
        title = parsed.slug.replace(/-/g, ' ');
      }
      parsed_results.push({ res: res, title: title, parsed: parsed, avatar: avatar, lines: lines, colorClass: colorClass, titleLineIdx: titleLineIdx });
    });

    // Chapter images — always available
    var chImages = (ch.images || []).map(function (p) { return booksOutUrl(p); });

    // Reading index — gated by ShowReadingsInThisChapter property
    var isWarningsBook = activeBook && activeBook.num === 4;
    if (shouldShowReadingsIndex()) {

      if (isWarningsBook) {
        // For Warnings: show speaker index with gallery to the right
        // Collect speakers from all readings in this chapter
        var allSpeakers = [];
        var seenCodes = {};
        parsed_results.forEach(function (pr) {
          if (!pr.lines) return;
          var sp = extractSpeakers(pr.lines);
          sp.forEach(function (s) {
            if (!seenCodes[s.code]) {
              seenCodes[s.code] = true;
              allSpeakers.push(s);
            }
          });
        });
        html += '<div id="reading-index-top"></div>';
        html += renderSpeakerAvatars(allSpeakers, chImages);
        // Build speaker code → avatarId map for inline avatars
        var speakerMap = {};
        allSpeakers.forEach(function (s) {
          if (s.avatarId) speakerMap[s.code] = s.avatarId;
        });
      } else {
        // Non-Warnings: normal reading index
        html += '<div class="reading-index-row">';
        html += '<div id="reading-index-top" class="reading-index">';
        html += '<span class="reading-index-label">Readings in this chapter:</span><ul>';
        parsed_results.forEach(function (pr, idx) {
          html += buildReadingIndexEntry(pr.avatar, pr.title, 'reading-' + idx, false, pr.res.rd.file, booksOutUrl(pr.res.rd.path));
          if (pr.parsed && pr.parsed.avatarId === 'Mary' && pr.lines) {
            var queenIdx = findQueenSplit(pr.lines);
            if (queenIdx >= 0) {
              var queenAv = avatars['Queen'] || null;
              html += buildReadingIndexEntry(queenAv, 'Words of the Queen', 'reading-' + idx + '-queen', true);
            }
          }
        });
        html += '</ul></div>';
        if (chImages.length) {
          html += '<div class="chapter-gallery">';
          html += '<div class="chapter-gallery-viewport">';
          if (chImages.length > 1) html += '<button class="gallery-btn prev" data-gallery-dir="-1">&#8249;</button>';
          chImages.forEach(function (src, i) {
            html += '<img class="chapter-gallery-img' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '" src="' + escHtml(src) + '" alt="">';
          });
          if (chImages.length > 1) html += '<button class="gallery-btn next" data-gallery-dir="1">&#8250;</button>';
          html += '</div>';
          if (chImages.length > 1) {
            html += '<div class="gallery-dots">';
            chImages.forEach(function (src, i) {
              html += '<button class="gallery-dot' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '"></button>';
            });
            html += '</div>';
          }
          html += '</div>';
        }
        html += '</div>';
      }
    } else if (chImages.length) {
      // No reading index — still show chapter images standalone (full-width)
      html += '<div class="chapter-gallery chapter-gallery-standalone">';
      html += '<div class="chapter-gallery-viewport">';
      if (chImages.length > 1) html += '<button class="gallery-btn prev" data-gallery-dir="-1">&#8249;</button>';
      chImages.forEach(function (src, i) {
        html += '<img class="chapter-gallery-img' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '" src="' + escHtml(src) + '" alt="">';
      });
      if (chImages.length > 1) html += '<button class="gallery-btn next" data-gallery-dir="1">&#8250;</button>';
      html += '</div>';
      if (chImages.length > 1) {
        html += '<div class="gallery-dots">';
        chImages.forEach(function (src, i) {
          html += '<button class="gallery-dot' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '"></button>';
        });
        html += '</div>';
      }
      html += '</div>';
    }

    // Section avatar card (e.g. Verdi on "For Priests")
    if (ch.avatar) {
      var sectionAvatar = avatars[ch.avatar] || null;
      if (sectionAvatar && sectionAvatar.id !== 'None') {
        var sectionParsed = { avatarId: ch.avatar, slug: '', displayTitle: '' };
        html += renderWelcomeCard(sectionAvatar, sectionParsed, false, getColorClass(ch.avatar));
      }
    }

    // Wrap all readings in a container
    // Chapter summary (from .summary file)
    if (summaryText) {
      var chDisplayTitle = prettyFolderName(ch.folder || '', null, ch.title, ch.displayTitle);
      html += '<div class="reading-block chapter-summary">';
      html += '<div class="chapter-summary-header">Chapter Summary</div>';
      html += '<div class="avatar-actions summary-actions">';
      html += '<button class="action-btn tts-btn" title="Listen"><svg class="tts-play-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5,3 19,12 5,21"/></svg><svg class="tts-pause-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="display:none"><rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/></svg></button>';
      html += '<button class="action-btn repost-btn" title="Quote"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>';
      html += '<button class="action-btn share-btn" title="Share" data-share-title="' + escHtml(chDisplayTitle + ' — Summary') + '"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg></button>';
      html += '<button class="action-btn copy-btn" title="Copy to clipboard"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>';
      html += '</div>';
      html += '<div class="reading-body chapter-summary-body">';
      var sumLines = summaryText.split(/\r?\n/);
      for (var si = 0; si < sumLines.length; si++) {
        var sLine = sumLines[si].trim();
        if (!sLine) { html += '<br>'; continue; }
        // Speaker labels end with colon — render as bold headers
        if (/^[A-Z][^:]{2,}:\s*$/.test(sLine)) {
          html += '<p class="summary-speaker">' + escHtml(sLine.replace(/:\s*$/, '')) + '</p>';
        } else {
          html += '<p>' + escHtml(sLine) + '</p>';
        }
      }
      html += '</div></div>';
    }

    html += '<div class="readings-container">';

    // Each reading
    var rdIndex = 0;
    parsed_results.forEach(function (pr) {
      if (!pr.res.text) {
        html += '<div class="reading-block"><p class="error">Could not load: ' + escHtml(pr.res.rd.file) + '</p></div>';
        rdIndex++;
        return;
      }

      var anchorPfx = isWarningsBook ? 'reading-' + rdIndex : null;
      html += '<div id="reading-' + rdIndex + '" class="reading-block ' + pr.colorClass + '">';
      // Check for "Words of the Queen" split in Mary readings
      var queenSplitIdx = -1;
      if (pr.parsed && pr.parsed.avatarId === 'Mary' && pr.lines) {
        queenSplitIdx = findQueenSplit(pr.lines);
      }

      // Skip Exorcist avatar row in Warnings — speakers panel already shows him
      if (!(isWarningsBook && pr.parsed && pr.parsed.avatarId === 'Exorcist')) {
        html += renderAvatarRow(pr.avatar, pr.parsed, pr.title, booksOutUrl(pr.res.rd.path), parsed_results.length > 1 && rdIndex > 0, false, pr.res.rd.mp3);
      }
      html += '<div class="reading-body">';
      if (queenSplitIdx >= 0) {
        // Render Mary's portion (before "Words of the Queen")
        html += renderBodyLines(pr.lines.slice(0, queenSplitIdx), pr.titleLineIdx, anchorPfx, speakerMap);
        html += '</div></div>';
        // Render Queen's portion with separate _queen.mp3
        var queenAv = avatars['Queen'] || null;
        var queenColor = getColorClass('Queen');
        var queenMp3Path = booksOutUrl(pr.res.rd.path).replace(/\.txt$/, '_queen.mp3');
        var hasQueenMp3 = !!pr.res.rd.queenMp3;
        html += '<div id="reading-' + rdIndex + '-queen" class="reading-block ' + queenColor + '">';
        html += renderAvatarRow(queenAv, { avatarId: 'Queen', slug: '' }, 'Words of the Queen', booksOutUrl(pr.res.rd.path), parsed_results.length > 1 && rdIndex > 0, true, hasQueenMp3, queenMp3Path);
        html += '<div class="reading-body">';
        html += renderBodyLines(pr.lines.slice(queenSplitIdx), 0, anchorPfx, speakerMap);
        html += '</div></div>';
      } else {
        html += renderBodyLines(pr.lines, pr.titleLineIdx, anchorPfx, speakerMap);
        html += '</div></div>';
      }
      rdIndex++;
    });

    html += '</div>'; // close readings-container

    // Footer nav
    html += buildChapterNav(prevCh !== null, nextCh !== null, prettyFolderName(ch.folder || '', null, ch.title, ch.displayTitle), true, null);

    content.innerHTML = html;
    content.className = 'content book-' + activeBook.num;
    content.scrollTop = 0;
    loadTwitterEmbeds(content);
    if (window.Likes) window.Likes.refreshVisible();

    // Wire reading index links for smooth scroll
    content.querySelectorAll('.reading-index-link').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var targetId = link.getAttribute('href').substring(1);
        var el = document.getElementById(targetId);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    // Wire "Top" links on avatar rows to scroll back to reading index
    content.querySelectorAll('.avatar-top-link').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var el = document.getElementById('reading-index-top');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    // Wire "▲ top" links on section headings to smooth-scroll to reading index
    content.querySelectorAll('.section-top-link').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var el = document.getElementById('reading-index-top');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    content.querySelectorAll('[data-dir]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var target = btn.dataset.dir === 'prev' ? prevCh : nextCh;
        if (target !== null) selectChapter(target);
      });
    });
    // Wire view toggle
    content.querySelectorAll('[data-action="toggle"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        toggleView();
      });
    });
    // Wire gallery carousel
    content.querySelectorAll('.chapter-gallery').forEach(function (gallery) {
      var imgs = gallery.querySelectorAll('.chapter-gallery-img');
      var dots = gallery.querySelectorAll('.gallery-dot');
      var count = imgs.length;
      if (count === 0) return;
      var current = 0;

      function showSlide(idx) {
        current = (idx + count) % count;
        imgs.forEach(function (img) { img.classList.remove('active'); });
        dots.forEach(function (dot) { dot.classList.remove('active'); });
        imgs[current].classList.add('active');
        if (dots[current]) dots[current].classList.add('active');
      }

      gallery.querySelectorAll('.gallery-btn').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          showSlide(current + parseInt(btn.dataset.galleryDir));
        });
      });

      dots.forEach(function (dot) {
        dot.addEventListener('click', function (e) {
          e.preventDefault();
          showSlide(parseInt(dot.dataset.idx));
        });
      });

      // Lightbox on image click (with prev/next arrows)
      imgs.forEach(function (img) {
        img.addEventListener('click', function () {
          var lbIdx = current;
          var overlay = document.createElement('div');
          overlay.className = 'lightbox-overlay';
          var closeBtn = document.createElement('button');
          closeBtn.className = 'lightbox-close';
          closeBtn.innerHTML = '&times;';
          var bigImg = document.createElement('img');
          bigImg.src = imgs[lbIdx].src;
          bigImg.addEventListener('click', function (e) { e.stopPropagation(); });
          overlay.appendChild(closeBtn);
          if (count > 1) {
            var lbPrev = document.createElement('button');
            lbPrev.className = 'lightbox-arrow lightbox-prev';
            lbPrev.innerHTML = '&#8249;';
            overlay.appendChild(lbPrev);
          }
          overlay.appendChild(bigImg);
          if (count > 1) {
            var lbNext = document.createElement('button');
            lbNext.className = 'lightbox-arrow lightbox-next';
            lbNext.innerHTML = '&#8250;';
            overlay.appendChild(lbNext);
          }
          document.body.appendChild(overlay);
          function updateLb() { bigImg.src = imgs[lbIdx].src; showSlide(lbIdx); }
          function closeLightbox() { document.body.removeChild(overlay); document.removeEventListener('keydown', onKey); }
          if (count > 1) {
            lbPrev.addEventListener('click', function (e) { e.stopPropagation(); lbIdx = (lbIdx - 1 + count) % count; updateLb(); });
            lbNext.addEventListener('click', function (e) { e.stopPropagation(); lbIdx = (lbIdx + 1) % count; updateLb(); });
          }
          overlay.addEventListener('click', closeLightbox);
          closeBtn.addEventListener('click', function (e) { e.stopPropagation(); closeLightbox(); });
          function onKey(e) {
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowLeft' && count > 1) { lbIdx = (lbIdx - 1 + count) % count; updateLb(); }
            if (e.key === 'ArrowRight' && count > 1) { lbIdx = (lbIdx + 1) % count; updateLb(); }
          }
          document.addEventListener('keydown', onKey);
        });
      });
    });

    // Wire avatar links — click avatar to navigate to its Welcome page
    content.querySelectorAll('[data-avatar-link]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var avId = el.getAttribute('data-avatar-link');
        if (avId) navigateToAvatarPage(avId);
      });
    });
  }

  function findAdjacentChapter(fromIdx, direction) {
    var currentSection = activeBook.sections && activeBook.sections.length
      ? activeBook.chapters[fromIdx] && activeBook.chapters[fromIdx].section
      : null;
    var i = fromIdx + direction;
    while (i >= 0 && i < activeBook.chapters.length) {
      var ch = activeBook.chapters[i];
      // If sectioned, stay within the same section
      if (currentSection && ch.section !== currentSection) { i += direction; continue; }
      if (ch.readings.length > 0) return i;
      i += direction;
    }
    return null;
  }

  /* ══════════════════════════════════════════════════════════════════
   *  SHARED RENDER HELPERS
   * ══════════════════════════════════════════════════════════════════ */

  /* ── Welcome card: avatar-driven display when file has no body text ── */
  function renderWelcomeCard(avatar, parsed, hideFullImage, colorClass) {
    var avImg = avatarImage(avatar);
    var hasImage = !hideFullImage && (avatar.featured || avImg);
    var html = '<div class="welcome-card' + (hasImage ? ' welcome-card-featured' : '') + (colorClass ? ' ' + colorClass : '') + '">';
    // Left side: avatar + info
    html += '<div class="welcome-profile">';
    // Large avatar image
    if (avImg) {
      var cr = parseCrop(avatar.crop);
      var imgStyle = 'object-fit:cover;';
      if (cr.position) imgStyle += 'object-position:' + cr.position + ';';
      if (cr.zoom !== 1) imgStyle += 'transform:scale(' + cr.zoom + ');transform-origin:' + (cr.xPct) + '% ' + (cr.yPct) + '%;';
      html += '<div class="welcome-avatar-clip" data-crop-avatar="' + escHtml(avatar.id) + '" title="Click to adjust crop" style="cursor:pointer">';
      html += '<img class="welcome-avatar-img" src="' + escHtml(avImg) + '" alt="' + escHtml(avatar.name || '') + '" style="' + imgStyle + '">';
      html += '</div>';
    } else {
      html += '<div class="welcome-avatar-img avatar-placeholder welcome-placeholder">' + escHtml((avatar.name || parsed.avatarId).charAt(0)) + '</div>';
    }
    // Name, title, book — only shown on profile pages (no body text)
    if (!hideFullImage) {
      // Show display title override (from filename) above the name if present
      if (parsed.displayTitle) {
        html += '<p class="welcome-book">' + escHtml(parsed.displayTitle) + '</p>';
      }
      html += '<h2 class="welcome-name">' + escHtml(avatar.name || parsed.avatarId) + '</h2>';
      if (!parsed.displayTitle && avatar.title) {
        html += '<p class="welcome-title">' + escHtml(avatar.title) + '</p>';
      }
      if (avatar.book) {
        html += '<p class="welcome-book">' + escHtml(avatar.book) + '</p>';
      }
      if (avatar.book2) {
        html += '<p class="welcome-book">' + escHtml(avatar.book2) + '</p>';
      }
    }
    html += '</div>';
    // Avatars that should NOT get a border on the right-side image
    var noBorderAvatars = ['Exorcist','Verdi','Akabor','Veroba','Allida','Lucifer','LuciferW','Beelzebub','Beelzebub2'];
    var noBorderClass = noBorderAvatars.indexOf(avatar.id) !== -1 ? ' welcome-featured-no-border' : '';
    // Right side: full image(s) — if avatar has both image and featured, show both big
    if (hasImage) {
      if (avatar.featured && avImg && !avatar.featuredOnly) {
        html += '<div class="welcome-featured welcome-featured-duo' + noBorderClass + '">';
        html += '<img class="welcome-featured-img" src="' + escHtml(avImg) + '" alt="' + escHtml(avatar.name) + '">';
        html += '<img class="welcome-featured-img" src="' + escHtml(avatar.featured) + '" alt="' + escHtml(avatar.name) + '">';
        if (avatar.caption) {
          html += '<p class="welcome-caption">' + escHtml(avatar.caption) + '</p>';
        }
        html += '</div>';
      } else {
        var fullImage = avatar.featured || avImg;
        html += '<div class="welcome-featured' + noBorderClass + '"><img class="welcome-featured-img" src="' + escHtml(fullImage) + '" alt="' + escHtml(avatar.name) + '">';
        if (avatar.caption) {
          html += '<p class="welcome-caption">' + escHtml(avatar.caption) + '</p>';
        }
        html += '</div>';
      }
    }
    html += '</div>';
    return html;
  }

  /* ── Live crop editor (click avatar circle on Welcome page) ── */
  function openCropEditor(avatar) {
    // Remove any existing editor
    var old = document.getElementById('crop-editor');
    if (old) old.remove();

    var cr = parseCrop(avatar.crop);
    var parts = (avatar.crop || '50% 50% 100%').trim().split(/\s+/);
    var cx = parseInt(parts[0]) || 50;
    var cy = parseInt(parts[1]) || 50;
    var cz = parseInt(parts[2]) || 100;

    // Voice/speed/pitch from avatar
    var curVoice = avatar.voice || '';
    var curSpeed = avatar.speed || '0';
    var curPitch = avatar.pitch || '0';

    // English voice list for the dropdown (47 voices)
    var ttsVoices = [
      { label: '── US Female ──', value: '', disabled: true },
      { label: 'Ava', value: 'en-US-AvaNeural' },
      { label: 'Aria', value: 'en-US-AriaNeural' },
      { label: 'Emma', value: 'en-US-EmmaNeural' },
      { label: 'Jenny', value: 'en-US-JennyNeural' },
      { label: 'Michelle', value: 'en-US-MichelleNeural' },
      { label: '── US Male ──', value: '', disabled: true },
      { label: 'Andrew', value: 'en-US-AndrewNeural' },
      { label: 'Brian', value: 'en-US-BrianNeural' },
      { label: 'Christopher', value: 'en-US-ChristopherNeural' },
      { label: 'Eric', value: 'en-US-EricNeural' },
      { label: 'Guy', value: 'en-US-GuyNeural' },
      { label: 'Roger', value: 'en-US-RogerNeural' },
      { label: 'Steffan', value: 'en-US-SteffanNeural' },
      { label: '── British Female ──', value: '', disabled: true },
      { label: 'Sonia (GB)', value: 'en-GB-SoniaNeural' },
      { label: 'Libby (GB)', value: 'en-GB-LibbyNeural' },
      { label: '── British Male ──', value: '', disabled: true },
      { label: 'Ryan (GB)', value: 'en-GB-RyanNeural' },
      { label: 'Thomas (GB)', value: 'en-GB-ThomasNeural' },
      { label: '── Other ──', value: '', disabled: true },
      { label: 'Natasha (AU)', value: 'en-AU-NatashaNeural' },
      { label: 'William (AU)', value: 'en-AU-WilliamMultilingualNeural' },
      { label: 'Clara (CA)', value: 'en-CA-ClaraNeural' },
      { label: 'Liam (CA)', value: 'en-CA-LiamNeural' },
      { label: 'Emily (IE)', value: 'en-IE-EmilyNeural' },
      { label: 'Connor (IE)', value: 'en-IE-ConnorNeural' },
      { label: 'Neerja (IN)', value: 'en-IN-NeerjaNeural' },
      { label: 'Prabhat (IN)', value: 'en-IN-PrabhatNeural' },
      { label: 'Molly (NZ)', value: 'en-NZ-MollyNeural' },
      { label: 'Mitchell (NZ)', value: 'en-NZ-MitchellNeural' },
    ];
    var voiceOptions = '<option value="">(default)</option>';
    ttsVoices.forEach(function(v) {
      if (v.disabled) {
        voiceOptions += '<option disabled>' + escHtml(v.label) + '</option>';
      } else {
        var sel = (v.value === curVoice) ? ' selected' : '';
        voiceOptions += '<option value="' + escHtml(v.value) + '"' + sel + '>' + escHtml(v.label) + '</option>';
      }
    });

    var overlay = document.createElement('div');
    overlay.id = 'crop-editor';
    overlay.innerHTML =
      '<div class="crop-panel">' +
        '<div class="crop-header"><span class="crop-avatar-id">' + escHtml(avatar.id) + '</span><button class="crop-close">&times;</button></div>' +
        '<div class="crop-preview"><div class="crop-preview-clip" id="crop-preview-clip" style="background-image:url(\'' + escHtml(avatar.image) + '\')"></div></div>' +
        '<div class="crop-controls">' +
          '<label>X <input type="range" id="crop-x" min="0" max="100" value="' + cx + '"><span id="crop-x-val">' + cx + '%</span></label>' +
          '<label>Y <input type="range" id="crop-y" min="-200" max="100" value="' + cy + '"><span id="crop-y-val">' + cy + '%</span></label>' +
          '<label>Zoom <input type="range" id="crop-z" min="100" max="600" step="10" value="' + cz + '"><span id="crop-z-val">' + cz + '%</span></label>' +
        '</div>' +
        '<div class="crop-output"><code id="crop-string">crop\t' + cx + '% ' + cy + '% ' + cz + '%</code></div>' +
        '<hr class="crop-divider">' +
        '<div class="voice-section">' +
          '<div class="voice-section-title">Voice Settings</div>' +
          '<div class="voice-controls">' +
            '<label class="voice-label">Voice <select id="voice-select" class="voice-select">' + voiceOptions + '</select></label>' +
            '<label>Speed <input type="range" id="voice-speed" min="-50" max="50" step="5" value="' + parseInt(curSpeed) + '"><span id="voice-speed-val">' + curSpeed + '%</span></label>' +
            '<label>Pitch <input type="range" id="voice-pitch" min="-50" max="50" step="5" value="' + parseInt(curPitch) + '"><span id="voice-pitch-val">' + curPitch + 'Hz</span></label>' +
          '</div>' +
          '<div class="crop-output"><code id="voice-string">voice\t' + escHtml(curVoice) + '</code></div>' +
        '</div>' +
        '<div class="crop-actions"><button id="voice-preview" class="crop-btn voice-preview-btn" title="Preview voice">&#9654; Preview</button><button id="crop-save" class="crop-btn">Save to .properties</button></div>' +
      '</div>';
    document.body.appendChild(overlay);

    var clipEl = document.getElementById('crop-preview-clip');
    var xSlider = document.getElementById('crop-x');
    var ySlider = document.getElementById('crop-y');
    var zSlider = document.getElementById('crop-z');
    var xVal = document.getElementById('crop-x-val');
    var yVal = document.getElementById('crop-y-val');
    var zVal = document.getElementById('crop-z-val');
    var cropStr = document.getElementById('crop-string');

    function updatePreview() {
      var x = xSlider.value, y = ySlider.value, z = zSlider.value;
      xVal.textContent = x + '%';
      yVal.textContent = y + '%';
      zVal.textContent = z + '%';
      var pos = x + '% ' + y + '%';
      clipEl.style.backgroundSize = z + '%';
      clipEl.style.backgroundPosition = pos;
      var str = x + '% ' + y + '%';
      if (z !== '100') str += ' ' + z + '%';
      cropStr.textContent = 'crop\t' + str;
      // Also live-update all avatar circles on the page
      var imgKey = avatar.image.replace(/^\.\.[\/\\]/, '');
      // Welcome card uses <img> with transform:scale
      document.querySelectorAll('.welcome-avatar-img').forEach(function(img) {
        if (img.src && img.src.indexOf(imgKey) !== -1) {
          img.style.objectPosition = pos;
          img.style.transform = 'scale(' + (parseFloat(z) / 100) + ')';
          img.style.transformOrigin = pos;
        }
      });
    }
    xSlider.addEventListener('input', updatePreview);
    ySlider.addEventListener('input', updatePreview);
    zSlider.addEventListener('input', updatePreview);
    updatePreview();

    // Voice controls
    var voiceSelect = document.getElementById('voice-select');
    var speedSlider = document.getElementById('voice-speed');
    var pitchSlider = document.getElementById('voice-pitch');
    var speedValEl = document.getElementById('voice-speed-val');
    var pitchValEl = document.getElementById('voice-pitch-val');
    var voiceStr = document.getElementById('voice-string');

    function updateVoiceDisplay() {
      var s = speedSlider.value, p = pitchSlider.value;
      speedValEl.textContent = (s >= 0 ? '+' : '') + s + '%';
      pitchValEl.textContent = (p >= 0 ? '+' : '') + p + 'Hz';
      voiceStr.textContent = 'voice\t' + voiceSelect.value + '  speed\t' + s + '  pitch\t' + p;
    }
    voiceSelect.addEventListener('change', updateVoiceDisplay);
    speedSlider.addEventListener('input', updateVoiceDisplay);
    pitchSlider.addEventListener('input', updateVoiceDisplay);

    // Preview button — server-side edge-tts via /tts-preview
    var _previewAudio = null;
    var _previewAbort = null;
    var previewBtn = document.getElementById('voice-preview');

    function triggerPreview() {
      var btn = previewBtn;
      // Stop any existing playback
      if (_previewAudio) { _previewAudio.pause(); _previewAudio = null; }
      if (_previewAbort) { _previewAbort.abort(); _previewAbort = null; }
      var voice = voiceSelect.value || 'en-US-AvaNeural';
      var speed = speedSlider.value;
      var pitch = pitchSlider.value;
      var sampleText = 'No one knows better than I what the Cross of Christ means. I was an Apostle and I walked with the Most High. I also saw His miracles. But your holy Church and the priests of your Church are absolutely no better than I was. On the contrary. Many are even more depraved and evil.';
      btn.textContent = '\u23F3 Loading...';
      _previewAbort = new AbortController();
      fetch('/tts-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sampleText, voice: voice, speed: parseInt(speed), pitch: parseInt(pitch) }),
        signal: _previewAbort.signal
      })
      .then(function(r) { if (!r.ok) throw new Error('TTS failed'); return r.blob(); })
      .then(function(blob) {
        var url = URL.createObjectURL(blob);
        _previewAudio = new Audio(url);
        _previewAudio.onended = function() { btn.textContent = '\u25B6 Preview'; URL.revokeObjectURL(url); _previewAudio = null; };
        _previewAudio.play();
        btn.textContent = '\u25A0 Stop';
      })
      .catch(function(err) {
        if (err.name !== 'AbortError') { btn.textContent = '\u25B6 Preview'; console.error('[TTS Preview]', err); }
      });
    }

    previewBtn.addEventListener('click', function() {
      if (_previewAudio && !_previewAudio.paused) {
        _previewAudio.pause();
        _previewAudio = null;
        previewBtn.textContent = '\u25B6 Preview';
        return;
      }
      triggerPreview();
    });

    // Auto-restart preview when voice/speed/pitch changes
    voiceSelect.addEventListener('change', triggerPreview);
    speedSlider.addEventListener('change', triggerPreview);
    pitchSlider.addEventListener('change', triggerPreview);

    // Close button
    overlay.querySelector('.crop-close').addEventListener('click', function() { if (_previewAudio) { _previewAudio.pause(); _previewAudio = null; } overlay.remove(); });
    // Click outside panel to close
    overlay.addEventListener('click', function(e) { if (e.target === overlay) { if (_previewAudio) { _previewAudio.pause(); _previewAudio = null; } overlay.remove(); } });

    // Save button
    document.getElementById('crop-save').addEventListener('click', function() {
      var x = xSlider.value, y = ySlider.value, z = zSlider.value;
      var cropVal = x + '% ' + y + '%';
      if (z !== '100') cropVal += ' ' + z + '%';
      // Gather voice settings too
      var voiceVal = (document.getElementById('voice-select') || {}).value || '';
      var speedVal2 = (document.getElementById('voice-speed') || {}).value || '0';
      var pitchVal2 = (document.getElementById('voice-pitch') || {}).value || '0';
      fetch('/save-crop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: avatar.id, crop: cropVal, voice: voiceVal, speed: speedVal2, pitch: pitchVal2 })
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.ok) {
          avatar.crop = cropVal;
          avatar.voice = voiceVal;
          avatar.speed = speedVal2;
          avatar.pitch = pitchVal2;
          var btn = document.getElementById('crop-save');
          btn.textContent = 'Saved \u2713';
          btn.style.background = '#27ae60';
          setTimeout(function() { btn.textContent = 'Save to .properties'; btn.style.background = ''; }, 1500);
        } else {
          alert('Save failed: ' + (data.error || 'unknown'));
        }
      }).catch(function(err) { alert('Save failed: ' + err); });
    });
  }

  /* Navigate to avatar's profile page in the Welcome book */
  function navigateToAvatarPage(avatarId) {
    var welcomeBook = books.find(function (b) { return b.num === 0; });
    if (!welcomeBook) return;
    // Build flat reading list for Welcome book
    var welcomeReadings = [];
    welcomeBook.chapters.forEach(function (ch) {
      ch.readings.forEach(function (rd) {
        welcomeReadings.push(rd);
      });
    });
    // Find the reading whose avatarId matches
    for (var i = 0; i < welcomeReadings.length; i++) {
      var p = parseFilename(welcomeReadings[i].file);
      if (p.avatarId === avatarId) {
        selectBook(0);
        selectReading(i);
        return;
      }
    }
  }

  function renderAvatarRow(avatar, parsed, shareTitle, downloadPath, showTopLink, hideFeatured, hasMp3, mp3Override) {
    var topLink = showTopLink ? '<a href="#reading-index-top" class="avatar-top-link">&#9650; top</a>' : '';
    var isWelcomeBook = activeBook && activeBook.num === 0;
    var avatarLinkAttr = (!isWelcomeBook && parsed && parsed.avatarId) ? ' data-avatar-link="' + escHtml(parsed.avatarId) + '"' : '';
    var clickStyle = avatarLinkAttr ? ' style="cursor:pointer" title="View avatar page"' : '';
    var colorCls = (avatar && avatar.color && avatar.color !== 'blue') ? ' avatar-color-' + avatar.color : '';
    var html = '<div class="avatar-row' + colorCls + '">' + '<div class="avatar-left' + (avatarLinkAttr ? ' avatar-clickable' : '') + '"' + avatarLinkAttr + clickStyle + '>';
    if (avatar && avatar.image) {
      html += '<div class="avatar-img-clip"><img class="avatar-img" src="' + escHtml(thumbPath(avatarImage(avatar))) + '" alt="' + escHtml(avatar.name || '') + '"></div>';
    } else {
      html += '<div class="avatar-img avatar-placeholder">' + escHtml((avatar ? avatar.name : parsed.avatarId).charAt(0)) + '</div>';
    }
    html += '<div class="avatar-info">';
    html += '<span class="avatar-name">' + escHtml(avatar ? avatar.name : parsed.avatarId) + '</span>';
    var avatarSub = (parsed && parsed.customSubtitle) || (avatar && avatar.title) || '';
    if (avatarSub) html += '<span class="avatar-row-subtitle">' + escHtml(avatarSub) + '</span>';
    html += '</div></div>';
    html += '<div class="avatar-center"><span class="avatar-reading-title">' + escHtml(shareTitle || '') + '</span></div>';
    html += '<div class="avatar-actions">';
    html += topLink;
    html += '<button class="action-btn tts-btn" title="Listen"><svg class="tts-play-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5,3 19,12 5,21"/></svg><svg class="tts-pause-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="display:none"><rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/></svg></button>';
    html += '<button class="action-btn repost-btn" title="Quote"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>';
    html += '<button class="action-btn like-btn" title="Like" data-reading-key="' + escHtml(downloadPath || '') + '"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg><span class="like-count"></span></button>';
    html += '<button class="action-btn share-btn" title="Share" data-share-title="' + escHtml(shareTitle || '') + '"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg></button>';
    var mp3Path = mp3Override || (hasMp3 && downloadPath ? downloadPath.replace(/\.txt$/, '.mp3') : '');
    var mp3Attr = mp3Path ? ' data-mp3-path="' + escHtml(mp3Path) + '"' : '';
    html += '<button class="action-btn download-btn" title="Download" data-download-path="' + escHtml(downloadPath || '') + '" data-download-title="' + escHtml(shareTitle || 'reading') + '"' + mp3Attr + '><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>';
    html += '<button class="action-btn copy-btn" title="Copy to clipboard"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>';
    html += '</div></div>';
    // Featured painting shown beside avatar row
    if (avatar && avatar.featured && !hideFeatured) {
      html += '<div class="avatar-featured"><img class="avatar-featured-img" src="' + escHtml(avatar.featured) + '" alt="' + escHtml(avatar.name) + '"></div>';
    }
    return html;
  }

  function renderBodyLines(lines, titleLineIdx, anchorPrefix, speakerMap) {
    var html = '';
    var started = false;
    var capsIdx = 0;
    var lastSectionTitle = '';
    for (var j = 0; j < lines.length; j++) {
      var line = lines[j].trim();
      if (!started) {
        if (j === titleLineIdx) { started = true; continue; }
        if (!line) continue;
        started = true;
      }
      if (line) {
        // *** = section break / extra newline
        if (/^\*{3,}$/.test(line)) { html += '<br>'; continue; }

        // In Warnings readings, skip speaker definition lines (e.g. "E = Exorcist.", "B = Beelzebub, angelic demon")
        if (anchorPrefix && /^[A-Z][a-z]?\s*=\s*\S/.test(line)) continue;

        // Embed X/Twitter post URLs
        var tweetMatch = line.match(/^https?:\/\/(?:x\.com|twitter\.com)\/\w+\/status\/(\d+)/);
        if (tweetMatch) {
          var tweetId = tweetMatch[1];
          html += '<div class="tweet-embed" data-tweet-id="' + tweetId + '">'
            + '<blockquote class="twitter-tweet" data-dnt="true">'
            + '<a href="' + escHtml(line.split('?')[0]) + '">Loading tweet\u2026</a>'
            + '</blockquote></div>';
          continue;
        }

        // Auto-bold ALL CAPS lines (chapter headings in plain text)
        var letters = line.replace(/[^a-zA-Z]/g, '');
        var isAllCaps = letters.length > 1 && letters === letters.toUpperCase();
        if (isAllCaps) {
          lastSectionTitle = line;
          // Look ahead: if next speaker line is a demon, skip standalone title (it goes in avatar bar)
          var nextDemon = false;
          if (speakerMap) {
            for (var k = j + 1; k < lines.length; k++) {
              var peek = lines[k].trim();
              if (!peek) continue;
              var peekMatch = peek.match(/^([A-Z][a-z]?):\s/);
              if (peekMatch && speakerMap[peekMatch[1]] && isDemon(speakerMap[peekMatch[1]])) nextDemon = true;
              break;
            }
          }
          if (!nextDemon) {
            var anchorAttr = anchorPrefix ? ' id="' + anchorPrefix + '-sh-' + capsIdx + '"' : '';
            var topLink = anchorPrefix ? ' <a href="#reading-index-top" class="section-top-link">&#9650; top</a>' : '';
            html += '<p' + anchorAttr + '><strong>' + escHtml(line) + '</strong>' + topLink + '</p>';
          }
          capsIdx++;
        } else {
          // Inline speaker avatar for Warnings readings
          var spMatch = speakerMap && line.match(/^([A-Z][a-z]?):\s/);
          if (spMatch && speakerMap[spMatch[1]]) {
            var spAvId = speakerMap[spMatch[1]];
            var spAv = avatars[spAvId];
            if (isDemon(spAvId, spAv)) {
              // Full avatar bar for demon speakers
              var spParsed = { avatarId: spAvId, slug: '' };
              html += renderAvatarRow(spAv, spParsed, lastSectionTitle || (spAv ? spAv.name : spAvId), '', false, true);
              html += '<p>' + escHtml(line.substring(spMatch[0].length)) + '</p>';
            } else {
              var spImg = (spAv && spAv.image) ? '<img class="inline-speaker-avatar" src="' + escHtml(thumbPath(avatarImage(spAv))) + '" alt="' + escHtml(spAv.name || '') + '">' : '';
              html += '<p>' + spImg + escHtml(line.substring(spMatch[0].length)) + '</p>';
            }
          } else {
            html += '<p>' + escHtml(line) + '</p>';
          }
        }
      }
    }
    return html;
  }

  function buildNav(hasPrev, hasNext, posText, isFooter, toggleTarget) {
    var cls = isFooter ? 'footer-nav' : 'header-nav';
    var html = '<div class="' + cls + '">';
    html += hasPrev
      ? '<a href="#" class="nav-btn" data-dir="prev">&larr; Previous</a>'
      : '<span class="nav-btn disabled">&larr; Previous</span>';
    html += '<span class="nav-pos">' + posText + '</span>';
    html += hasNext
      ? '<a href="#" class="nav-btn" data-dir="next">Next &rarr;</a>'
      : '<span class="nav-btn disabled">Next &rarr;</span>';
    html += '</div>';
    return html;
  }

  function buildChapterNav(hasPrev, hasNext, titleHtml, isFooter, toggleTarget) {
    var cls = isFooter ? 'footer-nav' : 'header-nav';
    var html = '<div class="' + cls + '">';
    html += hasPrev
      ? '<a href="#" class="nav-btn" data-dir="prev">&larr; Previous</a>'
      : '<span class="nav-btn disabled">&larr; Previous</span>';
    html += '<div class="chapter-title">' + titleHtml + '</div>';
    html += hasNext
      ? '<a href="#" class="nav-btn" data-dir="next">Next &rarr;</a>'
      : '<span class="nav-btn disabled">Next &rarr;</span>';
    html += '</div>';
    return html;
  }

  /* ══════════════════════════════════════════════════════════════════
   *  UTILITY HELPERS
   * ══════════════════════════════════════════════════════════════════ */

  /** Load the Twitter/X widget script (once) and render any tweet embeds on the page */
  var _twitterScriptLoading = false;
  function loadTwitterEmbeds(container) {
    var embeds = container.querySelectorAll('.tweet-embed[data-tweet-id]');
    if (!embeds.length) return;

    function renderTweets() {
      // Use createTweet API for each embed container
      embeds.forEach(function (div) {
        var id = div.getAttribute('data-tweet-id');
        if (!id || div.getAttribute('data-rendered')) return;
        div.setAttribute('data-rendered', '1');
        // Clear the blockquote fallback
        div.innerHTML = '';
        twttr.widgets.createTweet(id, div, { dnt: true, align: 'center' })
          .then(function (el) {
            if (!el) {
              // Widget failed — show a link fallback
              div.innerHTML = '<p style="text-align:center;"><a href="https://x.com/i/status/' + id
                + '" target="_blank" rel="noopener" style="color:#1da1f2;text-decoration:underline;">View post on X</a></p>';
            }
          })
          .catch(function () {
            div.innerHTML = '<p style="text-align:center;"><a href="https://x.com/i/status/' + id
              + '" target="_blank" rel="noopener" style="color:#1da1f2;text-decoration:underline;">View post on X</a></p>';
          });
      });
    }

    if (window.twttr && twttr.widgets && twttr.widgets.createTweet) {
      renderTweets();
      return;
    }

    // Load the script once
    if (!_twitterScriptLoading) {
      _twitterScriptLoading = true;
      var s = document.createElement('script');
      s.src = 'https://platform.twitter.com/widgets.js';
      s.async = true;
      s.charset = 'utf-8';
      s.onload = function () {
        if (window.twttr && twttr.widgets) renderTweets();
      };
      s.onerror = function () {
        // Script blocked — show link fallbacks
        embeds.forEach(function (div) {
          var id = div.getAttribute('data-tweet-id');
          div.innerHTML = '<p style="text-align:center;padding:20px;background:#f8f8f8;border:1px solid #e0e0e0;border-radius:8px;">'
            + '<a href="https://x.com/i/status/' + id
            + '" target="_blank" rel="noopener" style="color:#1da1f2;font-weight:600;">View post on X \u2197</a></p>';
        });
      };
      document.head.appendChild(s);
    }
  }

  function decodeText(buf) {
    var bytes = new Uint8Array(buf);
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
      return new TextDecoder('utf-16le').decode(buf);
    }
    return new TextDecoder('utf-8').decode(buf);
  }

  function parseFilename(filename) {
    var base = filename.replace(/\.txt$/, '');
    // Check for separator files (e.g., 0a, 5a, 10a, 0a-Welcome)
    var sepMatch = base.match(/^(\d+)a(?:$|-)/);

    if (sepMatch) return { num: parseInt(sepMatch[1]) + 0.5, avatarId: '', slug: base, displayTitle: '', separator: true };
    // Check for underscore display-title override (casing preserved from filename)
    // Format: filename_DisplayTitle_CustomSubtitle.txt
    var displayTitle = '';
    var customSubtitle = '';
    var uIdx = base.indexOf('_');
    if (uIdx !== -1) {
      var afterU = base.substring(uIdx + 1);
      var u2 = afterU.indexOf('_');
      if (u2 !== -1) {
        displayTitle = afterU.substring(0, u2).replace(/-/g, ' ');
        customSubtitle = afterU.substring(u2 + 1).replace(/-/g, ' ');
      } else {
        displayTitle = afterU.replace(/-/g, ' ');
      }
      base = base.substring(0, uIdx);
    }
    var m = base.match(/^(\d+)-([^-]+)-(.+)$/);
    if (m) return { num: parseInt(m[1]), avatarId: m[2], slug: m[3], displayTitle: displayTitle, customSubtitle: customSubtitle };
    // Pattern: num-avatarId (no slug, e.g., "1-HolySpirit")
    var m1b = base.match(/^(\d+)-([A-Za-z]\w*)$/);
    if (m1b) return { num: parseInt(m1b[1]), avatarId: m1b[2], slug: '', displayTitle: displayTitle, customSubtitle: customSubtitle };
    // Pattern: num-title with spaces (e.g., "1-Get your Blessed Seven Sorrows Rosary")
    var mNumTitle = base.match(/^(\d+)-(.+)$/);
    if (mNumTitle) return { num: parseInt(mNumTitle[1]), avatarId: '', slug: mNumTitle[2], displayTitle: displayTitle || mNumTitle[2], customSubtitle: customSubtitle };
    var m2 = base.match(/^([A-Za-z]+\d?)-(.+)$/);
    if (m2) return { num: 0, avatarId: m2[1], slug: m2[2], displayTitle: displayTitle, customSubtitle: customSubtitle };
    return { num: 0, avatarId: '', slug: base, displayTitle: displayTitle, customSubtitle: customSubtitle };
  }

  /* ── Convert folder name to display label: "1-creation" → "1. Creation" ── */
  function prettyFolderName(folder, num, fallbackTitle, displayTitle) {
    var showNums = activeBook ? getBookUi(activeBook).DisplaysNumbers : true;
    var title;
    if (displayTitle) {
      title = titleToHtml(displayTitle);
    } else if (fallbackTitle && fallbackTitle !== folder) {
      title = titleToHtml(fallbackTitle);
    } else if (!folder || folder === '_root') {
      title = escHtml(fallbackTitle);
    } else {
      var slug = folder.replace(/^\d+-/, '').replace(/-/g, ' ');
      slug = slug.replace(/ comma /gi, ', ').replace(/ apostrophe /gi, "\'");
      title = titleToHtml(slug);
    }
    if (showNums && typeof num === 'number' && num > 0 && num < 101) {
      return '<span class="chapter-num">' + num + '.</span><span class="chapter-text">' + title + '</span>';
    }
    return '<span class="chapter-text">' + title + '</span>';
  }



  /** Convert ^ or <br> to line breaks and ~ to dashes in display titles.
   *  Each segment is HTML-escaped individually. */
  function titleToHtml(str) {
    return str.replace(/~/g, '-').split(/\^|<br>/i).map(function (s) { return escHtml(titleCase(s.trim())); }).join('<br>');
  }

  /* ── Format Warnings sidebar date: "1-august-14-1975" → "Session 1 - 1975-08-14" ── */
  var MONTH_MAP = {january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',july:'07',august:'08',september:'09',october:'10',november:'11',december:'12'};
  function formatWarningsDate(folder, sessionNum) {
    var SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var slug = folder.replace(/^\d+-/, '');
    var m = slug.match(/^([a-z]+)-(\d{1,2})-(\d{4})$/i);
    if (m) {
      var mm = parseInt(MONTH_MAP[m[1].toLowerCase()] || '0', 10);
      var monthName = SHORT_MONTHS[mm - 1] || m[1];
      var day = parseInt(m[2], 10);
      return sessionNum + '.\u00a0\u00a0' + monthName + ' ' + day + ', ' + m[3];
    }
    return sessionNum + '.';
  }

  /* ── Extract a clean display title from file content lines ── */
  var MINOR_WORDS = /^(a|an|and|as|at|but|by|for|from|in|into|nor|of|on|or|so|the|to|up|with|yet)$/i;
  function titleCase(str) {
    return str.replace(/\S+/g, function (word, idx) {
      if (idx > 0 && MINOR_WORDS.test(word)) return word.toLowerCase();
      var w = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      if (/^st$/i.test(word)) w = 'St.';
      return w;
    });
  }

  function extractTitle(lines) {
    if (!lines || !lines.length) return '';
    // Find first non-blank line
    var first = '', firstIdx = -1;
    for (var i = 0; i < lines.length && i < 20; i++) {
      var t = lines[i].trim();
      if (t) { first = t; firstIdx = i; break; }
    }
    if (!first) return '';

    var raw = first;

    // Pattern 1: "Chapter X" → skip it, grab next non-blank line
    if (/^Chapter\s/i.test(first)) {
      for (var j = firstIdx + 1; j < lines.length && j < 30; j++) {
        var t2 = lines[j].trim();
        if (t2) { raw = t2; break; }
      }
    }

    // Strip leading number prefix: "2. Title" or "17. Title"
    raw = raw.replace(/^\d+\.\s*/, '');
    // Strip leading roman numeral prefix: "XIX. Title" or "III "
    raw = raw.replace(/^[IVXLC]+\.?\s+/i, '');
    // Strip BOM / garbage chars
    raw = raw.replace(/^[\ufeff\ufffd]+/, '');
    // Strip leading "BOOK X - VISION Y - " pattern (Hildegard)
    raw = raw.replace(/^BOOK\s+[IVXLC]+\s*-\s*VISION\s+[IVXLC]+\s*-\s*/i, '');
    // Remove trailing period
    raw = raw.replace(/\.$/, '');

    // If ALL-CAPS, convert to title case
    if (raw === raw.toUpperCase() && raw.length > 3) {
      raw = titleCase(raw);
    }

    return raw;
  }

  function getColorClass(avatarId) {
    var av = avatars[avatarId];
    var color = (av && av.color) || 'blue';
    return 'avatar-color-' + color;
  }

  /* Map speaker name keywords to avatar IDs */
  var SPEAKER_AVATAR_MAP = {
    'exorcist': 'Exorcist',
    'akabor': 'Akabor',
    'allida': 'Allida',
    'judas': 'Judas',
    'beelzebub': 'Beelzebub',
    'veroba': 'Veroba'
  };

  /* Extract speaker definitions from top of Warnings file.
     Parses lines like "E = Exorcist." or "A = Akabor, fallen angel..."
     Returns array of { code, name, description, avatarId } */
  function extractSpeakers(lines) {
    var speakers = [];
    var seen = {};
    for (var i = 0; i < lines.length && i < 30; i++) {
      var line = lines[i].trim();
      // Stop at first dialogue line (e.g. "E:" or "A:")
      if (/^[A-Z][a-z]?:/.test(line) && !/^[A-Z][a-z]?\s*=/.test(line)) break;
      var m = line.match(/^([A-Z][a-z]?)\s*=\s*(.+)/);
      if (m && m[2].length > 2) {
        var code = m[1];
        var desc = m[2].replace(/\.$/, '').trim();
        var namePart = desc.split(',')[0].trim();
        if (seen[code]) continue;
        seen[code] = true;
        // Find avatar ID by matching name keywords
        var avatarId = null;
        var lowerDesc = desc.toLowerCase();
        Object.keys(SPEAKER_AVATAR_MAP).forEach(function (key) {
          if (lowerDesc.indexOf(key) >= 0) avatarId = SPEAKER_AVATAR_MAP[key];
        });
        speakers.push({ code: code, name: namePart, description: desc, avatarId: avatarId });
      }
    }
    return speakers;
  }

  /* Render a row of speaker avatar clips for Warnings readings */
  function renderSpeakerAvatars(speakers, chImages) {
    if (!speakers.length) return '';
    var html = '<div class="reading-index-row">';
    // Left: speaker list
    html += '<div class="reading-index speaker-index">';
    html += '<span class="reading-index-label">Speakers in this Exorcism:</span><ul>';
    speakers.forEach(function (sp) {
      var av = sp.avatarId ? avatars[sp.avatarId] : null;
      var spAvatarId = sp.avatarId || '';
      var demonCls = isDemon(sp.avatarId, av) ? ' speaker-demon' : '';
      html += '<li><span class="reading-index-link speaker-entry' + demonCls + '" data-avatar-link="' + escHtml(spAvatarId) + '" style="cursor:pointer" title="View avatar page">';
      if (av && av.image) {
        html += '<span class="reading-index-clip"><img class="reading-index-img" src="' + escHtml(thumbPath(avatarImage(av))) + '" alt="' + escHtml(av.name || '') + '"></span>';
      } else {
        html += '<span class="reading-index-clip reading-index-placeholder">' + escHtml(sp.code) + '</span>';
      }
      html += '<span class="reading-index-text"><span class="reading-index-title">' + escHtml(sp.name) + '</span>';
      var subtitle = (av && av.title) || '';
      if (!subtitle && sp.description !== sp.name) subtitle = sp.description;
      if (subtitle) {
        html += '<span class="reading-index-avatar">' + escHtml(subtitle) + '</span>';
      }
      html += '</span></span></li>';
    });
    html += '</ul></div>';
    // Right: chapter gallery images
    if (chImages && chImages.length) {
      html += '<div class="chapter-gallery">';
      html += '<div class="chapter-gallery-viewport">';
      if (chImages.length > 1) html += '<button class="gallery-btn prev" data-gallery-dir="-1">&#8249;</button>';
      chImages.forEach(function (src, i) {
        html += '<img class="chapter-gallery-img' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '" src="' + escHtml(src) + '" alt="">';
      });
      if (chImages.length > 1) html += '<button class="gallery-btn next" data-gallery-dir="1">&#8250;</button>';
      html += '</div>';
      if (chImages.length > 1) {
        html += '<div class="gallery-dots">';
        chImages.forEach(function (src, i) {
          html += '<button class="gallery-dot' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '"></button>';
        });
        html += '</div>';
      }
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  /* Extract ALL CAPS section headings from a reading's lines (for Warnings) */
  function extractSectionHeadings(lines, titleLineIdx) {
    var headings = [];
    var started = false;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!started) {
        if (i === titleLineIdx) { started = true; continue; }
        if (!line) continue;
        started = true;
      }
      if (!line) continue;
      var letters = line.replace(/[^a-zA-Z]/g, '');
      if (letters.length > 1 && letters === letters.toUpperCase()) {
        headings.push({ title: line, lineIdx: i });
      }
    }
    return headings;
  }

  /* Find line index of "Words of The Queen" in a reading's lines */
  function findQueenSplit(lines) {
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim().toLowerCase().replace(/\s+/g, ' ');
      if (t === 'words of the queen') return i;
    }
    return -1;
  }

  /* Build a single reading-index <li> entry with avatar clip */
  function buildReadingIndexEntry(av, title, anchorId, indent, readingFile, readingKey) {
    var avatarName = av ? av.name : '';
    var colorCls = (av && av.color && av.color !== 'blue') ? ' avatar-color-' + av.color : '';
    var dataAttr = readingFile ? ' data-reading-file="' + escHtml(readingFile) + '"' : '';
    var avId = av && av.id && av.id !== 'None' ? av.id : '';
    var html = '<li class="reading-index-entry' + (indent ? ' reading-index-indent' : '') + '">';
    // Avatar — clickable to avatar page
    if (av && av.image) {
      html += '<span class="reading-index-clip' + (avId ? ' reading-index-av-link' : '') + '"' + (avId ? ' data-avatar-link="' + escHtml(avId) + '"' : '') + '><img class="reading-index-img" src="' + escHtml(thumbPath(avatarImage(av))) + '" alt="' + escHtml(av.name || '') + '"></span>';
    } else if (avId) {
      html += '<span class="reading-index-clip reading-index-placeholder reading-index-av-link" data-avatar-link="' + escHtml(avId) + '">' + escHtml((av.name || av.id).charAt(0)) + '</span>';
    }
    // Title — anchor link to reading
    html += '<a href="#' + anchorId + '" class="reading-index-link' + colorCls + '"' + dataAttr + '>';
    html += '<span class="reading-index-text"><span class="reading-index-title">' + escHtml(title) + '</span></span>';
    html += '</a>';
    // Heart — like button (no navigation)
    if (readingKey) {
      html += '<button class="like-btn index-like-btn" title="Like" data-reading-key="' + escHtml(readingKey) + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg></button>';
    }
    html += '</li>';
    return html;
  }

  function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ══════════════════════════════════════════════════════════════════
   *  TEXT-TO-SPEECH (TTS) — server-side edge-tts via /tts-preview
   * ══════════════════════════════════════════════════════════════════ */
  var _ttsAudio = null;
  var _ttsBtn = null;
  var _ttsSynth = window.speechSynthesis || null;
  var _ttsUtterance = null;

  function ttsSetIcon(btn, playing) {
    if (!btn) return;
    btn.querySelector('.tts-play-icon').style.display = playing ? 'none' : '';
    btn.querySelector('.tts-pause-icon').style.display = playing ? '' : 'none';
    if (playing) btn.classList.add('tts-active');
    else btn.classList.remove('tts-active');
  }

  function ttsStop() {
    if (_ttsAudio) {
      _ttsAudio.pause();
      _ttsAudio.src = '';
      _ttsAudio = null;
    }
    if (_ttsSynth && _ttsUtterance) {
      _ttsSynth.cancel();
      _ttsUtterance = null;
    }
    ttsSetIcon(_ttsBtn, false);
    _ttsBtn = null;
  }

  function ttsToggle(btn) {
    // If same button, toggle pause/resume
    if (_ttsBtn === btn) {
      if (_ttsAudio) {
        if (_ttsAudio.paused) { _ttsAudio.play(); ttsSetIcon(btn, true); }
        else { _ttsAudio.pause(); ttsSetIcon(btn, false); }
        return;
      }
      if (_ttsSynth && _ttsUtterance) {
        if (_ttsSynth.paused) { _ttsSynth.resume(); ttsSetIcon(btn, true); }
        else if (_ttsSynth.speaking) { _ttsSynth.pause(); ttsSetIcon(btn, false); }
        return;
      }
    }
    // Stop any existing playback
    ttsStop();
    // Get the reading block
    var block = btn.closest('.reading-block');
    if (!block) return;
    _ttsBtn = btn;
    btn.classList.add('tts-active');
    btn.querySelector('.tts-play-icon').style.display = 'none';
    btn.querySelector('.tts-pause-icon').style.display = 'none';
    // Check for explicit MP3 (pre-generated audio)
    var dlBtn = block.querySelector('.download-btn');
    var mp3Url = dlBtn ? (dlBtn.getAttribute('data-mp3-path') || '') : '';
    if (mp3Url) {
      var audio = new Audio(mp3Url);
      audio.oncanplay = function () {
        if (_ttsBtn !== btn) return;
        _ttsAudio = audio;
        audio.play();
        ttsSetIcon(btn, true);
      };
      audio.onended = function () { ttsStop(); };
      audio.onerror = function () { ttsStop(); };
      audio.load();
    } else {
      // Use browser speechSynthesis (must be synchronous with user tap)
      ttsSpeakBlock(btn, block);
    }
  }

  function ttsSpeakBlock(btn, block) {
    if (!_ttsSynth) { ttsStop(); return; }
    var body = block.querySelector('.reading-body');
    if (!body) { ttsStop(); return; }
    var text = body.innerText || body.textContent || '';
    text = text.trim();
    if (!text) { ttsStop(); return; }
    var utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.onend = function () { ttsStop(); };
    utter.onerror = function () { ttsStop(); };
    _ttsUtterance = utter;
    _ttsSynth.speak(utter);
    ttsSetIcon(btn, true);
  }

  // Delegate TTS button clicks
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.tts-btn');
    if (btn) { e.preventDefault(); ttsToggle(btn); }
  });
  // Stop TTS on navigation
  window.addEventListener('hashchange', ttsStop);

  /* ══════════════════════════════════════════════════════════════════
   *  READING CONTEXT MENU — Right-click Edit / Move Up / Down / Prev / Next
   * ══════════════════════════════════════════════════════════════════ */

  // Build the floating context menu element (created once, reused)
  var _ctxMenu = (function () {
    var menu = document.createElement('div');
    menu.id = 'reading-ctx-menu';

    var items = [
      { id: 'ctx-edit', icon: '✏️', label: 'Edit Title' },
      { id: 'ctx-sep1', sep: true },
      { id: 'ctx-up', icon: '⬆', label: 'Move Up' },
      { id: 'ctx-down', icon: '⬇', label: 'Move Down' },
      { id: 'ctx-sep2', sep: true },
      { id: 'ctx-prev', icon: '⏮', label: 'Move to Previous Chapter' },
      { id: 'ctx-next', icon: '⏭', label: 'Move to Next Chapter' },
      { id: 'ctx-sep3', sep: true },
      { id: 'ctx-props', icon: '⚙', label: 'Properties' }
    ];

    items.forEach(function (item) {
      if (item.sep) {
        var sep = document.createElement('div');
        sep.className = 'ctx-sep';
        menu.appendChild(sep);
        return;
      }
      var div = document.createElement('div');
      div.className = 'ctx-item';
      div.id = item.id;
      div.innerHTML = '<span>' + item.icon + '</span><span>' + item.label + '</span>';
      menu.appendChild(div);
    });

    document.body.appendChild(menu);
    return menu;
  })();

  // Context menu state: what reading is right-clicked
  var _ctxTarget = null; // { bookFolder, section, chapterFolder, readingFolder, displayTitle, rdIdx, totalInChapter }

  function showReadingCtxMenu(x, y, target) {
    _ctxTarget = target;

    // Enable/disable boundary items
    var upItem = document.getElementById('ctx-up');
    var downItem = document.getElementById('ctx-down');
    var prevItem = document.getElementById('ctx-prev');
    var nextItem = document.getElementById('ctx-next');

    upItem.className = target.rdIdx <= 0 ? 'ctx-item disabled' : 'ctx-item';
    downItem.className = target.rdIdx >= target.totalInChapter - 1 ? 'ctx-item disabled' : 'ctx-item';
    prevItem.className = target.isFirstChapter ? 'ctx-item disabled' : 'ctx-item';
    nextItem.className = target.isLastChapter ? 'ctx-item disabled' : 'ctx-item';

    _ctxMenu.style.display = 'block';
    // Position — keep on screen
    var menuW = _ctxMenu.offsetWidth;
    var menuH = _ctxMenu.offsetHeight;
    var left = x + menuW > window.innerWidth ? window.innerWidth - menuW - 4 : x;
    var top = y + menuH > window.innerHeight ? window.innerHeight - menuH - 4 : y;
    _ctxMenu.style.left = left + 'px';
    _ctxMenu.style.top = top + 'px';
  }

  function hideReadingCtxMenu() {
    _ctxMenu.style.display = 'none';
    _ctxTarget = null;
  }

  // Dismiss on click outside, Escape, scroll
  document.addEventListener('mousedown', function (e) {
    if (_ctxMenu.style.display === 'block' && !_ctxMenu.contains(e.target)) {
      hideReadingCtxMenu();
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') hideReadingCtxMenu();
  });
  document.getElementById('sidebar-list').addEventListener('scroll', function () {
    hideReadingCtxMenu();
  });

  // Build context target info from a reading
  function buildCtxTarget(rd, rdIdxInChapter, chapter, chapterIdx) {
    var book = activeBook;
    var bookFolder = book.folder;
    var section = chapter.section || '';
    var chapterFolder = chapter.folder;
    var readingFolder = rd.file;
    var displayTitle = rd.displayTitle || '';

    // Count real readings in this chapter (excluding separators)
    var total = chapter.readings.filter(function (r) {
      return !parseFilename(r.file).separator && !/^x/i.test(r.file);
    }).length;

    // Determine if first/last chapter (skipping separators)
    var chapters = book.chapters;
    if (book.sections && book.sections.length && _activeSection) {
      chapters = chapters.filter(function (c) { return c.section === _activeSection; });
    }
    var realChapters = chapters.filter(function (c) {
      var f = c.folder || '';
      var isSep = /^\d+a(?:$|[-\s])/.test(f) && c.readings.length === 0;
      return !isSep && c.readings.length > 0;
    });
    var chInReal = realChapters.indexOf(chapter);
    var isFirstCh = chInReal <= 0;
    var isLastCh = chInReal >= realChapters.length - 1;

    return {
      bookFolder: bookFolder,
      section: section,
      chapterFolder: chapterFolder,
      readingFolder: readingFolder,
      displayTitle: displayTitle,
      rdIdx: rdIdxInChapter,
      totalInChapter: total,
      isFirstChapter: isFirstCh,
      isLastChapter: isLastCh
    };
  }

  // Attach contextmenu to an <a> element for a reading
  function attachReadingContextMenu(aEl, rd, rdIdxInChapter, chapter, chapterIdx) {
    aEl.addEventListener('contextmenu', function (e) {
      if (!window.currentUser || !window.currentUser.isAdmin) return;
      e.preventDefault();
      e.stopPropagation();
      var target = buildCtxTarget(rd, rdIdxInChapter, chapter, chapterIdx);
      showReadingCtxMenu(e.clientX, e.clientY, target);
    });
  }

  // ── Context menu action handlers ──

  document.getElementById('ctx-edit').addEventListener('click', function () {
    if (!_ctxTarget) return;
    var target = _ctxTarget;
    hideReadingCtxMenu();
    openReadingEditModal(target);
  });

  document.getElementById('ctx-up').addEventListener('click', function () {
    if (!_ctxTarget || this.classList.contains('disabled')) return;
    doMoveReading('up');
  });
  document.getElementById('ctx-down').addEventListener('click', function () {
    if (!_ctxTarget || this.classList.contains('disabled')) return;
    doMoveReading('down');
  });
  document.getElementById('ctx-prev').addEventListener('click', function () {
    if (!_ctxTarget || this.classList.contains('disabled')) return;
    doMoveReading('prev-chapter');
  });
  document.getElementById('ctx-next').addEventListener('click', function () {
    if (!_ctxTarget || this.classList.contains('disabled')) return;
    doMoveReading('next-chapter');
  });
  document.getElementById('ctx-props').addEventListener('click', function () {
    if (!_ctxTarget) return;
    var target = _ctxTarget;
    hideReadingCtxMenu();
    openPropertiesModal('reading', target.bookFolder, target.section, target.chapterFolder, target.readingFolder);
  });

  function doMoveReading(direction) {
    var target = _ctxTarget;
    hideReadingCtxMenu();

    var body = {
      bookFolder: target.bookFolder,
      section: target.section,
      chapterFolder: target.chapterFolder,
      readingFolder: target.readingFolder,
      direction: direction
    };

    fetch('/move-reading', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.error) {
        alert('Move failed: ' + data.error);
        return;
      }
      // Re-fetch books.json and refresh
      reloadBooksAndRefresh();
    })
    .catch(function (err) {
      alert('Move failed: ' + err.message);
    });
  }

  function openReadingEditModal(target) {
    // Remove any existing modal
    var old = document.querySelector('.reading-edit-overlay');
    if (old) old.parentNode.removeChild(old);

    var overlay = document.createElement('div');
    overlay.className = 'reading-edit-overlay';

    var modal = document.createElement('div');
    modal.className = 'reading-edit-modal';

    var title = document.createElement('div');
    title.className = 'modal-title';
    title.textContent = 'Edit Reading Title';
    modal.appendChild(title);

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'modal-input';
    input.value = target.displayTitle;
    modal.appendChild(input);

    var actions = document.createElement('div');
    actions.className = 'modal-actions';

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'book-props-btn cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function () {
      overlay.parentNode.removeChild(overlay);
    });
    actions.appendChild(cancelBtn);

    var saveBtn = document.createElement('button');
    saveBtn.className = 'book-props-btn save';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', function () {
      var newTitle = input.value.trim();
      if (!newTitle) return;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      fetch('/save-reading-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookFolder: target.bookFolder,
          section: target.section,
          chapterFolder: target.chapterFolder,
          readingFolder: target.readingFolder,
          newTitle: newTitle
        })
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) {
          alert('Save failed: ' + data.error);
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save';
          return;
        }
        overlay.parentNode.removeChild(overlay);
        reloadBooksAndRefresh();
      })
      .catch(function (err) {
        alert('Save failed: ' + err.message);
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      });
    });
    actions.appendChild(saveBtn);
    modal.appendChild(actions);
    overlay.appendChild(modal);

    // Click outside to close
    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay) overlay.parentNode.removeChild(overlay);
    });

    document.body.appendChild(overlay);
    input.focus();
    input.select();
  }

  // Re-fetch books.json and refresh the sidebar + current view
  function reloadBooksAndRefresh() {
    fetch(nocache('/Site/books.json'))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        books = data;
        // Re-select the same book
        if (activeBook) {
          var bookNum = activeBook.num;
          var found = books.find(function (b) { return b.num === bookNum; });
          if (found) {
            activeBook = found;
            // Rebuild flatReadings
            flatReadings = [];
            activeBook.chapters.forEach(function (ch) {
              ch.readings.forEach(function (rd) {
                var p = parseFilename(rd.file);
                if (!p.separator && !/^header\.txt$/i.test(rd.file)) {
                  flatReadings.push({ rd: rd, ch: ch });
                }
              });
            });
            flatReadings.sort(function (a, b) {
              return parseFilename(a.rd.file).num - parseFilename(b.rd.file).num;
            });
          }
        }
        renderSidebar();
      })
      .catch(function (err) {
        console.error('Failed to reload books.json:', err);
      });
  }

  /* ══════════════════════════════════════════════════════════════════
   *  CHAPTER / SEPARATOR CONTEXT MENU — Right-click Rename / Move
   * ══════════════════════════════════════════════════════════════════ */

  var _chCtxMenu = (function () {
    var menu = document.createElement('div');
    menu.id = 'chapter-ctx-menu';

    var items = [
      { id: 'ch-ctx-rename', icon: '✏️', label: 'Rename' },
      { id: 'ch-ctx-sep1', sep: true },
      { id: 'ch-ctx-up', icon: '⬆', label: 'Move Up' },
      { id: 'ch-ctx-down', icon: '⬇', label: 'Move Down' },
      { id: 'ch-ctx-sep2', sep: true },
      { id: 'ch-ctx-props', icon: '⚙', label: 'Properties' }
    ];

    items.forEach(function (item) {
      if (item.sep) {
        var sep = document.createElement('div');
        sep.className = 'ctx-sep';
        menu.appendChild(sep);
        return;
      }
      var div = document.createElement('div');
      div.className = 'ctx-item';
      div.id = item.id;
      div.innerHTML = '<span>' + item.icon + '</span><span>' + item.label + '</span>';
      menu.appendChild(div);
    });

    document.body.appendChild(menu);
    return menu;
  })();

  var _chCtxTarget = null; // { bookFolder, section, chapterFolder, displayTitle, isSeparator, chapterIdx }

  function showChapterCtxMenu(x, y, target) {
    _chCtxTarget = target;
    // Hide move items for separators
    var upItem = document.getElementById('ch-ctx-up');
    var downItem = document.getElementById('ch-ctx-down');
    var sep1 = _chCtxMenu.querySelector('.ctx-sep');
    if (target.isSeparator) {
      upItem.style.display = 'none';
      downItem.style.display = 'none';
      if (sep1) sep1.style.display = 'none';
    } else {
      upItem.style.display = '';
      downItem.style.display = '';
      if (sep1) sep1.style.display = '';
      // Determine boundaries (first/last non-separator chapter)
      var chapters = activeBook.chapters;
      if (activeBook.sections && activeBook.sections.length && _activeSection) {
        chapters = chapters.filter(function (c) { return c.section === _activeSection; });
      }
      var realChapters = chapters.filter(function (c) {
        return !/^\d+a(?:$|-)/.test(c.folder || '');
      });
      var pos = realChapters.findIndex(function (c) { return c.folder === target.chapterFolder; });
      upItem.className = pos <= 0 ? 'ctx-item disabled' : 'ctx-item';
      downItem.className = pos >= realChapters.length - 1 ? 'ctx-item disabled' : 'ctx-item';
    }

    _chCtxMenu.style.display = 'block';
    var menuW = _chCtxMenu.offsetWidth;
    var menuH = _chCtxMenu.offsetHeight;
    var left = x + menuW > window.innerWidth ? window.innerWidth - menuW - 4 : x;
    var top = y + menuH > window.innerHeight ? window.innerHeight - menuH - 4 : y;
    _chCtxMenu.style.left = left + 'px';
    _chCtxMenu.style.top = top + 'px';
  }

  function hideChapterCtxMenu() {
    _chCtxMenu.style.display = 'none';
    _chCtxTarget = null;
  }

  // Dismiss on click outside, Escape, scroll
  document.addEventListener('mousedown', function (e) {
    if (_chCtxMenu.style.display === 'block' && !_chCtxMenu.contains(e.target)) {
      hideChapterCtxMenu();
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') hideChapterCtxMenu();
  });
  document.getElementById('sidebar-list').addEventListener('scroll', function () {
    hideChapterCtxMenu();
  });

  /* ── Book Tab Context Menu ── */
  var _bookCtxMenu = (function () {
    var menu = document.createElement('div');
    menu.id = 'book-ctx-menu';
    var div = document.createElement('div');
    div.className = 'ctx-item';
    div.id = 'book-ctx-props';
    div.innerHTML = '<span>⚙</span><span>Properties</span>';
    menu.appendChild(div);
    document.body.appendChild(menu);
    return menu;
  })();
  var _bookCtxTarget = null;

  function showBookCtxMenu(x, y, bookFolder) {
    _bookCtxTarget = bookFolder;
    _bookCtxMenu.style.display = 'block';
    var menuW = _bookCtxMenu.offsetWidth;
    var menuH = _bookCtxMenu.offsetHeight;
    var left = x + menuW > window.innerWidth ? window.innerWidth - menuW - 4 : x;
    var top = y + menuH > window.innerHeight ? window.innerHeight - menuH - 4 : y;
    _bookCtxMenu.style.left = left + 'px';
    _bookCtxMenu.style.top = top + 'px';
  }
  function hideBookCtxMenu() {
    _bookCtxMenu.style.display = 'none';
    _bookCtxTarget = null;
  }
  document.addEventListener('mousedown', function (e) {
    if (_bookCtxMenu.style.display === 'block' && !_bookCtxMenu.contains(e.target)) {
      hideBookCtxMenu();
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') hideBookCtxMenu();
  });
  document.getElementById('book-ctx-props').addEventListener('click', function () {
    if (!_bookCtxTarget) return;
    var folder = _bookCtxTarget;
    hideBookCtxMenu();
    openPropertiesModal('book', folder, '', '');
  });

  function attachChapterContextMenu(el, chapter, chapterIdx) {
    el.addEventListener('contextmenu', function (e) {
      if (!window.currentUser || !window.currentUser.isAdmin) return;
      e.preventDefault();
      e.stopPropagation();
      hideReadingCtxMenu();
      var book = activeBook;
      showChapterCtxMenu(e.clientX, e.clientY, {
        bookFolder: book.folder,
        section: chapter.section || '',
        chapterFolder: chapter.folder,
        displayTitle: chapter.displayTitle || chapter.title || '',
        isSeparator: false,
        chapterIdx: chapterIdx
      });
    });
  }

  function attachSeparatorContextMenu(el, chapter, chapterIdx) {
    el.addEventListener('contextmenu', function (e) {
      if (!window.currentUser || !window.currentUser.isAdmin) return;
      e.preventDefault();
      e.stopPropagation();
      hideReadingCtxMenu();
      var book = activeBook;
      showChapterCtxMenu(e.clientX, e.clientY, {
        bookFolder: book.folder,
        section: chapter.section || '',
        chapterFolder: chapter.folder,
        displayTitle: chapter.displayTitle || '',
        isSeparator: true,
        chapterIdx: chapterIdx
      });
    });
  }

  // ── Chapter context menu action handlers ──

  document.getElementById('ch-ctx-rename').addEventListener('click', function () {
    if (!_chCtxTarget) return;
    var target = _chCtxTarget;
    hideChapterCtxMenu();
    openChapterRenameModal(target);
  });

  document.getElementById('ch-ctx-up').addEventListener('click', function () {
    if (!_chCtxTarget || this.classList.contains('disabled')) return;
    doMoveChapter('up');
  });
  document.getElementById('ch-ctx-down').addEventListener('click', function () {
    if (!_chCtxTarget || this.classList.contains('disabled')) return;
    doMoveChapter('down');
  });
  document.getElementById('ch-ctx-props').addEventListener('click', function () {
    if (!_chCtxTarget) return;
    var target = _chCtxTarget;
    hideChapterCtxMenu();
    openPropertiesModal('chapter', target.bookFolder, target.section, target.chapterFolder);
  });

  function doMoveChapter(direction) {
    var target = _chCtxTarget;
    hideChapterCtxMenu();

    fetch('/move-chapter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookFolder: target.bookFolder,
        section: target.section,
        chapterFolder: target.chapterFolder,
        direction: direction
      })
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.error) {
        alert('Move failed: ' + data.error);
        return;
      }
      reloadBooksAndRefresh();
    })
    .catch(function (err) {
      alert('Move failed: ' + err.message);
    });
  }

  function openChapterRenameModal(target) {
    var old = document.querySelector('.reading-edit-overlay');
    if (old) old.parentNode.removeChild(old);

    var overlay = document.createElement('div');
    overlay.className = 'reading-edit-overlay';

    var modal = document.createElement('div');
    modal.className = 'reading-edit-modal';

    var title = document.createElement('div');
    title.className = 'modal-title';
    title.textContent = target.isSeparator ? 'Rename Section' : 'Rename Chapter';
    modal.appendChild(title);

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'modal-input';
    input.value = target.displayTitle;
    modal.appendChild(input);

    var actions = document.createElement('div');
    actions.className = 'modal-actions';

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'book-props-btn cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function () {
      overlay.parentNode.removeChild(overlay);
    });
    actions.appendChild(cancelBtn);

    var saveBtn = document.createElement('button');
    saveBtn.className = 'book-props-btn save';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', function () {
      var newTitle = input.value.trim();
      if (!newTitle) return;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      var endpoint = target.isSeparator ? '/rename-separator' : '/rename-chapter';
      var body = {
        bookFolder: target.bookFolder,
        section: target.section,
        newTitle: newTitle
      };
      if (target.isSeparator) {
        body.separatorFolder = target.chapterFolder;
      } else {
        body.chapterFolder = target.chapterFolder;
      }

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) {
          alert('Save failed: ' + data.error);
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save';
          return;
        }
        overlay.parentNode.removeChild(overlay);
        reloadBooksAndRefresh();
      })
      .catch(function (err) {
        alert('Save failed: ' + err.message);
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      });
    });
    actions.appendChild(saveBtn);
    modal.appendChild(actions);
    overlay.appendChild(modal);

    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay) overlay.parentNode.removeChild(overlay);
    });

    document.body.appendChild(overlay);
    input.focus();
    input.select();
  }

  /* ══════════════════════════════════════════════════════════════════
   *  PROPERTIES MODAL — Show/edit .properties file for chapter or reading
   * ══════════════════════════════════════════════════════════════════ */
  function openPropertiesModal(type, bookFolder, section, chapterFolder, readingFolder) {
    // type: 'chapter' or 'reading'
    var params = 'bookFolder=' + encodeURIComponent(bookFolder)
      + '&chapterFolder=' + encodeURIComponent(chapterFolder);
    if (section) {
      params += '&section=' + encodeURIComponent(section);
    }
    if (type === 'reading' && readingFolder) {
      params += '&readingFolder=' + encodeURIComponent(readingFolder);
    }

    fetch('/get-properties?' + params)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) { alert('Could not load properties: ' + data.error); return; }
        _showPropertiesModal(type, bookFolder, section, chapterFolder, readingFolder, data);
      })
      .catch(function (err) { alert('Error: ' + err.message); });
  }

  function _showPropertiesModal(type, bookFolder, section, chapterFolder, readingFolder, data) {
    var old = document.querySelector('.props-overlay');
    if (old) old.parentNode.removeChild(old);

    var overlay = document.createElement('div');
    overlay.className = 'props-overlay';

    var modal = document.createElement('div');
    modal.className = 'props-modal';

    // Title
    var title = document.createElement('div');
    title.className = 'props-modal-title';
    title.textContent = (type === 'reading' ? 'Reading' : type === 'book' ? 'Book' : 'Chapter') + ' Properties';
    modal.appendChild(title);

    // Path subtitle
    var sub = document.createElement('div');
    sub.className = 'props-modal-path';
    sub.textContent = data.path || (chapterFolder + (readingFolder ? '/' + readingFolder : ''));
    modal.appendChild(sub);

    // Parse .properties content into map (preserving order)
    var raw = data.content || '';
    var lines = raw.split('\n');
    var entries = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line.trim()) continue;
      var tabIdx = line.indexOf('\t');
      if (tabIdx === -1) {
        entries.push({ key: line.trim(), value: '' });
      } else {
        entries.push({ key: line.substring(0, tabIdx), value: line.substring(tabIdx + 1) });
      }
    }

    // Known meta/system keys (shown as form fields)
    var META_KEYS = {
      '_book':        { label: 'Book Title', field: 'text', scope: 'book' },
      '_subtitle':    { label: 'Subtitle', field: 'text', scope: 'book' },
      '_title':       { label: 'Title', field: 'text', scope: 'chapter|reading' },
      '_chapter':     { label: 'Chapter Title', field: 'text', scope: 'chapter' },
      '_avatar':      { label: 'Avatar', field: 'avatar', scope: 'reading' },
      'SidebarLevels':  { label: 'Sidebar Levels', field: 'select', options: ['1', '2'], scope: 'book' },
      'ShowAvatars':    { label: 'Show Avatars', field: 'select', options: ['Yes', 'No'], scope: 'book' },
      'AvatarLevel':    { label: 'Level', field: 'select', options: ['', 'Item', 'Reading', 'Chapter'], scope: 'book' },
      'DisplaysNumbers': { label: 'Display Numbers', field: 'select', options: ['Yes', 'No'], scope: 'book' },
      'AreDemonsRed':   { label: 'Demons Red', field: 'select', options: ['Yes', 'No'], scope: 'book' },
      'ShowReadingsInThisChapter': { label: 'Show Readings Header', field: 'select', options: ['Yes', 'No'], scope: 'book' },
      'ShowReadingsInThisChapterText': { label: 'Readings Header Text', field: 'text', scope: 'book' },
      'source':       { label: 'Source Folder', field: 'text', scope: 'chapter|reading' }
    };

    // Build avatar list from loaded avatars.json
    var avatarIds = window._avatarsDict ? Object.keys(window._avatarsDict).sort() : [];

    // Separate meta entries from reading-title mappings
    var metaEntries = [];
    var readingEntries = [];
    for (var j = 0; j < entries.length; j++) {
      if (META_KEYS[entries[j].key]) {
        metaEntries.push(entries[j]);
      } else {
        readingEntries.push(entries[j]);
      }
    }

    // For book type, ensure all book-scope meta keys are shown (even if absent)
    if (type === 'book') {
      var bookKeys = Object.keys(META_KEYS).filter(function (k) {
        return META_KEYS[k].scope.indexOf('book') !== -1;
      });
      for (var bk = 0; bk < bookKeys.length; bk++) {
        var found = metaEntries.some(function (e) { return e.key === bookKeys[bk]; });
        if (!found) metaEntries.push({ key: bookKeys[bk], value: '' });
      }
    }

    // Form container
    var form = document.createElement('div');
    form.className = 'props-form';

    // Render meta fields
    var fieldInputs = {}; // key → input element
    for (var m = 0; m < metaEntries.length; m++) {
      var entry = metaEntries[m];
      var spec = META_KEYS[entry.key];
      if (!spec) continue;

      var row = document.createElement('div');
      row.className = 'props-field-row';

      var lbl = document.createElement('label');
      lbl.className = 'props-field-label';
      lbl.textContent = spec.label;
      row.appendChild(lbl);

      var input;
      if (spec.field === 'select') {
        input = document.createElement('select');
        input.className = 'props-field-select';
        for (var oi = 0; oi < spec.options.length; oi++) {
          var opt = document.createElement('option');
          opt.value = spec.options[oi];
          opt.textContent = spec.options[oi] || '(none)';
          if (spec.options[oi].toLowerCase() === (entry.value || '').toLowerCase()) opt.selected = true;
          input.appendChild(opt);
        }
      } else if (spec.field === 'avatar') {
        input = document.createElement('select');
        input.className = 'props-field-select';
        var noneOpt = document.createElement('option');
        noneOpt.value = '';
        noneOpt.textContent = '(none)';
        if (!entry.value) noneOpt.selected = true;
        input.appendChild(noneOpt);
        for (var ai = 0; ai < avatarIds.length; ai++) {
          var avOpt = document.createElement('option');
          avOpt.value = avatarIds[ai];
          avOpt.textContent = avatarIds[ai];
          if (avatarIds[ai] === entry.value) avOpt.selected = true;
          input.appendChild(avOpt);
        }
      } else {
        input = document.createElement('input');
        input.type = 'text';
        input.className = 'props-field-input';
        input.value = entry.value;
      }
      fieldInputs[entry.key] = input;
      row.appendChild(input);
      form.appendChild(row);
    }

    modal.appendChild(form);

    // Reading-title mappings section (if any)
    var rdInputs = [];
    if (readingEntries.length > 0) {
      var rdHeader = document.createElement('div');
      rdHeader.className = 'props-section-header';
      rdHeader.textContent = 'Reading Titles';
      modal.appendChild(rdHeader);

      var rdTable = document.createElement('div');
      rdTable.className = 'props-readings-table';
      for (var r = 0; r < readingEntries.length; r++) {
        var rdRow = document.createElement('div');
        rdRow.className = 'props-reading-row';

        var rdKey = document.createElement('span');
        rdKey.className = 'props-reading-key';
        rdKey.textContent = readingEntries[r].key;
        rdKey.title = readingEntries[r].key;
        rdRow.appendChild(rdKey);

        var rdInput = document.createElement('input');
        rdInput.type = 'text';
        rdInput.className = 'props-field-input';
        rdInput.value = readingEntries[r].value;
        rdRow.appendChild(rdInput);
        rdInputs.push({ key: readingEntries[r].key, input: rdInput });

        rdTable.appendChild(rdRow);
      }
      modal.appendChild(rdTable);
    }

    // Actions
    var actions = document.createElement('div');
    actions.className = 'modal-actions';

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'book-props-btn cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function () {
      overlay.parentNode.removeChild(overlay);
    });
    actions.appendChild(cancelBtn);

    var saveBtn = document.createElement('button');
    saveBtn.className = 'book-props-btn save';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', function () {
      if (saveBtn.disabled) return;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving\u2026';
      cancelBtn.disabled = true;

      // Serialize form back to .properties format
      var outputLines = [];
      var keys = Object.keys(fieldInputs);
      for (var si = 0; si < keys.length; si++) {
        var k = keys[si];
        var v = fieldInputs[k].tagName === 'SELECT' ? fieldInputs[k].value : fieldInputs[k].value;
        outputLines.push(k + '\t' + v);
      }
      if (rdInputs) {
        for (var ri = 0; ri < rdInputs.length; ri++) {
          outputLines.push(rdInputs[ri].key + '\t' + rdInputs[ri].input.value);
        }
      }
      var content = outputLines.join('\n') + '\n';

      fetch('/save-properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookFolder: bookFolder,
          section: section || '',
          chapterFolder: chapterFolder,
          readingFolder: readingFolder || '',
          content: content
        })
      })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.error) {
          alert('Save failed: ' + res.error);
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save';
          return;
        }
        overlay.parentNode.removeChild(overlay);
        reloadBooksAndRefresh();
      })
      .catch(function (err) {
        alert('Save failed: ' + err.message);
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      });
    });
    actions.appendChild(saveBtn);
    modal.appendChild(actions);
    overlay.appendChild(modal);

    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay) overlay.parentNode.removeChild(overlay);
    });

    document.body.appendChild(overlay);
  }

  // ── Event delegation: right-click on reading index links in content area ──
  document.getElementById('content').addEventListener('contextmenu', function (e) {
    if (!window.currentUser || !window.currentUser.isAdmin) return;
    var link = e.target.closest('.reading-index-link[data-reading-file]');
    if (!link) return;
    e.preventDefault();
    e.stopPropagation();

    var readingFile = link.getAttribute('data-reading-file');
    if (!readingFile || !activeBook) return;

    // Find the chapter and reading
    var ch = null;
    var rd = null;
    var rdIdxInCh = -1;
    if (typeof activeChapterIdx === 'number' && activeBook.chapters[activeChapterIdx]) {
      ch = activeBook.chapters[activeChapterIdx];
      for (var i = 0; i < ch.readings.length; i++) {
        if (ch.readings[i].file === readingFile) {
          rd = ch.readings[i];
          rdIdxInCh = i;
          break;
        }
      }
    }
    if (!ch || !rd) return;

    var chIdx = activeBook.chapters.indexOf(ch);
    var target = buildCtxTarget(rd, rdIdxInCh, ch, chIdx);
    showReadingCtxMenu(e.clientX, e.clientY, target);
  });

})();
