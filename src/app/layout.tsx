import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ScholarSift — Research Paper Search & Filtering",
  description:
    "Search the open academic web (Semantic Scholar, OpenAlex, Crossref) and filter research papers into structured, Elicit-style columns. No API keys required.",
  keywords: [
    "research papers",
    "academic search",
    "Semantic Scholar",
    "OpenAlex",
    "literature review",
    "Elicit alternative",
  ],
  authors: [{ name: "ScholarSift" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "ScholarSift — Research Paper Search & Filtering",
    description:
      "Search the open academic web and filter research papers into structured columns.",
    url: "https://chat.z.ai",
    siteName: "ScholarSift",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ScholarSift",
    description:
      "Search the open academic web and filter research papers into structured columns.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          {children}
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
