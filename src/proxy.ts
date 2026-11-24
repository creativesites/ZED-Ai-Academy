import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const isOnboardingRoute = createRouteMatcher(['/onboarding(.*)']);
const isLaunchAcademyRoute = createRouteMatcher(['/launch-your-academy(.*)']);

/** Main marketing site pages — academy owners without an org are nudged to launch first. */
const isMarketingBrowseRoute = createRouteMatcher([
  '/',
  '/about(.*)',
  '/contact(.*)',
  '/pricing(.*)',
  '/faq(.*)',
  '/blog(.*)',
  '/test(.*)',
]);

const isPublicRoute = createRouteMatcher([
  '/',
  '/about(.*)',
  '/courses(.*)',
  '/contact',
  '/pricing(.*)',
  '/faq(.*)',
  '/blog(.*)',
  '/academy(.*)',
  '/ai-tutor(.*)',
  '/try(.*)',
  '/api/tutor/try/(.*)',
  '/api/tutor/demo/voice',
  '/api/ai/tutor',
  '/api/ai/practice-studio',
  '/api/webhooks/(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/test(.*)',
  '/manifest.json',
  '/favicon.ico',
  '/launch-your-academy(.*)',
]);

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// Reserved subdomains that cannot be claimed by tenants
const RESERVED_SUBDOMAINS = new Set([
  'www', 'api', 'admin', 'app', 'auth', 'mail', 'test', 'dev', 'staging', 'dashboard', 'creator', 'superadmin', 'academy'
]);

/**
 * Platform-level routes that must not be rewritten under `/academy/[domain]` when
 * requested on a tenant subdomain; instead they redirect to the apex domain.
 */
function isPlatformOnlyPath(pathname: string): boolean {
  if (/^\/courses\/[^/]+\/(learn|checkout)(\/|$)/.test(pathname)) return true;
  if (/^\/(live-sessions|certificates|dashboard|practice)(\/|$)/.test(pathname)) return true;
  return false;
}

const LAST_TENANT_COOKIE = 'last_visited_tenant';
const LAST_TENANT_MAX_AGE = 60 * 60 * 24 * 30;

function extractAcademySlug(pathname: string): string | null {
  const match = pathname.match(/^\/academy\/([^/?#]+)/);
  return match?.[1] ?? null;
}

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { userId, orgId, redirectToSignIn } = await auth();

  const url = req.nextUrl;
  const hostname = req.headers.get('host') || '';
  const pathname = url.pathname;

  // Determine protocol dynamically (https in production, http in local development)
  const forwardedProto = req.headers.get('x-forwarded-proto');
  const protocol = forwardedProto || (url.protocol ? url.protocol.replace(':', '') : 'http');

  // Define the root domain dynamically based on configuration or incoming host
  const configuredRootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  const appHost = process.env.NEXT_PUBLIC_APP_URL
    ? new URL(process.env.NEXT_PUBLIC_APP_URL).host
    : '';
  const rootDomain =
    configuredRootDomain && !configuredRootDomain.includes('localhost')
      ? configuredRootDomain
      : appHost && !appHost.includes('localhost')
      ? appHost
      : hostname.includes('localhost')
      ? 'localhost:3000'
      : hostname;

  // Determine if request is on a tenant subdomain
  const subdomain = hostname.endsWith(`.${rootDomain}`) && !hostname.startsWith('www.')
    ? hostname.replace(`.${rootDomain}`, '')
    : null;

  const isTenantSubdomain = Boolean(subdomain && !RESERVED_SUBDOMAINS.has(subdomain));

  // Redirect platform-only routes on tenant subdomains to the apex domain with the same path
  if (isTenantSubdomain && subdomain && isPlatformOnlyPath(pathname)) {
    return NextResponse.redirect(
      new URL(`${pathname}${url.search}`, `${protocol}://${rootDomain}`)
    );
  }

  // Redirect apex /courses to the platform academy (Zed AI Academy)
  if (!isTenantSubdomain && (pathname === '/courses' || pathname === '/courses/')) {
    return NextResponse.redirect(new URL('/academy/zedai', `${protocol}://${hostname}`));
  }

  // Signed-in users on auth pages are redirected to resolve their landing destination (F6: allow /)
  if (userId && !isTenantSubdomain && (pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up'))) {
    const afterSignInUrl = new URL('/after-sign-in', req.url);
    const redirectParam = url.searchParams.get('redirect_url');
    if (redirectParam) {
      afterSignInUrl.searchParams.set('redirect_url', redirectParam);
    }
    return NextResponse.redirect(afterSignInUrl);
  }

  // Allow onboarding routes without redirection
  if (userId && isOnboardingRoute(req)) {
    return NextResponse.next();
  }

  if (userId && isLaunchAcademyRoute(req)) {
    return NextResponse.next();
  }

  // Company admins browsing marketing site without an academy are guided to launch
  if (userId && isMarketingBrowseRoute(req) && !req.nextUrl.pathname.startsWith('/academy')) {
    const admin = supabaseAdmin();
    if (admin) {
      const { data: profile } = await admin
        .from('profiles')
        .select('role, company_id, onboarding_completed')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.role === 'company_admin') {
        if (!profile.onboarding_completed || orgId) {
          return NextResponse.next();
        }

        const { data: membership } = await admin
          .from('company_members')
          .select('company_id')
          .eq('profile_id', userId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        if (!membership?.company_id) {
          let hasCompany = false;
          if (profile.company_id) {
            const { data: company } = await admin
              .from('companies')
              .select('id')
              .eq('id', profile.company_id)
              .maybeSingle();
            hasCompany = Boolean(company);
          }
          if (!hasCompany) {
            return NextResponse.redirect(new URL('/launch-your-academy', req.url));
          }
        }
      }
    }
  }

  // Unauthenticated users trying to access private routes
  if (!userId && !isPublicRoute(req)) {
    if (isTenantSubdomain) {
      const returnBackUrl = new URL(`/academy/${subdomain}${pathname}${url.search}`, `${protocol}://${rootDomain}`).toString();
      const signInUrl = new URL('/sign-in', `${protocol}://${rootDomain}`);
      signInUrl.searchParams.set('redirect_url', returnBackUrl);
      return NextResponse.redirect(signInUrl);
    }
    return redirectToSignIn({ returnBackUrl: req.url });
  }

  // Unified authentication: redirect sign-in / sign-up on subdomain to root domain with tenant return URL
  if (isTenantSubdomain && subdomain && (pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up'))) {
    const targetUrl = new URL(url.pathname, `${protocol}://${rootDomain}`);

    const redirectUrlParam = url.searchParams.get('redirect_url');
    if (redirectUrlParam) {
      let absoluteRedirect = redirectUrlParam;
      if (redirectUrlParam.startsWith('/')) {
        const prefix = `/academy/${subdomain}`;
        if (!redirectUrlParam.startsWith(prefix)) {
          absoluteRedirect = `${prefix}${redirectUrlParam}`;
        }
      } else if (redirectUrlParam.includes(subdomain)) {
        try {
          const rObj = new URL(redirectUrlParam);
          rObj.host = rootDomain;
          const prefix = `/academy/${subdomain}`;
          if (!rObj.pathname.startsWith(prefix)) {
            rObj.pathname = `${prefix}${rObj.pathname}`;
          }
          absoluteRedirect = rObj.pathname + rObj.search;
        } catch {}
      }
      targetUrl.searchParams.set('redirect_url', absoluteRedirect);
    } else {
      // Default to returning to the tenant classroom/home
      targetUrl.searchParams.set('redirect_url', `/academy/${subdomain ?? ''}/classroom`);
    }

    // Preserve any role or additional parameters
    url.searchParams.forEach((val, key) => {
      if (key !== 'redirect_url') {
        targetUrl.searchParams.set(key, val);
      }
    });

    return NextResponse.redirect(targetUrl);
  }

  // Apply Subdomain Rewrite Logic (never rewrite API or tRPC endpoints)
  if (
    isTenantSubdomain &&
    subdomain &&
    !pathname.startsWith('/api/') &&
    !pathname.startsWith('/trpc/')
  ) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-tenant-slug', subdomain);

    const tenantPrefix = `/academy/${subdomain}`;
    const targetPath =
      pathname === tenantPrefix || pathname.startsWith(`${tenantPrefix}/`)
        ? pathname
        : `${tenantPrefix}${pathname}`;

    const res = NextResponse.rewrite(
      new URL(`${targetPath}${url.search}`, req.url),
      {
        request: { headers: requestHeaders },
      }
    );
    res.cookies.set(LAST_TENANT_COOKIE, subdomain, {
      path: '/',
      sameSite: 'lax',
      maxAge: LAST_TENANT_MAX_AGE,
    });
    return res;
  }

  const res = NextResponse.next();
  const academySlug = extractAcademySlug(pathname);
  if (academySlug) {
    res.cookies.set(LAST_TENANT_COOKIE, academySlug, {
      path: '/',
      sameSite: 'lax',
      maxAge: LAST_TENANT_MAX_AGE,
    });
  }
  return res;
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|json|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
