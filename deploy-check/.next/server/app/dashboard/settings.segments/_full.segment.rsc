1:"$Sreact.fragment"
3:I[31362,["/_next/static/chunks/c3f103333c7e70b4.js"],"GoogleAnalytics"]
4:I[39756,["/_next/static/chunks/ff1a16fafef87110.js","/_next/static/chunks/d2be314c3ece3fbe.js"],"default"]
5:I[37457,["/_next/static/chunks/ff1a16fafef87110.js","/_next/static/chunks/d2be314c3ece3fbe.js"],"default"]
6:I[94352,["/_next/static/chunks/c3f103333c7e70b4.js","/_next/static/chunks/7bf8c59e7cbc1753.js","/_next/static/chunks/ac584a36f7a76a3e.js","/_next/static/chunks/86852bbe29af2246.js","/_next/static/chunks/946ef40d845a02ea.js"],"DashboardLayoutClient"]
a:I[68027,[],"default"]
:HL["/_next/static/chunks/eae14d0754e80353.css","style"]
:HL["/_next/static/media/1b99372b3eaef0c8-s.p.758e15a8.woff2","font",{"crossOrigin":"","type":"font/woff2"}]
:HL["/_next/static/media/797e433ab948586e-s.p.29207c2f.woff2","font",{"crossOrigin":"","type":"font/woff2"}]
:HL["/_next/static/media/83afe278b6a6bb3c-s.p.3a6ba036.woff2","font",{"crossOrigin":"","type":"font/woff2"}]
:HL["/_next/static/media/caa3a2e1cccd8315-s.p.3b6cae6d.woff2","font",{"crossOrigin":"","type":"font/woff2"}]
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
0:{"P":null,"b":"JvBZ6c2-ZLNOkMjnSByfB","c":["","dashboard","settings"],"q":"","i":false,"f":[[["",{"children":["dashboard",{"children":["settings",{"children":["__PAGE__",{}]}]}]},"$undefined","$undefined",true],[["$","$1","c",{"children":[[["$","link","0",{"rel":"stylesheet","href":"/_next/static/chunks/eae14d0754e80353.css","precedence":"next","crossOrigin":"$undefined","nonce":"$undefined"}],["$","script","script-0",{"src":"/_next/static/chunks/c3f103333c7e70b4.js","async":true,"nonce":"$undefined"}]],["$","html",null,{"lang":"en","suppressHydrationWarning":true,"children":[["$","head",null,{"children":["$","script",null,{"dangerouslySetInnerHTML":{"__html":"$2"}}]}],["$","body",null,{"className":"geist_a71539c9-module__T19VSG__variable geist_mono_8d43a2aa-module__8Li5zG__variable outfit_ca35ecd4-module__VNkuCW__variable inter_fe8b9d92-module__LINzvG__variable antialiased","children":[["$","$L3",null,{"measurementId":""}],["$","$L4",null,{"parallelRouterKey":"children","error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L5",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":[[["$","title",null,{"children":"404: This page could not be found."}],["$","div",null,{"style":{"fontFamily":"system-ui,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\"","height":"100vh","textAlign":"center","display":"flex","flexDirection":"column","alignItems":"center","justifyContent":"center"},"children":["$","div",null,{"children":[["$","style",null,{"dangerouslySetInnerHTML":{"__html":"body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid rgba(255,255,255,.3)}}"}}],["$","h1",null,{"className":"next-error-h1","style":{"display":"inline-block","margin":"0 20px 0 0","padding":"0 23px 0 0","fontSize":24,"fontWeight":500,"verticalAlign":"top","lineHeight":"49px"},"children":404}],["$","div",null,{"style":{"display":"inline-block"},"children":["$","h2",null,{"style":{"fontSize":14,"fontWeight":400,"lineHeight":"49px","margin":0},"children":"This page could not be found."}]}]]}]}]],[]],"forbidden":"$undefined","unauthorized":"$undefined"}]]}]]}]]}],{"children":[["$","$1","c",{"children":[[["$","script","script-0",{"src":"/_next/static/chunks/7bf8c59e7cbc1753.js","async":true,"nonce":"$undefined"}],["$","script","script-1",{"src":"/_next/static/chunks/ac584a36f7a76a3e.js","async":true,"nonce":"$undefined"}],["$","script","script-2",{"src":"/_next/static/chunks/86852bbe29af2246.js","async":true,"nonce":"$undefined"}],["$","script","script-3",{"src":"/_next/static/chunks/946ef40d845a02ea.js","async":true,"nonce":"$undefined"}]],["$","$L6",null,{"children":["$","$L4",null,{"parallelRouterKey":"children","error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L5",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":"$undefined","forbidden":"$undefined","unauthorized":"$undefined"}]}]]}],{"children":[["$","$1","c",{"children":[null,["$","$L4",null,{"parallelRouterKey":"children","error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":"$L7","templateStyles":"$undefined","templateScripts":"$undefined","notFound":"$undefined","forbidden":"$undefined","unauthorized":"$undefined"}]]}],{"children":["$L8",{},null,false,false]},null,false,false]},null,false,false]},null,false,false],"$L9",false]],"m":"$undefined","G":["$a",[]],"S":true}
b:I[47257,["/_next/static/chunks/ff1a16fafef87110.js","/_next/static/chunks/d2be314c3ece3fbe.js"],"ClientPageRoot"]
c:I[59772,["/_next/static/chunks/c3f103333c7e70b4.js","/_next/static/chunks/7bf8c59e7cbc1753.js","/_next/static/chunks/ac584a36f7a76a3e.js","/_next/static/chunks/86852bbe29af2246.js","/_next/static/chunks/946ef40d845a02ea.js","/_next/static/chunks/0e69afde087b2f2d.js"],"default"]
f:I[97367,["/_next/static/chunks/ff1a16fafef87110.js","/_next/static/chunks/d2be314c3ece3fbe.js"],"OutletBoundary"]
10:"$Sreact.suspense"
12:I[97367,["/_next/static/chunks/ff1a16fafef87110.js","/_next/static/chunks/d2be314c3ece3fbe.js"],"ViewportBoundary"]
14:I[97367,["/_next/static/chunks/ff1a16fafef87110.js","/_next/static/chunks/d2be314c3ece3fbe.js"],"MetadataBoundary"]
7:["$","$L5",null,{}]
8:["$","$1","c",{"children":[["$","$Lb",null,{"Component":"$c","serverProvidedParams":{"searchParams":{},"params":{},"promises":["$@d","$@e"]}}],[["$","script","script-0",{"src":"/_next/static/chunks/0e69afde087b2f2d.js","async":true,"nonce":"$undefined"}]],["$","$Lf",null,{"children":["$","$10",null,{"name":"Next.MetadataOutlet","children":"$@11"}]}]]}]
9:["$","$1","h",{"children":[null,["$","$L12",null,{"children":"$L13"}],["$","div",null,{"hidden":true,"children":["$","$L14",null,{"children":["$","$10",null,{"name":"Next.Metadata","children":"$L15"}]}]}],["$","meta",null,{"name":"next-size-adjust","content":""}]]}]
d:{}
e:"$8:props:children:0:props:serverProvidedParams:params"
13:[["$","meta","0",{"charSet":"utf-8"}],["$","meta","1",{"name":"viewport","content":"width=device-width, initial-scale=1"}]]
16:I[27201,["/_next/static/chunks/ff1a16fafef87110.js","/_next/static/chunks/d2be314c3ece3fbe.js"],"IconMark"]
11:null
15:[["$","title","0",{"children":"Tastile — Execution Control"}],["$","meta","1",{"name":"description","content":"Stop managing tasks. Start controlling execution."}],["$","link","2",{"rel":"manifest","href":"/manifest.json","crossOrigin":"$undefined"}],["$","meta","3",{"property":"og:title","content":"Tastile — Execution Control"}],["$","meta","4",{"property":"og:description","content":"Stop managing tasks. Start controlling execution."}],["$","meta","5",{"property":"og:type","content":"website"}],["$","meta","6",{"name":"twitter:card","content":"summary"}],["$","meta","7",{"name":"twitter:title","content":"Tastile — Execution Control"}],["$","meta","8",{"name":"twitter:description","content":"Stop managing tasks. Start controlling execution."}],["$","link","9",{"rel":"shortcut icon","href":"/icon?v=6"}],["$","link","10",{"rel":"icon","href":"/icon?v=6"}],["$","link","11",{"rel":"apple-touch-icon","href":"/apple-icon.png"}],["$","$L16","12",{}]]
