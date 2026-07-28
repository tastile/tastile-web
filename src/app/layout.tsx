import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";

import { ColorSchemeScript, mantineHtmlProps } from "@mantine/core";
import type { Metadata } from "next";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { getCognitoPublicOrigin } from "@/lib/cognito/public-origin";
import { themeScript } from "@/lib/theme-script";
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
      </head>
      <body className="font-sans antialiased">
        <GoogleAnalytics measurementId={gaMeasurementId} />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
