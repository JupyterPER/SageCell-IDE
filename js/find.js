(function (IDE) {
  const store = IDE.store, S = store.state, MAX_MARKS = 1000, MAX_HITS = 300;
  let bar, q, r, oCase, oWord, oRe, oAll, info, hitsEl;
  let marks = [], hitData = [], hooked = false;

  function eq(a, b) { return a.line === b.line && a.ch === b.ch; }
  function setInfo(t) { info.textContent = t; }

  /** Build the search RegExp from the panel options, or null (with a message) if unusable. */
  function buildRe() {
    const src = q.value; if (!src) return null;
    let body = oRe.checked ? src : src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (oWord.checked) body = '\\b(?:' + body + ')\\b';
    try {
      const re = new RegExp(body, oCase.checked ? '' : 'i');
      if (re.test('')) { setInfo('Pattern matches empty text'); return null; }   // would loop forever
      return re;
    } catch (e) { setInfo('Invalid regular expression'); return null; }
  }

  function matches(doc, re, limit) {
    const out = [], c = doc.getSearchCursor(re, { line: 0, ch: 0 });
    while (out.length < limit && c.findNext()) out.push({ from: c.from(), to: c.to(), match: c.match });
    return out;
  }

  function expand(text, m) {
    if (!oRe.checked || !m) return text;
    return text.replace(/\$(&|\d)/g, function (_, k) { return k === '&' ? m[0] : (m[+k] == null ? '' : m[+k]); });
  }

  function projectFiles() {
    const pl = store.pipeline().slice(), a = store.get(S.activeId);
    if (a && !pl.some(function (x) { return x.id === a.id; })) pl.push(a);
    return pl;
  }

  function clearMarks() { marks.forEach(function (m) { m.clear(); }); marks = []; }

  function refresh() {
    clearMarks(); hitsEl.textContent = ''; hitData = [];
    const re = buildRe();
    if (!re) { if (!q.value) setInfo(''); return; }

    const cm = IDE.editor.cm(), list = matches(cm.getDoc(), re, MAX_MARKS + 1), over = list.length > MAX_MARKS;
    cm.operation(function () {
      list.slice(0, MAX_MARKS).forEach(function (m) { marks.push(cm.markText(m.from, m.to, { className: 'find-hit' })); });
    });
    const sel = cm.getCursor('from'), i = list.findIndex(function (m) { return eq(m.from, sel); });
    setInfo(list.length ? (i >= 0 ? (i + 1) + ' of ' : '') + (over ? MAX_MARKS + '+' : list.length) : 'No matches');

    if (oAll.checked) listProject(re);
  }

  function listProject(re) {
    let total = 0, nfiles = 0, capped = false;
    projectFiles().forEach(function (f) {
      if (capped) return;
      const list = matches(f.doc, re, MAX_HITS - total + 1);
      if (!list.length) return;
      nfiles++;
      list.forEach(function (m) {
        if (total >= MAX_HITS) { capped = true; return; }
        total++;
        const li = document.createElement('li'), b = document.createElement('b'), s = document.createElement('span');
        b.textContent = f.name + ':' + (m.from.line + 1);
        s.textContent = ' ' + f.doc.getLine(m.from.line).trim().slice(0, 100);   // textContent: code may contain HTML
        li.dataset.i = hitData.length; li.appendChild(b); li.appendChild(s); hitsEl.appendChild(li);
        hitData.push({ id: f.id, from: m.from, to: m.to });
      });
    });
    setInfo(total ? total + (capped ? '+' : '') + ' matches in ' + nfiles + ' file(s)' : 'No matches');
  }
  const refreshSoon = IDE.debounce(refresh, 150);

  /** Select the next/previous match in the current file, wrapping around. */
  function step(dir) {
    const cm = IDE.editor.cm(), re = buildRe(); if (!re) return;
    const find = function (c) { return dir > 0 ? c.findNext() : c.findPrevious(); };
    let c = cm.getSearchCursor(re, dir > 0 ? cm.getCursor('to') : cm.getCursor('from'));
    if (!find(c)) {
      const end = { line: cm.lastLine(), ch: cm.getLine(cm.lastLine()).length };
      c = cm.getSearchCursor(re, dir > 0 ? { line: 0, ch: 0 } : end);
      if (!find(c)) { setInfo('No matches'); return; }
    }
    cm.setSelection(c.from(), c.to());
    cm.scrollIntoView({ from: c.from(), to: c.to() }, 80);
    refresh();
  }

  function replaceOne() {
    const cm = IDE.editor.cm(), re = buildRe(); if (!re) return;
    const c = cm.getSearchCursor(re, cm.getCursor('from'));
    if (c.findNext() && eq(c.from(), cm.getCursor('from')) && eq(c.to(), cm.getCursor('to'))) {
      c.replace(expand(r.value, c.match));
    }
    step(1);                                    // replaces only if the selection was a match, then moves on
  }

  function replaceAll() {
    const re = buildRe(); if (!re) return;
    const targets = oAll.checked ? projectFiles() : [store.get(S.activeId)];
    const work = targets.filter(Boolean).map(function (f) { return { f: f, list: matches(f.doc, re, 1e6) }; })
      .filter(function (w) { return w.list.length; });
    const n = work.reduce(function (s, w) { return s + w.list.length; }, 0);
    if (!n) { setInfo('No matches'); return; }
    if (oAll.checked && !confirm('Replace ' + n + ' match(es) in ' + work.length + ' file(s)?')) return;

    work.forEach(function (w) {
      const doc = w.f.doc, run = function () {
        for (let i = w.list.length - 1; i >= 0; i--) {           // back to front keeps positions valid
          const m = w.list[i]; doc.replaceRange(expand(r.value, m.match), m.from, m.to, '+find');
        }
      };
      if (doc.cm) doc.cm.operation(run); else run();             // one undo step for the open file
    });
    store.emit('find-replace');                                  // snapshot reads every doc; autosave in 600 ms
    refresh();
    setInfo('Replaced ' + n);
  }

  function hookEditor() {
    if (hooked) return; hooked = true;
    const cm = IDE.editor.cm();
    cm.on('change', function () { if (!bar.hidden) refreshSoon(); });
    cm.on('swapDoc', function () { if (!bar.hidden) refreshSoon(); });
  }

  function open(focusReplace) {
    if (!bar) build();
    hookEditor();
    const sel = IDE.editor.cm().getSelection();
    bar.hidden = false;
    if (sel && sel.indexOf('\n') < 0) q.value = sel;
    (focusReplace ? r : q).focus(); if (!focusReplace) q.select();
    refresh();
  }
  function close() { bar.hidden = true; clearMarks(); hitsEl.textContent = ''; IDE.editor.cm().focus(); }

  function build() {
    bar = document.createElement('div');
    bar.id = 'find-bar'; bar.hidden = true;
    bar.innerHTML =
      '<div class="fb-row"><input class="fb-q" placeholder="Find" spellcheck="false" autocomplete="off" aria-label="Find">' +
        '<button type="button" data-a="prev" title="Previous (Shift+Enter)">↑</button>' +
        '<button type="button" data-a="next" title="Next (Enter / F3)">↓</button>' +
        '<button type="button" data-a="close" title="Close (Esc)">✕</button></div>' +
      '<div class="fb-row"><input class="fb-r" placeholder="Replace" spellcheck="false" autocomplete="off" aria-label="Replace with">' +
        '<button type="button" data-a="rep">Replace</button><button type="button" data-a="repall">All</button></div>' +
      '<div class="fb-row fb-opts">' +
        '<label><input type="checkbox" class="fb-case"> Aa</label>' +
        '<label><input type="checkbox" class="fb-word"> word</label>' +
        '<label><input type="checkbox" class="fb-re"> regex</label>' +
        '<label><input type="checkbox" class="fb-all"> all files</label>' +
        '<span class="fb-info" aria-live="polite"></span></div>' +
      '<ul class="fb-hits"></ul>';
    document.body.appendChild(bar);

    q = bar.querySelector('.fb-q'); r = bar.querySelector('.fb-r'); info = bar.querySelector('.fb-info');
    oCase = bar.querySelector('.fb-case'); oWord = bar.querySelector('.fb-word');
    oRe = bar.querySelector('.fb-re'); oAll = bar.querySelector('.fb-all'); hitsEl = bar.querySelector('.fb-hits');

    q.addEventListener('input', refreshSoon);
    [oCase, oWord, oRe, oAll].forEach(function (c) { c.addEventListener('change', refresh); });
    q.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1); } });
    r.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); replaceOne(); } });

    bar.addEventListener('click', function (e) {
      const li = e.target.closest('.fb-hits li');
      if (li) {
        const h = hitData[+li.dataset.i]; if (!h) return;
        IDE.editor.jumpTo(h.id, h.from.line);
        const cm = IDE.editor.cm(); cm.setSelection(h.from, h.to); cm.scrollIntoView({ from: h.from, to: h.to }, 80);
        return;
      }
      const b = e.target.closest('button[data-a]'); if (!b) return;
      ({ prev: function () { step(-1); }, next: function () { step(1); }, close: close, rep: replaceOne, repall: replaceAll })[b.dataset.a]();
    });
  }
  function init() {
    const findBtn = document.getElementById('find-btn');
    if (findBtn) findBtn.addEventListener('click', function () { open(false); });
  }

  document.addEventListener('keydown', function (e) {
    let active;
    try { active = IDE.editor.cm().getWrapperElement().contains(document.activeElement); } catch (_) { return; }
    const inBar = bar && bar.contains(document.activeElement), k = (e.key || '').toLowerCase();
    if (!active && !inBar) return;                               // elsewhere the browser's own find stays untouched
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (k === 'f' || k === 'h')) {
      e.preventDefault(); e.stopPropagation(); open(k === 'h');
    } else if (e.key === 'F3' && bar && !bar.hidden) {
      e.preventDefault(); step(e.shiftKey ? -1 : 1);
    } else if (e.key === 'Escape' && inBar) {
      e.preventDefault(); close();
    }
  }, true);

  IDE.find = { open: open, close: close, init: init };
})(window.IDE);
