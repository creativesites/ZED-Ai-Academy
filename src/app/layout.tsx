import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { SiteIntelligenceDock } from "@/components/shared/site-intelligence-dock";
import NextTopLoader from "nextjs-toploader";
import { NetworkStatusProvider } from "@/components/providers/NetworkStatusProvider";
import { SWRProvider } from "@/components/providers/SWRProvider";
import "./globals.css";

const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"], display: "swap" });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

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
        className={`${dmSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col overflow-x-hidden bg-background text-foreground">
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
          {/* <SiteIntelligenceDock /> */}
        </body>
      </html>
    </ClerkProvider>
  );
}
