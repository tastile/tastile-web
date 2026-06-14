1:"$Sreact.fragment"
3:I[9512,["7177","static/chunks/app/layout-a8639ebeecf60e41.js"],"GoogleAnalytics"]
4:I[7121,[],""]
5:I[4581,[],""]
:HL["/_next/static/css/cabeefd0b2ff3317.css","style"]
2:T484,
(function() {
  try {
    var storedMode = localStorage.getItem('theme-mode');
    var legacyStore = localStorage.getItem('tastile-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var mode = (function(stored, legacy, dark) {
      if (stored === 'light' || stored === 'dark-gray' || stored === 'dark-black') return stored;
      if (legacy) {
        try {
          var parsed = JSON.parse(legacy);
          var legacyTheme = parsed && parsed.state && parsed.state.theme;
          if (legacyTheme === 'light') return 'light';
          if (legacyTheme === 'gray') return 'dark-gray';
          if (legacyTheme === 'dark') return 'dark-black';
        } catch (_e) {}
      }
      return dark ? 'dark-gray' : 'light';
    })(storedMode, legacyStore, prefersDark);

    var root = document.documentElement;
    root.classList.remove('dark', 'theme-dark-gray', 'theme-dark-black', 'theme-light', 'theme-gray', 'theme-dark');
    if (mode === 'dark-gray') root.classList.add('dark', 'theme-dark-gray');
    if (mode === 'dark-black') root.classList.add('dark', 'theme-dark-black');
  } catch (_error) {}
})();
0:{"buildId":"z1IVv940L3-wCsP9DYHXp","rsc":["$","$1","c",{"children":[[["$","link","0",{"rel":"stylesheet","href":"/_next/static/css/cabeefd0b2ff3317.css","precedence":"next"}]],["$","html",null,{"lang":"en","suppressHydrationWarning":true,"children":[["$","head",null,{"children":["$","script",null,{"dangerouslySetInnerHTML":{"__html":"$2"}}]}],["$","body",null,{"className":"__variable_246ccd __variable_c29908 __variable_ed3508 __variable_f367f3 antialiased","children":[["$","$L3",null,{"measurementId":""}],["$","$L4",null,{"parallelRouterKey":"children","template":["$","$L5",null,{}]}]]}]]}]]}],"loading":null,"isPartial":false}
