import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "מערכת מסמכים עסקיים",
  description: "מערכת ניהול מסמכים פיננסיים לעסק קטן",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
