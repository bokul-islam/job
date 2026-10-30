import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "TalentBridge — Jobs, verified candidates, real response times", template: "%s · TalentBridge" },
  description: "A two-sided job marketplace connecting employers with verified job seekers. Video CVs, secure messaging, and transparent response-time analytics.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-screen flex-col font-sans">{children}</body>
    </html>
  );
}
