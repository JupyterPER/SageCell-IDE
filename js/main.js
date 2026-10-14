(function (IDE) {
  function applyTheme(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    const cm = IDE.editor.cm(); if (cm) cm.setOption('theme', dark ? 'dracula' : 'default');
    IDE.$('icon-moon').style.display = dark ? 'none' : '';
    IDE.$('icon-sun').style.display = dark ? '' : 'none';
    IDE.settings.set('dark', dark);
  }

  function init() {
    IDE.store.init();           // load autosave or defaults (needs CodeMirror)
    IDE.editor.init();
    IDE.layout.init();
    IDE.sidebar.init();
    IDE.data.init();
    IDE.projectIO.init();
    IDE.runner.init();
    IDE.find.init();

    const dark = IDE.settings.get('dark', window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    applyTheme(dark);
    IDE.$('theme-btn').addEventListener('click', function () { applyTheme(document.documentElement.getAttribute('data-theme') !== 'dark'); });

    const auto = IDE.$('auto-suggest');
    auto.checked = IDE.settings.get('autoSuggest', true);
    auto.addEventListener('change', function () { IDE.settings.set('autoSuggest', auto.checked); });

    IDE.store.emit('structure');   // first render of tabs + sidebar
    console.log('SageMath IDE initialized');
  }
  init();      // scripts are `defer`red, so the DOM is ready
})(window.IDE);
