import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lovable.dev Clone — AI Website & App Builder",
  description: "Prompt to full working web applications with instant live preview, code editing, and multi-agent AI engine.",
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
