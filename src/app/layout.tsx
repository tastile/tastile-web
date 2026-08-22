import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "yakuhanjp/dist/css/yakuhanjp.css";
import "./globals.css";

import { DemoSiteBanner } from "@/features/marketing/ui/DemoSiteBanner";
import { themeScript } from "@/lib/theme-script";
import { getPublicOrigin } from "@/shared/auth/public-origin";
import { getTranslation } from "@/shared/i18n/get-translation";
import { GoogleAnalytics } from "@/shared/ui/GoogleAnalytics";
import { ColorSchemeScript, mantineHtmlProps } from "@mantine/core";
import type { Metadata } from "next";
import { Zen_Kaku_Gothic_New } from "next/font/google";
import { AppProviders } from "./providers";

const zenKaku = Zen_Kaku_Gothic_New({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

const META_LOCALE = "en" as const;
const ROOT_TITLE = getTranslation(META_LOCALE, "app.metadata.title");
const ROOT_DESCRIPTION = getTranslation(META_LOCALE, "app.metadata.description");

export const metadata: Metadata = {
  title: ROOT_TITLE,
  description: ROOT_DESCRIPTION,
  metadataBase: new URL(getPublicOrigin()),
  manifest: "/manifest.json",
  icons: {
    icon: "/icon?v=6",
    shortcut: "/icon?v=6",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: ROOT_TITLE,
    description: ROOT_DESCRIPTION,
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";
  const isE2E = process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH === "1";

  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript defaultColorScheme="auto" />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: theme-init must run inline before paint to prevent FOUC — cannot be ref'd to a JS file */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${zenKaku.className} font-sans antialiased`}>
        <GoogleAnalytics measurementId={gaMeasurementId} />
        <AppProviders>
          {isE2E ? null : <DemoSiteBanner />}
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
