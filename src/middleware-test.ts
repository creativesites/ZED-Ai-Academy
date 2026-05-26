import { NextResponse } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import type { NextRequest } from 'next/server';



/**
 * Get cookie options for subdomain support
 * Uses leading dot for domain to enable subdomain cookie sharing
 */
function getCookieOptions() {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';
  const domain = rootDomain.split(':')[0];

  return {
    // Leading dot makes cookies accessible to all subdomains
    // For localhost: ".localhost" covers both localhost and *.localhost
    domain: `.${domain}`,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  };
}

export default clerkMiddleware(async (auth, req: NextRequest) =>  {
  const url = req.nextUrl;
  const hostname = req.headers.get('host') || '';
  const pathname = url.pathname;
  const { userId, orgId, redirectToSignIn, orgRole, orgSlug } = await auth()

  // Define the root domain (e.g. localhost:3000 or guidelearn.com)
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';

  // Determine if we are on a subdomain
  // logic: if hostname is "mine.guidelearn.com", subdomain is "mine"
  // if hostname is "guidelearn.com" or "www.guidelearn.com", subdomain is null
  const subdomain = hostname.endsWith(`.${rootDomain}`) && !hostname.startsWith('www.')
    ? hostname.replace(`.${rootDomain}`, '')
    : null;

  // Initialize response for cookie handling
//   let supabaseResponse = NextResponse.next({
//     request: req,
//   });

//   const cookieOptions = getCookieOptions();

  // Create Supabase client with cookie handling for subdomain support
//   const supabase = createServerClient(
//     process.env.NEXT_PUBLIC_SUPABASE_URL!,
//     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
//     {
//       cookies: {
//         getAll() {
//           return req.cookies.getAll();
//         },
//         setAll(cookiesToSet) {
//           cookiesToSet.forEach(({ name, value, options }) => {
//             // Merge our cookie options for subdomain support
//             const mergedOptions = { ...options, ...cookieOptions };
//             req.cookies.set(name, value);
//             supabaseResponse.cookies.set(name, value, mergedOptions);
//           });
//         },
//       },
//     }
//   );

  //const { data: { session } } = await supabase.auth.getSession();

  // Helper to copy cookies from supabaseResponse to a new response
//   const copyCookies = (response: NextResponse) => {
//     supabaseResponse.cookies.getAll().forEach((cookie) => {
//       response.cookies.set(cookie.name, cookie.value, cookieOptions);
//     });
//     return response;
//   };

  // ==========================================================
  // CASE 1: SUBDOMAINS (e.g., western-mining.guidelearn.com)
  // ==========================================================
  if (subdomain) {
    

    // 2. Fetch Tenant ID (to inject into headers for RLS/Layouts)
    // const { data: tenant } = await supabaseAdmin
    //   .from('tenants')
    //   .select('id')
    //   .eq('slug', subdomain)
    //   .single();

    // If tenant doesn't exist, redirect to root login
    // if (!tenant) {
    //   const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    //   return copyCookies(NextResponse.redirect(`${protocol}://${rootDomain}/login?error=no_tenant`));
    // }

    // 3. Verify user has access to this tenant
    // const { data: userRole } = await supabaseAdmin
    //   .from('user_roles')
    //   .select('id')
    //   .eq('user_id', session.user.id)
    //   .eq('tenant_id', tenant.id)
    //   .single();

    // if (!userRole) {
    //   const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    //   return copyCookies(NextResponse.redirect(`${protocol}://${rootDomain}/login?error=no_access`));
    // }

    // 4. Prepare Headers with tenant info
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-tenant-id', 'tripoli-1782738837477');
    requestHeaders.set('x-tenant-slug', subdomain);

    // 5. Rewrite the URL to the [tenant] dynamic folder
    // e.g. /academy/tenant-slug/dashboard -> internal /academy/tenant-slug/dashboard
    const rewriteResponse = NextResponse.rewrite(
      new URL(`/${subdomain}${pathname}${url.search}`, req.url),
      {
        request: { headers: requestHeaders },
      }
    );

    // Copy cookies to rewrite response
    //return copyCookies(rewriteResponse);
    return rewriteResponse
  }

  // ==========================================================
  // CASE 2: ROOT DOMAIN (guidelearn.com)
  // ==========================================================

  // A. Special Route: Super Admin
  if (pathname.startsWith('/super-admin')) {
    // Require session for super-admin routes
    // if (!session) {
    //   const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    //   return copyCookies(NextResponse.redirect(`${protocol}://${rootDomain}/login`));
    // }

    // // Verify user is actually a super admin
    // const { data: isSuperAdmin } = await supabaseAdmin
    //   .from('super_admins')
    //   .select('id')
    //   .eq('user_id', session.user.id)
    //   .single();

    // if (!isSuperAdmin) {
    //   // Not a super admin - redirect to login with error
    //   const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    //   return copyCookies(NextResponse.redirect(`${protocol}://${rootDomain}/login?error=not_authorized`));
    // }

    // Super admin verified - allow through
    // return copyCookies(supabaseResponse);
    return NextResponse.next()
  }

  // B. Redirect Logged-In Users
  // If user is at Home (/) or Login (/login) and HAS a session, send them to their dashboard
//   if (session && (pathname === '/' || pathname === '/login' || pathname === '/signup')) {

//     // 1. Check if they are a Super Admin first
//     const { data: isSuperAdmin } = await supabaseAdmin
//       .from('super_admins')
//       .select('id')
//       .eq('user_id', session.user.id)
//       .single();

//     if (isSuperAdmin) {
//       return copyCookies(NextResponse.redirect(new URL('/super-admin', req.url)));
//     }

//     // 2. If not Super Admin, find their Tenant
//     const { data: role } = await supabaseAdmin
//       .from('user_roles')
//       .select('tenant_id, tenants(slug)')
//       .eq('user_id', session.user.id)
//       .single();

//     // 3. Redirect to their specific subdomain
//     if (role?.tenants) {
//       // @ts-ignore - Supabase types join workaround
//       const tenantSlug = role.tenants.slug;

//       // Construct the subdomain URL
//       // Dev: http://slug.localhost:3000/dashboard
//       // Prod: https://slug.guidelearn.com/dashboard
//       const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
//       const redirectUrl = `${protocol}://${tenantSlug}.${rootDomain}/dashboard`;

//       return copyCookies(NextResponse.redirect(redirectUrl));
//     }
//   }

  // C. Public Routes (Landing Page, Signup, Login)
  // If no session or specific path, allow default behavior
    //   return copyCookies(supabaseResponse);
    return NextResponse.next()
})

// Ignore static files and APIs to save performance
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ],
};