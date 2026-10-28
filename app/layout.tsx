import type { Metadata, Viewport } from "next";
import { Manrope, Unbounded } from "next/font/google";
import { SITE } from "@/lib/site";
import "./globals.css";

const display = Unbounded({
  subsets: ["latin"],
  weight: "900",
  variable: "--font-unbounded",
  display: "swap",
});

const body = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: SITE.meta.title,
  description: SITE.meta.description,
};

export const viewport: Viewport = {
  themeColor: "#15121c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
