import { Inter } from "next/font/google";

// Legacy template body font (`--logistiq-font`). CS Learn uses Inter for UI/body text.
// Export name kept for existing imports.
export const dmSans = Inter({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--logistiq-font",
  display: "swap",
});
