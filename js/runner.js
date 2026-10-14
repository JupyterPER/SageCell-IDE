(function (IDE) {
  const store = IDE.store, S = store.state;
  const MAX_CARDS = 15, LINE_OFFSET = 0;           // adjust LINE_OFFSET if the live cell shifts line numbers (see test #3)
  const OBS = { childList: true, subtree: true, characterData: true };
  let runCounter = 0, linkKey = 'sageide-session';
  const cards = [];

  const seg = function (f, text) { return { file: f, text: text == null ? f.doc.getValue() : text }; };

  /** Concatenate segments; returns code + a source map for error links. */
  function compose(segs) {
    const lines = [], map = [];
    const add = function (file, text, title) {
      lines.push('# ── ' + title + ' ──');
      const start = lines.length + 1;                       // 1-based line of the first content line
      const parts = text.split('\n');
      for (let i = 0; i < parts.length; i++) lines.push(parts[i]);
      map.push({ id: file ? file.id : null, name: title, start: start, count: parts.length });
      lines.push('');
    };
    if (segs.some(function (s) { return s.text.indexOf('__ide_df__(') >= 0; })) add(null, IDE.data.PRELUDE, 'IDE prelude');
    segs.forEach(function (s) { add(s.file, s.text, s.file.name); });
    return { code: lines.join('\n'), map: map };
  }
  function mapLine(map, n) {
    n -= LINE_OFFSET;
    const m = map.find(function (x) { return n >= x.start && n < x.start + x.count; });
    return m ? { id: m.id, name: m.name, line: n - m.start + 1 } : null;
  }

  /** Make "File "<string>", line N" clickable and mapped to the original file. */
  function linkify(root, map) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [];
    let n;
    while ((n = walker.nextNode())) {
      if (/File "[^"]*", line \d+/.test(n.nodeValue) && !n.parentNode.closest('.err-link')) nodes.push(n);
    }
    nodes.forEach(function (node) {
      const txt = node.nodeValue, re = /(File "[^"]*", )line (\d+)/g, frag = document.createDocumentFragment();
      let last = 0, m;
      while ((m = re.exec(txt))) {
        const hit = mapLine(map, +m[2]); if (!hit) continue;
        frag.appendChild(document.createTextNode(txt.slice(last, m.index) + m[1]));
        const a = document.createElement('a');
        a.className = 'err-link'; a.href = '#'; a.textContent = hit.name + ':' + hit.line;
        if (hit.id) { a.dataset.file = hit.id; a.dataset.line = hit.line; }
        frag.appendChild(a); last = m.index + m[0].length;
      }
      if (last) { frag.appendChild(document.createTextNode(txt.slice(last))); node.parentNode.replaceChild(frag, node); }
    });
  }

  function removeCard(c) {
    c.obs.disconnect();
    try { if (c.info) sagecell.deleteSagecell(c.info); } catch (e) {}
    c.el.remove();
    cards.splice(cards.indexOf(c), 1);
    if (!cards.length) IDE.$('output').classList.remove('has-cards');
  }

  function runSegments(segs, label) {
    if (typeof sagecell === 'undefined') { IDE.toast('SageCell is still loading…', 'error'); return; }
    const built = compose(segs);
    if (!built.code.replace(/^\s*#.*$/gm, '').trim()) { IDE.toast('Nothing to run'); return; }

    const n = ++runCounter, out = IDE.$('output');
    const card = document.createElement('section');
    card.className = 'run-card';
    const head = 'Run #' + n + ' · ' + new Date().toLocaleTimeString() +
      (label && label !== 'all files' ? ' · ' + IDE.esc(label) : '');
    card.innerHTML =
      '<header class="rc-head"><span>' + head + '</span>' +
      '<span class="rc-actions"><button data-a="copy" title="Copy output">⧉</button>' +
      '<button data-a="fold" title="Collapse">–</button><button data-a="remove" title="Remove">✕</button></span></header>' +
      '<div class="rc-in" id="rc-in-' + n + '"><script type="text/x-sage"><\/script></div>' +
      '<div class="rc-out" id="rc-out-' + n + '"></div>';
    card.querySelector('script').textContent = built.code;          // textContent: no HTML escaping issues
    out.insertBefore(card, out.firstChild);                          // newest on top
    out.classList.add('has-cards');
    IDE.$('output-scroll').scrollTop = 0;

    const opts = {
      inputLocation: '#rc-in-' + n, outputLocation: '#rc-out-' + n,
      editor: 'textarea', autoeval: true, replaceOutput: false,
      hide: ['editor', 'evalButton', 'done', 'sessionFiles', 'permalink']
    };
    if (IDE.$('keep-session').checked) { opts.linked = true; opts.linkKey = linkKey; }
    let info = null;
    try { info = sagecell.makeSagecell(opts); }
    catch (e) { console.error(e); IDE.toast('Could not start the Sage cell: ' + e.message, 'error'); }

    const rcOut = card.querySelector('.rc-out');
    const relink = IDE.debounce(function () {
      obs.disconnect();
      try { linkify(rcOut, built.map); } finally { obs.observe(rcOut, OBS); }
    }, 200);
    const obs = new MutationObserver(relink);
    obs.observe(rcOut, OBS);

    cards.push({ el: card, info: info, obs: obs });
    while (cards.length > MAX_CARDS) removeCard(cards[0]);
  }

  /* ── run variants ── */
  function runAll() { runSegments(store.pipeline().map(function (f) { return seg(f); }), 'all files'); }
  function runOnly(id) { const f = store.get(id); if (f) runSegments([seg(f)], f.name + ' only'); }
  function runUpTo(id) {
    const pl = store.pipeline(), i = pl.findIndex(function (f) { return f.id === id; });
    if (i < 0) return runOnly(id);
    runSegments(pl.slice(0, i + 1).map(function (f) { return seg(f); }), 'up to ' + pl[i].name);
  }
  /** Ctrl+Enter: files before the current one + the current file up to the end of the current `# %%` block. */
  function runToCursor() {
    const cm = IDE.editor.cm(), f = store.get(S.activeId); if (!f) return;
    let end = cm.getCursor().line;
    const last = cm.lastLine();
    while (end < last && !/^\s*#\s*%%/.test(cm.getLine(end + 1))) end++;
    const partial = cm.getRange({ line: 0, ch: 0 }, { line: end, ch: cm.getLine(end).length });
    const pl = store.pipeline(), i = pl.findIndex(function (x) { return x.id === f.id; });
    const before = i < 0 ? [] : pl.slice(0, i);
    runSegments(before.map(function (x) { return seg(x); }).concat([seg(f, partial)]), f.name + ' to line ' + (end + 1));
  }

  function clear() { cards.slice().forEach(removeCard); }

  /** Next linked run connects to a brand-new kernel (variables and imports are gone). */
  function resetKernel() {
    if (!IDE.$('keep-session').checked) { IDE.toast('Keep session is off, so every run already starts fresh'); return; }
    linkKey = 'sageide-session-' + Date.now().toString(36);
    IDE.toast('Sage session reset. The next run starts with a fresh kernel.', 'success');
  }

  function init() {
    IDE.$('run').addEventListener('click', runAll);
    IDE.$('clear').addEventListener('click', clear);
    IDE.$('reset-kernel-btn').addEventListener('click', resetKernel);
    function copyCard(card) {
      const out = card.querySelector('.rc-out');
      const img = out.querySelector('img');
      const doText = function () {
        navigator.clipboard.writeText(out.innerText).then(function () { IDE.toast('Copied', 'success'); });
      };
      if (!img || !navigator.clipboard || !navigator.clipboard.write) return doText();
      fetch(img.src, { mode: 'cors' }).then(function (r) { return r.blob(); }).then(function (blob) {
        if (blob.type !== 'image/png') return doText();
        navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(
          function () { IDE.toast('Image copied', 'success'); },
          doText);
      }).catch(function () {
        /* remote sagecell URL without CORS: fetch is blocked, but <img> can
           still display it. Draw it to a canvas via the CORS-attempting load,
           and if that taints, load it anonymously as a last try. */
        const tryDraw = function (crossOrigin) {
          const probe = new Image();
          if (crossOrigin) probe.crossOrigin = 'anonymous';
          probe.onload = function () {
            try {
              const cv = document.createElement('canvas');
              cv.width = probe.naturalWidth; cv.height = probe.naturalHeight;
              cv.getContext('2d').drawImage(probe, 0, 0);
              cv.toBlob(function (b2) {
                if (!b2) return doText();
                navigator.clipboard.write([new ClipboardItem({ 'image/png': b2 })]).then(
                  function () { IDE.toast('Image copied', 'success'); },
                  doText);
              }, 'image/png');
            } catch (e) { doText(); }   /* canvas tainted - no CORS headers on the image host */
          };
          probe.onerror = function () { crossOrigin ? doText() : tryDraw(true); };
          probe.src = img.src;
        };
        tryDraw(false);
      });
    }

    IDE.$('output').addEventListener('click', function (e) {
      const link = e.target.closest('.err-link');
      if (link) { e.preventDefault(); if (link.dataset.file) IDE.editor.jumpTo(link.dataset.file, +link.dataset.line - 1); return; }
      const b = e.target.closest('.rc-actions button'); if (!b) return;
      const card = b.closest('.run-card'), c = cards.find(function (x) { return x.el === card; });
      if (b.dataset.a === 'remove' && c) removeCard(c);
      if (b.dataset.a === 'fold') card.classList.toggle('folded');
      if (b.dataset.a === 'copy') copyCard(card);
    });
  }

  IDE.runner = { init: init, compose: compose, runAll: runAll, runOnly: runOnly, runUpTo: runUpTo, runToCursor: runToCursor, clear: clear, seg: seg, resetKernel: resetKernel };
})(window.IDE);
