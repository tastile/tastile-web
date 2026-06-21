import type { Metadata } from "next";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { themeScript } from "@/lib/theme-script";
import "yakuhanjp/dist/css/yakuhanjp.css";
import "./globals.css";

// Mock font variables to avoid build-time Google Fonts download failures in offline/sandboxed environments
const geistSans = { variable: "font-sans" };
const geistMono = { variable: "font-mono" };
const outfit = { variable: "font-sans" };
const inter = { variable: "font-sans" };
const zenKaku = { variable: "font-sans" };

export const metadata: Metadata = {
  title: "Tastile — Execution Control",
  description: "Stop managing tasks. Start controlling execution.",
  metadataBase: new URL("https://tastile.app"),
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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: theme init runs synchronously before paint */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} ${inter.variable} ${zenKaku.variable} antialiased`}
      >
        <GoogleAnalytics measurementId={gaMeasurementId} />
        {children}
      </body>
    </html>
  );
}
