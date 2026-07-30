import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";

import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { DemoSiteBanner } from "@/components/marketing/DemoSiteBanner";
import { getCognitoPublicOrigin } from "@/lib/cognito/public-origin";
import { themeScript } from "@/lib/theme-script";
import { ColorSchemeScript, mantineHtmlProps } from "@mantine/core";
import type { Metadata } from "next";
import { AppProviders } from "./providers";
import "yakuhanjp/dist/css/yakuhanjp.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tastile — Execution Control",
  description: "Stop managing tasks. Start controlling execution.",
  metadataBase: new URL(getCognitoPublicOrigin()),
  manifest: "/manifest.json",
  icons: {
    icon: "/icon?v=6",
    shortcut: "/icon?v=6",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "Tastile — Execution Control",
    description: "Stop managing tasks. Start controlling execution.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";

  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript defaultColorScheme="auto" />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: theme-init must run inline before paint to prevent FOUC — cannot be ref'd to a JS file */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap"
        />
      </head>
      <body className="font-sans antialiased">
        <GoogleAnalytics measurementId={gaMeasurementId} />
        <AppProviders>
          <DemoSiteBanner />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
