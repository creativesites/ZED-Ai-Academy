import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import { NetworkStatusProvider } from "@/components/providers/NetworkStatusProvider";
import { SWRProvider } from "@/components/providers/SWRProvider";
import "./globals.css";
import "./app-surface-reset.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#062e39",
};

export const metadata: Metadata = {
  title: {
    default: "Zed AI Academy — Learn AI Skills That Matter",
    template: "%s | Zed AI Academy",
  },
  description:
    "Master AI tools, prompt engineering, and machine learning with hands-on courses built for individuals and teams in Africa.",
  keywords: ["AI courses", "artificial intelligence", "machine learning", "prompt engineering", "Zambia", "Africa"],
  openGraph: {
    title: "Zed AI Academy",
    description: "Master AI skills with courses built for Africa.",
    type: "website",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`h-full antialiased ${inter.variable} ${plusJakarta.variable} ${jetbrainsMono.variable}`}
      >
        <body className="min-h-full flex flex-col overflow-x-hidden bg-background text-foreground font-sans">
          <NextTopLoader
            color="#fd5523"
            initialPosition={0.08}
            crawlSpeed={200}
            height={3}
            crawl={true}
            showSpinner={false}
            easing="ease"
            speed={200}
            shadow="0 0 10px #fd5523,0 0 5px #fd5523"
          />
          <NetworkStatusProvider>
            <SWRProvider>{children}</SWRProvider>
          </NetworkStatusProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
