import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const TITLE = "Website Builder — AI Website & App Builder";
const DESCRIPTION =
  "Prompt to full working web applications with instant live preview, code editing, and multi-agent AI engine.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s — Website Builder" },
  description: DESCRIPTION,
  applicationName: "Website Builder",
  keywords: ["AI website builder", "code generation", "LangGraph", "live preview"],
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Website Builder",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#080c16",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#080c16] text-slate-100 min-h-screen antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
