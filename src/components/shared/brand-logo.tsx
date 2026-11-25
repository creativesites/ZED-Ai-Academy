import { BRAND, BRAND_LOGOS } from "@/lib/brand";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  /**
   * `onDark`  – full lockup, white wordmark (navy/charcoal backgrounds) — default.
   * `onLight` – full lockup, outlined wordmark (white/light backgrounds).
   * `emblem`  – icon only, outlined (any background; compact nav, avatars).
   * `emblemOnDark` – icon only, no outline (dark backgrounds).
   */
  variant?: keyof typeof BRAND_LOGOS;
  /** Size with a height or width utility (e.g. `h-10 w-auto`); aspect ratio is always preserved. */
  className?: string;
  /** Set when the logo sits next to visible product text, to avoid double announcement. */
  decorative?: boolean;
  priority?: boolean;
};

/**
 * The supplied CS Learn logo artwork. Never recreate it with text/CSS,
 * stretch it, recolour it or crop it — pick the variant that suits the background.
 */
export function BrandLogo({ variant = "onDark", className, decorative, priority }: BrandLogoProps) {
  const logo = BRAND_LOGOS[variant];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo.src}
      width={logo.width}
      height={logo.height}
      alt={decorative ? "" : BRAND.fullName}
      aria-hidden={decorative || undefined}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      className={cn("block h-10 w-auto max-w-none object-contain select-none", className)}
    />
  );
}

export default BrandLogo;
