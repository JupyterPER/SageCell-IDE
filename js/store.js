(function (IDE) {
  const KEY = 'sageide.project.v2';
  const DEFAULT_HELPERS = '# You can write helper functions here\n# Runs before main.sage\n\n';
  const S = { name: 'Untitled project', files: [], trash: [], openTabs: [], activeId: null, counter: 0 };
  const listeners = [];
  let saveTimer = null, warned = false, discarded = false;

  /* ── events + autosave ── */
  function on(fn) { listeners.push(fn); }
  function emit(kind, arg) {
    listeners.forEach(function (fn) { try { fn(kind, arg); } catch (e) { console.error(e); } });
    clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 600);
  }
  function saveNow() {
    if (discarded) return;
    try { localStorage.setItem(KEY, JSON.stringify(snapshot())); }
    catch (e) {
      if (!warned) { warned = true; IDE.toast('Autosave failed (project too large for localStorage). Export regularly!', 'error'); }
    }
  }

  /** Remove the saved project from this browser; the reload that follows boots an empty default project. */
  function discardSession() {
    discarded = true;
    clearTimeout(saveTimer);
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  /* ── model ── */
  function makeFile(d) {
    const f = {
      id: d.id || 'f' + (++S.counter) + '_' + Date.now().toString(36),
      name: d.name, kind: d.kind || 'script', isMain: !!d.isMain,
      status: d.isMain ? 'active' : (d.status || 'active')
    };
    f.doc = new CodeMirror.Doc(d.content || '', 'python');
    f.doc.on('change', function () { emit('content', f.id); });
    return f;
  }
  const get = function (id) { return S.files.find(function (f) { return f.id === id; }) || null; };
  const byName = function (n) { return S.files.find(function (f) { return f.name.toLowerCase() === String(n).toLowerCase(); }) || null; };
  const mainFile = function () { return S.files.find(function (f) { return f.isMain; }); };
  const mainId = function () { const m = mainFile(); return m ? m.id : null; };

  /** Execution order: active helpers in array order, then the entry file. */
  function pipeline() {
    return S.files.filter(function (f) { return f.status === 'active' && !f.isMain; })
      .concat(S.files.filter(function (f) { return f.isMain; }));
  }

  function normalizeName(raw) {
    let n = (raw || '').trim().replace(/[\\/]+/g, '_');
    if (!n) return '';
    if (!/\.(sage|py)$/i.test(n)) n += '.sage';
    return n;
  }
  function uniqueName(name, exceptId) {
    const taken = function (n) {
      return S.files.some(function (f) { return f.id !== exceptId && f.name.toLowerCase() === n.toLowerCase(); });
    };
    if (!taken(name)) return name;
    const m = /^(.*?)(\.[^.]+)$/.exec(name), base = m[1], ext = m[2];
    let i = 2; while (taken(base + '_' + i + ext)) i++;
    return base + '_' + i + ext;
  }

  /* ── tabs (views only, never destructive) ── */
  function openTab(id, silent) {
    if (!get(id)) return;
    if (S.openTabs.indexOf(id) < 0) S.openTabs.push(id);
    S.activeId = id;
    if (!silent) emit('tab');
  }
  function closeTab(id) {
    const i = S.openTabs.indexOf(id);
    if (i < 0) return;
    S.openTabs.splice(i, 1);
    if (S.activeId === id) openTab(S.openTabs[Math.min(i, S.openTabs.length - 1)] || mainId(), true);
    emit('tab');
  }

  /* ── files ── */
  function _add(name, content, o) {
    o = o || {};
    name = uniqueName(normalizeName(name) || 'untitled.sage');
    const f = makeFile({ name: name, content: content == null ? '# ' + name + '\n' : content, status: o.status, kind: o.kind });
    if (o.atStart) S.files.unshift(f);
    else {
      const mi = S.files.findIndex(function (x) { return x.isMain; });
      if (f.status === 'active' && mi >= 0) S.files.splice(mi, 0, f); else S.files.push(f);
    }
    return f;
  }
  function addFile(name, content, o) {
    const f = _add(name, content, o);
    openTab(f.id, true); emit('structure'); return f;
  }
  function addMany(list) {
    list.forEach(function (d) { _add(d.name, d.content, { status: d.status }); });
    emit('structure');
  }
  function replaceAll(list, name) {
    S.files = []; S.trash = []; S.openTabs = [];
    list.forEach(function (d) {
      const f = makeFile({
        name: uniqueName(normalizeName(d.name) || 'untitled.sage'), content: d.content,
        status: d.status, kind: d.kind, isMain: !!d.isMain && !mainFile()
      });
      S.files.push(f);
    });
    if (!mainFile()) S.files.push(makeFile({ name: uniqueName('main.sage'), content: '# main.sage\n', isMain: true }));
    S.name = name || 'Untitled project';
    openTab(mainId(), true);
    emit('structure'); emit('name');
  }
  function rename(id, raw) {
    const f = get(id); if (!f) return 'No such file';
    const n = normalizeName(raw);
    if (!n) return 'Name cannot be empty';
    if (S.files.some(function (x) { return x.id !== id && x.name.toLowerCase() === n.toLowerCase(); })) return 'A file with that name already exists';
    f.name = n; emit('structure'); return null;
  }
  function setName(n) { S.name = (n || '').trim() || 'Untitled project'; emit('name'); }

  /* ── status / ordering ── */
  function setStatus(id, status) {
    const f = get(id); if (!f || f.isMain || f.status === status) return;
    f.status = status; emit('structure');
  }
  function move(id, targetId, before) {
    if (id === targetId) return;
    const i = S.files.findIndex(function (f) { return f.id === id; }); if (i < 0) return;
    const f = S.files.splice(i, 1)[0];
    const j = S.files.findIndex(function (x) { return x.id === targetId; });
    if (j < 0) S.files.push(f); else S.files.splice(before ? j : j + 1, 0, f);
    emit('structure');
  }
  function moveToEnd(id, status) {
    const i = S.files.findIndex(function (f) { return f.id === id; }); if (i < 0) return;
    const f = S.files.splice(i, 1)[0];
    const mi = S.files.findIndex(function (x) { return x.isMain; });
    if (status === 'active' && mi >= 0) S.files.splice(mi, 0, f); else S.files.push(f);
    emit('structure');
  }
  /** Re-assign the active helper slots with a new order (used by auto-sort). */
  function setHelperOrder(list) {
    const slots = [];
    S.files.forEach(function (f, i) { if (f.status === 'active' && !f.isMain) slots.push(i); });
    slots.forEach(function (pos, k) { S.files[pos] = list[k]; });
    emit('structure');
  }

  /* ── trash ── */
  function trash(id) {
    const f = get(id); if (!f || f.isMain) return null;
    S.files.splice(S.files.indexOf(f), 1);
    S.trash.push(f);
    const t = S.openTabs.indexOf(id);
    if (t >= 0) S.openTabs.splice(t, 1);
    if (S.activeId === id) openTab(S.openTabs[Math.max(0, t - 1)] || mainId(), true);
    emit('structure'); return f;
  }
  function restore(id) {
    const i = S.trash.findIndex(function (f) { return f.id === id; }); if (i < 0) return;
    const f = S.trash.splice(i, 1)[0];
    f.name = uniqueName(f.name, f.id);
    const mi = S.files.findIndex(function (x) { return x.isMain; });
    if (f.status === 'active' && mi >= 0) S.files.splice(mi, 0, f); else S.files.push(f);
    openTab(f.id, true); emit('structure');
  }
  function emptyTrash() { S.trash = []; emit('structure'); }

  /* ── persistence ── */
  const ser = function (f) { return { id: f.id, name: f.name, kind: f.kind, status: f.status, isMain: f.isMain, content: f.doc.getValue() }; };
  function snapshot() {
    return { schema: 2, name: S.name, files: S.files.map(ser), trash: S.trash.map(ser),
             openTabs: S.openTabs, activeId: S.activeId, counter: S.counter };
  }
  function hasWork() {
    return S.files.some(function (f) {
      const v = f.doc.getValue().trim();
      return v && f.doc.getValue() !== DEFAULT_HELPERS && v !== '# main.sage';
    });
  }
  function loadDefault() {
    S.name = 'Untitled project';
    S.files = [makeFile({ name: 'main.sage', content: '', isMain: true }),
               makeFile({ name: 'helpers.sage', content: DEFAULT_HELPERS })];
    S.files.reverse();                                   // helpers first, main last
    S.trash = []; S.openTabs = []; openTab(mainId(), true);
  }
  function init() {
    let snap = null;
    try { snap = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    if (snap && snap.schema === 2 && Array.isArray(snap.files) && snap.files.some(function (f) { return f.isMain; })) {
      S.name = snap.name || S.name; S.counter = snap.counter || 0;
      S.files = snap.files.map(makeFile); S.trash = (snap.trash || []).map(makeFile);
      S.openTabs = (snap.openTabs || []).filter(get);
      S.activeId = get(snap.activeId) ? snap.activeId : mainId();
      if (!S.openTabs.length) S.openTabs = [S.activeId];
    } else loadDefault();
  }

  IDE.store = {
    state: S, on: on, emit: emit, init: init, snapshot: snapshot, makeFile: makeFile,
    get: get, byName: byName, pipeline: pipeline, mainId: mainId, hasWork: hasWork,
    openTab: openTab, closeTab: closeTab,
    addFile: addFile, addMany: addMany, replaceAll: replaceAll, rename: rename, setName: setName,
    setStatus: setStatus, move: move, moveToEnd: moveToEnd, setHelperOrder: setHelperOrder,
    trash: trash, restore: restore, emptyTrash: emptyTrash,
    discardSession: discardSession
  };
})(window.IDE);
