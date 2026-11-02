import { MobileBottomNav } from "@/components/layout/MobileBottomNav";

/**
 * Layout for white-label academy sites (everything under /academy/[domain], including
 * <slug>.<root-domain> subdomains, which the proxy rewrites to /academy/<slug>).
 *
 * Deliberately does NOT import public/assets/css/style.css (the purchased template stylesheet that
 * the marketing/learner/creator groups load). That file @imports Bootstrap and sets unlayered
 * global rules, which silently override Tailwind on any page that loads it:
 *   - h1-h6 { color: #062E39 } and a { color: #FD5523 } beat every Tailwind text-colour class
 *     (except text-white, which Bootstrap re-declares with !important) - so headings in dark
 *     templates were dark teal on near-black and links ignored their colour classes;
 *   - Bootstrap's !important spacing scale (p-4 = 1.5rem, gap-5 = 3rem) replaces Tailwind's
 *     (p-4 = 1rem, gap-5 = 1.25rem), and .container's padding/max-width beat Tailwind's.
 * Tenant UI is pure Tailwind + lucide, so it must not load that file.
 */
export default function TenantGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* room for the fixed mobile bottom nav (hidden from md up) */}
      <main className="flex-1 pb-[4.5rem] md:pb-0">{children}</main>
      <MobileBottomNav />
    </div>
  );
}
