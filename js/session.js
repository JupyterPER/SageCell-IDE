(function (IDE) {
  function confirmDelete() {
    if (document.getElementById('session-confirm')) return;
    const ov = document.createElement('div');
    ov.id = 'session-confirm';
    ov.innerHTML =
      '<div class="sc-box" role="alertdialog" aria-labelledby="sc-title" aria-describedby="sc-text">' +
        '<h3 id="sc-title">Delete project?</h3>' +
        '<p id="sc-text">All files (including the trash), open tabs and the run order saved in this browser ' +
        'will be removed and the editor resets to an empty project. This cannot be undone. ' +
        'Export first if you want a copy.</p>' +
        '<div class="sc-actions">' +
          '<button type="button" class="sc-cancel">Cancel</button>' +
          '<button type="button" class="sc-ok">Delete project</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);

    const onKey = function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    const close = function () { document.removeEventListener('keydown', onKey, true); ov.remove(); };
    document.addEventListener('keydown', onKey, true);

    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelector('.sc-cancel').addEventListener('click', close);
    ov.querySelector('.sc-ok').addEventListener('click', function () {
      IDE.store.discardSession();
      location.reload();
    });
    ov.querySelector('.sc-cancel').focus();
  }

  function init() {
    const btn = document.getElementById('delete-project-btn');
    if (btn) btn.addEventListener('click', confirmDelete);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  IDE.session = { confirmDelete: confirmDelete };
})(window.IDE);
