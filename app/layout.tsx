//app/layout.tsx
import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

const ibmPlexThai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-ibm-plex-thai",
});

export const metadata: Metadata = {
  title: "SCG | Health Check",
  description: "Employee Health Check Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body
        className={`${ibmPlexThai.variable} antialiased`}
        style={{ fontFamily: "var(--font-ibm-plex-thai), sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
