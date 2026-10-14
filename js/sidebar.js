(function (IDE) {
  const store = IDE.store, S = store.state, esc = IDE.esc;
  const el = IDE.$('sidebar');
  const ui = Object.assign({ pipeline: true, inactive: true, dataframes: true, outline: false, trash: false },
                           IDE.settings.get('sidebar', {}));
  let warnings = {}, renaming = null, dragId = null, committing = false;

  const ic = function (d) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>'; };
  const ICON = {
    eye:  ic('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'),
    off:  ic('<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'),
    trash: ic('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>'),
    plus: ic('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
    sort: ic('<path d="M3 6h13M3 12h9M3 18h5"/><polyline points="17 14 20 17 23 14"/><line x1="20" y1="8" x2="20" y2="17"/>'),
    undo: ic('<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>')
  };
  const btn = function (act, title, svg) { return '<button class="sb-btn" data-act="' + act + '" title="' + esc(title) + '">' + svg + '</button>'; };

  /* ── render ── */
  function row(f, idx, section, dfCount) {
    const active = f.status === 'active';
    const name = renaming === f.id
      ? '<input class="sb-rename" value="' + esc(f.name) + '" spellcheck="false">'
      : '<span class="sb-name" title="' + esc(f.name) + '">' + esc(f.name) + '</span>';
    const warn = warnings[f.id] ? '<span class="sb-warn" title="' + esc(warnings[f.id].join('\n')) + '">⚠</span>' : '';
    return '<div class="sb-row' + (f.id === S.activeId ? ' current' : '') + (active ? '' : ' inactive') + '" data-id="' + f.id +
      '" draggable="' + (!f.isMain && renaming !== f.id) + '">' +
      (section === 'pipeline' ? '<span class="sb-num">' + (idx + 1) + '</span>' : '') +
      (f.isMain ? '<span class="sb-star" title="Entry file – always runs last">★</span>'
                : '<span class="sb-grip">⠿</span>' + btn('toggle', active ? 'Exclude from run (keeps the file)' : 'Include in run', active ? ICON.eye : ICON.off)) +
      name + (dfCount ? '<span class="sb-badge" title="DataFrames in this file">📊' + dfCount + '</span>' : '') + warn +
      (f.isMain ? '' : btn('trash', 'Move to trash', ICON.trash)) + '</div>';
  }
  function section(key, title, count, body, drop, extra) {
    return '<div class="sb-sec"' + (drop ? ' data-drop="' + drop + '"' : '') + '>' +
      '<div class="sb-sec-head" data-act="fold" data-key="' + key + '"><span>' + (ui[key] ? '▾ ' : '▸ ') + title + ' (' + count + ')</span>' + (extra || '') + '</div>' +
      (ui[key] ? '<div class="sb-sec-body">' + body + '</div>' : '') + '</div>';
  }
  function render() {
    if (renaming) { /* keep the input alive */ }
    const pl = store.pipeline(), inactive = S.files.filter(function (f) { return f.status === 'inactive'; });
    const dfs = IDE.data ? IDE.data.scanAll() : [], per = {};
    dfs.forEach(function (b) { per[b.fileId] = (per[b.fileId] || 0) + 1; });

    let h = '<div class="sb-head"><span>Files</span><span>' + btn('new', 'New file', ICON.plus) + btn('sort', 'Auto-sort pipeline by dependencies', ICON.sort) + '</span></div>';
    h += section('pipeline', 'Pipeline', pl.length, pl.map(function (f, i) { return row(f, i, 'pipeline', per[f.id]); }).join(''), 'active');
    h += section('inactive', 'Inactive', inactive.length,
      inactive.map(function (f) { return row(f, 0, 'inactive', per[f.id]); }).join('') ||
      '<div class="sb-empty">Drag a file here to keep it without running it</div>', 'inactive');

    h += section('dataframes', 'DataFrames', dfs.length, dfs.map(function (b) {
      const i = b.info();
      return '<div class="sb-row" data-df="' + esc(b.name) + '" data-file="' + b.fileId + '" data-line="' + b.from.line + '">📊 <span class="sb-name">' +
        esc(b.name) + '</span><small>' + i.rows + '×' + i.cols + '</small></div>';
    }).join('') || '<div class="sb-empty">No DataFrames yet</div>', null,
      btn('manage', 'Open DataFrame manager (Ctrl+D)', ICON.plus));

    const cur = store.get(S.activeId);
    const syms = cur ? IDE.symbols.symbolsOf(cur).filter(function (s) { return s.kind !== 'import'; }).slice(0, 200) : [];
    h += section('outline', 'Outline', syms.length, syms.map(function (s) {
      return '<div class="sb-row" data-sym-line="' + (s.line - 1) + '"><span class="sb-kind">' + esc(s.kind) + '</span><span class="sb-name">' + esc(s.name) + '</span></div>';
    }).join('') || '<div class="sb-empty">Nothing defined at top level</div>');

    h += section('trash', 'Trash', S.trash.length, S.trash.map(function (f) {
      return '<div class="sb-row inactive" data-trash-id="' + f.id + '"><span class="sb-name">' + esc(f.name) + '</span>' + btn('restore', 'Restore', ICON.undo) + '</div>';
    }).join('') + (S.trash.length ? '<div class="sb-row" data-act="empty-trash"><span class="sb-name">Empty trash</span></div>' : '') ||
      '<div class="sb-empty">Deleted files appear here</div>');

    el.innerHTML = h;
    if (renaming) { const inp = el.querySelector('.sb-rename'); if (inp) { inp.focus(); inp.select(); } }
  }

  /* ── warnings from dependency analysis ── */
  function refreshWarnings() {
    try { warnings = IDE.symbols.analyze().warnings || {}; } catch (e) { warnings = {}; }
  }

  /* ── interactions ── */
  el.addEventListener('click', function (e) {
    const head = e.target.closest('.sb-sec-head');
    if (head && !e.target.closest('.sb-btn')) {
      ui[head.dataset.key] = !ui[head.dataset.key];
      IDE.settings.set('sidebar', ui);
      render(); return;
    }
    const btnEl = e.target.closest('.sb-btn');
    if (btnEl) {
      const row = btnEl.closest('.sb-row');
      const id = row && row.dataset.id;
      switch (btnEl.dataset.act) {
        case 'new': store.addFile('untitled.sage', ''); return;
        case 'sort':
          store.setHelperOrder(IDE.symbols.autoSort());
          IDE.toast('Pipeline re-sorted by dependencies', 'success'); return;
        case 'manage': IDE.data.openManager(); return;
        case 'toggle':
          if (id) store.setStatus(id, store.get(id).status === 'active' ? 'inactive' : 'active');
          return;
        case 'trash': if (id) doTrash(id); return;
        case 'restore': if (row) store.restore(row.dataset.trashId); return;
      }
    }
    const dfRow = e.target.closest('.sb-row[data-df]');
    if (dfRow) {
      const b = IDE.data.findBlock(dfRow.dataset.df);
      if (b) IDE.editor.jumpTo(b.fileId, b.from.line);
      return;
    }
    const symRow = e.target.closest('.sb-row[data-sym-line]');
    if (symRow) { IDE.editor.jumpTo(S.activeId, +symRow.dataset.symLine); return; }
    const trashRow = e.target.closest('.sb-row[data-act="empty-trash"]');
    if (trashRow) {
      if (S.trash.length && confirm('Permanently delete ' + S.trash.length + ' file(s)?')) store.emptyTrash();
      return;
    }
    const fileRow = e.target.closest('.sb-row[data-id]');
    if (fileRow) { store.openTab(fileRow.dataset.id); return; }
  });

  function doTrash(id) {
    const f = store.get(id); if (!f) return;
    store.trash(id);
    IDE.toast('"' + f.name + '" moved to trash', null, { label: 'Undo', fn: function () { store.restore(f.id); } });
  }

  /* inline rename (Enter commits, Escape cancels) */
  el.addEventListener('keydown', function (e) {
    if (!renaming || e.target.className !== 'sb-rename') return;
    e.stopPropagation();
    if (e.key === 'Enter') commitRename(e.target.value);
    if (e.key === 'Escape') { renaming = null; render(); }
  });
  el.addEventListener('blur', function (e) {
    if (renaming && e.target.className === 'sb-rename' && !committing) commitRename(e.target.value);
  }, true);
  function commitRename(v) {
    const id = renaming; renaming = null; committing = true;
    const err = store.rename(id, v);
    if (err) IDE.toast(err, 'error');
    committing = false;
  }

  /* context menu on a file row */
  el.addEventListener('contextmenu', function (e) {
    const row = e.target.closest('.sb-row[data-id]'); if (!row) return;
    e.preventDefault();
    const id = row.dataset.id, f = store.get(id); if (!f) return;
    IDE.menu.show(e.clientX, e.clientY, [
      { label: 'Open', fn: function () { store.openTab(id); } },
      '-',
      { label: 'Rename…', fn: function () { renaming = id; render(); } },
      { label: 'Run this file only', fn: function () { IDE.runner.runOnly(id); }, disabled: f.isMain },
      { label: 'Run up to this file', fn: function () { IDE.runner.runUpTo(id); } },
      { label: f.status === 'active' ? 'Exclude from run' : 'Include in run', disabled: f.isMain,
        fn: function () { store.setStatus(id, f.status === 'active' ? 'inactive' : 'active'); } },
      '-',
      { label: 'Duplicate', fn: function () { store.addFile(f.name.replace(/(\.[^.]+)?$/, '_copy$1'), f.doc.getValue()); } },
      { label: 'Move to trash', disabled: f.isMain, fn: function () { doTrash(id); } }
    ]);
  });

  /* ── drag & drop reordering ── */
  el.addEventListener('dragstart', function (e) {
    const row = e.target.closest('.sb-row[data-id]'); if (!row) return;
    dragId = row.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', dragId); } catch (err) {}
  });
  el.addEventListener('dragover', function (e) {
    const row = e.target.closest('.sb-row[data-id]'), sec = e.target.closest('[data-drop]');
    if (!row && !sec) return;
    e.preventDefault();
    el.querySelectorAll('.sb-drop-before, .sb-drop-after, .sb-drop-into').forEach(function (n) { n.classList.remove('sb-drop-before', 'sb-drop-after', 'sb-drop-into'); });
    if (row) {
      const r = row.getBoundingClientRect();
      row.classList.add(e.clientY < r.top + r.height / 2 ? 'sb-drop-before' : 'sb-drop-after');
    } else sec.classList.add('sb-drop-into');
  });
  el.addEventListener('dragleave', function (e) {
    if (!el.contains(e.relatedTarget)) el.querySelectorAll('.sb-drop-before, .sb-drop-after, .sb-drop-into')
      .forEach(function (n) { n.classList.remove('sb-drop-before', 'sb-drop-after', 'sb-drop-into'); });
  });
  el.addEventListener('drop', function (e) {
    e.preventDefault();
    const id = dragId || e.dataTransfer.getData('text/plain'); dragId = null;
    if (!id || !store.get(id)) return;
    const row = e.target.closest('.sb-row[data-id]');
    if (row) {
      const r = row.getBoundingClientRect();
      if (row.dataset.id !== id) store.move(id, row.dataset.id, e.clientY < r.top + r.height / 2);
    } else {
      const sec = e.target.closest('[data-drop]');
      if (sec) store.moveToEnd(id, sec.dataset.drop);
    }
    el.querySelectorAll('.sb-drop-before, .sb-drop-after, .sb-drop-into')
      .forEach(function (n) { n.classList.remove('sb-drop-before', 'sb-drop-after', 'sb-drop-into'); });
  });

  /* project name in the topbar */
  const nameEl = IDE.$('project-name');
  nameEl.addEventListener('input', function () { store.setName(this.value); });
  nameEl.addEventListener('blur', function () {
    if (!this.value.trim()) { this.value = S.name; this.select(); }   // empty on blur: fall back to the store's name
  });

  function init() {
    store.on(function (kind) {
      /* never rewrite the field while the user is typing in it - the trim/fallback in
         setName would eat trailing spaces and resurrect "Untitled project" mid-edit */
      if (kind === 'name') { if (document.activeElement !== nameEl) nameEl.value = S.name; return; }
      refreshWarnings();
      render();
    });
    refreshWarnings();
    IDE.$('project-name').value = S.name;
    render();
  }

  IDE.sidebar = { init: init, render: function () { refreshWarnings(); render(); } };
})(window.IDE);
