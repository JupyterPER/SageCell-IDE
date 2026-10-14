(function (IDE) {
  const HTML =
    '<form method="dialog" class="help-box">' +
      '<header><h3>Sage IDE: quick guide</h3><button class="help-x" value="close" aria-label="Close">✕</button></header>' +
      '<div class="help-body">' +

        '<h4>What it is</h4>' +
        '<p>A multi-file editor for Sage code. Your files run on a SageCell server, and the results appear as cards on the output side.</p>' +

        '<h4>Files and run order</h4>' +
        '<ul>' +
          '<li>Your project can hold several files. Open files appear as tabs; click a file in the sidebar to open it, middle-click a tab to close it.</li>' +
          '<li>Files run <b>in run order, top to bottom</b>: helpers first and <code>main.sage</code> last. Drag rows in the sidebar (or tabs, if tab reordering changes run order) to change it, or use the sort button to auto-order by dependencies.</li>' +
          '<li>Right-click a file for its menu: rename, duplicate, <b>Run this file only</b>, <b>Run up to this file</b>, exclude it from runs, or move it to the trash. You can also rename with a double-click on a tab.</li>' +
          '<li>Excluded (inactive) files do not run; they stay in the project, shown dimmed.</li>' +
          '<li>Deleted files go to the <b>trash</b>, where you can restore them or empty it.</li>' +
          '<li>New files come from the <b>+</b> in the Files header. Import and export live in the top bar: open <code>.json</code>, <code>.zip</code>, <code>.sage</code> and <code>.py</code> files, or save the whole project as JSON or ZIP.</li>' +
          '<li>Everything autosaves in this browser a moment after you stop typing.</li>' +
        '</ul>' +

        '<h4>Running code</h4>' +
        '<table>' +
          '<tr><td><b>Run All</b> button</td><td>Runs all active files in run order.</td></tr>' +
          '<tr><td><kbd>Shift</kbd>+<kbd>Enter</kbd></td><td>Same: runs everything.</td></tr>' +
          '<tr><td><kbd>Ctrl</kbd>+<kbd>Enter</kbd></td><td>Runs the files before the current one, then the current file up to the end of the current block. Blocks are separated by lines starting with <code># %%</code>.</td></tr>' +
          '<tr><td>Right-click a file</td><td><b>Run this file only</b>, or <b>Run up to this file</b> (every file up to and including the chosen one).</td></tr>' +
          '<tr><td><b>Clear Output</b></td><td>Removes all output cards.</td></tr>' +
        '</table>' +

        '<h4>Output cards</h4>' +
        '<ul>' +
          '<li>Each run creates a card. The newest is on top, and only the last 15 are kept.</li>' +
          '<li>Card buttons: copy the output, collapse the card, remove the card.</li>' +
          '<li>In an error traceback, a link such as <code>main.sage:12</code> opens that file at that line.</li>' +
        '</ul>' +

        '<h4>DataFrames</h4>' +
        '<ul>' +
          '<li>Tables you build appear as chips in the editor, with edit, peek and show-code actions. Press <kbd>Ctrl</kbd>+<kbd>D</kbd> or the table button in the top bar to open the DataFrame manager: import CSV/Excel, edit in a spreadsheet, export.</li>' +
        '</ul>' +

        '<h4>Sage session</h4>' +
        '<ul>' +
          '<li><b>Keep session</b> (on by default): runs share one Sage kernel, so variables and imports carry over between runs. If it is off, every run starts fresh.</li>' +
          '<li><b>Reset Sage session</b>: the next run starts with a new kernel. The files themselves are untouched.</li>' +
        '</ul>' +

        '<h4>Delete project</h4>' +
        '<p>Removes the saved project (all files, the trash, tabs and run order) from this browser and resets the editor. It cannot be undone, so export first if you want a copy.</p>' +

        '<h4>Editor shortcuts</h4>' +
        '<table>' +
          '<tr><td><kbd>Ctrl</kbd>+<kbd>Space</kbd></td><td>Autocomplete</td></tr>' +
          '<tr><td><kbd>Ctrl</kbd>+<kbd>/</kbd></td><td>Comment or uncomment lines</td></tr>' +
          '<tr><td><kbd>Ctrl</kbd>+<kbd>D</kbd></td><td>DataFrame manager</td></tr>' +
          '<tr><td><kbd>Ctrl</kbd>+<kbd>B</kbd></td><td>Show or hide the sidebar</td></tr>' +
        '</table>' +

        '<h4>Find and replace</h4>' +
        '<ul>' +
          '<li><kbd>Ctrl</kbd>+<kbd>F</kbd> opens find, <kbd>Ctrl</kbd>+<kbd>H</kbd> jumps to the replace field. <kbd>Enter</kbd> / <kbd>Shift</kbd>+<kbd>Enter</kbd> step through matches.</li>' +
          '<li>Options: match case, whole word, regex (use <code>$1</code> and <code>$&amp;</code> in the replacement).</li>' +
          '<li><b>all files</b> lists matches across the whole project. Click one to jump to it. "All" then replaces in every listed file.</li>' +
        '</ul>' +

        '<h4>Good to know</h4>' +
        '<ul>' +
          '<li>Your code is sent to a public SageCell server to run. Don\'t put secrets in it.</li>' +
          '<li>The project lives only in this browser (<code>localStorage</code>). Clearing site data or using another browser or device loses it.</li>' +
        '</ul>' +
      '</div>' +
      '<footer><button value="close" class="help-ok">Got it</button></footer>' +
    '</form>';

  let dlg = null;

  function open() {
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'help-dialog';
      dlg.setAttribute('aria-label', 'Help');
      dlg.innerHTML = HTML;
      dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });   // click on backdrop
      document.body.appendChild(dlg);
    }
    if (!dlg.open) dlg.showModal();
    dlg.querySelector('.help-ok').focus();
  }

  function init() {
    const btn = document.getElementById('help-btn');
    if (btn) btn.addEventListener('click', open);
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'F1') return;
      if (e.target.closest && e.target.closest('.CodeMirror')) return;   // never while typing in the editor
      e.preventDefault();
      open();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  IDE.help = { open: open };
})(window.IDE);
