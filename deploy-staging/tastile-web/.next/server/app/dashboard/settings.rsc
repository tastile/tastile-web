1:"$Sreact.fragment"
3:I[9512,["7177","static/chunks/app/layout-a8639ebeecf60e41.js"],"GoogleAnalytics"]
4:I[7121,[],""]
5:I[4581,[],""]
6:I[4882,["8500","static/chunks/8500-41fa79ac743d83f1.js","1531","static/chunks/1531-306b5353c8e4e9a6.js","3852","static/chunks/3852-06f22c22a1faaced.js","8430","static/chunks/8430-27a36a8418c1e3fe.js","2417","static/chunks/2417-742287708cc0c443.js","1845","static/chunks/1845-f609a0874b98d833.js","4391","static/chunks/4391-b42d65927bba8141.js","6627","static/chunks/6627-0c3b655f228d3f45.js","1954","static/chunks/app/dashboard/layout-b800e96cb367c731.js"],"DashboardLayoutClient"]
7:I[1304,[],"ClientPageRoot"]
8:I[5294,["2417","static/chunks/2417-742287708cc0c443.js","4631","static/chunks/app/dashboard/settings/page-c5419bfc7683e1da.js"],"default"]
b:I[484,[],"OutletBoundary"]
c:"$Sreact.suspense"
e:I[484,[],"ViewportBoundary"]
10:I[484,[],"MetadataBoundary"]
12:I[7123,[],""]
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
0:{"P":null,"b":"z1IVv940L3-wCsP9DYHXp","c":["","dashboard","settings"],"q":"","i":false,"f":[[["",{"children":["dashboard",{"children":["settings",{"children":["__PAGE__",{}]}]}]},"$undefined","$undefined",true],[["$","$1","c",{"children":[[["$","link","0",{"rel":"stylesheet","href":"/_next/static/css/cabeefd0b2ff3317.css","precedence":"next","crossOrigin":"$undefined","nonce":"$undefined"}]],["$","html",null,{"lang":"en","suppressHydrationWarning":true,"children":[["$","head",null,{"children":["$","script",null,{"dangerouslySetInnerHTML":{"__html":"$2"}}]}],["$","body",null,{"className":"__variable_246ccd __variable_c29908 __variable_ed3508 __variable_f367f3 antialiased","children":[["$","$L3",null,{"measurementId":""}],["$","$L4",null,{"parallelRouterKey":"children","error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L5",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":[[["$","title",null,{"children":"404: This page could not be found."}],["$","div",null,{"style":{"fontFamily":"system-ui,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\"","height":"100vh","textAlign":"center","display":"flex","flexDirection":"column","alignItems":"center","justifyContent":"center"},"children":["$","div",null,{"children":[["$","style",null,{"dangerouslySetInnerHTML":{"__html":"body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid rgba(255,255,255,.3)}}"}}],["$","h1",null,{"className":"next-error-h1","style":{"display":"inline-block","margin":"0 20px 0 0","padding":"0 23px 0 0","fontSize":24,"fontWeight":500,"verticalAlign":"top","lineHeight":"49px"},"children":404}],["$","div",null,{"style":{"display":"inline-block"},"children":["$","h2",null,{"style":{"fontSize":14,"fontWeight":400,"lineHeight":"49px","margin":0},"children":"This page could not be found."}]}]]}]}]],[]],"forbidden":"$undefined","unauthorized":"$undefined"}]]}]]}]]}],{"children":[["$","$1","c",{"children":[null,["$","$L6",null,{"children":["$","$L4",null,{"parallelRouterKey":"children","error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L5",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":"$undefined","forbidden":"$undefined","unauthorized":"$undefined"}]}]]}],{"children":[["$","$1","c",{"children":[null,["$","$L4",null,{"parallelRouterKey":"children","error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L5",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":"$undefined","forbidden":"$undefined","unauthorized":"$undefined"}]]}],{"children":[["$","$1","c",{"children":[["$","$L7",null,{"Component":"$8","serverProvidedParams":{"searchParams":{},"params":{},"promises":["$@9","$@a"]}}],null,["$","$Lb",null,{"children":["$","$c",null,{"name":"Next.MetadataOutlet","children":"$@d"}]}]]}],{},null,false,false]},null,false,false]},null,false,false]},null,false,false],["$","$1","h",{"children":[null,["$","$Le",null,{"children":"$Lf"}],["$","div",null,{"hidden":true,"children":["$","$L10",null,{"children":["$","$c",null,{"name":"Next.Metadata","children":"$L11"}]}]}],null]}],false]],"m":"$undefined","G":["$12",[]],"S":true}
9:{}
a:"$0:f:0:1:1:children:1:children:1:children:0:props:children:0:props:serverProvidedParams:params"
f:[["$","meta","0",{"charSet":"utf-8"}],["$","meta","1",{"name":"viewport","content":"width=device-width, initial-scale=1"}]]
13:I[6869,[],"IconMark"]
d:null
11:[["$","title","0",{"children":"Tastile — Execution Control"}],["$","meta","1",{"name":"description","content":"Stop managing tasks. Start controlling execution."}],["$","link","2",{"rel":"manifest","href":"/manifest.json","crossOrigin":"$undefined"}],["$","meta","3",{"property":"og:title","content":"Tastile — Execution Control"}],["$","meta","4",{"property":"og:description","content":"Stop managing tasks. Start controlling execution."}],["$","meta","5",{"property":"og:type","content":"website"}],["$","meta","6",{"name":"twitter:card","content":"summary"}],["$","meta","7",{"name":"twitter:title","content":"Tastile — Execution Control"}],["$","meta","8",{"name":"twitter:description","content":"Stop managing tasks. Start controlling execution."}],["$","link","9",{"rel":"shortcut icon","href":"/icon?v=6"}],["$","link","10",{"rel":"icon","href":"/icon?v=6"}],["$","link","11",{"rel":"apple-touch-icon","href":"/apple-icon.png"}],["$","$L13","12",{}]]
