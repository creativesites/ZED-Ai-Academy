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
  '/api/webhook/clerk',
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

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { userId, orgId, redirectToSignIn } = await auth()

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
    return redirectToSignIn({ returnBackUrl: req.url })
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
