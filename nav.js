/*  nav.js  –  Builds top-nav + sidebar from _categorized.txt
 *  ─────────────────────────────────────────────────────────
 *  Include this script in every chapter page:
 *     <script src="nav.js" defer></script>
 *
 *  It expects:
 *   • <nav class="top-nav" id="top-nav"></nav>          (filled automatically)
 *   • <div class="sidebar" id="sidebar"></div>           (filled automatically)
 *   • <script> window.PAGE_FILE = '1-creation.html'; </script>  (set per page)
 *
 *  It fetches ../_categorized.txt (one level up from Site/), parses the
 *  book sections, and renders links into both containers.
 */

(function () {
  'use strict';

  /* ── First-chapter lookup so top-nav links work ── */
  var BOOK_FIRST = {};   // { 'Warnings from Beyond': '1-prayers-before-...' }

  /* ── Short labels for the top-nav bar ── */
  var SHORT_LABELS = {
    'Warnings from Beyond':                   'Warnings',
    'Visions of Catherine and Mary':          'Catherine and Mary',
    'Book 1 – The Visions of Catherine and Mary': 'Catherine and Mary',
    'Book 2 - The Imitation of Christ':       'Imitation',
    'Book 3 – The Visions of Hell':           'Hell',
    'Book 4 - The Church of Darkness':        'Church of Darkness',
    'Book 5 - Life of Catherine':             'Life of Catherine',
    'Book 6 - Life of Mary':                  'Life of Mary',
    'Appendix':                               'Appendix'
  };

  /* ── Which book does the current page belong to? ── */
  var currentFile = window.PAGE_FILE || location.pathname.split('/').pop();

  /* ── Helpers ── */
  function titleFromFile(f) {
    // 1-creation.html  →  1 - Creation
    var base = f.replace(/\.html$/, '').replace(/^b6-/, '');
    var m = base.match(/^(\d+)-(.+)$/);
    if (!m) return base;
    var num = m[1];
    var slug = m[2].replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    return num + ' - ' + slug;
  }

  function sortByChapter(a, b) {
    var na = parseInt(a.replace(/^b6-/, ''), 10) || 0;
    var nb = parseInt(b.replace(/^b6-/, ''), 10) || 0;
    return na - nb;
  }

  /* ── Parse _categorized.txt ── */
  function parseCategorized(text) {
    var books = [];            // [{name, files:[]}]
    var current = null;

    text.split(/\r?\n/).forEach(function (line) {
      var hdr = line.match(/^=== \[Chapters in (.+?)\] ===/);
      if (hdr) {
        current = { name: hdr[1], files: [] };
        books.push(current);
        return;
      }
      // special case: line like === [Visions of Catherine and Mary] ===
      var hdr2 = line.match(/^=== \[(.+?)\] ===/);
      if (hdr2) {
        current = { name: hdr2[1], files: [] };
        books.push(current);
        return;
      }
      if (current) {
        var f = line.trim();
        if (f && f.endsWith('.html')) {
          current.files.push(f);
        }
      }
    });

    // sort each book's file list numerically
    books.forEach(function (b) { b.files.sort(sortByChapter); });

    // record first chapter per book
    books.forEach(function (b) {
      if (b.files.length) BOOK_FIRST[b.name] = b.files[0];
    });

    return books;
  }

  /* ── Render ── */
  function renderTopNav(books) {
    var nav = document.getElementById('top-nav');
    if (!nav) return;
    books.forEach(function (b) {
      if (!b.files.length) return;
      var a = document.createElement('a');
      a.href = b.files[0];
      a.textContent = SHORT_LABELS[b.name] || b.name;
      nav.appendChild(a);
    });
  }

  function renderSidebar(books) {
    var sb = document.getElementById('sidebar');
    if (!sb) return;

    // find which book contains the current page
    var myBook = null;
    books.forEach(function (b) {
      if (b.files.indexOf(currentFile) !== -1) myBook = b;
    });
    if (!myBook && books.length) myBook = books[0];

    var h3 = document.createElement('h3');
    h3.textContent = SHORT_LABELS[myBook.name] || myBook.name;
    sb.appendChild(h3);

    var ul = document.createElement('ul');
    myBook.files.forEach(function (f) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = f;
      a.textContent = titleFromFile(f);
      if (f === currentFile) a.className = 'current';
      li.appendChild(a);
      ul.appendChild(li);
    });
    sb.appendChild(ul);
  }

  /* ── Set prev/next links ── */
  function setPrevNext(books) {
    var myBook = null;
    var idx = -1;
    books.forEach(function (b) {
      var i = b.files.indexOf(currentFile);
      if (i !== -1) { myBook = b; idx = i; }
    });
    if (!myBook) return;

    var prevBtns = [document.getElementById('prev-btn'), document.getElementById('prev-btn-footer')];
    var nextBtns = [document.getElementById('next-btn'), document.getElementById('next-btn-footer')];

    prevBtns.forEach(function (btn) {
      if (!btn) return;
      if (idx > 0) {
        btn.href = myBook.files[idx - 1];
        btn.textContent = '← Previous';
        btn.classList.remove('disabled');
      } else {
        btn.removeAttribute('href');
        btn.classList.add('disabled');
        btn.textContent = '← Previous';
      }
    });

    nextBtns.forEach(function (btn) {
      if (!btn) return;
      if (idx < myBook.files.length - 1) {
        btn.href = myBook.files[idx + 1];
        btn.textContent = 'Next →';
        btn.classList.remove('disabled');
      } else {
        btn.removeAttribute('href');
        btn.classList.add('disabled');
        btn.textContent = 'Next →';
      }
    });
  }

  /* ── Boot ── */
  function boot() {
    fetch('../_categorized.txt')
      .then(function (r) { return r.text(); })
      .then(function (txt) {
        var books = parseCategorized(txt);
        renderTopNav(books);
        renderSidebar(books);
        setPrevNext(books);
      })
      .catch(function (err) {
        console.error('nav.js: could not load _categorized.txt', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
