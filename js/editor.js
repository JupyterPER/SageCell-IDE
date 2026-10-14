(function (IDE) {
  const store = IDE.store, S = store.state, esc = IDE.esc;
  let cm = null, idleTimer = null, shownId = null;

  /* ── words from sagekeywords.js ── */
  const ALL_WORDS = {};
  if (typeof SAGE_WORDS !== 'undefined') Object.keys(SAGE_WORDS).forEach(function (k) {
    SAGE_WORDS[k].forEach(function (w) { ALL_WORDS[w] = k; });
  });
  const WORD_LIST = Object.keys(ALL_WORDS);

  function item(text, kind, cls, rank) {
    return { text: text, displayText: text, className: cls || '', rank: rank,
      render: function (el) { el.innerHTML = esc(text) + '<span class="hint-kind">' + esc(kind) + '</span>'; } };
  }

  /* ── hint function: Sage words + project symbols + buffer words + DataFrame columns ── */
  function sageHint(cm) {
    const cur = cm.getCursor(), before = cm.getLine(cur.line).slice(0, cur.ch);

    // df["<cursor>  → column names
    const cm1 = /([A-Za-z_]\w*)\s*\[\s*(["'])([^"']*)$/.exec(before);
    if (cm1) {
      const cols = IDE.symbols.columnsOf(cm1[1]);
      if (cols.length) {
        const pre = cm1[3].toLowerCase();
        return {
          list: cols.filter(function (c) { return String(c).toLowerCase().indexOf(pre) === 0; })
                    .map(function (c) { return item(String(c), 'column', '', 0); }),
          from: CodeMirror.Pos(cur.line, cur.ch - cm1[3].length), to: cur
        };
      }
    }

    const wm = /[A-Za-z_]\w*$/.exec(before);
    if (!wm) return null;
    const word = wm[0], lower = word.toLowerCase();
    const afterDot = before.charAt(before.length - word.length - 1) === '.';
    const seen = new Set(), res = [];
    const add = function (it) { if (!seen.has(it.text) && it.text !== word) { seen.add(it.text); res.push(it); } };

    if (!afterDot) {
      IDE.symbols.suggest(word, S.activeId).forEach(function (s) {
        const label = s.kind + (s.state === 'same' ? '' : ' · ' + s.file);
        add(item(s.name, label, s.state === 'later' ? 'hint-later' : s.state === 'inactive' ? 'hint-inactive' : '', 0));
      });
    }
    WORD_LIST.forEach(function (w) { if (w.toLowerCase().indexOf(lower) === 0) add(item(w, ALL_WORDS[w], '', 1)); });
    const any = CodeMirror.hint.anyword(cm);
    if (any && any.list) any.list.forEach(function (w) {
      const t = typeof w === 'string' ? w : w.text;
      if (!ALL_WORDS[t]) add(item(t, 'buffer', '', 2));
    });

    res.sort(function (a, b) { return a.rank - b.rank || a.text.localeCompare(b.text); });
    return { list: res, from: CodeMirror.Pos(cur.line, cur.ch - word.length), to: cur };
  }
  const showHint = function (c) { c.showHint({ hint: sageHint, completeSingle: false }); };

  /* ── init: one CodeMirror instance, docs swapped per tab ── */
  function init() {
    cm = CodeMirror(IDE.$('editor'), {
      mode: 'python', theme: 'default', lineNumbers: true, indentUnit: 4,
      autoCloseBrackets: true, matchBrackets: true,
      extraKeys: {
        'Shift-Enter': function () { IDE.runner.runAll(); },
        'Ctrl-Enter': function () { IDE.runner.runToCursor(); },
        'Ctrl-Space': function (c) { showHint(c); },
        'Ctrl-D': function () { IDE.data.openManager(); },
        'Ctrl-/': 'toggleComment',
        'Ctrl-B': function () {},                       // handled globally by layout.js
        Backspace: fixBackspace
      }
    });
    cm.on('cursorActivity', IDE.debounce(function () {
      const f = store.get(S.activeId);
      if (f && f.doc.getMode) { /* doc exists */ }
    }, 200));

    /* idle auto-suggest: fire once typing pauses on a word */
    cm.on('change', function (c, ch) {
      if (!IDE.settings.get('autoSuggest', true)) return;
      if (ch.origin !== '+input' || !ch.text || !ch.text.join('').match(/[A-Za-z_]/)) return;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(function () {
        if (!c.state.completionActive) showHint(c);
      }, 450);
    });

    store.on(function (kind) {
      if (kind === 'tab' || kind === 'structure') { showDoc(); renderTabs(); }   // was: renderTabs only on 'structure'
      if (kind === 'content') onEdit();
    });
    initTabBar();
    showDoc(); renderTabs();
  }

  function showDoc() {
    const f = store.get(S.activeId) || store.get(store.mainId());
    if (!f || !cm) return;
    if (cm.getDoc() !== f.doc) cm.swapDoc(f.doc);
    if (shownId !== f.id) { shownId = f.id; }
    cm.refresh();
    refreshChipsSoon();
  }
  function renderTabs() {
    const bar = IDE.$('file-tabs-bar'), addBtn = bar.querySelector('.tab-add-btn');
    bar.querySelectorAll('.file-tab').forEach(function (t) { t.remove(); });
    S.openTabs.forEach(function (id) {
      const f = store.get(id); if (!f) return;
      const t = document.createElement('div');
      t.className = 'file-tab' + (f.isMain ? ' main-tab' : '') + (f.status === 'inactive' ? ' inactive' : '') +
                    (id === S.activeId ? ' active current' : '');
      t.dataset.id = id;
      t.draggable = !f.isMain;                                   // the entry file stays put
      t.title = f.name + (f.isMain ? ' (entry file - runs last)' : '') + (f.status === 'inactive' ? ' - excluded from run' : '');
      t.innerHTML = (f.isMain ? '<span class="tab-star" title="Entry file">★</span>' : '') +
        '<span class="tab-name">' + esc(f.name) + '</span>' +
        '<button type="button" class="tab-close" title="Close tab (the file is kept)">×</button>';
      bar.insertBefore(t, addBtn);
    });
    const pl = store.pipeline();
    IDE.$('run-order-text').textContent = pl.map(function (f) { return f.name; }).join(' → ') || '–';
    const cur = bar.querySelector('.file-tab.current');
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  /* ── edits: refresh chips + outline while typing ── */
  const refreshChipsSoon = IDE.debounce(function () {
    if (IDE.data) IDE.data.refreshChips();
    if (IDE.sidebar) IDE.sidebar.render();
  }, 300);
  function onEdit() { refreshChipsSoon(); }

  /** Backspace at the edge of a collapsed (readOnly+atomic) DataFrame block deletes the block range, not nothing. */
  function fixBackspace(c) {
    const cur = c.getCursor();
    const marks = c.findMarksAt({ line: cur.line, ch: cur.ch })
      .concat(c.findMarksAt({ line: cur.line, ch: Math.max(0, cur.ch - 1) }));
    for (let i = 0; i < marks.length; i++) {
      const m = marks[i];
      if (!m.readOnly) continue;
      const r = m.find();
      if (r && (r.to.line < cur.line || (r.to.line === cur.line && r.to.ch <= cur.ch))) {
        c.replaceRange('', r.from, r.to, '+delete');
        return;
      }
    }
    return CodeMirror.Pass;                            // normal backspace
  }

  /* ── public helpers used by other modules ── */
  function jumpTo(fileId, line) {
    store.openTab(fileId);
    showDoc();
    const f = store.get(fileId); if (!f) return;
    const ln = Math.max(0, Math.min(line, f.doc.lastLine()));
    f.doc.setCursor({ line: ln, ch: 0 });
    cm.focus();
    const pos = cm.charCoords({ line: ln, ch: 0 }, 'local');
    cm.scrollTo(null, pos.top - cm.getScrollerElement().clientHeight / 3);
    cm.setCursor({ line: ln, ch: 0 });
    cm.execCommand('goLineStart');
  }
  function attachChipLayer(layer) {
    const sc = cm.getScrollerElement();
    if (layer.parentElement !== sc) sc.appendChild(layer);
  }

  /* ── tab bar: click, close, middle-click, rename, drag to reorder ── */
  const TAB_DRAG_CHANGES_RUN_ORDER = true;   // false = dragging only changes the tab order, not the pipeline

  function initTabBar() {
    const bar = IDE.$('file-tabs-bar');
    let dragId = null;
    const tabOf = function (e) { return e.target.closest ? e.target.closest('.file-tab') : null; };
    const clearMarks = function () {
      bar.querySelectorAll('.dragging,.drop-before,.drop-after').forEach(function (n) {
        n.classList.remove('dragging', 'drop-before', 'drop-after');
      });
    };

    bar.addEventListener('click', function (e) {
      const tab = tabOf(e); if (!tab) return;           // the "+" button is handled in sidebar.js
      if (e.target.closest('.tab-close')) { e.stopPropagation(); store.closeTab(tab.dataset.id); return; }
      if (tab.dataset.id !== S.activeId) store.openTab(tab.dataset.id);   // no re-render on the active tab (keeps dblclick working)
    });
    bar.addEventListener('mousedown', function (e) { if (e.button === 1) e.preventDefault(); });   // no autoscroll cursor
    bar.addEventListener('auxclick', function (e) {                                                // middle-click closes
      if (e.button !== 1) return;
      const tab = tabOf(e); if (!tab) return;
      e.preventDefault(); store.closeTab(tab.dataset.id);
    });
    bar.addEventListener('dblclick', function (e) {
      const tab = tabOf(e); if (!tab || e.target.closest('.tab-close')) return;
      const f = store.get(tab.dataset.id); if (!f) return;
      const nn = prompt('Rename file:', f.name);
      if (nn && nn !== f.name) { const err = store.rename(f.id, nn); if (err) IDE.toast(err, 'error'); }
    });

    bar.addEventListener('dragstart', function (e) {
      const tab = tabOf(e);
      if (!tab || !tab.draggable) return;
      dragId = tab.dataset.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragId);     // Firefox needs data or the drag never starts
      tab.classList.add('dragging');
    });
    bar.addEventListener('dragover', function (e) {
      if (!dragId) return;
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      bar.querySelectorAll('.drop-before,.drop-after').forEach(function (n) { n.classList.remove('drop-before', 'drop-after'); });
      const tab = tabOf(e);
      if (!tab || tab.dataset.id === dragId) return;
      const r = tab.getBoundingClientRect();
      tab.classList.add(e.clientX < r.left + r.width / 2 ? 'drop-before' : 'drop-after');
    });
    bar.addEventListener('drop', function (e) {
      if (!dragId) return;
      e.preventDefault();
      const tab = tabOf(e), id = dragId;
      dragId = null;
      let targetId = null, before = false;
      if (tab && tab.dataset.id !== id) {
        targetId = tab.dataset.id;
        const r = tab.getBoundingClientRect();
        before = e.clientX < r.left + r.width / 2;
      } else if (tab) { clearMarks(); return; }          // dropped on itself
      clearMarks();
      reorderTab(id, targetId, before);                  // no target = dropped on empty bar space -> move to the end
    });
    bar.addEventListener('dragend', function () { dragId = null; clearMarks(); });

    /* the "+" button: sidebar.js doesn't bind it, so it lives here */
    IDE.$('add-tab-btn').addEventListener('click', function () { store.addFile('untitled.sage', ''); });
  }

  function reorderTab(id, targetId, before) {
    const a = S.openTabs.indexOf(id); if (a < 0) return;
    S.openTabs.splice(a, 1);
    const b = targetId ? S.openTabs.indexOf(targetId) : -1;
    if (b < 0) S.openTabs.push(id); else S.openTabs.splice(before ? b : b + 1, 0, id);

    if (TAB_DRAG_CHANGES_RUN_ORDER) {                    // keep the pipeline in step with the tabs
      const f = store.get(id), t = targetId && store.get(targetId);
      if (f && t && !f.isMain && !t.isMain) {
        S.files.splice(S.files.indexOf(f), 1);
        const j = S.files.indexOf(t);
        S.files.splice(before ? j : j + 1, 0, f);
      }
    }
    store.emit('structure');                             // redraws tabs, sidebar and the "Pipeline:" line, and autosaves
  }

  IDE.editor = {
    init: init, cm: function () { return cm; }, jumpTo: jumpTo,
    attachChipLayer: attachChipLayer, scroller: function () { return cm ? cm.getScrollerElement() : null; },
    renderTabs: renderTabs, showHint: showHint
  };
})(window.IDE);
