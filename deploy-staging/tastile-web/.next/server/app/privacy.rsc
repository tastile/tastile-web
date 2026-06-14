1:"$Sreact.fragment"
3:I[9512,["7177","static/chunks/app/layout-a8639ebeecf60e41.js"],"GoogleAnalytics"]
4:I[7121,[],""]
5:I[4581,[],""]
6:I[5778,["8500","static/chunks/8500-41fa79ac743d83f1.js","1531","static/chunks/1531-306b5353c8e4e9a6.js","2417","static/chunks/2417-742287708cc0c443.js","9877","static/chunks/app/privacy/page-2ba8c29f5490ee67.js"],"SiteHeader"]
16:I[7123,[],""]
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
0:{"P":null,"b":"z1IVv940L3-wCsP9DYHXp","c":["","privacy"],"q":"","i":false,"f":[[["",{"children":["privacy",{"children":["__PAGE__",{}]}]},"$undefined","$undefined",true],[["$","$1","c",{"children":[[["$","link","0",{"rel":"stylesheet","href":"/_next/static/css/cabeefd0b2ff3317.css","precedence":"next","crossOrigin":"$undefined","nonce":"$undefined"}]],["$","html",null,{"lang":"en","suppressHydrationWarning":true,"children":[["$","head",null,{"children":["$","script",null,{"dangerouslySetInnerHTML":{"__html":"$2"}}]}],["$","body",null,{"className":"__variable_246ccd __variable_c29908 __variable_ed3508 __variable_f367f3 antialiased","children":[["$","$L3",null,{"measurementId":""}],["$","$L4",null,{"parallelRouterKey":"children","error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L5",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":[[["$","title",null,{"children":"404: This page could not be found."}],["$","div",null,{"style":{"fontFamily":"system-ui,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\"","height":"100vh","textAlign":"center","display":"flex","flexDirection":"column","alignItems":"center","justifyContent":"center"},"children":["$","div",null,{"children":[["$","style",null,{"dangerouslySetInnerHTML":{"__html":"body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid rgba(255,255,255,.3)}}"}}],["$","h1",null,{"className":"next-error-h1","style":{"display":"inline-block","margin":"0 20px 0 0","padding":"0 23px 0 0","fontSize":24,"fontWeight":500,"verticalAlign":"top","lineHeight":"49px"},"children":404}],["$","div",null,{"style":{"display":"inline-block"},"children":["$","h2",null,{"style":{"fontSize":14,"fontWeight":400,"lineHeight":"49px","margin":0},"children":"This page could not be found."}]}]]}]}]],[]],"forbidden":"$undefined","unauthorized":"$undefined"}]]}]]}]]}],{"children":[["$","$1","c",{"children":[null,["$","$L4",null,{"parallelRouterKey":"children","error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L5",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":"$undefined","forbidden":"$undefined","unauthorized":"$undefined"}]]}],{"children":[["$","$1","c",{"children":[["$","div",null,{"className":"min-h-screen bg-background flex flex-col","children":[["$","$L6",null,{"showFeatureLink":true}],["$","main",null,{"className":"flex-1","children":["$","div",null,{"className":"layout-shell max-w-3xl py-12","children":[["$","h1",null,{"className":"mb-8 text-3xl font-[510] tracking-[-0.02em] text-foreground","children":"Privacy Policy"}],["$","div",null,{"className":"prose dark:prose-invert max-w-none","children":[["$","p",null,{"className":"mb-6 text-foreground-muted","children":"Last updated: March 14, 2026"}],["$","h2",null,{"className":"mt-8 mb-4 text-xl font-[590] text-foreground","children":"What Data We Collect"}],["$","ul",null,{"className":"list-disc space-y-2 pl-6 text-foreground-muted","children":["$L7","$L8","$L9","$La"]}],"$Lb","$Lc","$Ld","$Le","$Lf","$L10","$L11","$L12"]}]]}]}],"$L13"]}],null,"$L14"]}],{},null,false,false]},null,false,false]},null,false,false],"$L15",false]],"m":"$undefined","G":["$16",[]],"S":true}
17:I[6766,["8500","static/chunks/8500-41fa79ac743d83f1.js","1531","static/chunks/1531-306b5353c8e4e9a6.js","2417","static/chunks/2417-742287708cc0c443.js","9877","static/chunks/app/privacy/page-2ba8c29f5490ee67.js"],"SiteFooter"]
18:I[484,[],"OutletBoundary"]
19:"$Sreact.suspense"
1b:I[484,[],"ViewportBoundary"]
1d:I[484,[],"MetadataBoundary"]
7:["$","li",null,{"children":[["$","strong",null,{"children":"Account Information:"}]," Email address and authentication data from Amazon Cognito and any configured federated identity provider."]}]
8:["$","li",null,{"children":[["$","strong",null,{"children":"Tile Data:"}]," Titles, descriptions, and execution status of your tiles."]}]
9:["$","li",null,{"children":[["$","strong",null,{"children":"Event Data:"}]," Execution history including start times, completions, and breaks."]}]
a:["$","li",null,{"children":[["$","strong",null,{"children":"Usage Data:"}]," Basic analytics on feature usage to improve the service."]}]
b:["$","h2",null,{"className":"mt-8 mb-4 text-xl font-[590] text-foreground","children":"How We Store Data"}]
c:["$","p",null,{"className":"text-foreground-muted","children":"Your cloud data is stored securely on Tastile-managed AWS infrastructure. Local tiles are stored on your device only. Cloud tiles and events are encrypted in transit and at rest."}]
d:["$","h2",null,{"className":"mt-8 mb-4 text-xl font-[590] text-foreground","children":"Third-Party Services"}]
e:["$","ul",null,{"className":"list-disc space-y-2 pl-6 text-foreground-muted","children":[["$","li",null,{"children":[["$","strong",null,{"children":"Amazon Cognito:"}]," Account registration and authentication."]}],["$","li",null,{"children":[["$","strong",null,{"children":"AWS:"}]," Application hosting, storage, and database infrastructure."]}],["$","li",null,{"children":[["$","strong",null,{"children":"Stripe:"}]," Payment processing for Pro subscriptions."]}],["$","li",null,{"children":[["$","strong",null,{"children":"Federated identity providers:"}]," Optional authentication methods when enabled."]}]]}]
f:["$","h2",null,{"className":"mt-8 mb-4 text-xl font-[590] text-foreground","children":"Your Rights"}]
10:["$","p",null,{"className":"text-foreground-muted","children":"You can request deletion of your account and all associated data at any time by contacting us. Local data can be deleted by uninstalling the application."}]
11:["$","h2",null,{"className":"mt-8 mb-4 text-xl font-[590] text-foreground","children":"Contact"}]
12:["$","p",null,{"className":"text-foreground-muted","children":"For privacy-related inquiries, please contact privacy@tastile.app"}]
13:["$","$L17",null,{}]
14:["$","$L18",null,{"children":["$","$19",null,{"name":"Next.MetadataOutlet","children":"$@1a"}]}]
15:["$","$1","h",{"children":[null,["$","$L1b",null,{"children":"$L1c"}],["$","div",null,{"hidden":true,"children":["$","$L1d",null,{"children":["$","$19",null,{"name":"Next.Metadata","children":"$L1e"}]}]}],null]}]
1c:[["$","meta","0",{"charSet":"utf-8"}],["$","meta","1",{"name":"viewport","content":"width=device-width, initial-scale=1"}]]
1f:I[6869,[],"IconMark"]
1a:null
1e:[["$","title","0",{"children":"Privacy Policy — Tastile"}],["$","meta","1",{"name":"description","content":"Tastile privacy policy and data handling practices."}],["$","link","2",{"rel":"manifest","href":"/manifest.json","crossOrigin":"$undefined"}],["$","meta","3",{"property":"og:title","content":"Tastile — Execution Control"}],["$","meta","4",{"property":"og:description","content":"Stop managing tasks. Start controlling execution."}],["$","meta","5",{"property":"og:type","content":"website"}],["$","meta","6",{"name":"twitter:card","content":"summary"}],["$","meta","7",{"name":"twitter:title","content":"Tastile — Execution Control"}],["$","meta","8",{"name":"twitter:description","content":"Stop managing tasks. Start controlling execution."}],["$","link","9",{"rel":"shortcut icon","href":"/icon?v=6"}],["$","link","10",{"rel":"icon","href":"/icon?v=6"}],["$","link","11",{"rel":"apple-touch-icon","href":"/apple-icon.png"}],["$","$L1f","12",{}]]
