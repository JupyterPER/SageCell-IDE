(function (IDE) {
  const store = IDE.store, S = store.state;
  const H_BEGIN = '# ═══ SAGEIDE:BEGIN', H_END = '# ═══ SAGEIDE:END';
  const normalize = function (t) { return t.replace(/^\ufeff/, '').replace(/\r\n?/g, '\n'); };
  const base = function (p) { return p.split('/').pop(); };

  /* ── header written into main.sage of a ZIP ── */
  function buildHeader() {
    const pl = store.pipeline(), helpers = pl.filter(function (f) { return !f.isMain; });
    const usesDf = S.files.some(function (f) { return f.status === 'active' && f.doc.getValue().indexOf('__ide_df__(') >= 0; });
    if (!helpers.length && !usesDf) return '';
    const L = [H_BEGIN + ' (auto-generated – do not edit) ═══',
               '# project: ' + S.name,
               '# order: ' + pl.map(function (f) { return f.name; }).join(', ')];
    if (usesDf) L.push(IDE.data.PRELUDE);
    helpers.forEach(function (f) { L.push("load('" + f.name + "')"); });
    L.push(H_END + ' ═══', '');
    return L.join('\n') + '\n';
  }
  /** Remove the generated header; returns the helper order it declared (if any). */
  function stripHeader(text) {
    const a = text.indexOf(H_BEGIN); if (a < 0) return { text: text, order: null };
    const b = text.indexOf(H_END, a); if (b < 0) return { text: text, order: null };
    const nl = text.indexOf('\n', b), header = text.slice(a, b);
    let order = null, m = /^# order:\s*(.+)$/m.exec(header);
    if (m) order = m[1].split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    else {
      const re = /load\(\s*['"]([^'"]+)['"]\s*\)/g; order = [];
      while ((m = re.exec(header))) order.push(m[1]);
      if (!order.length) order = null;
    }
    return { text: (text.slice(0, a) + text.slice(nl < 0 ? text.length : nl + 1)).replace(/^\n+/, ''), order: order };
  }

  /* ── JSON v2 export / import ── */
  function exportJson() {
    const snap = store.snapshot();
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
    IDE.download(blob, IDE.slug(S.name) + '.json');
  }
  function importJson(text) {
    let snap = null;
    try { snap = JSON.parse(text); } catch (e) { return IDE.toast('Not a valid JSON project file', 'error'); }
    if (!snap || snap.schema !== 2 || !Array.isArray(snap.files)) return IDE.toast('Not a SageIDE v2 project file', 'error');
    if (snap.files.some(function (f) { return f.isMain; }) &&
        !confirm('Replace the current project with "' + (snap.name || 'imported project') + '"?')) return;
    store.replaceAll(snap.files, snap.name);
    (snap.trash || []).forEach(function (d) { S.trash.push(IDE.store.makeFile(d)); });
    IDE.toast('Project loaded', 'success');
  }

  /* ── ZIP export / import ── */
  function exportZip() {
    const zip = new JSZip();
    const pl = store.pipeline();
    const main = pl.length ? pl[pl.length - 1] : null;
    const manifest = { schema: 2, name: S.name, order: pl.map(function (f) { return f.name; }) };
    zip.file('sageide.json', JSON.stringify(manifest, null, 2));
    S.files.forEach(function (f) {
      let content = f.doc.getValue();
      if (f.isMain) content = buildHeader() + content;
      zip.file(f.name, content);
    });
    zip.generateAsync({ type: 'blob' }).then(function (blob) {
      IDE.download(blob, IDE.slug(S.name) + '.zip');
      IDE.toast('Project exported as ZIP', 'success');
    });
  }
  function importZip(file) {
    JSZip.loadAsync(file).then(function (zip) {
      const names = Object.keys(zip.files).filter(function (n) { return !zip.files[n].dir && !/^\./.test(n); });
      const hasManifest = !!zip.files['sageide.json'];
      if (!names.length) return IDE.toast('The ZIP is empty', 'error');
      if (!names.some(function (n) { return /\.(sage|py)$/i.test(n); }))
        return IDE.toast('No .sage or .py files in this ZIP', 'error');
      if (!confirm('Replace the current project with the files from "' + file.name + '"?')) return;

      let order = null, projName = file.name.replace(/\.zip$/i, '');
      const readAll = names.map(function (n) { return zip.files[n].async('string').then(function (t) { return { name: n, text: t }; }); });
      Promise.all(readAll).then(function (entries) {
        const byName = {};
        entries.forEach(function (en) { byName[en.name] = en.text; });
        if (hasManifest) {
          try {
            const man = JSON.parse(byName['sageide.json']);
            if (man.order) order = man.order;
            if (man.name) projName = man.name;
          } catch (e) {}
        }
        let files = entries.filter(function (en) { return /\.(sage|py)$/i.test(en.name); });
        if (order && order.length) {
          files.sort(function (a, b) {
            const ia = order.indexOf(a.name), ib = order.indexOf(b.name);
            return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
          });
        }
        const list = files.map(function (en) {
          const stripped = stripHeader(en.text);
          return { name: en.name, content: stripped.text, status: 'active' };
        });
        if (!list.length) return IDE.toast('No usable files found', 'error');
        const mainEntry = list.reduce(function (best, f) {
          return /main/i.test(f.name) && !/main/i.test(best.name) ? f : best;
        }, list[0]);
        mainEntry.isMain = true;
        store.replaceAll(list, projName);
        IDE.toast('Project "' + projName + '" loaded', 'success');
      });
    }, function (err) {
      IDE.toast('Could not read the ZIP: ' + (err && err.message || err), 'error');
    });
  }

  /* ── single .sage / .py file open ── */
  function importSingle(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const stripped = stripHeader(normalize(e.target.result));
      store.addFile(file.name, stripped.text);
      IDE.toast('"' + file.name + '" added to the project', 'success');
    };
    reader.readAsText(file);
  }

  /* ── the Save / Export menu ── */
  function exportMenu(x, y) {
    IDE.menu.show(x, y, [
      { label: S.name + '.zip (whole project, with manifest)', fn: exportZip },
      { label: S.name + '.json (IDE format, exact restore)', fn: exportJson },
      '-',
      { label: 'main.sage only (single file with header)', fn: function () {
        const f = store.pipeline().pop();
        if (!f) return IDE.toast('Nothing to export', 'error');
        IDE.download(new Blob([buildHeader() + f.doc.getValue()], { type: 'text/x-python' }), f.name);
      } }
    ]);
  }

  function handleFiles(files) {
    Array.from(files).forEach(function (file) {
      if (/\.zip$/i.test(file.name)) importZip(file);
      else if (/\.json$/i.test(file.name)) {
        const r = new FileReader();
        r.onload = function (e) { importJson(e.target.result); };
        r.readAsText(file);
      } else if (/\.(sage|py)$/i.test(file.name)) importSingle(file);
      else IDE.toast('Unsupported file: ' + file.name, 'error');
    });
  }

  function init() {
    IDE.$('upload-btn').addEventListener('click', function () { IDE.$('file-upload-input').click(); });
    IDE.$('file-upload-input').addEventListener('change', function (e) {
      handleFiles(e.target.files); e.target.value = '';
    });
    IDE.$('download-btn').addEventListener('click', function (e) {
      const r = e.currentTarget.getBoundingClientRect();
      exportMenu(r.left, r.bottom + 6);
    });

    /* drag & drop anywhere */
    document.addEventListener('dragover', function (e) { e.preventDefault(); });
    document.addEventListener('drop', function (e) {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    });

    /* warn before leaving with unsaved-to-disk work */
    window.addEventListener('beforeunload', function (e) {
      if (store.hasWork()) { e.preventDefault(); e.returnValue = ''; }
    });
  }

  IDE.projectIO = { init: init, exportJson: exportJson, exportZip: exportZip, importZip: importZip,
    buildHeader: buildHeader, stripHeader: stripHeader, handleFiles: handleFiles };
})(window.IDE);
