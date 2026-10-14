(function (IDE) {
  const store = IDE.store, S = store.state, esc = IDE.esc, getEl = IDE.$;
  const dmModal = getEl('data-modal'), dgModal = getEl('datagrid-modal');
  let editing = [];                     // [{name, block, data}] for the spreadsheet tabs
  let gridInstance = null;

  const PRELUDE = [
    'def __ide_df__(raw):',
    '    import pandas as pd, json',
    '    rows = json.loads(raw)',
    '    df = pd.DataFrame(rows[1:], columns=[str(c) for c in rows[0]])',
    '    for c in df.columns:',
    "        try:",
    "            df[c] = pd.to_numeric(df[c].replace('', float('nan')))",
    '        except (ValueError, TypeError):',
    '            pass',
    '    return df'
  ].join('\n');

  /* ═══ block format ═══ */
  const RE_V2 = /^# @dataframe ([A-Za-z_]\w*)[^\n]*\n\1 = __ide_df__\(r'''([\s\S]*?)'''\)[ \t]*\n# @end dataframe[ \t]*(?:\n|$)/gm;
  const RE_V1 = /# ── DataFrame: ([A-Za-z_]\w*) ──\n\1_name = "\1"\nimport pandas as pd, json\n\1_raw = r'''([\s\S]*?)'''\n\1_json = json\.loads\(\1_raw\)\n\1 = pd\.DataFrame\(\1_json\[1:\], columns=\1_json\[0\]\)\nprint\(f"DataFrame[^\n]*\)\n?/g;

  function buildBlock(name, data) {
    const json = JSON.stringify(data).replace(/'/g, '\\u0027');       // can never terminate the ''' string
    return '# @dataframe ' + name + ' rows=' + Math.max(0, data.length - 1) + ' cols=' + (data[0] || []).length + '\n' +
           name + " = __ide_df__(r'''" + json + "''')\n# @end dataframe\n";
  }

  const scanCache = new Map();
  function scanFile(f) {
    const gen = f.doc.changeGeneration(), c = scanCache.get(f.id);
    if (c && c.gen === gen) return c.blocks;
    const text = f.doc.getValue(), blocks = [];
    [[RE_V2, false], [RE_V1, true]].forEach(function (pair) {
      const re = pair[0], legacy = pair[1];
      re.lastIndex = 0; let m;
      while ((m = re.exec(text))) {
        const end = m.index + m[0].length, endNoNl = text.charAt(end - 1) === '\n' ? end - 1 : end;
        blocks.push(makeBlock(f, m[1], m[2], f.doc.posFromIndex(m.index), f.doc.posFromIndex(end), f.doc.posFromIndex(endNoNl), legacy));
      }
    });
    blocks.sort(function (a, b) { return a.from.line - b.from.line; });
    scanCache.set(f.id, { gen: gen, blocks: blocks });
    return blocks;
  }
  function makeBlock(f, name, raw, from, to, markTo, legacy) {
    let parsed = null;
    const b = { name: name, file: f, fileId: f.id, from: from, to: to, markTo: markTo, legacy: legacy };
    b.data = function () { return parsed || (parsed = JSON.parse(raw)); };
    b.info = function () { const d = b.data(); return { rows: Math.max(0, d.length - 1), cols: (d[0] || []).length }; };
    b.columns = function () {
      try { const m = /^\s*\[\s*(\[[^\]]*\])/.exec(raw); return JSON.parse(m[1]); }
      catch (e) { try { return b.data()[0] || []; } catch (e2) { return []; } }
    };
    return b;
  }
  const scanAll = function () { return S.files.flatMap(scanFile); };
  const findBlock = function (name) {
    for (let i = 0; i < S.files.length; i++) { const b = scanFile(S.files[i]).find(function (x) { return x.name === name; }); if (b) return b; }
    return null;
  };

  /* ═══ chips: collapsed DataFrame blocks rendered in the editor ═══ */
  const chipLayer = document.createElement('div');
  chipLayer.className = 'df-chip-layer';

  let shownFor = null;
  function refreshChips() {
    const f = store.get(S.activeId);
    if (!f) return;
    if (shownFor !== f.id) { shownFor = f.id; IDE.editor.attachChipLayer(chipLayer); }
    chipLayer.innerHTML = '';
    scanFile(f).forEach(function (b) {
      const host = ensureMark(f, b).replacedWith;
      if (!host) return;
      const info = b.info();
      host.innerHTML =
        '<span class="df-chip">' +
        '<span class="df-chip-tag">📊 ' + esc(b.name) + '</span>' +
        '<span class="df-chip-shape">' + info.rows + '×' + info.cols + '</span>' +
        '<span class="df-chip-actions">' +
        '<button data-a="edit" title="Open in spreadsheet editor">edit</button>' +
        '<button data-a="peek" title="Show first rows">peek</button>' +
        '<button data-a="inline" title="Unfold to source code">code</button>' +
        '</span></span>';
    });
  }
  function peek(b) {
    const d = b.data(), cols = d[0] || [], rows = d.slice(1, 6);
    let h = '<div class="df-peek"><header>📊 ' + esc(b.name) + ' · ' + b.info().rows + ' rows' + (b.legacy ? ' · legacy block' : '') +
      '</header><table class="dm-table"><thead><tr>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table><footer>first ' + rows.length + ' row' + (rows.length === 1 ? '' : 's') + '</footer></div>';
    IDE.popup(h);
  }
  /** Replace (or insert) a block's source text in its file, preserving undo history. */
  function writeBlock(b, newName, data, targetFileId) {
    const oldName = b ? b.name : null;
    const text = buildBlock(newName, data);
    const f = b ? b.file : store.get(targetFileId || S.activeId);
    const pos = f.doc.posFromIndex(0);
    if (b) {
      const from = f.doc.indexFromPos(b.from), to = f.doc.indexFromPos(b.to);
      f.doc.replaceRange(text, b.from, b.to);
      scanCache.delete(f.id);
    } else {
      const cur = IDE.editor.cm() && f.id === S.activeId ? IDE.editor.cm().getCursor() : { line: f.doc.lastLine(), ch: 0 };
      f.doc.replaceRange((f.doc.getLine(cur.line).trim() ? '\n\n' : ''), { line: cur.line, ch: 0 });
      f.doc.replaceRange(text, f.doc.getCursor());
      scanCache.delete(f.id);
    }
    if (oldName && oldName !== newName) IDE.toast('DataFrame renamed: ' + oldName + ' → ' + newName + '. Update references yourself.');
    else IDE.toast('DataFrame "' + newName + '" saved', 'success');
  }
  function ensureMark(f, b) {
    /* doc.getBookmark does not exist in CodeMirror; find existing chip marks by exact range */
    const exact = (f.doc.findMarks(b.from, b.to) || []).filter(function (m) {
      if (!m.replacedWith) return false;
      const r = m.find();
      return r && r.from.line === b.from.line && r.from.ch === b.from.ch &&
                    r.to.line === b.to.line && r.to.ch === b.to.ch;
    });
    if (exact.length) return exact[0];
    const mark = f.doc.markText(b.from, b.to, { replacedWith: document.createElement('span'), atomic: true, readOnly: true, className: 'df-mark' });
    return mark;
  }

  /* ═══ paste initDataGridXL(data) + initSimpleTableEditor(data) unchanged from the old sageide.js ═══ */
  function initDataGridXL(data) {
    var container = getEl('datagridxl-container');
    if (!container) return;

    // Clear previous content
    container.innerHTML = '';

    try {
      // Check if DataGrid XL is loaded
      if (typeof DataGridXL === 'undefined') {
        // Fallback to simple HTML table editor
        initSimpleTableEditor(data);
        return;
      }

      gridInstance = new DataGridXL("datagridxl-container", {
        data: data,
        editable: true,
        allowInsertRow: true,
        allowDeleteRow: true,
        allowInsertColumn: true,
        allowDeleteColumn: true,
        allowRenameColumn: false, // We'll use first row as headers
        colHeaderLabelType: "letters", // Excel-style A, B, C
        rowHeaderLabelType: "numbers"
      });

    } catch (err) {
      console.error('DataGrid XL initialization failed:', err);
      initSimpleTableEditor(data);
    }
  }

  // Fallback simple table editor if DataGrid XL fails to load
  function initSimpleTableEditor(data) {
    var container = getEl('datagridxl-container');
    if (!container) return;

    container.innerHTML = '';

    var table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '13px';

    // Create header row (first data row)
    var thead = document.createElement('thead');
    var headerRow = document.createElement('tr');

    // Add corner cell
    var corner = document.createElement('th');
    corner.style.width = '40px';
    corner.style.background = 'var(--bg-hover)';
    corner.style.border = '1px solid var(--border)';
    corner.textContent = '#';
    headerRow.appendChild(corner);

    // Add column headers from first data row
    var numCols = data[0] ? data[0].length : 3;
    for (var i = 0; i < numCols; i++) {
      var th = document.createElement('th');
      th.style.background = 'var(--bg-hover)';
      th.style.padding = '8px';
      th.style.border = '1px solid var(--border)';
      th.style.minWidth = '100px';
      th.style.position = 'relative';

      var input = document.createElement('input');
      input.type = 'text';
      input.value = data[0] && data[0][i] !== undefined ? data[0][i] : 'Col' + (i + 1);
      input.style.width = '100%';
      input.style.border = 'none';
      input.style.background = 'transparent';
      input.style.fontWeight = '600';
      input.style.color = 'var(--text)';
      input.dataset.row = '0';
      input.dataset.col = i.toString();

      th.appendChild(input);
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create data rows
    var tbody = document.createElement('tbody');
    for (var r = 1; r < data.length; r++) {
      var tr = document.createElement('tr');

      // Row number cell
      var rowTd = document.createElement('td');
      rowTd.style.width = '40px';
      rowTd.style.background = 'var(--bg-hover)';
      rowTd.style.border = '1px solid var(--border)';
      rowTd.style.textAlign = 'center';
      rowTd.style.color = 'var(--text-3)';
      rowTd.textContent = r.toString();
      tr.appendChild(rowTd);

      for (var c = 0; c < numCols; c++) {
        var td = document.createElement('td');
        td.style.border = '1px solid var(--border)';
        td.style.padding = '0';

        var cellInput = document.createElement('input');
        cellInput.type = 'text';
        cellInput.value = data[r] && data[r][c] !== undefined ? data[r][c] : '';
        cellInput.style.width = '100%';
        cellInput.style.padding = '6px 8px';
        cellInput.style.border = 'none';
        cellInput.style.background = 'transparent';
        cellInput.style.color = 'var(--text)';
        cellInput.dataset.row = r.toString();
        cellInput.dataset.col = c.toString();

        td.appendChild(cellInput);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    container.appendChild(table);

    // Store reference for data extraction
    gridInstance = {
      isSimpleTable: true,
      getData: function() {
        var result = [];
        var headInputs = table.querySelectorAll('thead tr input');
        var headRow = [];
        headInputs.forEach(function(input) { headRow.push(input.value); });
        if (headRow.length) result.push(headRow);
        var rows = tbody.querySelectorAll('tr');
        rows.forEach(function(tr) {
          var rowData = [];
          var inputs = tr.querySelectorAll('input');
          inputs.forEach(function(input) {
            rowData.push(input.value);
          });
          if (rowData.length > 0) result.push(rowData);
        });
        return result;
      }
    };
  }

  /* ═══ modals: manager + spreadsheet editor ═══ */
  function openManager() {
    renderManager();
    dmModal.classList.add('open');
  }
  function renderManager() {
    const dfs = scanAll();
    getEl('dm-rows').innerHTML = dfs.length ? dfs.map(function (b) {
      const i = b.info();
      return '<tr data-df="' + esc(b.name) + '"><td>📊 ' + esc(b.name) + (b.legacy ? ' <small>(legacy)</small>' : '') + '</td><td>' + i.rows + '×' + i.cols +
        '</td><td>' + esc(b.file.name) + '</td><td><button class="data-action-btn" data-a="edit">Edit</button> ' +
        '<button class="data-action-btn" data-a="export-csv">CSV</button> <button class="data-action-btn" data-a="export-xlsx">Excel</button> ' +
        '<button class="data-action-btn" data-a="rename">Rename</button> <button class="data-action-btn" data-a="delete">Delete</button></td></tr>';
    }).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--text-4);padding:2em">No DataFrames. Import one or click “New DataFrame”.</td></tr>';
    const sel = getEl('dg-target');
    sel.innerHTML = S.files.map(function (f) { return '<option value="' + f.id + '"' + (f.id === S.activeId ? ' selected' : '') + '>' + esc(f.name) + '</option>'; }).join('');
  }

  function getDataFromGrid() {
    if (!gridInstance) return null;
    try {
      return gridInstance.getData();
    } catch (err) { console.error(err); return null; }
  }

  let activeTab = 0;
  function openEditor(list) {
    editing = list.map(function (d) { return { name: d.name, block: d.block || null, data: d.data }; });
    activeTab = 0;
    renderEditorTabs();
    dmModal.classList.remove('open');
    dgModal.classList.add('open');
    setTimeout(function () { initDataGridXL(editing[activeTab].data); }, 50);
  }
  function renderEditorTabs() {
    getEl('dg-tabs').innerHTML = editing.map(function (e, k) {
      return '<button class="dg-tab' + (k === activeTab ? ' current' : '') + '" data-k="' + k + '">' + esc(e.name) + '</button>';
    }).join('');
    getEl('datagrid-df-name').value = editing[activeTab].name;
  }
  function switchTab(k) {
    if (!editing.length) return;
    const cur = getDataFromGrid(); if (cur) editing[activeTab].data = cur;
    activeTab = k;
    renderEditorTabs();
    initDataGridXL(editing[activeTab].data);
  }

  function saveEditor() {
    const cur = getDataFromGrid(); if (cur) editing[activeTab].data = cur;
    const target = getEl('dg-target').value;
    editing.forEach(function (e) {
      const filtered = e.data.filter(function (row) { return row.some(function (c) { return c !== '' && c !== null && c !== undefined; }); });
      if (!filtered.length) return;
      const nameInput = getEl('datagrid-df-name');
      const nm = (editing.length === 1 && nameInput.value.trim()) || e.name;
      writeBlock(e.block, nm, filtered, target);
    });
    closeEditor();
  }
  function closeEditor() {
    dgModal.classList.remove('open');
    if (gridInstance) { try { gridInstance.destroy(); } catch (e) {} gridInstance = null; }
    editing = [];
  }

  /* CSV / Excel import (multiple files at once) */
  function importFiles(files) {
    Array.from(files).forEach(function (file) {
      const nm = file.name.replace(/\.[^.]+$/, '').replace(/[^\w]/g, '_').replace(/^(\d)/, '_$1') || 'df';
      if (/\.xlsx?$/i.test(file.name)) {
        const reader = new FileReader();
        reader.onload = function (e) {
          try {
            const wb = XLSX.read(e.target.result, { type: 'binary' });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
            if (json.length) addImported(nm, json);
          } catch (err) { IDE.toast('Could not read ' + file.name + ': ' + err.message, 'error'); }
        };
        reader.readAsBinaryString(file);
      } else {
        Papa.parse(file, {
          skipEmptyLines: 'greedy',
          complete: function (res) { if (res.data && res.data.length) addImported(nm, res.data); else IDE.toast(file.name + ' is empty', 'error'); }
        });
      }
    });
  }
  function addImported(name, data) {
    const cols = data[0].length;
    const rows = data.slice(1).map(function (r) { while (r.length < cols) r.push(''); return r.slice(0, cols); });
    data = [data[0]].concat(rows);
    openEditor([{ name: name, data: data }]);
  }

  /* export helpers */
  function toCsv(data, delim, bom) {
    const q = function (v) {
      v = String(v == null ? '' : v);
      return /["\n\r]|[\x00-\x1f]/.test(v) || v.indexOf(delim) >= 0 ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
    return (bom ? '\ufeff' : '') + data.map(function (r) { return r.map(q).join(delim); }).join('\r\n');
  }
  function exportOne(b) {
    const rows = [b.columns().map(String)].concat(b.data().slice(1));
    IDE.download(new Blob([toCsv(rows, ',', false)], { type: 'text/csv;charset=utf-8' }), b.name + '.csv');
  }

  function onManagerClick(e) {
    const tr = e.target.closest('tr[data-df]'); if (!tr) return;
    const name = tr.dataset.df, b = findBlock(name); if (!b) return;
    const a = (e.target.closest('button') || {}).dataset;
    if (!a || !a.a) { openEditor([{ name: name, block: b, data: b.data() }]); return; }
    if (a.a === 'edit') openEditor([{ name: name, block: b, data: b.data() }]);
    if (a.a === 'export-csv') exportOne(b);
    if (a.a === 'export-xlsx') {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([b.columns().map(String)].concat(b.data().slice(1))), b.name.slice(0, 31));
      XLSX.writeFile(wb, b.name + '.xlsx');
    }
    if (a.a === 'rename') {
      const nn = prompt('New name for "' + name + '":', name);
      if (nn && /^[A-Za-z_]\w*$/.test(nn.trim())) writeBlock(b, nn.trim(), b.data());
      else if (nn) IDE.toast('Not a valid Python identifier', 'error');
    }
    if (a.a === 'delete') {
      if (confirm('Delete DataFrame "' + name + '" from ' + b.file.name + '?')) {
        b.file.doc.replaceRange('', b.from, b.to);
        scanCache.delete(b.fileId);
        renderManager(); IDE.toast('DataFrame "' + name + '" deleted');
      }
    }
  }

  function init() {
    getEl('data-btn').addEventListener('click', openManager);
    getEl('data-cancel').addEventListener('click', function () { dmModal.classList.remove('open'); });
    getEl('datagrid-cancel').addEventListener('click', closeEditor);
    getEl('datagrid-save').addEventListener('click', saveEditor);

    getEl('dm-import').addEventListener('click', function () { getEl('data-upload-input').click(); });
    getEl('data-upload-input').addEventListener('change', function (e) {
      importFiles(e.target.files); e.target.value = '';
    });
    getEl('dm-new').addEventListener('click', function () {
      openEditor([{ name: 'df', data: [['Column1', 'Column2'], ['', '']] }]);
    });
    getEl('dm-edit-all').addEventListener('click', function () {
      const dfs = scanAll();
      if (!dfs.length) return IDE.toast('No DataFrames yet');
      openEditor(dfs.map(function (b) { return { name: b.name, block: b, data: b.data() }; }));
    });

    getEl('dm-rows').addEventListener('click', onManagerClick);
    getEl('dg-tabs').addEventListener('click', function (e) {
      const t = e.target.closest('.dg-tab'); if (t) switchTab(+t.dataset.k);
    });

    getEl('dm-export-xlsx').addEventListener('click', function () {
      const dfs = scanAll(); if (!dfs.length) return;
      const wb = XLSX.utils.book_new();
      dfs.forEach(function (b) {
        const ws = XLSX.utils.aoa_to_sheet([b.columns().map(String)].concat(b.data().slice(1)));
        XLSX.utils.book_append_sheet(wb, ws, b.name.slice(0, 31));
      });
      XLSX.writeFile(wb, IDE.slug(S.name) + '.xlsx');
    });
    getEl('dm-export-zip').addEventListener('click', function () {
      const dfs = scanAll(); if (!dfs.length) return;
      const zip = new JSZip(), delim = getEl('dm-delim').value, bom = getEl('dm-bom').checked;
      dfs.forEach(function (b) {
        const rows = [b.columns().map(String)].concat(b.data().slice(1));
        zip.file(b.name + '.csv', toCsv(rows, delim, bom));
      });
      zip.generateAsync({ type: 'blob' }).then(function (blob) { IDE.download(blob, IDE.slug(S.name) + '-csv.zip'); });
    });

    /* Ctrl+D opens the manager from anywhere EXCEPT inside CodeMirror,
       where editor.js's extraKeys handler owns it (prevents double-fire) */
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.key.toLowerCase() === 'd' && !e.target.closest('.CodeMirror')) {
        e.preventDefault(); openManager();
      }
    });

    /* chip clicks (edit / peek / inline) */
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('.df-chip-actions button'); if (!btn) return;
      const chip = btn.closest('.df-chip'); if (!chip) return;
      const f = store.get(S.activeId); if (!f) return;
      const name = chip.querySelector('.df-chip-tag').textContent.replace(/^📊\s*/, '');
      const block = scanFile(f).find(function (x) { return x.name === name; });
      if (!block) return;
      if (btn.dataset.a === 'edit') openEditor([{ name: block.name, block: block, data: block.data() }]);
      if (btn.dataset.a === 'peek') peek(block);
      if (btn.dataset.a === 'inline') {
        const marks = f.doc.getAllMarks().filter(function (m) { return m.replacedWith && m.replacedWith.contains(chip); });
        marks.forEach(function (m) { m.clear(); });
        IDE.toast('Unfolded to source');
      }
    });
  }

  IDE.data = {
    PRELUDE: PRELUDE, scanFile: scanFile, scanAll: scanAll, findBlock: findBlock, buildBlock: buildBlock,
    openManager: openManager, refreshChips: refreshChips, writeBlock: writeBlock, init: init
  };
})(window.IDE);

