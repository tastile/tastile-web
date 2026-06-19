import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Outfit, Zen_Kaku_Gothic_New } from "next/font/google";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { themeScript } from "@/lib/theme-script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const zenKaku = Zen_Kaku_Gothic_New({
  variable: "--font-zen-kaku",
  // next/font's bundled TS types for Zen_Kaku_Gothic_New are stale —
  // they only declare "cyrillic" | "latin" | "latin-ext", but Google
  // Fonts exposes "japanese" and "vietnamese" as well. Cast to the
  // declared union so the loader passes through the extra subset.
  subsets: ["latin", "japanese"] as ("cyrillic" | "latin" | "latin-ext")[],
  weight: ["400", "500", "700", "900"],
});

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
