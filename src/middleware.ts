import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const isOnboardingRoute = createRouteMatcher(['/onboarding(.*)'])
const isLaunchAcademyRoute = createRouteMatcher(['/launch-your-academy(.*)'])

/** Main marketing site pages — academy owners without an org are nudged to launch first. */
const isMarketingBrowseRoute = createRouteMatcher([
  '/',
  '/about(.*)',
  '/courses(.*)',
  '/contact(.*)',
  '/pricing(.*)',
  '/faq(.*)',
  '/blog(.*)',
  '/test(.*)',
])

const isPublicRoute = createRouteMatcher([
  '/',
  '/about(.*)',
  '/courses',
  '/contact',
  '/pricing(.*)',
  '/faq(.*)',
  '/blog(.*)',
  '/academy(.*)',
  '/courses/([^/]+)',
  '/api/webhooks/(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/test(.*)',
  '/manifest.json',
  '/favicon.ico',
  '/launch-your-academy(.*)',
])

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

// List of reserved subdomains to prevent tenants from claiming system routes
const RESERVED_SUBDOMAINS = new Set([
  'www', 'api', 'admin', 'app', 'auth', 'mail', 'test', 'dev', 'staging', 'dashboard', 'creator', 'superadmin', 'academy'
])

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { userId, orgId, redirectToSignIn } = await auth()
  
  const url = req.nextUrl;
  const hostname = req.headers.get('host') || '';
  const pathname = url.pathname;
  
  // Define the root domain (e.g. localhost:3000 or zedai.com)
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';
  
  // Determine if we are on a subdomain
  const subdomain = hostname.endsWith(`.${rootDomain}`) && !hostname.startsWith('www.')
    ? hostname.replace(`.${rootDomain}`, '')
    : null;
    
  const isTenantSubdomain = subdomain && !RESERVED_SUBDOMAINS.has(subdomain);

  // For users visiting /onboarding, don't try to redirect
  if (userId && isOnboardingRoute(req)) {
    return NextResponse.next()
  }

  if (userId && isLaunchAcademyRoute(req)) {
    return NextResponse.next()
  }

  // Company admins browsing the marketing site without an academy → dedicated launch flow
  if (userId && isMarketingBrowseRoute(req) && !req.nextUrl.pathname.startsWith('/academy')) {
    const admin = supabaseAdmin()
    if (admin) {
      const { data: profile } = await admin
        .from('profiles')
        .select('role, company_id, onboarding_completed')
        .eq('id', userId)
        .maybeSingle()

      if (profile?.role === 'company_admin') {
        if (!profile.onboarding_completed) {
          return NextResponse.next()
        }
        if (orgId) {
          return NextResponse.next()
        }
        const { data: membership } = await admin
          .from('company_members')
          .select('company_id')
          .eq('profile_id', userId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle()

        if (!membership?.company_id) {
          let hasCompany = false
          if (profile.company_id) {
            const { data: company } = await admin
              .from('companies')
              .select('id')
              .eq('id', profile.company_id)
              .maybeSingle()
            hasCompany = !!company
          }
          if (!hasCompany) {
            return NextResponse.redirect(new URL('/launch-your-academy', req.url))
          }
        }
      }
    }
  }

  // If the user isn't signed in and the route is private, redirect to sign-in
  if (!userId && !isPublicRoute(req)) {
    if (isTenantSubdomain) {
      const returnBackUrl = new URL(`/academy/${subdomain}${pathname}${url.search}`, `http://${rootDomain}`).toString();
      const signInUrl = new URL('/sign-in', `http://${rootDomain}`);
      signInUrl.searchParams.set('redirect_url', returnBackUrl);
      return NextResponse.redirect(signInUrl);
    }
    return redirectToSignIn({ returnBackUrl: req.url })
  }

  // If the request is for sign-in or sign-up on a subdomain, redirect to the main domain so session cookies are unified
  if (isTenantSubdomain && (pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up'))) {
    const targetUrl = new URL(url.pathname, `http://${rootDomain}`);
    
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
    }
    
    // Copy other params
    url.searchParams.forEach((val, key) => {
      if (key !== 'redirect_url') {
        targetUrl.searchParams.set(key, val);
      }
    });

    return NextResponse.redirect(targetUrl);
  }

  // Apply Subdomain Rewrite Logic
  if (isTenantSubdomain) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-tenant-slug', subdomain);

    // Rewrite the URL to the internal dynamic folder structure
    return NextResponse.rewrite(
      new URL(`/academy/${subdomain}${pathname}${url.search}`, req.url),
      {
        request: { headers: requestHeaders },
      }
    );
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|json|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
