import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter, Manrope, JetBrains_Mono } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import { NetworkStatusProvider } from "@/components/providers/NetworkStatusProvider";
import { SWRProvider } from "@/components/providers/SWRProvider";
import "./globals.css";
import "./app-surface-reset.css";
import { BRAND, BRAND_COLORS, appUrl } from "@/lib/brand";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Display font for headings, course titles and large statistics.
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BRAND_COLORS.softWhite },
    { media: "(prefers-color-scheme: dark)", color: BRAND_COLORS.midnight },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  applicationName: BRAND.name,
  title: {
    default: `${BRAND.fullName} — Learn, Practice, Build, Grow`,
    template: `%s | ${BRAND.name}`,
  },
  description: BRAND.description,
  keywords: ["CS Learn", "CreativeSites Learn", "CreativeSites", "AI courses", "online courses", "AI tutor", "certificates", "Zambia", "Africa"],
  authors: [{ name: BRAND.parent }],
  creator: BRAND.parent,
  publisher: BRAND.parent,
  openGraph: {
    title: BRAND.fullName,
    description: BRAND.description,
    siteName: BRAND.fullName,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND.fullName,
    description: BRAND.description,
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: BRAND.name,
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: BRAND_COLORS.royalBlue,
          colorForeground: BRAND_COLORS.charcoal,
          fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
          borderRadius: "0.75rem",
        },
      }}
    >
      <html
        lang="en"
        className={`h-full antialiased ${inter.variable} ${manrope.variable} ${jetbrainsMono.variable}`}
      >
        <body className="min-h-full flex flex-col overflow-x-hidden bg-background text-foreground font-sans">
          <NextTopLoader
            color={BRAND_COLORS.royalBlue}
            initialPosition={0.08}
            crawlSpeed={200}
            height={3}
            crawl={true}
            showSpinner={false}
            easing="ease"
            speed={200}
            shadow={`0 0 10px ${BRAND_COLORS.electricBlue},0 0 5px ${BRAND_COLORS.royalBlue}`}
          />
          <NetworkStatusProvider>
            <SWRProvider>{children}</SWRProvider>
          </NetworkStatusProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
