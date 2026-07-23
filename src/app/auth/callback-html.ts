import { NextResponse } from "next/server";

export function callbackHtmlResponse(args: {
  title: string;
  message: string;
  destination: string;
  tone: "success" | "error";
}) {
  const accent = args.tone === "success" ? "#5e6ad2" : "#ef4444";
  const escapedDestination = escapeHtml(args.destination);
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="1.2;url=${escapedDestination}" />
  <title>${escapeHtml(args.title)} | Tastile</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      color-scheme: light dark;
      --background: #f7f8f8;
      --surface-elevated: #ffffff;
      --surface-0: #f3f4f5;
      --foreground: #111217;
      --foreground-muted: #4f5562;
      --primary: #5e6ad2;
      --primary-hover: #7170ff;
      --radius-md: 12px;
      --radius-full: 999px;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --background: #08090a;
        --surface-elevated: #191a1b;
        --surface-0: #0f1011;
        --foreground: #f7f8f8;
        --foreground-muted: #d0d6e0;
      }
    }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: var(--background);
      color: var(--foreground);
      font-family: "Zen Kaku Gothic New", "Noto Sans JP", "Hiragino Sans", "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .panel {
      width: min(520px, calc(100vw - 32px));
      background: var(--surface-elevated);
      border-radius: var(--radius-md);
      padding: 32px;
      box-sizing: border-box;
    }
    .mark {
      width: 52px;
      height: 52px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      background: ${accent};
      color: #fff;
      font-weight: 700;
      font-size: 24px;
    }
    h1 {
      margin: 22px 0 10px;
      font-size: 28px;
      line-height: 1.15;
      letter-spacing: 0;
      color: var(--foreground);
    }
    p { margin: 0; line-height: 1.65; }
    .muted { color: var(--foreground-muted); }
    .bar {
      margin-top: 26px;
      height: 4px;
      border-radius: var(--radius-full);
      overflow: hidden;
      background: ${args.tone === "success" ? "rgba(94,106,210,.18)" : "rgba(239,68,68,.18)"};
    }
    .bar span {
      display: block;
      width: 45%;
      height: 100%;
      background: ${accent};
      animation: slide 1.2s ease-in-out infinite;
      border-radius: inherit;
    }
    a { color: ${accent}; text-decoration: none; }
    a:hover { color: var(--primary-hover); }
    @keyframes slide {
      0% { transform: translateX(-120%); }
      100% { transform: translateX(240%); }
    }
  </style>
</head>
<body>
  <main class="panel">
    <div class="mark">T</div>
    <h1>${escapeHtml(args.title)}</h1>
    <p class="muted">${escapeHtml(args.message)}</p>
    <div class="bar" aria-hidden="true"><span></span></div>
    <p class="muted" style="margin-top:18px;font-size:14px;">自動で移動しない場合は <a href="${escapedDestination}">こちら</a> を開いてください。</p>
  </main>
  <script type="application/json" id="auth-callback-destination">${escapeHtml(JSON.stringify(args.destination))}</script>
  <script>(function(){var d=JSON.parse(document.getElementById("auth-callback-destination").textContent);setTimeout(function(){window.location.replace(d);},900);})();</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
