1:"$Sreact.fragment"
3:I[31362,["/_next/static/chunks/c3f103333c7e70b4.js"],"GoogleAnalytics"]
4:I[39756,["/_next/static/chunks/ff1a16fafef87110.js","/_next/static/chunks/d2be314c3ece3fbe.js"],"default"]
5:I[37457,["/_next/static/chunks/ff1a16fafef87110.js","/_next/static/chunks/d2be314c3ece3fbe.js"],"default"]
6:I[36852,["/_next/static/chunks/c3f103333c7e70b4.js","/_next/static/chunks/ff1a16fafef87110.js","/_next/static/chunks/66ac6fe91132b530.js"],"SiteHeader"]
1a:I[68027,[],"default"]
:HL["/_next/static/chunks/e2426d6428d8274f.css","style"]
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
0:{"P":null,"b":"0tdSaLDRX3b9R0vS0cGX2","c":["","terms"],"q":"","i":false,"f":[[["",{"children":["terms",{"children":["__PAGE__",{}]}]},"$undefined","$undefined",true],[["$","$1","c",{"children":[[["$","link","0",{"rel":"stylesheet","href":"/_next/static/chunks/e2426d6428d8274f.css","precedence":"next","crossOrigin":"$undefined","nonce":"$undefined"}],["$","script","script-0",{"src":"/_next/static/chunks/c3f103333c7e70b4.js","async":true,"nonce":"$undefined"}]],["$","html",null,{"lang":"en","suppressHydrationWarning":true,"children":[["$","head",null,{"children":["$","script",null,{"dangerouslySetInnerHTML":{"__html":"$2"}}]}],["$","body",null,{"className":"geist_a71539c9-module__T19VSG__variable geist_mono_8d43a2aa-module__8Li5zG__variable outfit_ca35ecd4-module__VNkuCW__variable inter_fe8b9d92-module__LINzvG__variable antialiased","children":[["$","$L3",null,{"measurementId":""}],["$","$L4",null,{"parallelRouterKey":"children","error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L5",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":[[["$","title",null,{"children":"404: This page could not be found."}],["$","div",null,{"style":{"fontFamily":"system-ui,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\"","height":"100vh","textAlign":"center","display":"flex","flexDirection":"column","alignItems":"center","justifyContent":"center"},"children":["$","div",null,{"children":[["$","style",null,{"dangerouslySetInnerHTML":{"__html":"body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid rgba(255,255,255,.3)}}"}}],["$","h1",null,{"className":"next-error-h1","style":{"display":"inline-block","margin":"0 20px 0 0","padding":"0 23px 0 0","fontSize":24,"fontWeight":500,"verticalAlign":"top","lineHeight":"49px"},"children":404}],["$","div",null,{"style":{"display":"inline-block"},"children":["$","h2",null,{"style":{"fontSize":14,"fontWeight":400,"lineHeight":"49px","margin":0},"children":"This page could not be found."}]}]]}]}]],[]],"forbidden":"$undefined","unauthorized":"$undefined"}]]}]]}]]}],{"children":[["$","$1","c",{"children":[null,["$","$L4",null,{"parallelRouterKey":"children","error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L5",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":"$undefined","forbidden":"$undefined","unauthorized":"$undefined"}]]}],{"children":[["$","$1","c",{"children":[["$","div",null,{"className":"min-h-screen bg-background flex flex-col","children":[["$","$L6",null,{"showFeatureLink":true}],["$","main",null,{"className":"flex-1","children":["$","div",null,{"className":"layout-shell max-w-3xl py-12","children":[["$","h1",null,{"className":"mb-8 text-3xl font-[510] tracking-[-0.02em] text-foreground","children":"Terms of Service"}],["$","div",null,{"className":"prose dark:prose-invert max-w-none","children":[["$","p",null,{"className":"mb-6 text-foreground-muted","children":"Last updated: March 14, 2026"}],"$L7","$L8","$L9","$La","$Lb","$Lc","$Ld","$Le","$Lf","$L10","$L11","$L12","$L13","$L14"]}]]}]}],"$L15"]}],["$L16","$L17"],"$L18"]}],{},null,false,false]},null,false,false]},null,false,false],"$L19",false]],"m":"$undefined","G":["$1a",[]],"S":true}
1b:I[8745,["/_next/static/chunks/c3f103333c7e70b4.js","/_next/static/chunks/ff1a16fafef87110.js","/_next/static/chunks/66ac6fe91132b530.js"],"SiteFooter"]
1c:I[97367,["/_next/static/chunks/ff1a16fafef87110.js","/_next/static/chunks/d2be314c3ece3fbe.js"],"OutletBoundary"]
1d:"$Sreact.suspense"
1f:I[97367,["/_next/static/chunks/ff1a16fafef87110.js","/_next/static/chunks/d2be314c3ece3fbe.js"],"ViewportBoundary"]
21:I[97367,["/_next/static/chunks/ff1a16fafef87110.js","/_next/static/chunks/d2be314c3ece3fbe.js"],"MetadataBoundary"]
7:["$","h2",null,{"className":"mt-8 mb-4 text-xl font-[590] text-foreground","children":"1. Account Terms"}]
8:["$","p",null,{"className":"text-foreground-muted","children":"You must be 13 years or older to use Tastile. You are responsible for maintaining the security of your account and for all activities that occur under your account."}]
9:["$","h2",null,{"className":"mt-8 mb-4 text-xl font-[590] text-foreground","children":"2. Acceptable Use"}]
a:["$","p",null,{"className":"text-foreground-muted","children":"You agree not to use Tastile for any unlawful purpose or to transmit any material that violates any laws or regulations. You may not attempt to gain unauthorized access to any portion of the service."}]
b:["$","h2",null,{"className":"mt-8 mb-4 text-xl font-[590] text-foreground","children":"3. Billing and Refunds"}]
c:["$","p",null,{"className":"text-foreground-muted","children":"Pro subscriptions are billed monthly through Stripe. You may cancel at any time. Refunds are provided at our discretion for technical issues or service unavailability."}]
d:["$","h2",null,{"className":"mt-8 mb-4 text-xl font-[590] text-foreground","children":"4. Limitation of Liability"}]
e:["$","p",null,{"className":"text-foreground-muted","children":"Tastile is provided \"as is\" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the service."}]
f:["$","h2",null,{"className":"mt-8 mb-4 text-xl font-[590] text-foreground","children":"5. Termination"}]
10:["$","p",null,{"className":"text-foreground-muted","children":"We reserve the right to suspend or terminate your account for violations of these terms. You may delete your account at any time from the settings page."}]
11:["$","h2",null,{"className":"mt-8 mb-4 text-xl font-[590] text-foreground","children":"6. Changes to Terms"}]
12:["$","p",null,{"className":"text-foreground-muted","children":"We may update these terms from time to time. Continued use of Tastile after changes constitutes acceptance of the new terms."}]
13:["$","h2",null,{"className":"mt-8 mb-4 text-xl font-[590] text-foreground","children":"Contact"}]
14:["$","p",null,{"className":"text-foreground-muted","children":"For questions about these terms, please contact legal@tastile.app"}]
15:["$","$L1b",null,{}]
16:["$","script","script-0",{"src":"/_next/static/chunks/ff1a16fafef87110.js","async":true,"nonce":"$undefined"}]
17:["$","script","script-1",{"src":"/_next/static/chunks/66ac6fe91132b530.js","async":true,"nonce":"$undefined"}]
18:["$","$L1c",null,{"children":["$","$1d",null,{"name":"Next.MetadataOutlet","children":"$@1e"}]}]
19:["$","$1","h",{"children":[null,["$","$L1f",null,{"children":"$L20"}],["$","div",null,{"hidden":true,"children":["$","$L21",null,{"children":["$","$1d",null,{"name":"Next.Metadata","children":"$L22"}]}]}],["$","meta",null,{"name":"next-size-adjust","content":""}]]}]
20:[["$","meta","0",{"charSet":"utf-8"}],["$","meta","1",{"name":"viewport","content":"width=device-width, initial-scale=1"}]]
23:I[27201,["/_next/static/chunks/ff1a16fafef87110.js","/_next/static/chunks/d2be314c3ece3fbe.js"],"IconMark"]
1e:null
22:[["$","title","0",{"children":"Terms of Service — Tastile"}],["$","meta","1",{"name":"description","content":"Tastile terms of service and usage agreement."}],["$","link","2",{"rel":"manifest","href":"/manifest.json","crossOrigin":"$undefined"}],["$","meta","3",{"property":"og:title","content":"Tastile — Execution Control"}],["$","meta","4",{"property":"og:description","content":"Stop managing tasks. Start controlling execution."}],["$","meta","5",{"property":"og:type","content":"website"}],["$","meta","6",{"name":"twitter:card","content":"summary"}],["$","meta","7",{"name":"twitter:title","content":"Tastile — Execution Control"}],["$","meta","8",{"name":"twitter:description","content":"Stop managing tasks. Start controlling execution."}],["$","link","9",{"rel":"shortcut icon","href":"/icon?v=6"}],["$","link","10",{"rel":"icon","href":"/icon?v=6"}],["$","link","11",{"rel":"apple-touch-icon","href":"/apple-icon.png"}],["$","$L23","12",{}]]
