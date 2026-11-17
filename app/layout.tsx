import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai, Prompt } from "next/font/google";
import "./globals.css";

const thaiSans = IBM_Plex_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

// Rounder Thai display face for headings; body text stays IBM Plex Sans Thai.
const thaiHeading = Prompt({
  variable: "--font-heading",
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Part-time Job Finder",
  description:
    "A student-first MVP for finding part-time jobs that fit class schedules.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  // "Add to Home Screen" opens full-screen like an app
  appleWebApp: {
    capable: true,
    title: "หางานว่าง",
    statusBarStyle: "black",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#10162d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={`${thaiSans.variable} ${thaiHeading.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
