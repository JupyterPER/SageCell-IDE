(function (IDE) {
  const store = IDE.store, S = store.state;
  const cache = new Map();
  const KW = new Set('if else elif for while try except finally with return lambda def class import from as pass break continue raise assert del global nonlocal yield async await not and or in is print'.split(' '));

  function extract(doc) {
    const out = [];
    let ln = 0;
    const push = function (name, kind) { if (name && !KW.has(name)) out.push({ name: name, kind: kind, line: ln }); };
    doc.eachLine(function (h) {
      ln++;
      const t = h.text;
      if (!t || t.length > 500 || t[0] === '#' || /^\s/.test(t)) return;   // top level only, skip data blobs
      let m;
      if ((m = /^(?:async\s+)?def\s+([A-Za-z_]\w*)/.exec(t))) push(m[1], 'function');
      else if ((m = /^class\s+([A-Za-z_]\w*)/.exec(t))) push(m[1], 'class');
      else if ((m = /^([A-Za-z_]\w*)\s*\(\s*[A-Za-z_][\w\s,]*\)\s*=(?!=)/.exec(t))) push(m[1], 'function');   // f(x) = x^2
      else if ((m = /^([A-Za-z_]\w*)\.<([^>]+)>\s*=/.exec(t))) {                                           // R.<x,y> = ...
        push(m[1], 'ring'); m[2].split(',').forEach(function (g) { push(g.trim(), 'generator'); });
      }
      else if ((m = /^var\(\s*(['"])([^'"]+)\1/.exec(t))) m[2].split(/[\s,]+/).forEach(function (v) { push(v, 'symbolic'); });
      else if ((m = /^import\s+(.+)$/.exec(t))) m[1].split(',').forEach(function (p) {
        const mm = /^\s*([\w.]+)(?:\s+as\s+(\w+))?/.exec(p); if (mm) push(mm[2] || mm[1].split('.')[0], 'import');
      });
      else if ((m = /^from\s+\S+\s+import\s+(.+)$/.exec(t))) m[1].replace(/[()]/g, '').split(',').forEach(function (p) {
        const mm = /^\s*(\w+)(?:\s+as\s+(\w+))?/.exec(p); if (mm && mm[1] !== '*') push(mm[2] || mm[1], 'import');
      });
      else if ((m = /^([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s*(?::[^=]+)?=(?!=)/.exec(t))) m[1].split(',').forEach(function (v) { push(v.trim(), 'variable'); });
    });
    return out;
  }

  function symbolsOf(f) {
    const gen = f.doc.changeGeneration();
    let c = cache.get(f.id);
    if (!c || c.gen !== gen) {
      const dfs = IDE.data ? IDE.data.scanFile(f).map(function (b) {
        return { name: b.name, kind: 'dataframe', line: b.from.line + 1, columns: b.columns() };
      }) : [];
      c = { gen: gen, syms: extract(f.doc).concat(dfs) };
      cache.set(f.id, c);
    }
    return c.syms;
  }

  function stateFor(sf, curId) {
    if (sf.id === curId) return 'same';
    if (sf.status === 'inactive') return 'inactive';
    const p = store.pipeline().map(function (x) { return x.id; });
    const ci = p.indexOf(curId), si = p.indexOf(sf.id);
    return (ci >= 0 && si > ci) ? 'later' : 'ok';
  }

  /** Completion candidates from all project files. */
  function suggest(prefix, curId) {
    const lp = prefix.toLowerCase(), seen = new Set(), out = [];
    S.files.forEach(function (f) {
      symbolsOf(f).forEach(function (s) {
        if (s.name === prefix || s.name.toLowerCase().indexOf(lp) !== 0 || seen.has(s.name)) return;
        seen.add(s.name);
        out.push({ name: s.name, kind: s.kind, file: f.name, state: stateFor(f, curId) });
      });
    });
    return out;
  }

  function columnsOf(dfName) {
    for (let i = 0; i < S.files.length; i++) {
      const s = symbolsOf(S.files[i]).find(function (x) { return x.kind === 'dataframe' && x.name === dfName; });
      if (s) return s.columns || [];
    }
    return [];
  }

  /* ── dependency analysis ── */
  function usedNames(f) {
    const used = new Set();
    f.doc.eachLine(function (h) {
      let t = h.text;
      if (!t || t.length > 500 || /^\s*#/.test(t)) return;
      t = t.replace(/(["'])(?:\\.|(?!\1).)*\1/g, '""').replace(/#.*$/, '');
      const re = /(^|[^\w.])([A-Za-z_]\w*)/g; let m;
      while ((m = re.exec(t))) used.add(m[2]);
    });
    return used;
  }
  /** -> { warnings: {fileId: [msg]}, edges: [[defIdx, useIdx]], act: pipeline } */
  function analyze() {
    const act = store.pipeline();
    const defs = act.map(function (f) { return new Set(symbolsOf(f).map(function (s) { return s.name; })); });
    const warnings = {}, edges = [];
    act.forEach(function (f, i) {
      usedNames(f).forEach(function (n) {
        if (defs[i].has(n)) return;
        const js = [];
        defs.forEach(function (d, j) { if (j !== i && d.has(n)) js.push(j); });
        if (!js.length || js.some(function (j) { return j < i; })) return;
        edges.push([js[0], i]);
        const list = warnings[f.id] = warnings[f.id] || [];
        if (list.length < 5) list.push('"' + n + '" is defined in ' + act[js[0]].name + ', which runs later');
      });
    });
    return { warnings: warnings, edges: edges, act: act };
  }
  /** Stable topological sort of the active helpers (cycles keep their current order). */
  function autoSort() {
    const a = analyze(), helpers = a.act.filter(function (f) { return !f.isMain; });
    const indeg = helpers.map(function () { return 0; }), adj = helpers.map(function () { return []; });
    a.edges.forEach(function (e) {
      const fa = a.act[e[0]], fb = a.act[e[1]];
      if (fa.isMain || fb.isMain) return;
      const ia = helpers.indexOf(fa), ib = helpers.indexOf(fb);
      adj[ia].push(ib); indeg[ib]++;
    });
    const done = new Set(), out = [];
    while (out.length < helpers.length) {
      let k = -1, i;
      for (i = 0; i < helpers.length; i++) if (!done.has(i) && indeg[i] === 0) { k = i; break; }
      if (k < 0) for (i = 0; i < helpers.length; i++) if (!done.has(i)) { k = i; break; }
      done.add(k); out.push(helpers[k]);
      adj[k].forEach(function (j) { indeg[j]--; });
    }
    return out;
  }

  IDE.symbols = { symbolsOf: symbolsOf, suggest: suggest, columnsOf: columnsOf, analyze: analyze, autoSort: autoSort };
})(window.IDE);
