import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PharOS",
  description: "PharOS Beta Command Center",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
