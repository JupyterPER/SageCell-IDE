window.IDE = window.IDE || {};
(function (IDE) {
  IDE.$ = function (id) { return document.getElementById(id); };
  IDE.esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  IDE.debounce = function (fn, ms) {
    let t; return function () { const a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); };
  };
  IDE.slug = function (s) {
    return (s || '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'sage-project';
  };
  IDE.download = function (blob, filename) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 200);
  };

  /* settings (localStorage) */
  IDE.settings = {
    get: function (k, d) { try { const v = localStorage.getItem('sageide.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('sageide.' + k, JSON.stringify(v)); } catch (e) {} }
  };

  /* toast; optional action = {label, fn} (used for "Undo") */
  IDE.toast = function (msg, type, action) {
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' toast-error' : '') + (type === 'success' ? ' toast-success' : '') + (action ? ' has-action' : '');
    el.textContent = msg;
    if (action) {
      const b = document.createElement('button');
      b.textContent = action.label;
      b.onclick = function () { action.fn(); el.remove(); };
      el.appendChild(b);
    }
    document.body.appendChild(el);
    setTimeout(function () { el.classList.add('show'); }, 20);
    setTimeout(function () { el.classList.remove('show'); setTimeout(function () { el.remove(); }, 300); }, action ? 6000 : 2800);
  };

  /* popover: IDE.popup(htmlString, anchorEl?) – closes on outside click / Escape */
  let popupEl = null;
  function closePopup() { if (popupEl) { popupEl.remove(); popupEl = null; } }
  IDE.popup = function (html, anchor) {
    closePopup();
    popupEl = document.createElement('div');
    popupEl.className = 'ide-popup';
    popupEl.innerHTML = html;
    document.body.appendChild(popupEl);
    const r = popupEl.getBoundingClientRect();
    let x, y;
    if (anchor) {
      const a = anchor.getBoundingClientRect();
      x = Math.min(a.left, innerWidth - r.width - 8);
      y = a.bottom + 6;
      if (y + r.height > innerHeight - 8) y = Math.max(8, a.top - r.height - 6);
    } else { x = innerWidth / 2 - r.width / 2; y = Math.max(60, innerHeight * 0.2); }
    popupEl.style.left = x + 'px';
    popupEl.style.top = y + 'px';
    const onDown = function (e) { if (popupEl && !popupEl.contains(e.target)) { closePopup(); cleanup(); } };
    const onKey = function (e) { if (e.key === 'Escape') { closePopup(); cleanup(); } };
    function cleanup() {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    }
    setTimeout(function () {
      document.addEventListener('mousedown', onDown, true);
      document.addEventListener('keydown', onKey, true);
    }, 0);
    return popupEl;
  };

  /* context / dropdown menu. items: [{label, fn, disabled}] or '-' for a separator */
  let openMenu = null;
  IDE.menu = {
    close: function () {
      if (openMenu) { openMenu.remove(); openMenu = null; }
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    },
    show: function (x, y, items) {
      IDE.menu.close();
      const m = document.createElement('div');
      m.className = 'ctx-menu';
      items.forEach(function (it) {
        if (it === '-') { m.appendChild(document.createElement('hr')); return; }
        const b = document.createElement('button');
        b.textContent = it.label; b.disabled = !!it.disabled;
        b.onclick = function () { IDE.menu.close(); it.fn(); };
        m.appendChild(b);
      });
      document.body.appendChild(m);
      const r = m.getBoundingClientRect();
      m.style.left = Math.max(4, Math.min(x, innerWidth - r.width - 4)) + 'px';
      m.style.top  = Math.max(4, Math.min(y, innerHeight - r.height - 4)) + 'px';
      openMenu = m;
      document.addEventListener('mousedown', onDown, true);
      document.addEventListener('keydown', onKey, true);
    }
  };
  function onDown(e) { if (openMenu && !openMenu.contains(e.target)) IDE.menu.close(); }
  function onKey(e) { if (e.key === 'Escape') IDE.menu.close(); }
})(window.IDE);
