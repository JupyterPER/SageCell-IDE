/* ── File State ─────────────────────────────────────────────────── */
var files = [
  { id: 'main', name: 'main.sage', content: '', isMain: true },
  { id: 'helpers', name: 'helpers.sage', content: '# You can write helper functions here\n# Runs before main.sage\n\n', isMain: false }
];
var activeFileId = 'main';
var fileCounter = 1;
var draggedFileId = null;
var isDark = false;

var editor = null; // Will be initialized after DOM ready

/* ── Safe Element Getter ────────────────────────────────────────── */
function getEl(id) {
  var el = document.getElementById(id);
  if (!el) console.warn('Element not found: #' + id);
  return el;
}

/* ── Hint Function ──────────────────────────────────────────────── */
var ALL_WORDS = {};
if (typeof SAGE_WORDS !== 'undefined') {
  Object.keys(SAGE_WORDS).forEach(function (k) {
    SAGE_WORDS[k].forEach(function (w) { ALL_WORDS[w] = k; });
  });
}
var WORD_LIST = Object.keys(ALL_WORDS);

function sageHint(cm) {
  var cur = cm.getCursor(), tok = cm.getTokenAt(cur);
  var word = tok.string.replace(/[^\w]/g, '');
  var from = { line: cur.line, ch: tok.start };
  var to   = { line: cur.line, ch: cur.ch };
  var results = [];
  if (word.length >= 1) {
    var lower = word.toLowerCase();
    WORD_LIST.forEach(function (w) {
      if (w.toLowerCase().indexOf(lower) === 0 && w !== word)
        results.push({ text: w, displayText: w,
          render: function (el, s, d) { el.innerHTML = d.text + '<span class="hint-kind">' + ALL_WORDS[d.text] + '</span>'; }
        });
    });
  }
  var any = CodeMirror.hint.anyword(cm);
  if (any && any.list) {
    any.list.forEach(function (w) {
      var t = (typeof w === 'string') ? w : w.text;
      if (!ALL_WORDS[t] && t !== word)
        results.push({ text: t, displayText: t,
          render: function (el, s, d) { el.innerHTML = d.text + '<span class="hint-kind">buffer</span>'; }
        });
    });
  }
  results.sort(function (a, b) { return a.text.localeCompare(b.text); });
  return { list: results, from: from, to: to };
}

/* ── Initialize Editor ──────────────────────────────────────────── */
function initEditor() {
  var editorContainer = getEl('editor');
  if (!editorContainer) return false;

  editor = CodeMirror(editorContainer, {
    value: '',
    mode: 'python',
    theme: 'default',
    lineNumbers: true,
    indentUnit: 4,
    tabSize: 4,
    smartIndent: true,
    indentWithTabs: false,
    matchBrackets: true,
    autoCloseBrackets: true,
    extraKeys: {
      'Shift-Enter': function () { runCode(); },
      'Ctrl-Space':  function (cm) { cm.showHint({ hint: sageHint, completeSingle: false }); },
      'Ctrl-/': function (cm) { cm.toggleComment(); },
      'Ctrl-\\': function (cm) { cm.toggleComment({ fullLines: false }); },
      'Tab': function (cm) {
        if (cm.somethingSelected()) {
          cm.indentSelection('add');
        } else {
          cm.execCommand('insertSoftTab');
        }
      },
      'Shift-Tab': function (cm) {
        cm.indentSelection('subtract');
      }
    },
    hintOptions: { hint: sageHint, completeSingle: false }
  });

  editor.on('change', function () {
    var f = getFile(activeFileId);
    if (f) f.content = editor.getValue();
  });

  return true;
}

/* ── File Helpers ───────────────────────────────────────────────── */
function getFile(id) { return files.find(function (f) { return f.id === id; }); }

function saveActiveFile() {
  var f = getFile(activeFileId);
  if (f) f.content = editor.getValue();
}

function switchToFile(id) {
  saveActiveFile();
  activeFileId = id;
  var f = getFile(id);
  if (f) editor.setValue(f.content);
  renderTabs();
  editor.focus();
}

function addFile(name) {
  fileCounter++;
  var id = 'file_' + fileCounter + '_' + Date.now();
  var fname = name || 'untitled_' + fileCounter + '.sage';
  files.push({ id: id, name: fname, content: '# ' + fname + '\n', isMain: false });
  switchToFile(id);
}

function removeFile(id) {
  var idx = files.findIndex(function (f) { return f.id === id; });
  if (idx === -1) return;
  files.splice(idx, 1);
  if (activeFileId === id) switchToFile('main');
  else renderTabs();
}

function escHtml(s) { 
  var d = document.createElement('div'); 
  d.textContent = s; 
  return d.innerHTML; 
}

/* ── Drag & Drop ────────────────────────────────────────────────── */
function handleDragStart(e) {
  draggedFileId = this.dataset.id;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.id);
}
function handleDragOver(e) {
  if (!draggedFileId || this.dataset.id === draggedFileId) return;
  var f = getFile(this.dataset.id);
  if (!f || f.isMain) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  var rect = this.getBoundingClientRect();
  var mid  = rect.left + rect.width / 2;
  if (e.clientX < mid) {
    this.classList.add('drag-over-left');
    this.classList.remove('drag-over-right');
  } else {
    this.classList.remove('drag-over-left');
    this.classList.add('drag-over-right');
  }
}
function handleDragLeave() { 
  this.classList.remove('drag-over-left', 'drag-over-right'); 
}
function handleDrop(e) {
  e.preventDefault();
  var tid = this.dataset.id, tf = getFile(tid);
  this.classList.remove('drag-over-left', 'drag-over-right');
  if (!tf || tf.isMain || !draggedFileId || draggedFileId === tid) return;
  var rect = this.getBoundingClientRect();
  var before = e.clientX < rect.left + rect.width / 2;
  var fromIdx = files.findIndex(function (f) { return f.id === draggedFileId; });
  if (fromIdx === -1) return;
  var item = files.splice(fromIdx, 1)[0];
  var toIdx = files.findIndex(function (f) { return f.id === tid; });
  if (!before) toIdx++;
  files.splice(toIdx, 0, item);
  draggedFileId = null;
  renderTabs();
}
function handleDragEnd() {
  draggedFileId = null;
  document.querySelectorAll('.file-tab').forEach(function (t) {
    t.classList.remove('dragging', 'drag-over-left', 'drag-over-right');
  });
}

/* ── Render Tabs ────────────────────────────────────────────────── */
function renderTabs() {
  var bar = getEl('file-tabs-bar');
  if (!bar) return;
  var addBtn = getEl('add-tab-btn');
  bar.querySelectorAll('.file-tab').forEach(function (t) { t.remove(); });

  files.forEach(function (f) {
    var tab = document.createElement('div');
    tab.className = 'file-tab' + (f.id === activeFileId ? ' active' : '') + (f.isMain ? ' main-tab' : '');
    tab.dataset.id = f.id;
    tab.innerHTML =
      '<svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
      '<span class="tab-name">' + escHtml(f.name) + '</span>' +
      (f.isMain ? '<span class="tab-badge">entry</span>' : '') +
      '<span class="tab-close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></span>';

    tab.addEventListener('click', function (e) {
      if (e.target.closest('.tab-close')) return;
      switchToFile(f.id);
    });
    tab.addEventListener('dblclick', function (e) {
      if (e.target.closest('.tab-close')) return;
      openRenameModal(f.id);
    });

    if (!f.isMain) {
      tab.querySelector('.tab-close').addEventListener('click', function (e) {
        e.stopPropagation();
        removeFile(f.id);
      });
      tab.draggable = true;
      tab.addEventListener('dragstart', handleDragStart);
      tab.addEventListener('dragover', handleDragOver);
      tab.addEventListener('dragleave', handleDragLeave);
      tab.addEventListener('drop', handleDrop);
      tab.addEventListener('dragend', handleDragEnd);
    }
    bar.insertBefore(tab, addBtn);
  });
  updateRunOrder();
}

function updateRunOrder() {
  var el = getEl('run-order-text');
  if (!el) return;
  var helpers = files.filter(function (f) { return !f.isMain; });
  var parts = helpers.map(function (f) { return f.name; });
  var mainFile = getFile('main');
  parts.push(mainFile ? mainFile.name : 'main.sage');
  el.innerHTML = parts.map(function (n) { return '<em>' + escHtml(n) + '</em>'; }).join(' → ');
}

/* ── Rename Modal ───────────────────────────────────────────────── */
var renameFileId = null;

function openRenameModal(id) {
  var f = getFile(id); 
  if (!f) return;
  renameFileId = id;
  var input = getEl('rename-input');
  if (input) {
    input.value = f.name;
    input.focus();
    input.select();
  }
  var modal = getEl('rename-modal');
  if (modal) modal.classList.add('open');
}

function closeRenameModal() { 
  var modal = getEl('rename-modal');
  if (modal) modal.classList.remove('open'); 
  renameFileId = null; 
}

function doRename() {
  if (!renameFileId) return;
  var input = getEl('rename-input');
  if (!input) return;
  var val = input.value.trim();
  if (!val) { closeRenameModal(); return; }
  if (!val.endsWith('.sage') && !val.endsWith('.py')) val += '.sage';
  var f = getFile(renameFileId);
  if (f) f.name = val;
  closeRenameModal();
  renderTabs();
}

/* ── Toast ──────────────────────────────────────────────────────── */
function showToast(msg, type) {
  var el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' toast-error' : '') + (type === 'success' ? ' toast-success' : '');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(function () { el.classList.add('show'); }, 20);
  setTimeout(function () {
    el.classList.remove('show');
    setTimeout(function () { el.remove(); }, 300);
  }, 2800);
}

/* ── Theme Toggle ───────────────────────────────────────────────── */
function toggleTheme() {
  isDark = !isDark;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  if (editor) editor.setOption('theme', isDark ? 'dracula' : 'default');
  var moon = getEl('icon-moon');
  var sun = getEl('icon-sun');
  if (moon) moon.style.display = isDark ? 'none' : '';
  if (sun) sun.style.display  = isDark ? '' : 'none';
}

/* ── Download Project (JSON) ────────────────────────────────────── */
function downloadProject() {
  saveActiveFile();
  var helpers  = files.filter(function (f) { return !f.isMain; });
  var mainFile = getFile('main');
  var ordered  = [];

  helpers.forEach(function (f, i) {
    ordered.push({ order: i + 1, name: f.name, content: f.content, isMain: false });
  });
  ordered.push({ order: ordered.length + 1, name: mainFile.name, content: mainFile.content, isMain: true });

  var data = { sagecell_project: true, version: 1, fileCount: ordered.length, files: ordered };
  var json = JSON.stringify(data, null, 2);
  var blob = new Blob([json], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sage_project.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  showToast('Saved sage_project.json (' + ordered.length + ' files)', 'success');
}

/* ── Upload Project (JSON) ──────────────────────────────────────── */
function uploadProject(file) {
  var reader = new FileReader();
  reader.onload = function (ev) {
    try {
      var data = JSON.parse(ev.target.result);
      if (!data.sagecell_project || !Array.isArray(data.files) || data.files.length === 0) {
        showToast('Invalid project file — expected sagecell_project JSON', 'error');
        return;
      }

      var mainEntry = null;
      var helperEntries = [];
      var sorted = data.files.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });

      sorted.forEach(function (f) {
        if (f.isMain) mainEntry = f;
        else helperEntries.push(f);
      });

      files = [];
      fileCounter = 0;

      files.push({
        id: 'main',
        name: (mainEntry && mainEntry.name) || 'main.sage',
        content: (mainEntry && typeof mainEntry.content === 'string') ? mainEntry.content : '# main.sage\n',
        isMain: true
      });

      helperEntries.forEach(function (f) {
        fileCounter++;
        files.push({
          id: 'file_' + fileCounter + '_' + Date.now() + '_' + fileCounter,
          name: f.name || ('untitled_' + fileCounter + '.sage'),
          content: (typeof f.content === 'string') ? f.content : '',
          isMain: false
        });
      });

      activeFileId = 'main';
      if (editor) editor.setValue(files[0].content);
      renderTabs();
      showToast('Loaded ' + files.length + ' file' + (files.length > 1 ? 's' : '') + ' from ' + file.name, 'success');
    } catch (err) {
      showToast('Error reading file: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

/* ── Run Code ───────────────────────────────────────────────────── */
function runCode() {
  saveActiveFile();
  var helpers  = files.filter(function (f) { return !f.isMain; });
  var mainFile = getFile('main');
  var parts    = [];

  helpers.forEach(function (f) {
    parts.push('# ── ' + f.name + ' ──');
    parts.push(f.content);
  });
  parts.push('# ── ' + mainFile.name + ' ──');
  parts.push(mainFile.content);

  var code = parts.join('\n\n');
  if (!code.trim()) return;

  var es = getEl('empty-state');
  if (es) es.style.display = 'none';

  var ta = document.querySelector('#sagecell-hidden .sagecell_commands');
  if (ta) { ta.value = code; ta.dispatchEvent(new Event('change')); }
  var cmEl = document.querySelector('#sagecell-hidden .CodeMirror');
  if (cmEl && cmEl.CodeMirror) cmEl.CodeMirror.setValue(code);
  var btn = document.querySelector('#sagecell-hidden .sagecell_evalButton');
  if (btn) btn.click();
}

function clearOutput() {
  var output = getEl('output');
  if (!output) return;
  output.innerHTML =
    '<div class="empty-state" id="empty-state">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:40px;height:40px;opacity:0.4"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>' +
    '<p>Run your code to see results here</p></div>';
    
}


/* ── Data Import / Export ───────────────────────────────────────── */

var dataModal = null;
var datagridModal = null;
var currentGridData = null; // Stores data being edited in DataGrid XL
var gridInstance = null; // DataGrid XL instance

function initDataFeatures() {
  dataModal = getEl('data-modal');
  datagridModal = getEl('datagrid-modal');
  
  // Wire data button
  var dataBtn = getEl('data-btn');
  if (dataBtn) dataBtn.addEventListener('click', openDataModal);
  
  // Wire cancel button
  var cancelBtn = getEl('data-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', closeDataModal);
  
  // Close on backdrop click
  if (dataModal) {
    dataModal.addEventListener('click', function(e) { 
      if (e.target === dataModal) closeDataModal(); 
    });
  }
  
  // Import buttons
  var importExcelBtn = getEl('import-excel-btn');
  if (importExcelBtn) {
    importExcelBtn.addEventListener('click', function() {
      var input = getEl('excel-upload-input');
      if (input) input.click();
    });
  }
  
  var importCsvBtn = getEl('import-csv-btn');
  if (importCsvBtn) {
    importCsvBtn.addEventListener('click', function() {
      var input = getEl('csv-upload-input');
      if (input) input.click();
    });
  }
  
  // Edit data button
  var editDataBtn = getEl('edit-data-btn');
    if (editDataBtn) {
    editDataBtn.addEventListener('click', function () {
        saveActiveFile();

        var nameInput = getEl('dataframe-name-input');
        var dfName = nameInput ? nameInput.value.trim() : 'df';
        if (!dfName) dfName = 'df';

        var block = findDataFrameBlock(dfName);
        closeDataModal();

        if (block) {
        openDataGridEditor(block.data, dfName);
        } else {
        // No existing block — start fresh
        openDataGridEditor(null, dfName);
        }
    });
    }
  
  // File inputs
  var excelInput = getEl('excel-upload-input');
  if (excelInput) {
    excelInput.addEventListener('change', function(e) {
      var f = e.target.files[0];
      if (f) {
        importExcelForEdit(f);
        this.value = '';
      }
    });
  }
  
  var csvInput = getEl('csv-upload-input');
  if (csvInput) {
    csvInput.addEventListener('change', function(e) {
      var f = e.target.files[0];
      if (f) {
        importCsvForEdit(f);
        this.value = '';
      }
    });
  }
  
  // Export buttons
  var exportExcelBtn = getEl('export-excel-btn');
  if (exportExcelBtn) exportExcelBtn.addEventListener('click', exportToExcel);
  
  var exportCsvBtn = getEl('export-csv-btn');
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportToCsv);
  
  // DataGrid modal buttons
  var datagridCancel = getEl('datagrid-cancel');
  if (datagridCancel) datagridCancel.addEventListener('click', closeDataGridEditor);
  
  var datagridSave = getEl('datagrid-save');
  if (datagridSave) datagridSave.addEventListener('click', saveDataGridAndInsert);
  
  // Close datagrid on backdrop
  if (datagridModal) {
    datagridModal.addEventListener('click', function(e) {
      if (e.target === datagridModal) closeDataGridEditor();
    });
  }
}

function openDataModal() {
  if (dataModal) dataModal.classList.add('open');
  var input = getEl('dataframe-name-input');
  if (input) input.focus();
}

function closeDataModal() {
  if (dataModal) dataModal.classList.remove('open');
}

/* ── DataGrid XL Editor ─────────────────────────────────────────── */

function openDataGridEditor(initialData, dfName) {
  if (!datagridModal) return;
  
  // Set default data if not provided
  if (!initialData) {
    initialData = [
      ['Column1', 'Column2', 'Column3'],
      ['', '', ''],
      ['', '', '']
    ];
  }
  
  currentGridData = initialData;
  
  // Set DataFrame name
  var nameInput = getEl('datagrid-df-name');
  if (nameInput) nameInput.value = dfName || 'df';
  
  // Show modal
  datagridModal.classList.add('open');
  
  // Initialize DataGrid XL after modal is visible (needs dimensions)
  setTimeout(function() {
    initDataGridXL(initialData);
  }, 50);
}

function closeDataGridEditor() {
  if (datagridModal) datagridModal.classList.remove('open');
  
  // Destroy grid instance to free memory
  if (gridInstance) {
    try {
      gridInstance.destroy();
    } catch(e) {
      // Ignore destroy errors
    }
    gridInstance = null;
  }
  
  currentGridData = null;
}

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
    
    // Row number
    var rowNum = document.createElement('td');
    rowNum.textContent = r.toString();
    rowNum.style.background = 'var(--bg-hover)';
    rowNum.style.border = '1px solid var(--border)';
    rowNum.style.textAlign = 'center';
    rowNum.style.color = 'var(--text-3)';
    rowNum.style.fontSize = '11px';
    tr.appendChild(rowNum);
    
    for (var c = 0; c < numCols; c++) {
      var td = document.createElement('td');
      td.style.padding = '6px 8px';
      td.style.border = '1px solid var(--border)';
      
      var input = document.createElement('input');
      input.type = 'text';
      input.value = data[r] && data[r][c] !== undefined ? data[r][c] : '';
      input.style.width = '100%';
      input.style.border = 'none';
      input.style.background = 'transparent';
      input.style.color = 'var(--text)';
      input.dataset.row = r.toString();
      input.dataset.col = c.toString();
      
      td.appendChild(input);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  
  // Add empty rows if needed
  var minRows = Math.max(5, data.length + 2);
  for (var er = data.length; er < minRows; er++) {
    var tr = document.createElement('tr');
    
    var rowNum = document.createElement('td');
    rowNum.textContent = er.toString();
    rowNum.style.background = 'var(--bg-hover)';
    rowNum.style.border = '1px solid var(--border)';
    rowNum.style.textAlign = 'center';
    rowNum.style.color = 'var(--text-3)';
    rowNum.style.fontSize = '11px';
    tr.appendChild(rowNum);
    
    for (var c = 0; c < numCols; c++) {
      var td = document.createElement('td');
      td.style.padding = '6px 8px';
      td.style.border = '1px solid var(--border)';
      
      var input = document.createElement('input');
      input.type = 'text';
      input.value = '';
      input.style.width = '100%';
      input.style.border = 'none';
      input.style.background = 'transparent';
      input.style.color = 'var(--text)';
      input.dataset.row = er.toString();
      input.dataset.col = c.toString();
      
      td.appendChild(input);
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

function getDataFromEditor() {
  if (!gridInstance) return currentGridData || [['Column1'], ['']];
  
  try {
    if (gridInstance.isSimpleTable) {
      return gridInstance.getData();
    }
    // DataGrid XL native method
    return gridInstance.getData();
  } catch (err) {
    console.error('Error getting data from editor:', err);
    return currentGridData || [['Column1'], ['']];
  }
}

function saveDataGridAndInsert() {
  var data = getDataFromEditor();

  // Drop completely empty rows
  var filteredData = data.filter(function (row) {
    return row.some(function (cell) {
      return cell !== '' && cell !== null && cell !== undefined;
    });
  });
  if (filteredData.length === 0) filteredData = [['Column1'], ['']];

  var nameInput = getEl('datagrid-df-name');
  var dfName = nameInput ? nameInput.value.trim() : 'df';
  if (!dfName) dfName = 'df';

  // Keep the outer modal's name field in sync
  var mainNameInput = getEl('dataframe-name-input');
  if (mainNameInput) mainNameInput.value = dfName;

  saveActiveFile();

  var existing = findDataFrameBlock(dfName);
  var newBlock = buildDataFrameBlock(dfName, filteredData);

  if (existing) {
    // Replace the block in its original file
    var f = existing.file;
    f.content =
      f.content.slice(0, existing.blockStart) +
      newBlock +
      f.content.slice(existing.blockEnd);

    // If that file is the active one, refresh the editor buffer
    if (f.id === activeFileId && editor) {
      var cur = editor.getCursor();
      editor.setValue(f.content);
      try { editor.setCursor(cur); } catch (_) {}
    }
    showToast('Updated DataFrame "' + dfName + '"', 'success');
  } else {
    // No existing block — insert at cursor in the active file
    if (editor) {
      editor.replaceRange(newBlock, editor.getCursor());
      editor.focus();
    }
    showToast('Inserted DataFrame "' + dfName + '"', 'success');
  }

  closeDataGridEditor();
}

/* ── Import for Editing ─────────────────────────────────────────── */

function importExcelForEdit(file) {
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = e.target.result;
      var workbook = XLSX.read(data, { type: 'binary' });
      var firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      var jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
      
      if (jsonData.length === 0) {
        showToast('Excel file is empty', 'error');
        return;
      }
      
      openDataGridEditor(jsonData);
      showToast('Excel loaded for editing', 'success');
    } catch (err) {
      console.error('Excel import error:', err);
      showToast('Failed to import Excel: ' + err.message, 'error');
    }
  };
  reader.readAsBinaryString(file);
}

function importCsvForEdit(file) {
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var csvText = e.target.result;
      var jsonData = parseCsvToArray(csvText);
      
      if (jsonData.length === 0) {
        showToast('CSV file is empty', 'error');
        return;
      }
      
      openDataGridEditor(jsonData);
      showToast('CSV loaded for editing', 'success');
    } catch (err) {
      console.error('CSV import error:', err);
      showToast('Failed to import CSV: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

/* ── Original Import/Export (direct insert) ─────────────────────── */

// Import Excel file directly (no editing)
function importExcelFile(file) {
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = e.target.result;
      var workbook = XLSX.read(data, { type: 'binary' });
      var firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      var jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
      
      if (jsonData.length === 0) {
        showToast('Excel file is empty', 'error');
        return;
      }
      
      insertDataFrameCode(jsonData);
      showToast('Excel imported successfully', 'success');
    } catch (err) {
      console.error('Excel import error:', err);
      showToast('Failed to import Excel: ' + err.message, 'error');
    }
  };
  reader.readAsBinaryString(file);
}

// Import CSV file directly (no editing)
function importCsvFile(file) {
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var csvText = e.target.result;
      var jsonData = parseCsvToArray(csvText);
      
      if (jsonData.length === 0) {
        showToast('CSV file is empty', 'error');
        return;
      }
      
      insertDataFrameCode(jsonData);
      showToast('CSV imported successfully', 'success');
    } catch (err) {
      console.error('CSV import error:', err);
      showToast('Failed to import CSV: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

// Parse CSV text to array of arrays
function parseCsvToArray(csvText) {
  var lines = csvText.split(/\r\n|\n/);
  var result = [];
  
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line === '') continue;
    
    var row = [];
    var current = '';
    var inQuotes = false;
    
    for (var j = 0; j < line.length; j++) {
      var char = line[j];
      
      if (char === '"') {
        if (inQuotes && j + 1 < line.length && line[j + 1] === '"') {
          current += '"';
          j++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((char === ',' || char === ';') && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    result.push(row);
  }
  
  return result;
}

// Insert DataFrame code into current file
function insertDataFrameCode(jsonData) {
  var nameInput = getEl('dataframe-name-input');
  var dfName = nameInput ? nameInput.value.trim() : 'df';
  if (!dfName) dfName = 'df';

  var code = buildDataFrameBlock(dfName, jsonData);

  if (editor) {
    var cursor = editor.getCursor();
    editor.replaceRange(code, cursor);
    editor.focus();
  }
  closeDataModal();
}

/* ── DataFrame Block Parsing ───────────────────────────────────── */

function reEscape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Build the exact text insertDataFrameCode produces, for a given name + data.
// Keeping format here in ONE place guarantees parser + writer stay in sync.
function buildDataFrameBlock(dfName, jsonData) {
  var jsonString = JSON.stringify(jsonData);
  return [
    '# ── DataFrame: ' + dfName + ' ──',
    dfName + '_name = "' + dfName + '"',
    'import pandas as pd, json',
    dfName + '_raw = r\'\'\'' + jsonString + '\'\'\'',
    dfName + '_json = json.loads(' + dfName + '_raw)',
    dfName + ' = pd.DataFrame(' + dfName + '_json[1:], columns=' + dfName + '_json[0])',
    'print(f"DataFrame \'{' + dfName + '_name}\' created | Shape: {' + dfName + '.shape} | Columns: {list(' + dfName + '.columns)}")',
    ''
  ].join('\n');
}

// Find a DataFrame block by name across all files.
// Returns { file, blockStart, blockEnd, blockText, data } or null.
function findDataFrameBlock(dfName) {
  var name = reEscape(dfName);

  // Matches the exact block buildDataFrameBlock/insertDataFrameCode emits.
  // Anchored on the header comment and the trailing print() line so we can
  // safely replace the whole block in place.
  //
  // Note: triple-quoted raw string:  <name>_raw = r'''...'''
  var re = new RegExp(
    '# ── DataFrame: ' + name + ' ──\\n' +
    name + '_name = "' + name + '"\\n' +
    'import pandas as pd, json\\n' +
    name + "_raw = r'''([\\s\\S]*?)'''\\n" +
    name + '_json = json\\.loads\\(' + name + '_raw\\)\\n' +
    name + ' = pd\\.DataFrame\\(' + name + '_json\\[1:\\], columns=' + name + '_json\\[0\\]\\)\\n' +
    'print\\(f"DataFrame[^\\n]*\\)\\n?'
  );

  for (var i = 0; i < files.length; i++) {
    var content = files[i].content;
    var m = re.exec(content);
    if (m) {
      try {
        return {
          file: files[i],
          blockStart: m.index,
          blockEnd: m.index + m[0].length,
          blockText: m[0],
          data: JSON.parse(m[1])
        };
      } catch (e) {
        console.error('DataFrame block for "' + dfName + '" has invalid JSON:', e);
        return null;
      }
    }
  }
  return null;
}

/* ── Export (pure JS, no Python round-trip) ────────────────────── */

function getExportTarget() {
  var nameInput = getEl('dataframe-name-input');
  var dfName = nameInput ? nameInput.value.trim() : 'df';
  if (!dfName) dfName = 'df';

  // Make sure the editor buffer is reflected in files[].content
  saveActiveFile();

  var block = findDataFrameBlock(dfName);
  if (!block) {
    showToast('No DataFrame named "' + dfName + '" found in the code', 'error');
    return null;
  }
  return { dfName: dfName, data: block.data };
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
}

function exportToExcel() {
  var target = getExportTarget();
  if (!target) return;

  try {
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet(target.data);
    XLSX.utils.book_append_sheet(wb, ws, target.dfName.slice(0, 31)); // Excel sheet name limit
    var wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    var blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    triggerDownload(blob, target.dfName + '_' + timestamp() + '.xlsx');
    showToast('Exported ' + target.dfName + ' to Excel', 'success');
    closeDataModal();
  } catch (e) {
    console.error(e);
    showToast('Excel export failed: ' + e.message, 'error');
  }
}

function exportToCsv() {
  var target = getExportTarget();
  if (!target) return;

  try {
    var csv = convertArrayToCsv(target.data);
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, target.dfName + '_' + timestamp() + '.csv');
    showToast('Exported ' + target.dfName + ' to CSV', 'success');
    closeDataModal();
  } catch (e) {
    console.error(e);
    showToast('CSV export failed: ' + e.message, 'error');
  }
}

function triggerDownload(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 100);
}

function convertArrayToCsv(data) {
  return data.map(function(row) {
    return row.map(function(field) {
      var str = String(field).replace(/"/g, '""');
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes(';')) {
        return '"' + str + '"';
      }
      return str;
    }).join(';');
  }).join('\n');
}

function wireButtons() {
  var addTabBtn = getEl('add-tab-btn');
  if (addTabBtn) addTabBtn.addEventListener('click', function () { addFile(); });

  var downloadBtn = getEl('download-btn');
  if (downloadBtn) downloadBtn.addEventListener('click', downloadProject);

  var uploadBtn = getEl('upload-btn');
  if (uploadBtn) {
    uploadBtn.addEventListener('click', function () {
      var input = getEl('file-upload-input');
      if (input) input.click();
    });
  }

  var fileUploadInput = getEl('file-upload-input');
  if (fileUploadInput) {
    fileUploadInput.addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (f) uploadProject(f);
      this.value = '';
    });
  }

  var themeBtn = getEl('theme-btn');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  var runBtn = getEl('run');
  if (runBtn) runBtn.addEventListener('click', runCode);

  var clearBtn = getEl('clear');
  if (clearBtn) clearBtn.addEventListener('click', clearOutput);

  // Rename modal
  var renameCancel = getEl('rename-cancel');
  if (renameCancel) renameCancel.addEventListener('click', closeRenameModal);

  var renameSave = getEl('rename-save');
  if (renameSave) renameSave.addEventListener('click', doRename);

  var renameInput = getEl('rename-input');
  if (renameInput) {
    renameInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doRename();
      if (e.key === 'Escape') closeRenameModal();
    });
  }

  var renameModal = getEl('rename-modal');
  if (renameModal) {
    renameModal.addEventListener('click', function (e) {
      if (e.target === renameModal) closeRenameModal();
    });
  }

  // Single keyboard-shortcut listener
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
      e.preventDefault();
      closeDataModal();
      openDataGridEditor();
      return;
    }
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 'd') {
      e.preventDefault();
      openDataModal();
    }
  });
}

/* ── Drag & Drop for JSON Project Files ────────────────────────── */
function setupDragDrop() {
  var editorElement = getEl('editor');
  if (!editorElement) return;

  editorElement.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    var file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.json')) {
      e.dataTransfer.dropEffect = 'copy';
      document.body.classList.add('dragging-json-file');
    }
  }, true);

  editorElement.addEventListener('dragleave', function(e) {
    e.preventDefault();
    e.stopPropagation();
    document.body.classList.remove('dragging-json-file');
  }, true);

  editorElement.addEventListener('drop', function(e) {
    e.preventDefault();
    e.stopPropagation();
    document.body.classList.remove('dragging-json-file');
    
    var file = e.dataTransfer.files[0];
    if (!file) return;
    
    if (file.name.endsWith('.json')) {
      uploadProject(file);
    }
  }, true);

  if (editor) {
    editor.on('drop', function(cm, e) {
      var file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.json')) {
        return false;
      }
    });
  }
}

/* ── Initialization ─────────────────────────────────────────────── */
function init() {
  if (!initEditor()) {
    console.error('Failed to initialize editor');
    return;
  }
  
  wireButtons();
  initDataFeatures();
  setupDragDrop();
  renderTabs();
  switchToFile('main');
  
  console.log('SageMath IDE initialized');
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

