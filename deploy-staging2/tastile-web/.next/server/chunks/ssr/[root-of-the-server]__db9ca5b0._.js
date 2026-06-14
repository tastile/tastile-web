module.exports=[89578,a=>{a.v({className:"geist_a71539c9-module__T19VSG__className",variable:"geist_a71539c9-module__T19VSG__variable"})},35214,a=>{a.v({className:"geist_mono_8d43a2aa-module__8Li5zG__className",variable:"geist_mono_8d43a2aa-module__8Li5zG__variable"})},14235,a=>{a.v({className:"outfit_ca35ecd4-module__VNkuCW__className",variable:"outfit_ca35ecd4-module__VNkuCW__variable"})},47591,a=>{a.v({className:"inter_fe8b9d92-module__LINzvG__className",variable:"inter_fe8b9d92-module__LINzvG__variable"})},80765,a=>{"use strict";a.s(["GoogleAnalytics",()=>b]);let b=(0,a.i(11857).registerClientReference)(function(){throw Error("Attempted to call GoogleAnalytics() from the server but GoogleAnalytics is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/src/components/GoogleAnalytics.tsx <module evaluation>","GoogleAnalytics")},5270,a=>{"use strict";a.s(["GoogleAnalytics",()=>b]);let b=(0,a.i(11857).registerClientReference)(function(){throw Error("Attempted to call GoogleAnalytics() from the server but GoogleAnalytics is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/src/components/GoogleAnalytics.tsx","GoogleAnalytics")},4319,a=>{"use strict";a.i(80765);var b=a.i(5270);a.n(b)},27572,a=>{"use strict";var b=a.i(7997),c=a.i(89578);let d={className:c.default.className,style:{fontFamily:"'Geist', 'Geist Fallback'",fontStyle:"normal"}};null!=c.default.variable&&(d.variable=c.default.variable);var e=a.i(35214);let f={className:e.default.className,style:{fontFamily:"'Geist Mono', 'Geist Mono Fallback'",fontStyle:"normal"}};null!=e.default.variable&&(f.variable=e.default.variable);var g=a.i(14235);let h={className:g.default.className,style:{fontFamily:"'Outfit', 'Outfit Fallback'",fontStyle:"normal"}};null!=g.default.variable&&(h.variable=g.default.variable);var i=a.i(47591);let j={className:i.default.className,style:{fontFamily:"'Inter', 'Inter Fallback'",fontStyle:"normal"}};null!=i.default.variable&&(j.variable=i.default.variable);var k=a.i(4319);let l=`
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
`,m={title:"Tastile — Execution Control",description:"Stop managing tasks. Start controlling execution.",metadataBase:new URL("https://tastile.app"),manifest:"/manifest.json",icons:{icon:"/icon?v=6",shortcut:"/icon?v=6",apple:"/apple-icon.png"},openGraph:{title:"Tastile — Execution Control",description:"Stop managing tasks. Start controlling execution.",type:"website"}};function n({children:a}){return(0,b.jsxs)("html",{lang:"en",suppressHydrationWarning:!0,children:[(0,b.jsx)("head",{children:(0,b.jsx)("script",{dangerouslySetInnerHTML:{__html:l}})}),(0,b.jsxs)("body",{className:`${d.variable} ${f.variable} ${h.variable} ${j.variable} antialiased`,children:[(0,b.jsx)(k.GoogleAnalytics,{measurementId:""}),a]})]})}a.s(["default",()=>n,"metadata",0,m],27572)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__db9ca5b0._.js.map