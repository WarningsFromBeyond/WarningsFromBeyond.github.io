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

  function avatarThumb(avatar) {
    return avatar.thumb || avatarImage(avatar);
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

  /* ── URL routing: hash-based deep links ── */
  var SITE_BASE = 'https://warningsfrombeyond.com/';
  var _suppressHashChange = false;
  var _suppressPopState = false;

  /** Build the canonical clean path for the current navigation state.
   * Uses _path baked into books.json when available; otherwise falls back to
   * folder-based hash for back-compat with old links. */
  function buildPath(book, ch, rd) {
    if (!book) return '/';
    if (rd && rd._path) return rd._path;
    if (ch && ch._path) return ch._path;
    if (book._path) return book._path;
    // Fallback (data lacks _path - dev mode without publish slug bake)
    var parts = [book.folder];
    if (ch) parts.push(ch.folder);
    if (rd) parts.push(rd.file.replace(/\.txt$/, ''));
    return '/' + parts.map(function (p) { return encodeURIComponent(p); }).join('/');
  }

  /** Legacy alias kept for any callers that still use buildHash. */
  function buildHash(book, ch, rd) {
    var p = buildPath(book, ch, rd);
    if (p === '/') return '';
    // If we have slug paths (from _path), prefer the clean URL form.
    if (rd && rd._path) return p; // pushPath will use it as a real path
    return '#/' + p.replace(/^\//, '');
  }

  /** Push a clean path (or hash) to URL bar without triggering navigation.
   * If the value starts with '#', uses replaceState on the hash (legacy).
   * Otherwise, replaces the URL with the clean path. */
  function pushHash(value) {
    if (!value) return;
    _suppressHashChange = true;
    _suppressPopState = true;
    try {
      history.replaceState(null, '', value);
    } catch (e) { /* ignore */ }
    _suppressHashChange = false;
    setTimeout(function () { _suppressPopState = false; }, 0);
  }

  /** Get the full shareable URL for the current reading (clean path for OG cards) */
  function getCurrentShareUrl() {
    var ch = activeBook && activeBook.chapters[activeChapterIdx];
    var rd = null;
    if (viewMode === 'book' && flatReadings[activeReadingIdx]) {
      rd = flatReadings[activeReadingIdx].rd;
      ch = flatReadings[activeReadingIdx].ch || ch;
    }
    var path = buildPath(activeBook, ch, rd);
    if (!path || path === '/') return SITE_BASE;
    // SITE_BASE ends with '/'; path starts with '/'; strip one slash.
    return SITE_BASE.replace(/\/$/, '') + path;
  }

  /** Get the first image URL for the current reading (absolute, for sharing) */
  function getCurrentReadingImage() {
    var rd = null, ch = null;
    if (viewMode === 'book' && flatReadings[activeReadingIdx]) {
      rd = flatReadings[activeReadingIdx].rd;
      ch = flatReadings[activeReadingIdx].ch;
    } else if (activeBook && activeBook.chapters[activeChapterIdx]) {
      ch = activeBook.chapters[activeChapterIdx];
    }
    // Try reading-level images first, then chapter images
    if (rd && rd.images && rd.images.length) {
      return SITE_BASE + 'BooksOut/' + rd.images[0];
    }
    if (ch && ch.images && ch.images.length) {
      return SITE_BASE + 'BooksOut/' + ch.images[0];
    }
    // Fall back to avatar image
    if (rd) {
      var p = parseFilename(rd.file);
      var av = avatars[p.avatarId];
      if (av && av.image) return SITE_BASE + av.image;
    }
    return SITE_BASE + 'og-image.jpg';
  }

  /** Parse hash and navigate to the target */
  function navigateFromHash() {
    var hash = location.hash;
    if (!hash || hash.length < 3) return false;
    var raw = hash.replace(/^#\/?/, '');
    var parts = raw.split('/').map(function (s) { return decodeURIComponent(s); });
    if (!parts.length || !parts[0]) return false;

    var bookFolder = parts[0];
    var chFolder = parts[1] || null;
    var rdSlug = parts[2] || null;

    var book = books.find(function (b) { return b.folder === bookFolder; });
    if (!book) return false;

    // Select the book (this renders sidebar + default chapter)
    // but we need to override if we have a specific chapter/reading
    if (chFolder) {
      var chIdx = -1;
      for (var i = 0; i < book.chapters.length; i++) {
        if (book.chapters[i].folder === chFolder) { chIdx = i; break; }
      }
      if (chIdx < 0) { selectBook(book.num); return true; }

      // Select book without auto-selecting chapter
      activeBook = book;
      localStorage.setItem('lastTab', book.num);
      document.querySelectorAll('.nav-tab').forEach(function (t) {
        t.classList.toggle('active', parseInt(t.dataset.book) === book.num);
      });
      // Build flat readings for book-view
      flatReadings = [];
      book.chapters.forEach(function (c, ci) {
        c.readings.forEach(function (r) {
          var pr = parseFilename(r.file);
          if (!pr.separator && !/^header\.txt$/i.test(r.file)) {
            flatReadings.push({ rd: r, ch: c, _chIdx: ci });
          }
        });
      });
      flatReadings.sort(function (a, b) {
        if (a._chIdx !== b._chIdx) return a._chIdx - b._chIdx;
        return parseFilename(a.rd.file).num - parseFilename(b.rd.file).num;
      });

      if (rdSlug) {
        // Find specific reading in flat list
        var rdFile = rdSlug + '.txt';
        var flatIdx = -1;
        for (var fi = 0; fi < flatReadings.length; fi++) {
          if (flatReadings[fi].rd.file === rdFile && flatReadings[fi]._chIdx === chIdx) {
            flatIdx = fi; break;
          }
        }
        if (flatIdx >= 0 && getBookUi(book).ShowAvatars) {
          viewMode = 'book';
          renderSidebar();
          selectReading(flatIdx);
          updateMobileBars();
          closeMobileDrawer();
          return true;
        }
      }

      // Navigate to the chapter
      if (book.sections && book.sections.length) {
        var targetCh = book.chapters[chIdx];
        if (targetCh.section) {
          _activeSection = targetCh.section;
          localStorage.setItem('lastSection', _activeSection);
        }
      }
      renderSidebar();
      selectChapter(chIdx);
      updateMobileBars();
      closeMobileDrawer();
      return true;
    }

    selectBook(book.num);
    return true;
  }

  /** Navigate based on location.pathname (slug-based clean URLs).
   * Looks up by book._slug / ch._slug / rd._slug. Returns true on success. */
  function navigateFromPath() {
    var pathname = location.pathname || '';
    if (!pathname || pathname === '/' || pathname === '/index.html') return false;
    var raw = pathname.replace(/^\/+|\/+$/g, '');
    if (!raw) return false;
    // Reject paths that look like physical files (e.g. /style.css, /app.js)
    if (raw.indexOf('.') !== -1 && /\.[a-zA-Z0-9]{2,5}$/.test(raw)) return false;
    var parts = raw.split('/').map(function (s) { return decodeURIComponent(s); });
    if (!parts.length) return false;

    var bookSlug = parts[0];
    var chSlug = parts[1] || null;
    var rdSlug = parts[2] || null;

    var book = books.find(function (b) { return b._slug === bookSlug; });
    if (!book) return false;

    if (!chSlug) { selectBook(book.num); return true; }

    var chIdx = -1;
    for (var i = 0; i < book.chapters.length; i++) {
      if (book.chapters[i]._slug === chSlug) { chIdx = i; break; }
    }
    if (chIdx < 0) { selectBook(book.num); return true; }

    // Activate book without auto-selecting first chapter
    activeBook = book;
    localStorage.setItem('lastTab', book.num);
    document.querySelectorAll('.nav-tab').forEach(function (t) {
      t.classList.toggle('active', parseInt(t.dataset.book) === book.num);
    });
    flatReadings = [];
    book.chapters.forEach(function (c, ci) {
      c.readings.forEach(function (r) {
        var pr = parseFilename(r.file);
        if (!pr.separator && !/^header\.txt$/i.test(r.file)) {
          flatReadings.push({ rd: r, ch: c, _chIdx: ci });
        }
      });
    });
    flatReadings.sort(function (a, b) {
      if (a._chIdx !== b._chIdx) return a._chIdx - b._chIdx;
      return parseFilename(a.rd.file).num - parseFilename(b.rd.file).num;
    });

    // Resolve target reading: explicit rdSlug wins, else if chapter has 1
    // reading, target it.
    var targetRd = null;
    var targetCh = book.chapters[chIdx];
    if (rdSlug) {
      for (var ri = 0; ri < targetCh.readings.length; ri++) {
        if (targetCh.readings[ri]._slug === rdSlug) { targetRd = targetCh.readings[ri]; break; }
      }
    } else if (targetCh.readings.length === 1) {
      targetRd = targetCh.readings[0];
    }

    if (targetRd && getBookUi(book).ShowAvatars) {
      var flatIdx = -1;
      for (var fi = 0; fi < flatReadings.length; fi++) {
        if (flatReadings[fi].rd === targetRd) { flatIdx = fi; break; }
      }
      if (flatIdx >= 0) {
        viewMode = 'book';
        renderSidebar();
        selectReading(flatIdx);
        updateMobileBars();
        closeMobileDrawer();
        return true;
      }
    }

    // Navigate to chapter (book-with-chapters mode)
    if (book.sections && book.sections.length && targetCh.section) {
      _activeSection = targetCh.section;
      localStorage.setItem('lastSection', _activeSection);
    }
    renderSidebar();
    selectChapter(chIdx);
    updateMobileBars();
    closeMobileDrawer();
    return true;
  }

  /** Listen for hash changes (browser back/forward) */
  window.addEventListener('hashchange', function () {
    if (_suppressHashChange) return;
    navigateFromHash();
  });

  /** Listen for popstate (back/forward on path-based URLs) */
  window.addEventListener('popstate', function () {
    if (_suppressPopState) return;
    if (!navigateFromPath()) {
      // Fall back to hash routing if path didn't match
      navigateFromHash();
    }
  });

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
    // Routing priority: clean path > legacy hash > saved tab > default
    if (navigateFromPath()) {
      // navigated from clean URL path - done
    } else if (location.hash && location.hash.length > 2 && navigateFromHash()) {
      // navigated from URL hash (legacy) - done
    } else {
      // Restore last tab or default to Welcome (book 0)
      var savedTab = parseInt(localStorage.getItem('lastTab'));
      var first = (!isNaN(savedTab) && books.find(function (b) { return b.num === savedTab; }))
               || books.find(function (b) { return b.num === 0; })
               || books.find(function (b) { return b.totalReadings > 0; });
      if (first) selectBook(first.num);
    }
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
      if (_publishedMode) return;
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

    var title = '';
    var byLine = '';
    var avatarTitle = '';

    // Try reading-block first (content area buttons)
    var block = btn.closest('.reading-block');
    if (block) {
      var titleEl = block.querySelector('.reading-title');
      if (!titleEl) titleEl = block.querySelector('.avatar-reading-title');
      title = titleEl ? titleEl.textContent.trim() : '';
      var nameEl = block.querySelector('.avatar-name');
      byLine = nameEl ? nameEl.textContent.trim() : '';
      var subEl = block.querySelector('.avatar-row-subtitle');
      avatarTitle = subEl ? subEl.textContent.trim() : '';
    } else {
      // Fallback: media bar button — use media bar info
      var bar = btn.closest('.media-bar');
      if (bar) {
        var nameEl = bar.querySelector('.avatar-name');
        byLine = nameEl ? nameEl.textContent.trim() : '';
        var subEl = bar.querySelector('.avatar-row-subtitle');
        avatarTitle = subEl ? subEl.textContent.trim() : '';
        var rdEl = bar.querySelector('.media-bar-reading-title');
        var chapEl = bar.querySelector('.media-bar-chapter-name');
        title = (rdEl ? rdEl.textContent.trim() : '') || (chapEl ? chapEl.textContent.trim() : '');
      }
    }

    // Build the post text: "[Name], [Title]\n[teaser]"
    var avatarId = '';
    if (viewMode === 'book' && flatReadings[activeReadingIdx]) {
      var _p = parseFilename(flatReadings[activeReadingIdx].rd.file);
      avatarId = _p.avatarId;
    }
    var teaser = avatarId && avatars[avatarId] ? (avatars[avatarId].teaser || '') : '';
    var postText = byLine || '';
    if (avatarTitle) postText += ', ' + avatarTitle;
    if (teaser) postText += '\n\n' + teaser;

    // Use clean path URL — X will crawl it and render the OG card with image
    var shareUrl = getCurrentShareUrl();
    var intentUrl = 'https://x.com/intent/post?text=' + encodeURIComponent(postText) + '&url=' + encodeURIComponent(shareUrl);
    window.open(intentUrl, '_blank', 'noopener,noreferrer');
  });

  /* ── Share button handler (event delegation on content) ── */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.share-btn');
    if (!btn) return;
    e.preventDefault();
    var title = btn.dataset.shareTitle || 'Reading';
    var url = getCurrentShareUrl();
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
        if (_publishedMode) return;
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
      '<button class="mob-menu-btn" id="mob-menu-btn" title="Menu">&#9776;</button>' +
      '<span class="mob-book-name">' + escHtml(activeBook ? activeBook.name : '') + '</span>' +
      '<button class="mob-book-nav' + (hasPrevBook ? '' : ' disabled') + '" id="mob-book-prev" title="Previous book">&#9664;</button>' +
      '<button class="mob-book-nav' + (hasNextBook ? '' : ' disabled') + '" id="mob-book-next" title="Next book">&#9654;</button>';

    // Menu button → toggle sidebar drawer
    bar1.querySelector('#mob-menu-btn').addEventListener('click', toggleMobileDrawer);
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

    // ── Bar 2: Filter tab (Codex/Warnings only) or blank ──
    var chIdx = activeChapterIdx;
    var prevCh = (chIdx >= 0) ? findAdjacentChapter(chIdx, -1) : null;
    var nextCh = (chIdx >= 0) ? findAdjacentChapter(chIdx, 1) : null;

    // Only books with sections (Codex, Warnings) show the active filter in Bar 2
    var bar2Label = '';
    if (activeBook && activeBook.sections && activeBook.sections.length) {
      bar2Label = _activeSection || activeBook.sections[0] || '';
    }

    bar2.innerHTML =
      '<span class="mob-reading-name">' + escHtml(bar2Label) + '</span>' +
      '<button class="mob-reading-nav' + (prevCh !== null ? '' : ' disabled') + '" id="mob-ch-prev" title="Previous chapter">&#9664;</button>' +
      '<button class="mob-reading-nav' + (nextCh !== null ? '' : ' disabled') + '" id="mob-ch-next" title="Next chapter">&#9654;</button>';

    // Menu button is now in Bar 1
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
    // Click sidebar header to go to landing page (first reading)
    header.style.cursor = 'pointer';
    header.addEventListener('click', function () {
      if (!activeBook) return;
      localStorage.removeItem('lastChapter_' + activeBook.num);
      if (activeBook.sections && activeBook.sections.length) {
        _activeSection = activeBook.sections[0];
        localStorage.setItem('lastSection', _activeSection);
        renderSidebar();
        var sectionChapters = activeBook.chapters.filter(function (c) { return c.section === _activeSection; });
        var firstWithReadings = sectionChapters.find(function (c) { return c.readings && c.readings.length > 0; });
        if (firstWithReadings) {
          var idx = activeBook.chapters.indexOf(firstWithReadings);
          if (idx >= 0) selectChapter(idx);
        }
      } else {
        var startIdx = (activeBook.chapters.length > 1 && activeBook.chapters[0].num === 0) ? 1 : 0;
        for (var i = startIdx; i < activeBook.chapters.length; i++) {
          if (activeBook.chapters[i].readings.length > 0) {
            selectChapter(i);
            return;
          }
        }
      }
    });

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

    // Add hearts to avatar sidebar items (flat mode — Welcome, Hell, etc.)
    list.querySelectorAll('li.sidebar-item > a[data-ch][data-rd]').forEach(function (link) {
      var chIdx = parseInt(link.dataset.ch, 10);
      var rdIdx = parseInt(link.dataset.rd, 10);
      var rdPath = _getReadingKey(chIdx, rdIdx);
      if (!rdPath) return;
      var likeKey = _readingKeyToLikeKey(rdPath);
      // Skip if heart already added
      if (link.parentNode.querySelector('.sidebar-heart')) return;
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
            document.querySelectorAll('.like-btn[data-reading-key="' + CSS.escape(likeKey) + '"]').forEach(function (b) {
              window.Likes.applyHeartState(b, info);
            });
            if (info.liked) btn.classList.add('liked');
            else btn.classList.remove('liked');
          });
        } else {
          var liked = _isHearted(rdPath);
          if (!liked) localStorage.setItem('liked:' + likeKey, '1');
          else localStorage.removeItem('liked:' + likeKey);
          btn.classList.toggle('liked');
        }
      });
      link.appendChild(btn);
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

    // Delegated right-click context menu for sidebar items (admin only, dev mode only)
    list.addEventListener('contextmenu', function (e) {
      if (_publishedMode) return;
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
    var xp = parseFloat(parts[0]); if (isNaN(xp)) xp = 50;
    var yp = parseFloat(parts[1]); if (isNaN(yp)) yp = 50;
    var pos = xp + '% ' + yp + '%';
    var z = 1;
    if (parts[2]) { z = parseFloat(parts[2]) / 100; if (isNaN(z) || z === 0) z = 1; }
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
          var scr = parseCrop(avatarObj.crop);
          clip.style.backgroundImage = 'url(' + avatarThumb(avatarObj) + ')';
          clip.style.backgroundPosition = scr.position || '50% 50%';
          clip.style.backgroundSize = (scr.zoom * 100) + '%';
          clip.style.backgroundRepeat = 'no-repeat';
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
        var titleText = (avatarObj && avatarObj.name) || 'MISSING';
        var titleHtml = escHtml(titleText);

        if (avatarObj && avatarObj.id !== 'None') {
          a.classList.add('sidebar-row');
          if (avatarObj.image) {
            var clip = document.createElement('div');
            clip.className = 'sidebar-avatar-clip';
            var scr2 = parseCrop(avatarObj.crop);
            clip.style.backgroundImage = 'url(' + avatarThumb(avatarObj) + ')';
            clip.style.backgroundPosition = scr2.position || '50% 50%';
            clip.style.backgroundSize = (scr2.zoom * 100) + '%';
            clip.style.backgroundRepeat = 'no-repeat';
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
        var subText = (avatarObj && avatarObj.title) || '';
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
    pushHash(buildHash(activeBook, ch));
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
    pushHash(buildHash(activeBook, ch));
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

    // Update URL bar with deep link
    pushHash(buildHash(activeBook, flatReadings[rdIdx].ch, rd));

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
    // For Welcome: if no displayTitle, use first non-empty line of text as title
    if (isWelcome && !title && hasBody) {
      for (var ti = 0; ti < lines.length; ti++) {
        if (lines[ti].trim()) { title = lines[ti].trim(); break; }
      }
    }

    var html = '';

    // ── Media bar: combined nav + avatar + actions ──
    var readingCh = flatReadings[rdIdx].ch;
    var chTitle;
    if (isWelcome) {
      var sidebarItem = document.querySelector('.sidebar-item a.active .sidebar-title');
      chTitle = sidebarItem ? sidebarItem.textContent.trim() : (avatar && avatar.name ? avatar.name : 'Welcome');
    } else {
      chTitle = prettyFolderName(readingCh.folder || '', null, readingCh.title, readingCh.displayTitle);
    }
    var mediaBarAvatar = avatar;
    // For Welcome Beelzebub2/Judas2, use the original avatar image
    if (isWelcome && avatar) {
      if (avatar.id === 'Beelzebub2') {
        var beelAv = avatars['Beelzebub'];
        if (beelAv) mediaBarAvatar = Object.assign({}, avatar, { image: beelAv.image, crop: beelAv.crop });
      }
      if (avatar.id === 'Judas2') {
        var judAv = avatars['Judas'];
        if (judAv) mediaBarAvatar = Object.assign({}, avatar, { image: judAv.image, crop: judAv.crop });
      }
    }
    html += buildMediaBar({
      hasPrev: rdIdx > 0,
      hasNext: rdIdx < total - 1,
      posText: (rdIdx + 1) + ' of ' + (total > 1000 ? '1000+' : total),
      titleHtml: chTitle,
      avatar: (!avatar || avatar.id === 'None') ? null : mediaBarAvatar,
      parsed: parsed,
      isWelcome: isWelcome,
      downloadPath: booksOutUrl(rd.path),
      shareTitle: isWelcome ? '' : title,
      hasMp3: rd.mp3,
      mp3Override: null,
      isFooter: false
    });

    // ── Chapter banner images (e.g. WFB presents) ──
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

    // Featured painting (previously part of avatar row, now shown below media bar)
    // Skip for Welcome — renderWelcomeCard already shows the featured image
    if (avatar && avatar.featured && !isWelcome) {
      html += '<div class="avatar-featured"><img class="avatar-featured-img" src="' + escHtml(avatar.featured) + '" alt="' + escHtml(avatar.name) + '"></div>';
    }

    if (isWelcome && avatar && avatar.id !== 'None') {
      if (hasBody) {
        html += '<div class="reading-body">';
        html += renderBodyLines(lines, -1);
        html += '</div>';
      }
    } else {
      var isAvatarBook = activeBook && activeBook.num === 0;
      if (!isAvatarBook) {
        html += '<h3 class="reading-title">' + titleToHtml(title) + '</h3>';
        if (avatar && avatar.teaser) {
          html += '<p class="reading-teaser">' + escHtml(avatar.teaser) + '</p>';
        }
      }
      html += '<div class="reading-body">';
      html += renderBodyLines(lines, titleLineIdx);
      html += '</div>';
    }
    html += '</div>';

    content.innerHTML = html;
    content.className = 'content book-' + activeBook.num;
    content.scrollTop = 0;
    loadTwitterEmbeds(content);
    if (window.Likes) window.Likes.refreshVisible();
    _preloadMediaDuration();
    _initMediaBarOptions();

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
    pushHash(buildHash(activeBook, ch));
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
      html += '<button class="action-btn repost-btn" title="Quote"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>';
      html += '<button class="action-btn quote2-btn" title="Quote"><svg width="18" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a5 5 0 0 1-5 5H7l-4 4V8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5z"/></svg></button>';
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
      var zoomPct = cr.zoom * 100;
      var clipStyle = 'background-image:url(\'' + escHtml(avImg) + '\');';
      clipStyle += 'background-position:' + (cr.position || '50% 50%') + ';';
      clipStyle += 'background-size:' + zoomPct + '%;';
      html += '<div class="welcome-avatar-clip welcome-avatar-img" style="' + clipStyle + '">';
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

  /* ── openCropEditor removed — crop editing is in the Properties modal ── */
  function openCropEditor(avatar) { void avatar; }

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
      var hcr = parseCrop(avatar.crop);
      html += '<div class="avatar-img-clip" style="background-image:url(' + escHtml(avatarImage(avatar)) + ');background-position:' + (hcr.position || '50% 50%') + ';background-size:' + (hcr.zoom * 100) + '%"></div>';
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
    html += '<button class="action-btn repost-btn" title="Quote"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>';
    html += '<button class="action-btn quote2-btn" title="Quote"><svg width="18" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a5 5 0 0 1-5 5H7l-4 4V8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5z"/></svg></button>';
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

        // Speaker ID lines (e.g. "B = Beelzebub, an Angelic Demon") — render bold
        if (/^[A-Z][a-z]?\s*=\s*\S/.test(line)) {
          var idClass = /demon/i.test(line) ? 'speaker-id demon-id' : 'speaker-id';
          html += '<p class="' + idClass + '"><strong>' + escHtml(line) + '</strong></p>';
          continue;
        }

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
              var spImg = (spAv && spAv.image) ? '<img class="inline-speaker-avatar" src="' + escHtml(avatarThumb(spAv)) + '" alt="' + escHtml(spAv.name || '') + '">' : '';
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
    var html = '<div class="footer-nav">';
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
    if (isFooter) {
      var html = '<div class="footer-nav">';
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
    // Top: Winamp-style media bar for chapter view
    return buildMediaBar({
      hasPrev: hasPrev,
      hasNext: hasNext,
      titleHtml: titleHtml,
      posText: null,
      avatar: null,
      parsed: null,
      isWelcome: false,
      downloadPath: '',
      shareTitle: '',
      hasMp3: false,
      mp3Override: null,
      isFooter: false
    });
  }

  /* ── Media bar: Winamp-style combined player bar ── */
  function buildMediaBar(opts) {
    if (opts.isFooter) {
      var fhtml = '<div class="footer-nav">';
      fhtml += opts.hasPrev
        ? '<a href="#" class="nav-btn" data-dir="prev">&larr; Previous</a>'
        : '<span class="nav-btn disabled">&larr; Previous</span>';
      if (opts.titleHtml) fhtml += '<div class="chapter-title">' + opts.titleHtml + '</div>';
      else if (opts.posText) fhtml += '<span class="nav-pos">' + opts.posText + '</span>';
      fhtml += opts.hasNext
        ? '<a href="#" class="nav-btn" data-dir="next">Next &rarr;</a>'
        : '<span class="nav-btn disabled">Next &rarr;</span>';
      fhtml += '</div>';
      return fhtml;
    }

    var colorCls = (opts.avatar && opts.avatar.color && opts.avatar.color !== 'blue') ? ' avatar-color-' + opts.avatar.color : '';
    var html = '<div class="media-bar' + colorCls + '">';

    var downloadPath = opts.downloadPath || '';
    var shareTitle = opts.shareTitle || '';
    var mp3Path = opts.mp3Override || (opts.hasMp3 && downloadPath ? downloadPath.replace(/\.txt$/, '.mp3') : '');
    var mp3Attr = mp3Path ? ' data-mp3-path="' + escHtml(mp3Path) + '"' : '';

    html += '<div class="media-bar-row">';

    // LEFT: Avatar image spanning full height, name + buttons to right
    html += '<div class="media-bar-left">';
    if (opts.avatar && opts.avatar.id !== 'None') {
      var isWelcomeBook = opts.isWelcome;
      var avatarLinkAttr = (!isWelcomeBook && opts.parsed && opts.parsed.avatarId) ? ' data-avatar-link="' + escHtml(opts.parsed.avatarId) + '"' : '';
      var clickStyle = avatarLinkAttr ? ' style="cursor:pointer" title="View avatar page"' : '';
      html += '<div class="media-bar-avatar' + (avatarLinkAttr ? ' avatar-clickable' : '') + '"' + avatarLinkAttr + clickStyle + '>';
      if (opts.avatar.image) {
        var mcr = parseCrop(opts.avatar.crop);
        html += '<div class="avatar-img-clip" style="background-image:url(' + escHtml(avatarImage(opts.avatar)) + ');background-position:' + (mcr.position || '50% 50%') + ';background-size:' + (mcr.zoom * 100) + '%"></div>';
      }
      html += '<div class="media-bar-left-info">';
      html += '<div class="avatar-info">';
      html += '<span class="avatar-name">' + escHtml(opts.avatar.name || '') + '</span>';
      var sub = (opts.parsed && opts.parsed.customSubtitle) || opts.avatar.title || '';
      if (sub) html += '<span class="avatar-row-subtitle">' + escHtml(sub) + '</span>';
      html += '</div>';
      // Action buttons
      html += '<div class="media-bar-actions">';
      html += '<button class="action-btn repost-btn" title="Quote"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>';
      html += '<button class="action-btn quote2-btn" title="Quote"><svg width="16" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a5 5 0 0 1-5 5H7l-4 4V8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5z"/></svg></button>';
      html += '<button class="action-btn share-btn" title="Share" data-share-title="' + escHtml(shareTitle) + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg></button>';
      html += '<button class="action-btn download-btn" title="Download" data-download-path="' + escHtml(downloadPath) + '" data-download-title="' + escHtml(shareTitle || 'reading') + '"' + mp3Attr + '><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>';
      html += '<button class="action-btn copy-btn" title="Copy to clipboard"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>';
      html += '<button class="action-btn like-btn" title="Like" data-reading-key="' + escHtml(downloadPath) + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg><span class="like-count"></span></button>';
      html += '</div>';
      html += '</div>';
      html += '</div>';
    }
    html += '</div>';

    // CENTER: Transport (prev, pause, PLAY, repeat, next)
    html += '<div class="media-bar-center">';
    html += '<div class="media-bar-transport">';
    html += opts.hasPrev
      ? '<a href="#" class="mbtn mbtn-nav" data-dir="prev" title="Previous"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="3" height="16"/><polygon points="21,4 9,12 21,20"/></svg></a>'
      : '<span class="mbtn mbtn-nav disabled"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="3" height="16"/><polygon points="21,4 9,12 21,20"/></svg></span>';
    html += '<button class="mbtn media-skip-btn" data-skip="-15" title="Back 15s"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="12" y="15.5" text-anchor="middle" font-size="7.5" font-weight="bold" font-family="sans-serif">15</text></svg></button>';
    html += '<button class="mbtn mbtn-play tts-btn media-play-btn" title="Play"' + mp3Attr + '><svg class="media-load-ring" viewBox="0 0 48 48" aria-hidden="true"><circle class="media-load-ring-track" cx="24" cy="24" r="20" fill="none" stroke-width="3"></circle><circle class="media-load-ring-fill" cx="24" cy="24" r="20" fill="none" stroke-width="3" stroke-linecap="round"></circle></svg><svg class="media-play-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,3 20,12 6,21"/></svg><svg class="media-pause-icon" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/></svg></button>';
    html += '<button class="mbtn media-skip-btn" data-skip="15" title="Forward 15s"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/><text x="12" y="15.5" text-anchor="middle" font-size="7.5" font-weight="bold" font-family="sans-serif">15</text></svg></button>';
    html += opts.hasNext
      ? '<a href="#" class="mbtn mbtn-nav" data-dir="next" title="Next"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="3,4 15,12 3,20"/><rect x="18" y="4" width="3" height="16"/></svg></a>'
      : '<span class="mbtn mbtn-nav disabled"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="3,4 15,12 3,20"/><rect x="18" y="4" width="3" height="16"/></svg></span>';
    html += '</div>';
    html += '</div>';

    // RIGHT: 3-column grid, 2 rows
    html += '<div class="media-bar-right">';
    html += '<div class="media-bar-controls">';
    html += '<label class="media-bar-option" title="Reading voice"><input type="checkbox" class="media-reading-cb" checked> Reading</label>';
    html += '<div class="media-bar-volume"><svg class="media-vol-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3z"/><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg><input type="range" class="media-reading-volume" min="0" max="100" value="100" style="--vol-pct:100%"></div>';
    html += '<label class="media-bar-option" title="Sync music with reading"><input type="checkbox" class="media-sync-cb"> Sync</label>';
    html += '<label class="media-bar-option" title="Background music"><input type="checkbox" class="media-music-cb"> Music</label>';
    html += '<div class="media-bar-volume"><svg class="media-vol-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3z"/><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg><input type="range" class="media-volume" min="0" max="100" value="10" style="--vol-pct:10%"></div>';
    html += '<label class="media-bar-option" title="Auto-play next reading"><input type="checkbox" class="media-continuous-cb"> Continue</label>';
    html += '</div>';
    html += '</div>';

    html += '</div>'; // close media-bar-row

    // Chapter title row
    var chapterText = '';
    if (opts.titleHtml) {
      var tmp = document.createElement('span');
      tmp.innerHTML = opts.titleHtml;
      chapterText = tmp.textContent || tmp.innerText || '';
    }
    // Combined chapter + reading title row
    if (chapterText || opts.shareTitle || opts.posText) {
      html += '<div class="media-bar-subtitle">';
      html += '<span class="media-bar-time"></span>';
      if (chapterText) html += '<span class="media-bar-chapter-name">' + escHtml(chapterText) + '</span>';
      if (chapterText && opts.shareTitle) html += '<span class="media-bar-title-sep"> — </span>';
      if (opts.shareTitle) html += '<span class="media-bar-reading-title">' + escHtml(opts.shareTitle) + '</span>';
      if (opts.posText) html += '<span class="media-bar-pos">' + escHtml(opts.posText) + '</span>';
      html += '</div>';
    }

    // Progress slider row
    html += '<div class="media-bar-progress-row">';
    html += '<input type="range" class="media-progress" min="0" max="1000" value="0" step="1">';
    html += '</div>';

    html += '</div>'; // close media-bar
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
        html += '<span class="reading-index-clip"><img class="reading-index-img" src="' + escHtml(avatarThumb(av)) + '" alt="' + escHtml(av.name || '') + '"></span>';
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
      html += '<span class="reading-index-clip' + (avId ? ' reading-index-av-link' : '') + '"' + (avId ? ' data-avatar-link="' + escHtml(avId) + '"' : '') + '><img class="reading-index-img" src="' + escHtml(avatarThumb(av)) + '" alt="' + escHtml(av.name || '') + '"></span>';
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
   *  TEXT-TO-SPEECH (TTS) — Winamp-style transport controls
   * ══════════════════════════════════════════════════════════════════ */
  var _ttsAudio = null;
  var _ttsBtn = null;
  var _eqInterval = null;
  var _musicAudio = null;
  var _currentMusicFile = null;
  var _musicFadeTimer = null;
  var _musicHoldTimer = null;
  var _preserveMusic = false;
  var _continuingPlayback = false;
  // ── Mobile-playback robustness state ────────────────────────────────
  // _loading: re-entry guard while a fresh play() is in flight (buffering).
  // _watchdogTimer: fires if 'playing' never arrives — surfaces retry toast.
  // _introTimer: replacement for the old setTimeout(4s) intro delay,
  //              tied to actual _musicAudio.currentTime so it does not
  //              drift on a busy mobile JS thread.
  // _musicGateTimer: deferred _startMusic() trigger (waits for reading to
  //                  buffer ≥ 3s OR 1500ms) so reading audio gets first
  //                  bite of bandwidth on cellular.
  // _musicUnlocked: true once we have a persistent _musicAudio element
  //                 that has been touched by a synchronous play() inside
  //                 a user gesture — required for iOS Safari to ever
  //                 allow background music to play later.
  var _loading = false;
  var _watchdogTimer = null;
  var _introTimer = null;
  var _musicGateTimer = null;
  var _musicUnlocked = false;
  var _toastTimer = null;

  function _mediaToast(msg, level) {
    // Tiny non-blocking toast above the media bar. Auto-dismiss in 4s.
    var existing = document.getElementById('media-toast');
    if (!existing) {
      existing = document.createElement('div');
      existing.id = 'media-toast';
      existing.className = 'media-toast';
      document.body.appendChild(existing);
    }
    existing.textContent = msg || '';
    existing.classList.remove('media-toast-error', 'media-toast-info');
    existing.classList.add(level === 'error' ? 'media-toast-error' : 'media-toast-info');
    existing.classList.add('media-toast-show');
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(function () {
      existing.classList.remove('media-toast-show');
    }, 4000);
  }

  function _setLoadingProgress(pct) {
    // pct in [0..1], or null/undefined for indeterminate.
    var btn = document.querySelector('.media-play-btn');
    if (!btn) return;
    if (pct == null || isNaN(pct)) {
      btn.classList.add('media-loading-indet');
      btn.style.removeProperty('--load-pct');
    } else {
      var clamped = Math.max(0, Math.min(1, pct));
      btn.classList.remove('media-loading-indet');
      btn.style.setProperty('--load-pct', clamped.toFixed(3));
    }
  }

  function _clearLoadingState() {
    var btn = document.querySelector('.media-play-btn');
    if (btn) {
      btn.classList.remove('media-loading');
      btn.classList.remove('media-loading-indet');
      btn.style.removeProperty('--load-pct');
    }
    if (_watchdogTimer) { clearTimeout(_watchdogTimer); _watchdogTimer = null; }
    _loading = false;
  }

  function _clearTransientTimers() {
    if (_introTimer) { clearInterval(_introTimer); _introTimer = null; }
    if (_musicGateTimer) { clearTimeout(_musicGateTimer); _musicGateTimer = null; }
  }

  function _ensureMusicElement() {
    // Create a persistent _musicAudio element on first user gesture.
    // Calling .play() synchronously inside the gesture unlocks the element
    // for iOS Safari, even if it has no src yet (we use a 1-frame muted
    // play-then-pause to satisfy the gesture-unlock requirement).
    if (_musicAudio) return _musicAudio;
    var a = new Audio();
    a.loop = true;
    a.preload = 'none';
    a.muted = true;
    a.volume = 0;
    _musicAudio = a;
    // Attempt the synchronous play to unlock — must be inside a gesture.
    try {
      var p = a.play();
      if (p && p.then) p.then(function () { try { a.pause(); } catch(e){} _musicUnlocked = true; }, function () {});
    } catch (e) { /* will retry later */ }
    return a;
  }

  function _musicUrl(filename) {
    var prefix = _publishedMode ? './Music/' : '../Music/';
    var name = filename.indexOf('.') === -1 ? filename + '.mp3' : filename;
    return prefix + encodeURIComponent(name);
  }

  /* ── MediaSession: lock-screen / CarPlay / Bluetooth headphone controls.
   *    Without this, iOS treats <audio> playback as transient and may
   *    suspend it when the screen locks; with this, iOS shows the player
   *    on the lock screen and respects play/pause/next/prev from the car
   *    head unit and BT headphones. Safe no-op on browsers that lack the
   *    API (older Safari, etc.). ───────────────────────────────────── */
  var _mediaSessionWired = false;
  function _setMediaSessionMetadata() {
    if (!('mediaSession' in navigator)) return;
    try {
      var entry = (viewMode === 'book' && flatReadings[activeReadingIdx])
        ? flatReadings[activeReadingIdx] : null;
      var rd = entry ? entry.rd : null;
      var ch = entry ? entry.ch : null;
      var p = rd ? parseFilename(rd.file) : { avatarId: '', displayTitle: '', slug: '' };
      var av = (p.avatarId && avatars[p.avatarId]) ? avatars[p.avatarId] : null;
      var title = (rd && (rd.title || p.displayTitle || p.slug)) || (ch && ch.folder) || 'Reading';
      var artist = av ? (av.name || p.avatarId) : (p.avatarId || '');
      var album  = (activeBook && (activeBook.name || activeBook.folder)) || '';
      var artwork = [];
      if (av && av.image) {
        // Resolve relative path to absolute — required for some lock-screen UIs.
        var imgUrl = new URL(av.image, document.baseURI).href;
        artwork.push({ src: imgUrl, sizes: '512x512', type: 'image/jpeg' });
      }
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title, artist: artist, album: album, artwork: artwork
      });
    } catch (e) { /* best-effort */ }
  }
  function _setMediaSessionState(state) {
    if (!('mediaSession' in navigator)) return;
    try { navigator.mediaSession.playbackState = state; } catch (e) {}
  }
  function _wireMediaSessionActions() {
    if (_mediaSessionWired || !('mediaSession' in navigator)) return;
    _mediaSessionWired = true;
    function clickPlay() {
      var btn = document.querySelector('.media-play-btn');
      if (btn) btn.click();
    }
    try {
      navigator.mediaSession.setActionHandler('play', clickPlay);
      navigator.mediaSession.setActionHandler('pause', clickPlay);
      navigator.mediaSession.setActionHandler('previoustrack', function () {
        if (viewMode !== 'book' || activeReadingIdx <= 0) return;
        selectReading(activeReadingIdx - 1);
        setTimeout(clickPlay, 400);
      });
      navigator.mediaSession.setActionHandler('nexttrack', function () {
        if (viewMode !== 'book' || activeReadingIdx >= flatReadings.length - 1) return;
        selectReading(activeReadingIdx + 1);
        setTimeout(clickPlay, 400);
      });
      navigator.mediaSession.setActionHandler('seekbackward', function (d) {
        if (!_ttsAudio) return;
        var step = (d && d.seekOffset) || 15;
        try { _ttsAudio.currentTime = Math.max(0, _ttsAudio.currentTime - step); } catch(e){}
      });
      navigator.mediaSession.setActionHandler('seekforward', function (d) {
        if (!_ttsAudio) return;
        var step = (d && d.seekOffset) || 15;
        try { _ttsAudio.currentTime = Math.min(_ttsAudio.duration || 0, _ttsAudio.currentTime + step); } catch(e){}
      });
    } catch (e) { /* unsupported actions throw — ignore */ }
  }

  function _getMusicForReading(rdIdx) {
    if (rdIdx < 0 || rdIdx >= flatReadings.length) return null;
    var entry = flatReadings[rdIdx];
    if (entry.ch.music) { console.log('[music] chapter override:', entry.ch.music); return entry.ch.music; }
    var p = parseFilename(entry.rd.file);
    var avatarId = p.avatarId;
    if (!avatarId && entry.ch.folder) {
      var fm = entry.ch.folder.match(/^\d+-([A-Za-z]\w*)/);
      if (fm) avatarId = fm[1];
    }
    console.log('[music] rd.file=', entry.rd.file, 'ch.folder=', entry.ch.folder, 'avatarId=', avatarId, 'avatars[id]=', avatars[avatarId]);
    if (avatarId && avatars[avatarId] && avatars[avatarId].music) {
      return avatars[avatarId].music;
    }
    return null;
  }

  function _getAvatarVolumeForReading(rdIdx) {
    if (rdIdx < 0 || rdIdx >= flatReadings.length) return 1.0;
    var entry = flatReadings[rdIdx];
    var p = parseFilename(entry.rd.file);
    var avatarId = p.avatarId;
    if (!avatarId && entry.ch.folder) {
      var fm = entry.ch.folder.match(/^\d+-([A-Za-z]\w*)/);
      if (fm) avatarId = fm[1];
    }
    if (avatarId && avatars[avatarId] && avatars[avatarId].volume) {
      var v = parseInt(String(avatars[avatarId].volume).replace('%', ''), 10);
      if (!isNaN(v) && v > 0 && v <= 100) return v / 100;
    }
    return 1.0;
  }

  function _getChapterMusic() {
    return _getMusicForReading(activeReadingIdx);
  }

  function _startMusic() {
    var musicFile = _getChapterMusic();
    if (!musicFile) {
      _stopMusic();
      return;
    }
    // Same track already playing — keep it, clear flag.
    if (_musicAudio && _currentMusicFile === musicFile && _musicAudio.src) {
      _preserveMusic = false;
      // Make sure it's actually rolling (might have been paused on swap).
      if (_musicAudio.paused) { try { _musicAudio.play().catch(function(){}); } catch(e){} }
      return;
    }
    var cb = document.querySelector('.media-music-cb');
    var volSlider = document.querySelector('.media-volume');
    var vol = volSlider ? parseInt(volSlider.value, 10) / 100 : 0.10;
    var musicOn = !!(cb && cb.checked);
    // Re-use the persistent _musicAudio element (created during the click
    // gesture by _ensureMusicElement). On iOS Safari this element is
    // already unlocked, so swapping src + load() + play() works where
    // creating a brand-new Audio() would be silently blocked.
    var a = _musicAudio || _ensureMusicElement();
    if (_musicFadeTimer) { clearInterval(_musicFadeTimer); _musicFadeTimer = null; }
    if (_musicHoldTimer) { clearTimeout(_musicHoldTimer); _musicHoldTimer = null; }
    try { a.pause(); } catch(e){}
    a.src = _musicUrl(musicFile);
    a.preload = 'auto';
    a.loop = true;
    a.muted = !musicOn;
    a.volume = musicOn ? vol : 0;
    _currentMusicFile = musicFile;
    try {
      var p = a.play();
      if (p && p.catch) p.catch(function () {
        // Music failed (autoplay policy / network). Reading must still play.
        _mediaToast('Music unavailable', 'info');
      });
    } catch (e) {
      _mediaToast('Music unavailable', 'info');
    }
  }

  function _stopMusic() {
    if (_musicFadeTimer) { clearInterval(_musicFadeTimer); _musicFadeTimer = null; }
    if (_musicHoldTimer) { clearTimeout(_musicHoldTimer); _musicHoldTimer = null; }
    if (_musicAudio) {
      try { _musicAudio.pause(); } catch(e){}
      // Keep the element alive (do NOT null it) so its iOS gesture-unlock
      // is preserved across reading transitions. Just clear the src so
      // the next _startMusic() will swap in a fresh URL.
      try { _musicAudio.src = ''; } catch(e){}
    }
    _currentMusicFile = null;
  }

  function _fadeOutMusic(holdMs, fadeMs) {
    if (!_musicAudio) return;
    var audio = _musicAudio;
    var startVol = audio.volume;
    if (_musicFadeTimer) { clearInterval(_musicFadeTimer); _musicFadeTimer = null; }
    if (_musicHoldTimer) { clearTimeout(_musicHoldTimer); _musicHoldTimer = null; }
    _musicHoldTimer = setTimeout(function () {
      _musicHoldTimer = null;
      if (_musicAudio !== audio) return;
      var steps = 30;
      var stepMs = fadeMs / steps;
      var i = 0;
      _musicFadeTimer = setInterval(function () {
        if (_musicAudio !== audio) { clearInterval(_musicFadeTimer); _musicFadeTimer = null; return; }
        i++;
        audio.volume = Math.max(0, startVol * (1 - i / steps));
        if (i >= steps) {
          clearInterval(_musicFadeTimer);
          _musicFadeTimer = null;
          if (_musicAudio === audio) _stopMusic();
        }
      }, stepMs);
    }, holdMs);
  }

  function mediaBarSetState(state) {
    // state: 'playing' | 'paused' | 'stopped' | 'loading'
    // 'loading' is the buffering phase between user tap and audio start.
    // It dims the play icon and reveals the SVG ring overlay; the ring
    // starts indeterminate and turns determinate once we have a duration
    // + buffered length to compute a percentage.
    var playBtn = document.querySelector('.media-play-btn');
    var pauseBtn = document.querySelector('.media-pause-btn');
    var stopBtn = document.querySelector('.media-stop-btn');
    var eq = document.querySelector('.media-bar-eq');
    if (playBtn) {
      playBtn.classList.toggle('active', state === 'playing');
      playBtn.classList.toggle('is-playing', state === 'playing');
      if (state === 'loading') {
        playBtn.classList.add('media-loading');
        playBtn.classList.add('media-loading-indet');
      } else {
        playBtn.classList.remove('media-loading');
        playBtn.classList.remove('media-loading-indet');
        playBtn.style.removeProperty('--load-pct');
      }
    }
    if (pauseBtn) pauseBtn.classList.toggle('active', state === 'paused');
    if (stopBtn) stopBtn.classList.toggle('active', state === 'stopped');
    if (eq) {
      if (state === 'playing') {
        eq.classList.add('eq-active');
        startEqAnimation();
      } else {
        eq.classList.remove('eq-active');
        stopEqAnimation();
      }
    }
  }

  function startEqAnimation() {
    if (_eqInterval) return;
    var eq = document.querySelector('.media-bar-eq');
    if (!eq) return;
    var bars = eq.querySelectorAll('.eq-bar');
    _eqInterval = setInterval(function () {
      bars.forEach(function (bar) {
        var h = Math.floor(Math.random() * 20) + 3;
        bar.style.height = h + 'px';
      });
    }, 120);
  }

  function stopEqAnimation() {
    if (_eqInterval) { clearInterval(_eqInterval); _eqInterval = null; }
    var eq = document.querySelector('.media-bar-eq');
    if (!eq) return;
    eq.querySelectorAll('.eq-bar').forEach(function (bar) {
      bar.style.height = '3px';
    });
  }

  function ttsSetIcon(btn, playing) {
    // Legacy: for avatar-row tts buttons (in chapter view)
    if (!btn) return;
    var playIcon = btn.querySelector('.tts-play-icon');
    var pauseIcon = btn.querySelector('.tts-pause-icon');
    if (playIcon) playIcon.style.display = playing ? 'none' : '';
    if (pauseIcon) pauseIcon.style.display = playing ? '' : 'none';
    if (playing) btn.classList.add('tts-active');
    else btn.classList.remove('tts-active');
  }

  var _preloadAudioEl = null;
  function _preloadMediaDuration() {
    if (_preloadAudioEl) { _preloadAudioEl.src = ''; _preloadAudioEl = null; }
    var playBtn = document.querySelector('.media-play-btn');
    var mp3Url = playBtn ? playBtn.getAttribute('data-mp3-path') : '';
    var timeEl = document.querySelector('.media-bar-time');
    if (!mp3Url || !timeEl) { if (timeEl) timeEl.textContent = ''; return; }
    var a = new Audio();
    a.preload = 'metadata';
    a.addEventListener('loadedmetadata', function () {
      if (!a.duration || !isFinite(a.duration)) return;
      var m = Math.floor(a.duration / 60);
      var s = Math.floor(a.duration % 60);
      timeEl.textContent = m + ':' + (s < 10 ? '0' : '') + s;
      _preloadAudioEl = null;
    });
    a.src = mp3Url;
    _preloadAudioEl = a;
  }

  function _bindProgressSlider(audio) {
    var slider = document.querySelector('.media-progress');
    var timeEl = document.querySelector('.media-bar-time');
    if (!slider) return;
    function fmt(s) {
      if (!isFinite(s) || s < 0) return '';
      var m = Math.floor(s / 60);
      var sec = Math.floor(s % 60);
      return m + ':' + (sec < 10 ? '0' : '') + sec;
    }
    function offset() { return audio._introOffset || 0; }
    function vDur() { return (audio.duration || 0) + offset(); }
    function vCur() {
      var off = offset();
      if (off > 0 && audio._introStart) {
        var introElapsed = (Date.now() - audio._introStart) / 1000;
        if (introElapsed < off && audio.currentTime === 0) {
          return Math.min(introElapsed, off);
        }
      }
      return off + audio.currentTime;
    }
    function refresh() {
      var d = vDur();
      if (!d || _seeking) return;
      slider.value = Math.round((vCur() / d) * 1000);
      if (timeEl) timeEl.textContent = fmt(d - vCur());
    }
    audio.addEventListener('timeupdate', refresh);
    audio.addEventListener('loadedmetadata', function () {
      if (timeEl && vDur()) timeEl.textContent = fmt(vDur());
    });
    // Ticker to update slider during intro music delay
    if (audio._introTicker) clearInterval(audio._introTicker);
    audio._introTicker = setInterval(function () {
      if (!_ttsAudio || _ttsAudio !== audio) { clearInterval(audio._introTicker); return; }
      refresh();
      if (audio.currentTime > 0) { clearInterval(audio._introTicker); audio._introTicker = null; }
    }, 200);
    var _seeking = false;
    slider.addEventListener('mousedown', function () { _seeking = true; });
    slider.addEventListener('input', function () {
      var d = vDur();
      if (!d) return;
      var target = (slider.value / 1000) * d;
      var off = offset();
      if (target <= off) {
        // Seeking into intro region: skip intro, start audio at 0
        audio._introStart = Date.now() - (target * 1000);
        if (audio.paused && audio.currentTime === 0) {
          // still in intro phase, leave audio paused
        } else {
          audio.currentTime = 0;
        }
      } else {
        audio._introStart = Date.now() - (off * 1000);
        audio.currentTime = target - off;
        if (audio.paused) audio.play();
      }
    });
    slider.addEventListener('mouseup', function () { _seeking = false; });
    slider.addEventListener('touchstart', function () { _seeking = true; });
    slider.addEventListener('touchend', function () { _seeking = false; });
  }

  function _resetProgressSlider() {
    var slider = document.querySelector('.media-progress');
    var timeEl = document.querySelector('.media-bar-time');
    if (slider) slider.value = 0;
    if (timeEl) timeEl.textContent = '';
  }

  function ttsStop() {
    _clearTransientTimers();
    _clearLoadingState();
    if (_ttsAudio) {
      _ttsAudio.pause();
      _ttsAudio.src = '';
      _ttsAudio = null;
    }
    if (!_preserveMusic) _stopMusic();
    _resetProgressSlider();
    ttsSetIcon(_ttsBtn, false);
    _ttsBtn = null;
    mediaBarSetState('stopped');
    _setMediaSessionState('none');
  }

  function ttsOnEnded() {
    // Continuous: auto-advance to next reading
    var cb = document.querySelector('.media-continuous-cb');
    var repeatOn = cb ? cb.checked : false;
    var willPreserve = false;
    if (repeatOn && viewMode === 'book' && activeReadingIdx >= 0 && activeReadingIdx < flatReadings.length - 1) {
      // Check if next reading uses the same background music (after avatar fallback)
      var curMusic = _getMusicForReading(activeReadingIdx);
      var nxtMusic = _getMusicForReading(activeReadingIdx + 1);
      if (curMusic && curMusic === nxtMusic) { _preserveMusic = true; willPreserve = true; }
      _continuingPlayback = true;
    }
    // Reading ended naturally: fade music over 6 seconds (unless preserving for next reading)
    if (!willPreserve && _musicAudio) {
      _preserveMusic = true; // prevent ttsStop from killing music; fade will stop it
      _fadeOutMusic(0, 6000);
    }
    ttsStop();
    _preserveMusic = false;
    if (repeatOn) {
      if (viewMode === 'book' && activeReadingIdx >= 0 && activeReadingIdx < flatReadings.length - 1) {
        setTimeout(function () {
          selectReading(activeReadingIdx + 1);
          // Auto-play after loading
          setTimeout(function () {
            var playBtn = document.querySelector('.media-play-btn');
            if (playBtn) playBtn.click();
          }, 500);
        }, 300);
      }
    }
  }

  function ttsToggle(btn) {
    // Resolve the mp3 the button currently targets
    var targetMp3 = btn.getAttribute('data-mp3-path') || '';
    if (!targetMp3) {
      var hostBlock = btn.closest('.reading-block');
      if (!hostBlock) {
        var contentEl = document.getElementById('content');
        hostBlock = contentEl ? contentEl.querySelector('.reading-block') : null;
      }
      if (hostBlock) {
        var dl = hostBlock.querySelector('.download-btn');
        if (dl) targetMp3 = dl.getAttribute('data-mp3-path') || '';
      }
    }
    // Re-entry guard: if we're still mid-buffer for THIS button, ignore
    // repeat taps so we don't pile up multiple Audio objects on a slow
    // network. (This is the classic "user double-taps because nothing
    // visibly happened" failure mode.)
    if (_loading && _ttsBtn === btn) return;
    // If same button AND same mp3, toggle pause/resume
    if (_ttsBtn === btn && _ttsAudio && _ttsAudio.src && targetMp3 &&
        decodeURIComponent(_ttsAudio.src).indexOf(targetMp3) !== -1) {
      if (_ttsAudio.paused) {
        _ttsAudio.play();
        if (_musicAudio && _currentMusicFile) {
          try { _musicAudio.play().catch(function(){}); } catch(e){}
        }
        ttsSetIcon(btn, true);
        mediaBarSetState('playing');
        _setMediaSessionState('playing');
      } else {
        _ttsAudio.pause();
        if (_musicAudio) { try { _musicAudio.pause(); } catch(e){} }
        ttsSetIcon(btn, false);
        mediaBarSetState('paused');
        _setMediaSessionState('paused');
      }
      return;
    }
    // Stop any existing playback (clears timers + loading state too)
    ttsStop();
    _ttsBtn = btn;
    // Find reading block — either from avatar row or from the content area
    var block = btn.closest('.reading-block');
    if (!block) {
      // Media bar play — find the first reading block on the page
      var content = document.getElementById('content');
      block = content ? content.querySelector('.reading-block') : null;
    }
    if (!block) { _ttsBtn = null; return; }
    // Check for explicit MP3
    var mp3Url = btn.getAttribute('data-mp3-path') || '';
    if (!mp3Url) {
      var dlBtn = block.querySelector('.download-btn');
      mp3Url = dlBtn ? (dlBtn.getAttribute('data-mp3-path') || '') : '';
    }
    if (!mp3Url) { _ttsBtn = null; return; }

    // ── iOS gesture-unlock: must happen synchronously inside this click.
    // Always create the persistent _musicAudio element NOW so the music
    // checkbox can be toggled later without needing another tap. If the
    // user already has the music checkbox on, _startMusic() below will
    // swap a real src onto this element — also inside the gesture window
    // initially, then again later if we defer for bandwidth.
    _ensureMusicElement();

    btn.classList.add('tts-active');
    _loading = true;
    mediaBarSetState('loading');
    _setLoadingProgress(null); // indeterminate until we know duration

    // Apply reading volume and mute state
    var rdVolSlider = document.querySelector('.media-reading-volume');
    var rdVol = rdVolSlider ? parseInt(rdVolSlider.value, 10) / 100 : 1.0;
    var avVol = _getAvatarVolumeForReading(activeReadingIdx);
    rdVol = rdVol * avVol;
    var rdCb = document.querySelector('.media-reading-cb');
    var rdMuted = rdCb ? !rdCb.checked : false;

    var audio = new Audio();
    // preload='metadata' fetches headers (duration) without pulling the
    // whole file — important on cellular where reading is many MB.
    audio.preload = 'metadata';
    audio.volume = rdVol;
    audio.muted = rdMuted;

    // Track buffer % into the loading ring as it fills.
    audio.addEventListener('progress', function () {
      try {
        if (audio.buffered && audio.buffered.length && audio.duration) {
          var endSec = audio.buffered.end(audio.buffered.length - 1);
          _setLoadingProgress(endSec / audio.duration);
        }
      } catch(e){}
    });
    audio.addEventListener('loadedmetadata', function () {
      _setLoadingProgress(0);
    });

    // 'playing' fires the moment audio actually produces sound. That's
    // the true signal to drop the ring and switch to the EQ animation.
    audio.addEventListener('playing', function () {
      if (_ttsBtn !== btn) return;
      _clearLoadingState();
      mediaBarSetState('playing');
      // Lock-screen / CarPlay / BT controls — must be wired AFTER actual
      // playback has started so iOS attaches the session to this element.
      _wireMediaSessionActions();
      _setMediaSessionMetadata();
      _setMediaSessionState('playing');
    });

    // First time we have enough data to play through, wire everything up.
    audio.oncanplay = function () {
      if (_ttsBtn !== btn) return;
      if (_ttsAudio === audio) return; // prevent duplicate fires
      _ttsAudio = audio;
      _bindProgressSlider(audio);

      // Defer music start until reading has buffered ≥ 3s OR 1500ms,
      // whichever comes first. This avoids parallel-fetch starvation
      // on cellular: reading gets first bite of bandwidth, music
      // joins once the reading buffer is healthy.
      var prevMusic = _currentMusicFile;
      var startedMusicYet = false;
      function maybeStartMusic() {
        if (startedMusicYet) return;
        startedMusicYet = true;
        if (_musicGateTimer) { clearTimeout(_musicGateTimer); _musicGateTimer = null; }
        _startMusic();
        var hasMusic = !!_currentMusicFile;
        var musicChanged = (_currentMusicFile && _currentMusicFile !== prevMusic);
        if (_continuingPlayback || !hasMusic || !musicChanged) {
          _continuingPlayback = false;
          audio._introOffset = 0;
          if (audio.paused) audio.play().catch(function(){});
          ttsSetIcon(btn, true);
        } else {
          // Music just started fresh: voice waits ~4s of music intro.
          // Use a clock tied to actual _musicAudio.currentTime so a busy
          // mobile JS thread can't push it to 6+s like the old setTimeout.
          audio._introOffset = 4;
          audio._introStart = Date.now();
          ttsSetIcon(btn, true);
          if (_introTimer) clearInterval(_introTimer);
          _introTimer = setInterval(function () {
            if (_ttsBtn !== btn || _ttsAudio !== audio) {
              clearInterval(_introTimer); _introTimer = null; return;
            }
            var ct = (_musicAudio && _musicAudio.currentTime) || 0;
            // wall-clock fallback in case music never actually plays
            var wall = (Date.now() - audio._introStart) / 1000;
            if (ct >= 4 || wall >= 6) {
              clearInterval(_introTimer); _introTimer = null;
              if (audio.paused) audio.play().catch(function(){});
            }
          }, 100);
        }
      }
      // Try the buffer-based gate
      if (_musicGateTimer) clearTimeout(_musicGateTimer);
      _musicGateTimer = setTimeout(maybeStartMusic, 1500);
      var bufCheck = setInterval(function () {
        if (_ttsBtn !== btn || _ttsAudio !== audio) { clearInterval(bufCheck); return; }
        if (startedMusicYet) { clearInterval(bufCheck); return; }
        try {
          if (audio.buffered && audio.buffered.length) {
            var endSec = audio.buffered.end(audio.buffered.length - 1);
            if (endSec >= 3) { clearInterval(bufCheck); maybeStartMusic(); }
          }
        } catch(e){}
      }, 200);
    };
    audio.onended = function () { ttsOnEnded(); };
    audio.onerror = function () {
      _mediaToast('Unable to load reading. Tap play to retry.', 'error');
      ttsStop();
    };
    audio.src = mp3Url;
    audio.load();
    // iOS Safari requires audio.play() to be called synchronously within
    // the user gesture handler — async callbacks (oncanplay) are blocked.
    audio.play().catch(function () {});

    // Watchdog: if 'playing' never fires within 12s the network has
    // probably stalled. Surface a retry toast and reset the UI so the
    // user can tap again.
    if (_watchdogTimer) clearTimeout(_watchdogTimer);
    _watchdogTimer = setTimeout(function () {
      if (_ttsBtn !== btn) return;
      // Already playing? then loading state would have been cleared.
      if (!_loading) return;
      _mediaToast('Slow network. Tap play to retry.', 'error');
      ttsStop();
    }, 12000);
  }

  // Delegate TTS / media bar button clicks
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.tts-btn');
    if (btn) { e.preventDefault(); ttsToggle(btn); return; }

    // Skip ±15s buttons
    var skipBtn = e.target.closest('.media-skip-btn');
    if (skipBtn) {
      e.preventDefault();
      if (_ttsAudio) {
        var secs = parseInt(skipBtn.getAttribute('data-skip'), 10) || 0;
        _ttsAudio.currentTime = Math.max(0, Math.min(_ttsAudio.duration || 0, _ttsAudio.currentTime + secs));
      }
      return;
    }
    // Repeat button (toggle keep-reading)
    var repBtn = e.target.closest('.media-repeat-btn');
    if (repBtn) {
      e.preventDefault();
      repBtn.classList.toggle('active');
      var on = repBtn.classList.contains('active');
      try { localStorage.setItem('keepReading', on ? '1' : '0'); } catch(ex) {}
      return;
    }
  });
  // Volume slider
  var _syncAnchor = null; // { reading: val, music: val } — snapshot when sync starts
  document.addEventListener('input', function (e) {
    var isSynced = false;
    var syncCb = document.querySelector('.media-sync-cb');
    if (syncCb && syncCb.checked) isSynced = true;

    // Music volume slider
    if (e.target.classList.contains('media-volume')) {
      var val = parseInt(e.target.value, 10);
      e.target.style.setProperty('--vol-pct', val + '%');
      if (_musicAudio) _musicAudio.volume = val / 100;
      if (isSynced && _syncAnchor && _syncAnchor.music > 0) {
        var ratio = val / _syncAnchor.music;
        var newReading = Math.round(Math.min(100, Math.max(0, _syncAnchor.reading * ratio)));
        var rdSlider = document.querySelector('.media-reading-volume');
        if (rdSlider) {
          rdSlider.value = newReading;
          rdSlider.style.setProperty('--vol-pct', newReading + '%');
          if (_ttsAudio) _ttsAudio.volume = newReading / 100;
        }
      }
    }
    // Reading volume slider
    if (e.target.classList.contains('media-reading-volume')) {
      var val2 = parseInt(e.target.value, 10);
      e.target.style.setProperty('--vol-pct', val2 + '%');
      if (_ttsAudio) _ttsAudio.volume = val2 / 100;
      if (isSynced && _syncAnchor && _syncAnchor.reading > 0) {
        var ratio2 = val2 / _syncAnchor.reading;
        var newMusic = Math.round(Math.min(100, Math.max(0, _syncAnchor.music * ratio2)));
        var mSlider = document.querySelector('.media-volume');
        if (mSlider) {
          mSlider.value = newMusic;
          mSlider.style.setProperty('--vol-pct', newMusic + '%');
          if (_musicAudio) _musicAudio.volume = newMusic / 100;
        }
      }
    }
  });
  // Capture anchor values when sync is checked or when a drag starts while synced
  function _captureSyncAnchor() {
    var rdSlider = document.querySelector('.media-reading-volume');
    var mSlider = document.querySelector('.media-volume');
    _syncAnchor = {
      reading: rdSlider ? parseInt(rdSlider.value, 10) : 100,
      music: mSlider ? parseInt(mSlider.value, 10) : 10
    };
  }
  document.addEventListener('mousedown', function (e) {
    if (e.target.classList.contains('media-volume') || e.target.classList.contains('media-reading-volume')) {
      var syncCb = document.querySelector('.media-sync-cb');
      if (syncCb && syncCb.checked) _captureSyncAnchor();
    }
  });
  document.addEventListener('touchstart', function (e) {
    if (e.target.classList.contains('media-volume') || e.target.classList.contains('media-reading-volume')) {
      var syncCb = document.querySelector('.media-sync-cb');
      if (syncCb && syncCb.checked) _captureSyncAnchor();
    }
  });
  // Checkboxes — persist to localStorage
  document.addEventListener('change', function (e) {
    if (e.target.classList.contains('media-continuous-cb')) {
      try { localStorage.setItem('keepReading', e.target.checked ? '1' : '0'); } catch(ex) {}
    }
    if (e.target.classList.contains('media-music-cb')) {
      try { localStorage.setItem('musicEnabled', e.target.checked ? '1' : '0'); } catch(ex) {}
      if (_musicAudio) _musicAudio.muted = !e.target.checked;
    }
    if (e.target.classList.contains('media-reading-cb')) {
      try { localStorage.setItem('readingEnabled', e.target.checked ? '1' : '0'); } catch(ex) {}
      if (_ttsAudio) _ttsAudio.muted = !e.target.checked;
    }
    if (e.target.classList.contains('media-sync-cb')) {
      try { localStorage.setItem('syncEnabled', e.target.checked ? '1' : '0'); } catch(ex) {}
      if (e.target.checked) _captureSyncAnchor();
    }
  });
  // Initialize all checkboxes from localStorage on media bar render
  function _initMediaBarOptions() {
    var cb = document.querySelector('.media-continuous-cb');
    if (cb) {
      try { cb.checked = localStorage.getItem('keepReading') === '1'; } catch(ex) {}
    }
    var mcb = document.querySelector('.media-music-cb');
    if (mcb) {
      try { mcb.checked = localStorage.getItem('musicEnabled') === '1'; } catch(ex) {}
    }
    var rcb = document.querySelector('.media-reading-cb');
    if (rcb) {
      var readingOn = localStorage.getItem('readingEnabled');
      try { rcb.checked = readingOn === null ? true : readingOn === '1'; } catch(ex) {}
    }
    var scb = document.querySelector('.media-sync-cb');
    if (scb) {
      try { scb.checked = localStorage.getItem('syncEnabled') === '1'; } catch(ex) {}
    }
  }
  // Stop TTS on navigation
  window.addEventListener('hashchange', ttsStop);

  // Lightbox for welcome featured images (delegated)
  document.addEventListener('click', function (e) {
    var img = e.target.closest('.welcome-featured-img');
    if (!img) return;
    var container = img.closest('.welcome-featured');
    var imgs = container ? Array.from(container.querySelectorAll('.welcome-featured-img')) : [img];
    var count = imgs.length;
    var lbIdx = imgs.indexOf(img);
    if (lbIdx < 0) lbIdx = 0;
    var overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    var closeBtn = document.createElement('button');
    closeBtn.className = 'lightbox-close';
    closeBtn.innerHTML = '&times;';
    var bigImg = document.createElement('img');
    bigImg.src = imgs[lbIdx].src;
    bigImg.addEventListener('click', function (ev) { ev.stopPropagation(); });
    overlay.appendChild(closeBtn);
    var lbPrev, lbNext;
    if (count > 1) {
      lbPrev = document.createElement('button');
      lbPrev.className = 'lightbox-arrow lightbox-prev';
      lbPrev.innerHTML = '&#8249;';
      overlay.appendChild(lbPrev);
    }
    overlay.appendChild(bigImg);
    if (count > 1) {
      lbNext = document.createElement('button');
      lbNext.className = 'lightbox-arrow lightbox-next';
      lbNext.innerHTML = '&#8250;';
      overlay.appendChild(lbNext);
    }
    document.body.appendChild(overlay);
    function updateLb() { bigImg.src = imgs[lbIdx].src; }
    function closeLightbox() { document.body.removeChild(overlay); document.removeEventListener('keydown', onKey); }
    if (count > 1) {
      lbPrev.addEventListener('click', function (ev) { ev.stopPropagation(); lbIdx = (lbIdx - 1 + count) % count; updateLb(); });
      lbNext.addEventListener('click', function (ev) { ev.stopPropagation(); lbIdx = (lbIdx + 1) % count; updateLb(); });
    }
    overlay.addEventListener('click', closeLightbox);
    closeBtn.addEventListener('click', function (ev) { ev.stopPropagation(); closeLightbox(); });
    function onKey(ev) {
      if (ev.key === 'Escape') closeLightbox();
      if (ev.key === 'ArrowLeft' && count > 1) { lbIdx = (lbIdx - 1 + count) % count; updateLb(); }
      if (ev.key === 'ArrowRight' && count > 1) { lbIdx = (lbIdx + 1) % count; updateLb(); }
    }
    document.addEventListener('keydown', onKey);
  });

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
      if (_publishedMode) return;
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
    Promise.all([
      fetch(nocache('books.json')).then(function (r) { return r.json(); }),
      fetch(nocache('avatars.json')).then(function (r) { return r.json(); })
    ])
      .then(function (results) {
        books = results[0];
        avatars = results[1];
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
        console.error('Failed to reload books/avatars:', err);
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
    // Welcome book uses avatar properties instead of chapter properties
    if (activeBook && activeBook.folder === '0-Welcome') {
      var avMatch = (target.chapterFolder || '').match(/^\d+-([A-Za-z]\w*)/);
      if (avMatch) {
        openAvatarPropertiesModal(avMatch[1], target.bookFolder, target.chapterFolder);
        return;
      }
    }
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
    var raw = (data.content || '').replace(/^\uFEFF/, '').replace(/\r/g, '');
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
      'source':       { label: 'Source Folder', field: 'text', scope: 'chapter|reading' },
      'music':        { label: 'Music', field: 'music', scope: 'chapter' }
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

    // For chapter type, ensure all chapter-scope meta keys are shown
    if (type === 'chapter') {
      var chKeys = Object.keys(META_KEYS).filter(function (k) {
        return META_KEYS[k].scope.indexOf('chapter') !== -1;
      });
      for (var ck = 0; ck < chKeys.length; ck++) {
        var chFound = metaEntries.some(function (e) { return e.key === chKeys[ck]; });
        if (!chFound) metaEntries.push({ key: chKeys[ck], value: '' });
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
      } else if (spec.field === 'music') {
        input = document.createElement('select');
        input.className = 'props-field-select';
        var mNone = document.createElement('option');
        mNone.value = '';
        mNone.textContent = '(none)';
        if (!entry.value) mNone.selected = true;
        input.appendChild(mNone);
        // Load music files async
        (function (sel, curVal) {
          fetch('/list-music').then(function (r) { return r.json(); }).then(function (d) {
            (d.files || []).forEach(function (f) {
              var o = document.createElement('option');
              o.value = f;
              o.textContent = f.replace(/\.mp3$/i, '');
              if (f === curVal) o.selected = true;
              sel.appendChild(o);
            });
          }).catch(function () {});
        })(input, entry.value);
      } else if (spec.field === 'voice') {
        input = document.createElement('select');
        input.className = 'props-field-select';
        input.style.flex = '1';
        var vNone = document.createElement('option');
        vNone.value = '';
        vNone.textContent = '(none)';
        if (!entry.value) vNone.selected = true;
        input.appendChild(vNone);
        // Load processed voices from _voices/ folder
        var _voiceBookFolder = bookFolder;
        var _voiceSection = section;
        var _voiceChapterFolder = chapterFolder;
        (function (sel, curVal) {
          var vParams = 'bookFolder=' + encodeURIComponent(bookFolder)
            + '&chapterFolder=' + encodeURIComponent(chapterFolder);
          if (section) vParams += '&section=' + encodeURIComponent(section);
          fetch('/list-processed-voices?' + vParams).then(function (r) { return r.json(); }).then(function (d) {
            (d.voices || []).forEach(function (v) {
              var o = document.createElement('option');
              o.value = v.name;
              o.textContent = v.name;
              if (v.name === curVal) o.selected = true;
              sel.appendChild(o);
            });
          }).catch(function () {});
        })(input, entry.value);
        // Wrap in a row with a play button
        var voiceRow = document.createElement('div');
        voiceRow.style.display = 'flex';
        voiceRow.style.alignItems = 'center';
        voiceRow.style.gap = '6px';
        voiceRow.style.flex = '1';
        voiceRow.appendChild(input);
        var playBtn = document.createElement('button');
        playBtn.type = 'button';
        playBtn.textContent = '\u25B6';
        playBtn.title = 'Preview voice';
        playBtn.style.cssText = 'padding:4px 10px;cursor:pointer;border:1px solid #ccc;border-radius:4px;background:#f5f5f5;font-size:14px;';
        var _voiceAudio = null;
        playBtn.addEventListener('click', function () {
          var selVoice = input.value;
          if (!selVoice) return;
          // Stop any currently playing preview
          if (_voiceAudio) { _voiceAudio.pause(); _voiceAudio = null; playBtn.textContent = '\u25B6'; }
          var safeName = selVoice.replace(/[^\w\s\-]/g, '').trim().replace(/ /g, '_');
          var baseParts = ['../BooksOut', _voiceBookFolder];
          if (_voiceSection) baseParts.push(_voiceSection);
          baseParts.push(_voiceChapterFolder, '_voices', safeName + '.mp3');
          var mp3Url = baseParts.join('/');
          _voiceAudio = new Audio(mp3Url);
          _voiceAudio.volume = 0.8;
          playBtn.textContent = '\u25A0';
          _voiceAudio.onended = function () { playBtn.textContent = '\u25B6'; _voiceAudio = null; };
          _voiceAudio.onerror = function () { playBtn.textContent = '\u25B6'; _voiceAudio = null; };
          _voiceAudio.play().catch(function () { playBtn.textContent = '\u25B6'; });
        });
        voiceRow.appendChild(playBtn);
        // Replace input with the wrapper row for layout
        fieldInputs[entry.key] = input;
        row.appendChild(voiceRow);
        form.appendChild(row);
        continue; // skip the default append below
      } else if (spec.field === 'speed') {
        input = document.createElement('select');
        input.className = 'props-field-select';
        for (var sp = -25; sp <= 25; sp += 5) {
          var spOpt = document.createElement('option');
          var spLabel = sp === 0 ? '0%' : (sp > 0 ? '+' + sp + '%' : sp + '%');
          spOpt.value = spLabel;
          spOpt.textContent = spLabel;
          var curSpeed = entry.value || '0%';
          // Handle legacy '100%' format → '0%'
          if (curSpeed === '100%') curSpeed = '0%';
          if (curSpeed === spLabel) spOpt.selected = true;
          input.appendChild(spOpt);
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

    // Reading titles are no longer shown in the chapter properties dialog

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

  /* ══════════════════════════════════════════════════════════════════
   *  AVATAR PROPERTIES MODAL — Show/edit avatar .properties
   * ══════════════════════════════════════════════════════════════════ */
  function openAvatarPropertiesModal(avatarId, bookFolder, chapterFolder) {
    fetch('/get-avatar-properties?avatarId=' + encodeURIComponent(avatarId))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) { alert('Could not load avatar properties: ' + data.error); return; }
        _showAvatarPropertiesModal(avatarId, bookFolder, chapterFolder, data);
      })
      .catch(function (err) { alert('Error: ' + err.message); });
  }

  function _showAvatarPropertiesModal(avatarId, bookFolder, chapterFolder, data) {
    var old = document.querySelector('.props-overlay');
    if (old) old.parentNode.removeChild(old);

    var overlay = document.createElement('div');
    overlay.className = 'props-overlay';

    var modal = document.createElement('div');
    modal.className = 'props-modal';

    // Title
    var title = document.createElement('div');
    title.className = 'props-modal-title';
    title.textContent = 'Avatar Properties';
    modal.appendChild(title);

    // Path subtitle
    var sub = document.createElement('div');
    sub.className = 'props-modal-path';
    sub.textContent = 'Avatars/' + avatarId;
    modal.appendChild(sub);

    // Parse content
    var raw = (data.content || '').replace(/^\uFEFF/, '').replace(/^\uFEFF/, '').replace(/\r/g, '');
    var lines = raw.split('\n');
    var props = {};
    var propOrder = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line.trim()) continue;
      var tabIdx = line.indexOf('\t');
      var key, val;
      if (tabIdx === -1) {
        key = line.trim(); val = '';
      } else {
        key = line.substring(0, tabIdx); val = line.substring(tabIdx + 1);
      }
      props[key] = val;
      propOrder.push(key);
    }

    // ── Crop section ──
    var _avObj = avatars[avatarId] || {};
    var _imgUrl = _avObj.image || ('../Avatars/' + avatarId + '/' + avatarId + '.jpg');
    var _crRaw = props['crop'] || _avObj.crop || '50% 50% 100%';
    var _crParts = _crRaw.trim().split(/\s+/);
    var _cx = parseFloat(_crParts[0]) || 50;
    var _cy = parseFloat(_crParts[1]) || 50;
    var _cz = parseFloat(_crParts[2]) || 100;

    var cropSection = document.createElement('div');
    cropSection.className = 'props-crop-section';

    var cropPreview = document.createElement('div');
    cropPreview.className = 'props-crop-preview';
    cropPreview.style.backgroundImage = 'url("' + _imgUrl + '")';
    cropPreview.style.backgroundSize = _cz + '%';
    cropPreview.style.backgroundPosition = _cx + '% ' + _cy + '%';
    cropSection.appendChild(cropPreview);

    var cropZoomRow = document.createElement('div');
    cropZoomRow.className = 'props-crop-zoom-row';
    var cropZoomLbl = document.createElement('label');
    cropZoomLbl.textContent = 'Zoom ';
    var cropZoomSlider = document.createElement('input');
    cropZoomSlider.type = 'range';
    cropZoomSlider.min = '100';
    cropZoomSlider.max = '600';
    cropZoomSlider.step = '10';
    cropZoomSlider.value = String(Math.round(_cz));
    cropZoomLbl.appendChild(cropZoomSlider);
    cropZoomRow.appendChild(cropZoomLbl);
    var cropZoomVal = document.createElement('span');
    cropZoomVal.textContent = Math.round(_cz) + '%';
    cropZoomRow.appendChild(cropZoomVal);
    cropSection.appendChild(cropZoomRow);

    var cropOutput = document.createElement('div');
    cropOutput.className = 'props-crop-output';
    var cropCode = document.createElement('code');
    cropCode.textContent = Math.round(_cx) + '% ' + Math.round(_cy) + '% ' + Math.round(_cz) + '%';
    cropOutput.appendChild(cropCode);
    cropSection.appendChild(cropOutput);

    modal.appendChild(cropSection);

    // Drag-to-pan
    var _dragActive = false;
    var _dragStartX = 0, _dragStartY = 0;
    var _dragStartCx = _cx, _dragStartCy = _cy;

    function _updateCropPreview() {
      cropPreview.style.backgroundSize = _cz + '%';
      cropPreview.style.backgroundPosition = _cx + '% ' + _cy + '%';
      cropZoomVal.textContent = Math.round(_cz) + '%';
      cropZoomSlider.value = String(Math.round(_cz));
      cropCode.textContent = Math.round(_cx) + '% ' + Math.round(_cy) + '% ' + Math.round(_cz) + '%';
    }

    cropPreview.addEventListener('mousedown', function(e) {
      e.preventDefault();
      _dragActive = true;
      _dragStartX = e.clientX;
      _dragStartY = e.clientY;
      _dragStartCx = _cx;
      _dragStartCy = _cy;
      cropPreview.classList.add('dragging');
    });
    var _cropMouseMove = function(e) {
      if (!_dragActive) return;
      var dx = e.clientX - _dragStartX;
      var dy = e.clientY - _dragStartY;
      _cx = Math.max(0, Math.min(100, _dragStartCx - dx * 0.5));
      _cy = Math.max(-200, Math.min(100, _dragStartCy - dy * 0.5));
      _updateCropPreview();
    };
    var _cropMouseUp = function() {
      if (_dragActive) { _dragActive = false; cropPreview.classList.remove('dragging'); }
    };
    document.addEventListener('mousemove', _cropMouseMove);
    document.addEventListener('mouseup', _cropMouseUp);

    cropZoomSlider.addEventListener('input', function() {
      _cz = parseInt(cropZoomSlider.value);
      _updateCropPreview();
    });

    // Cleanup drag listeners when modal closes
    function _removeCropListeners() {
      document.removeEventListener('mousemove', _cropMouseMove);
      document.removeEventListener('mouseup', _cropMouseUp);
    }

    // Avatar fields to show
    var AVATAR_FIELDS = [
      { key: 'name',   label: 'Name',        field: 'text' },
      { key: 'title',  label: 'Title',       field: 'text' },
      { key: 'teaser', label: 'Description', field: 'textarea' },
      { key: 'voice',  label: 'Voice',       field: 'voice-tts' },
      { key: 'speed', label: 'Speed', field: 'speed' },
      { key: 'pitch', label: 'Pitch', field: 'pitch' },
      { key: 'volume', label: 'Volume', field: 'volume' },
      { key: 'music', label: 'Music', field: 'music' }
    ];

    var form = document.createElement('div');
    form.className = 'props-form';

    var fieldInputs = {};

    for (var f = 0; f < AVATAR_FIELDS.length; f++) {
      var spec = AVATAR_FIELDS[f];
      var row = document.createElement('div');
      row.className = 'props-field-row';

      var lbl = document.createElement('label');
      lbl.className = 'props-field-label';
      lbl.textContent = spec.label;
      row.appendChild(lbl);

      var input;
      var curVal = props[spec.key] || '';

      if (spec.field === 'voice-tts') {
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
          { label: 'Mitchell (NZ)', value: 'en-NZ-MitchellNeural' }
        ];
        input = document.createElement('select');
        input.className = 'props-field-select';
        var ttsNone = document.createElement('option');
        ttsNone.value = '';
        ttsNone.textContent = '(default)';
        if (!curVal) ttsNone.selected = true;
        input.appendChild(ttsNone);
        for (var tv = 0; tv < ttsVoices.length; tv++) {
          var tvOpt = document.createElement('option');
          if (ttsVoices[tv].disabled) {
            tvOpt.disabled = true;
            tvOpt.textContent = ttsVoices[tv].label;
          } else {
            tvOpt.value = ttsVoices[tv].value;
            tvOpt.textContent = ttsVoices[tv].label;
            if (ttsVoices[tv].value === curVal) tvOpt.selected = true;
          }
          input.appendChild(tvOpt);
        }
        // Wrap in a row with a preview button
        var ttsRow = document.createElement('div');
        ttsRow.style.cssText = 'display:flex;align-items:center;gap:6px;flex:1;';
        ttsRow.appendChild(input);
        var _ttsPreviewAudio = null;
        var _ttsPreviewAbort = null;
        var ttsPreviewBtn = document.createElement('button');
        ttsPreviewBtn.type = 'button';
        ttsPreviewBtn.className = 'props-voice-preview-btn';
        ttsPreviewBtn.textContent = '\u25B6';
        ttsPreviewBtn.title = 'Preview TTS voice';
        ttsPreviewBtn.addEventListener('click', function() {
          if (_ttsPreviewAudio && !_ttsPreviewAudio.paused) {
            _ttsPreviewAudio.pause(); _ttsPreviewAudio = null;
            ttsPreviewBtn.textContent = '\u25B6'; return;
          }
          if (_ttsPreviewAbort) { _ttsPreviewAbort.abort(); _ttsPreviewAbort = null; }
          var v = input.value || 'en-US-AvaNeural';
          ttsPreviewBtn.textContent = '\u23F3';
          _ttsPreviewAbort = new AbortController();
          fetch('/tts-preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: 'No one knows better than I what the Cross of Christ means.', voice: v, speed: 0, pitch: 0 }),
            signal: _ttsPreviewAbort.signal
          })
          .then(function(r) { if (!r.ok) throw new Error('TTS failed'); return r.blob(); })
          .then(function(blob) {
            var url = URL.createObjectURL(blob);
            _ttsPreviewAudio = new Audio(url);
            _ttsPreviewAudio.onended = function() { ttsPreviewBtn.textContent = '\u25B6'; URL.revokeObjectURL(url); _ttsPreviewAudio = null; };
            _ttsPreviewAudio.play();
            ttsPreviewBtn.textContent = '\u25A0';
          })
          .catch(function(err) {
            if (err.name !== 'AbortError') { ttsPreviewBtn.textContent = '\u25B6'; }
          });
        });
        ttsRow.appendChild(ttsPreviewBtn);
        fieldInputs[spec.key] = input;
        row.appendChild(ttsRow);
        form.appendChild(row);
        continue;
      } else if (spec.field === 'speed' || spec.field === 'pitch') {
        input = document.createElement('select');
        input.className = 'props-field-select';
        for (var sp = -35; sp <= 25; sp += 5) {
          var spOpt = document.createElement('option');
          var spLabel = sp === 0 ? '0' : String(sp);
          spOpt.value = spLabel;
          spOpt.textContent = spLabel;
          if (curVal === spLabel || curVal === spLabel + '%') spOpt.selected = true;
          input.appendChild(spOpt);
        }
        // If current value not in range, add it
        if (curVal && !input.querySelector('option[selected]')) {
          var customOpt = document.createElement('option');
          customOpt.value = curVal;
          customOpt.textContent = curVal;
          customOpt.selected = true;
          input.insertBefore(customOpt, input.firstChild);
        }
      } else if (spec.field === 'volume') {
        input = document.createElement('select');
        input.className = 'props-field-select';
        var volOpts = [['', '100% (default)']];
        for (var vp = 100; vp >= 10; vp -= 10) {
          volOpts.push([String(vp), vp + '%']);
        }
        var cvNorm = (curVal || '').replace('%', '').trim();
        for (var vi = 0; vi < volOpts.length; vi++) {
          var vOpt = document.createElement('option');
          vOpt.value = volOpts[vi][0];
          vOpt.textContent = volOpts[vi][1];
          if (cvNorm === volOpts[vi][0] || (volOpts[vi][0] === '' && !cvNorm)) vOpt.selected = true;
          input.appendChild(vOpt);
        }
      } else if (spec.field === 'music') {
        input = document.createElement('select');
        input.className = 'props-field-select';
        var mNone = document.createElement('option');
        mNone.value = '';
        mNone.textContent = '(none)';
        if (!curVal) mNone.selected = true;
        input.appendChild(mNone);
        (function (sel, cv) {
          fetch('/list-music').then(function (r) { return r.json(); }).then(function (d) {
            (d.files || []).forEach(function (mf) {
              var o = document.createElement('option');
              o.value = mf;
              o.textContent = mf.replace(/\.mp3$/i, '');
              if (mf === cv) o.selected = true;
              sel.appendChild(o);
            });
          }).catch(function () {});
        })(input, curVal);
      } else if (spec.field === 'textarea') {
        input = document.createElement('textarea');
        input.className = 'props-field-textarea';
        input.value = curVal;
        input.rows = 8;
      } else {
        input = document.createElement('input');
        input.type = 'text';
        input.className = 'props-field-input';
        input.value = curVal;
      }

      fieldInputs[spec.key] = input;
      row.appendChild(input);
      form.appendChild(row);
    }

    modal.appendChild(form);

    // Actions
    var actions = document.createElement('div');
    actions.className = 'modal-actions';

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'book-props-btn cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function () {
      _removeCropListeners();
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

      // Build new crop value from drag UI
      var newCropVal = Math.round(_cx) + '% ' + Math.round(_cy) + '% ' + Math.round(_cz) + '%';

      // Rebuild full .properties preserving all original keys
      var outputLines = [];
      var writtenKeys = {};
      // Write in original order, updating known fields
      for (var oi = 0; oi < propOrder.length; oi++) {
        var k = propOrder[oi];
        if (k === 'crop') {
          outputLines.push('crop\t' + newCropVal);
        } else if (fieldInputs[k]) {
          var v = fieldInputs[k].tagName === 'SELECT' ? fieldInputs[k].value : fieldInputs[k].value;
          outputLines.push(k + '\t' + v);
        } else {
          outputLines.push(k + '\t' + (props[k] || ''));
        }
        writtenKeys[k] = true;
      }
      // Add any new fields that weren't in the original
      var fkeys = Object.keys(fieldInputs);
      for (var ni = 0; ni < fkeys.length; ni++) {
        if (!writtenKeys[fkeys[ni]]) {
          var nv = fieldInputs[fkeys[ni]].tagName === 'SELECT' ? fieldInputs[fkeys[ni]].value : fieldInputs[fkeys[ni]].value;
          if (nv) outputLines.push(fkeys[ni] + '\t' + nv);
        }
      }
      // If crop was never in the original file, append it
      if (!writtenKeys['crop']) {
        outputLines.push('crop\t' + newCropVal);
      }
      var content = outputLines.join('\n') + '\n';

      fetch('/save-avatar-properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatarId: avatarId,
          content: content
        })
      })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.error) {
          alert('Save failed: ' + res.error);
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save';
          cancelBtn.disabled = false;
          return;
        }
        // Also save pre-cropped JPEG images
        return fetch('/save-avatar-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatarId: avatarId, crop: newCropVal })
        }).then(function(r2) { return r2.json(); }).then(function(img) {
          if (img.error) console.warn('[save-avatar-images]', img.error);
          _removeCropListeners();
          overlay.parentNode.removeChild(overlay);
          reloadBooksAndRefresh();
        });
      })
      .catch(function (err) {
        alert('Save failed: ' + err.message);
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
        cancelBtn.disabled = false;
      });
    });
    actions.appendChild(saveBtn);
    modal.appendChild(actions);
    overlay.appendChild(modal);

    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay) { _removeCropListeners(); overlay.parentNode.removeChild(overlay); }
    });

    document.body.appendChild(overlay);
  }

  // ── Event delegation: right-click on reading index links in content area ──
  document.getElementById('content').addEventListener('contextmenu', function (e) {
    if (_publishedMode) return;
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

  /* ══════════════════════════════════════════════════════════════════
   *  READING BODY CONTEXT MENU — Right-click on reading body text
   *  Shows: Edit Text, Edit Image (hidden on Welcome book)
   * ══════════════════════════════════════════════════════════════════ */

  var _bodyCtxMenu = (function () {
    var menu = document.createElement('div');
    menu.id = 'body-ctx-menu';
    var items = [
      { id: 'body-ctx-edit-text', icon: '📝', label: 'Edit Text' },
      { id: 'body-ctx-edit-image', icon: '🖼️', label: 'Edit Image' }
    ];
    items.forEach(function (item) {
      var div = document.createElement('div');
      div.className = 'ctx-item';
      div.id = item.id;
      div.innerHTML = '<span>' + item.icon + '</span><span>' + item.label + '</span>';
      menu.appendChild(div);
    });
    document.body.appendChild(menu);
    return menu;
  })();

  var _bodyCtxRd = null; // current reading object for body context menu

  function showBodyCtxMenu(x, y, rd) {
    _bodyCtxRd = rd;
    // Hide Edit Image on Welcome book
    var imgItem = document.getElementById('body-ctx-edit-image');
    if (imgItem) imgItem.style.display = (activeBook && activeBook.num === 0) ? 'none' : '';

    _bodyCtxMenu.style.display = 'block';
    var menuW = _bodyCtxMenu.offsetWidth;
    var menuH = _bodyCtxMenu.offsetHeight;
    var left = x + menuW > window.innerWidth ? window.innerWidth - menuW - 4 : x;
    var top = y + menuH > window.innerHeight ? window.innerHeight - menuH - 4 : y;
    _bodyCtxMenu.style.left = left + 'px';
    _bodyCtxMenu.style.top = top + 'px';
  }

  function hideBodyCtxMenu() {
    _bodyCtxMenu.style.display = 'none';
    _bodyCtxRd = null;
  }

  document.addEventListener('mousedown', function (e) {
    if (_bodyCtxMenu.style.display === 'block' && !_bodyCtxMenu.contains(e.target)) hideBodyCtxMenu();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') hideBodyCtxMenu();
  });

  // Attach body context menu via event delegation on #content
  document.getElementById('content').addEventListener('contextmenu', function (e) {
    if (!window.currentUser || !window.currentUser.isAdmin) return;
    // Only on reading-body or its children, but not on index links (handled above)
    var bodyEl = e.target.closest('.reading-body');
    if (!bodyEl) return;
    // Don't intercept if the existing reading context menu is target
    if (e.target.closest('.reading-index-link')) return;

    e.preventDefault();
    e.stopPropagation();

    // Find the current reading
    var rd = null;
    if (viewMode === 'book' && activeReadingIdx >= 0 && flatReadings[activeReadingIdx]) {
      rd = flatReadings[activeReadingIdx].rd;
    } else if (viewMode === 'chapter') {
      // In chapter view, find which reading block was clicked
      var block = bodyEl.closest('.reading-block');
      if (block) {
        var dlBtn = block.querySelector('.download-btn[data-download-path]');
        if (dlBtn) {
          var dlPath = dlBtn.getAttribute('data-download-path');
          // Match by path
          for (var i = 0; i < flatReadings.length; i++) {
            if (booksOutUrl(flatReadings[i].rd.path) === dlPath) {
              rd = flatReadings[i].rd;
              break;
            }
          }
        }
      }
    }
    if (!rd) return;
    showBodyCtxMenu(e.clientX, e.clientY, rd);
  });

  document.getElementById('body-ctx-edit-text').addEventListener('click', function () {
    if (!_bodyCtxRd) return;
    var rd = _bodyCtxRd;
    hideBodyCtxMenu();
    openEditTextModal(rd);
  });

  document.getElementById('body-ctx-edit-image').addEventListener('click', function () {
    if (!_bodyCtxRd) return;
    var rd = _bodyCtxRd;
    hideBodyCtxMenu();
    openEditImageModal(rd);
  });

  /* ══════════════════════════════════════════════════════════════════
   *  EDIT TEXT MODAL — Full reading text editor with history
   * ══════════════════════════════════════════════════════════════════ */

  function openEditTextModal(rd) {
    var old = document.querySelector('.edit-text-overlay');
    if (old) old.parentNode.removeChild(old);

    var overlay = document.createElement('div');
    overlay.className = 'edit-text-overlay';

    var modal = document.createElement('div');
    modal.className = 'edit-text-modal';

    // Title bar
    var titleBar = document.createElement('div');
    titleBar.className = 'edit-text-title';
    titleBar.textContent = 'Edit Reading — ' + (rd.displayTitle || rd.path);
    modal.appendChild(titleBar);

    // Main body: textarea + optional history panel
    var body = document.createElement('div');
    body.className = 'edit-text-body';

    var textarea = document.createElement('textarea');
    textarea.className = 'edit-text-area';
    textarea.spellcheck = false;
    textarea.placeholder = 'Loading...';
    textarea.disabled = true;
    body.appendChild(textarea);

    // History panel (hidden by default)
    var historyPanel = document.createElement('div');
    historyPanel.className = 'edit-text-history';
    historyPanel.style.display = 'none';
    var historyTitle = document.createElement('div');
    historyTitle.className = 'edit-text-history-title';
    historyTitle.textContent = 'History';
    historyPanel.appendChild(historyTitle);
    var historyList = document.createElement('div');
    historyList.className = 'edit-text-history-list';
    historyPanel.appendChild(historyList);
    body.appendChild(historyPanel);

    modal.appendChild(body);

    // Actions bar
    var actions = document.createElement('div');
    actions.className = 'edit-text-actions';

    var historyBtn = document.createElement('button');
    historyBtn.className = 'book-props-btn history';
    historyBtn.textContent = 'History';
    historyBtn.addEventListener('click', function () {
      if (historyPanel.style.display === 'none') {
        historyPanel.style.display = '';
        historyBtn.textContent = 'Hide History';
        loadHistory(rd.path, historyList, textarea);
      } else {
        historyPanel.style.display = 'none';
        historyBtn.textContent = 'History';
      }
    });
    actions.appendChild(historyBtn);

    var spacer = document.createElement('div');
    spacer.style.flex = '1';
    actions.appendChild(spacer);

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
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
      fetch('/save-reading-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readingPath: rd.path, text: textarea.value })
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
        // Clear cached content and re-render
        rd._content = null;
        if (viewMode === 'book') selectReading(activeReadingIdx);
        else if (viewMode === 'chapter') showChapter(activeChapterIdx);
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

    // Load the current text
    loadReadingText(rd).then(function (text) {
      textarea.value = text;
      textarea.disabled = false;
      textarea.focus();
    }).catch(function () {
      textarea.placeholder = 'Failed to load text.';
    });
  }

  function loadHistory(readingPath, listEl, textarea) {
    listEl.innerHTML = '<div class="edit-text-history-loading">Loading...</div>';
    fetch('/reading-history?path=' + encodeURIComponent(readingPath))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        listEl.innerHTML = '';
        if (!data.entries || !data.entries.length) {
          listEl.innerHTML = '<div class="edit-text-history-empty">No history yet</div>';
          return;
        }
        data.entries.forEach(function (entry) {
          var row = document.createElement('div');
          row.className = 'edit-text-history-entry';

          var info = document.createElement('div');
          info.className = 'edit-text-history-info';
          info.innerHTML = '<span class="edit-text-history-date">' + escHtml(entry.display) + '</span>' +
            '<span class="edit-text-history-size">' + Math.round(entry.size / 1024) + ' KB</span>';
          row.appendChild(info);

          var btns = document.createElement('div');
          btns.className = 'edit-text-history-btns';

          var previewBtn = document.createElement('button');
          previewBtn.className = 'book-props-btn';
          previewBtn.textContent = 'Preview';
          previewBtn.addEventListener('click', function () {
            previewBtn.disabled = true;
            previewBtn.textContent = '...';
            // Read the history file content by fetching it
            var histDir = readingPath.replace(/[^/]+$/, '') + '.history/' + entry.filename;
            fetch(nocache(booksOutUrl(histDir)))
              .then(function (r) { return r.arrayBuffer(); })
              .then(function (buf) { return decodeText(buf); })
              .then(function (text) {
                textarea.value = text;
                previewBtn.disabled = false;
                previewBtn.textContent = 'Preview';
              })
              .catch(function () {
                previewBtn.disabled = false;
                previewBtn.textContent = 'Preview';
                alert('Failed to load history version');
              });
          });
          btns.appendChild(previewBtn);

          var restoreBtn = document.createElement('button');
          restoreBtn.className = 'book-props-btn save';
          restoreBtn.textContent = 'Restore';
          restoreBtn.addEventListener('click', function () {
            restoreBtn.disabled = true;
            restoreBtn.textContent = '...';
            fetch('/restore-reading', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ readingPath: readingPath, historyFile: entry.filename })
            })
            .then(function (r) { return r.json(); })
            .then(function (data) {
              if (data.error) {
                alert('Restore failed: ' + data.error);
                restoreBtn.disabled = false;
                restoreBtn.textContent = 'Restore';
                return;
              }
              // Close modal and refresh
              var ov = document.querySelector('.edit-text-overlay');
              if (ov) ov.parentNode.removeChild(ov);
              var rd = flatReadings[activeReadingIdx] ? flatReadings[activeReadingIdx].rd : null;
              if (rd) rd._content = null;
              if (viewMode === 'book') selectReading(activeReadingIdx);
              else if (viewMode === 'chapter') showChapter(activeChapterIdx);
            })
            .catch(function (err) {
              alert('Restore failed: ' + err.message);
              restoreBtn.disabled = false;
              restoreBtn.textContent = 'Restore';
            });
          });
          btns.appendChild(restoreBtn);

          row.appendChild(btns);
          listEl.appendChild(row);
        });
      })
      .catch(function () {
        listEl.innerHTML = '<div class="edit-text-history-empty">Failed to load history</div>';
      });
  }

  /* ══════════════════════════════════════════════════════════════════
   *  EDIT IMAGE MODAL — Upload/replace the single image per reading
   * ══════════════════════════════════════════════════════════════════ */

  function openEditImageModal(rd) {
    var old = document.querySelector('.edit-image-overlay');
    if (old) old.parentNode.removeChild(old);

    var overlay = document.createElement('div');
    overlay.className = 'edit-image-overlay';

    var modal = document.createElement('div');
    modal.className = 'edit-image-modal';

    var titleBar = document.createElement('div');
    titleBar.className = 'edit-text-title';
    titleBar.textContent = 'Edit Image — ' + (rd.displayTitle || rd.path);
    modal.appendChild(titleBar);

    // Current image preview
    var previewArea = document.createElement('div');
    previewArea.className = 'edit-image-preview';
    var currentImages = rd.images || [];
    if (currentImages.length) {
      var img = document.createElement('img');
      img.src = booksOutUrl(currentImages[0]);
      img.alt = 'Current image';
      previewArea.appendChild(img);
    } else {
      previewArea.innerHTML = '<div class="edit-image-none">No image</div>';
    }
    modal.appendChild(previewArea);

    // File input
    var inputRow = document.createElement('div');
    inputRow.className = 'edit-image-input-row';
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.jpg,.jpeg,.png,.webp';
    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files[0]) {
        var reader = new FileReader();
        reader.onload = function (ev) {
          previewArea.innerHTML = '';
          var img = document.createElement('img');
          img.src = ev.target.result;
          img.alt = 'New image preview';
          previewArea.appendChild(img);
        };
        reader.readAsDataURL(fileInput.files[0]);
      }
    });
    inputRow.appendChild(fileInput);
    modal.appendChild(inputRow);

    // Actions
    var actions = document.createElement('div');
    actions.className = 'edit-text-actions';

    var spacer = document.createElement('div');
    spacer.style.flex = '1';
    actions.appendChild(spacer);

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
      if (!fileInput.files || !fileInput.files[0]) {
        alert('Please select an image file.');
        return;
      }
      saveBtn.disabled = true;
      saveBtn.textContent = 'Uploading...';

      var formData = new FormData();
      formData.append('readingPath', rd.path);
      formData.append('image', fileInput.files[0]);

      fetch('/save-reading-image', {
        method: 'POST',
        body: formData
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) {
          alert('Upload failed: ' + data.error);
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save';
          return;
        }
        overlay.parentNode.removeChild(overlay);
        reloadBooksAndRefresh();
      })
      .catch(function (err) {
        alert('Upload failed: ' + err.message);
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

})();
