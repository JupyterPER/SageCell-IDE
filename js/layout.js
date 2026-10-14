(function (IDE) {
  const root = document.documentElement, LS = 'sageide.layout';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) {}
  const persist = function () { try { localStorage.setItem(LS, JSON.stringify(saved)); } catch (e) {} };

  function splitter(el, o) {
    const set = function (w) {
      w = Math.max(o.min, Math.min(o.max(), w));
      root.style.setProperty(o.v, w + 'px'); saved[o.v] = w;
    };
    el.addEventListener('pointerdown', function (e) {
      e.preventDefault(); el.setPointerCapture(e.pointerId);
      const x0 = e.clientX, w0 = o.panel().getBoundingClientRect().width;
      document.body.classList.add('resizing'); el.classList.add('active');
      const move = function (ev) { set(w0 + (o.invert ? -1 : 1) * (ev.clientX - x0)); };
      const up = function () {
        el.releasePointerCapture(e.pointerId);
        el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up);
        document.body.classList.remove('resizing'); el.classList.remove('active'); persist();
      };
      el.addEventListener('pointermove', move); el.addEventListener('pointerup', up);
    });
    el.addEventListener('dblclick', function () { root.style.removeProperty(o.v); delete saved[o.v]; persist(); });
    el.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const step = (e.shiftKey ? 60 : 20) * (e.key === 'ArrowRight' ? 1 : -1) * (o.invert ? -1 : 1);
      set(o.panel().getBoundingClientRect().width + step); persist();
    });
  }

  function init() {
    Object.keys(saved).forEach(function (k) { root.style.setProperty(k, saved[k] + 'px'); });
    const main = IDE.$('main');
    splitter(IDE.$('split-side'), {
      v: '--w-side', panel: function () { return IDE.$('sidebar'); }, min: 140, invert: false,
      max: function () { return Math.min(520, main.clientWidth * 0.4); }
    });
    splitter(IDE.$('split-out'), {
      v: '--w-out', panel: function () { return document.querySelector('.panel-output'); }, min: 220, invert: true,
      max: function () { return main.clientWidth * 0.75; }
    });
    if (IDE.settings.get('sideCollapsed', false)) document.body.classList.add('side-collapsed');

    new ResizeObserver(function () { const c = IDE.editor.cm(); if (c) c.refresh(); }).observe(IDE.$('editor'));

    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        const on = document.body.classList.toggle('side-collapsed');
        IDE.settings.set('sideCollapsed', on);
      }
    });
  }
  IDE.layout = { init: init };
})(window.IDE);
