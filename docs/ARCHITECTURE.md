# Architecture — Zed AI Academy

## Overview

A Next.js App Router monolith backed by Supabase. No separate backend service — all server logic lives in Next.js Server Components, Server Actions, and API Routes.

```
Browser → Next.js (App Router) → Supabase (Postgres + Auth + Storage)
                              → Anthropic API (AI features)
                              → Payment Gateway (Zambian processor)
                              → YouTube (video embeds, no API needed)
```

## App Router Groups

| Route group | Path | Who sees it |
|---|---|---|
| `(marketing)` | `/`, `/pricing`, `/courses`, `/about` | Public |
| `(auth)` | `/login`, `/register`, `/forgot-password` | Unauthenticated |
| `(learner)` | `/dashboard`, `/courses/[slug]/learn` | Enrolled learners |
| `(creator)` | `/creator/*` | Instructors / admin |
| `(company)` | `/company/*` | Company admins |
| `api` | `/api/*` | Server-side only |

## Authentication Flow
- Supabase Auth (email/password + OAuth Google optional)
- Session stored in cookies via `@supabase/ssr`
- Middleware (`src/middleware.ts`) protects route groups by checking session
- Role stored in `profiles.role` — values: `learner`, `instructor`, `company_admin`, `super_admin`

## Data Access Pattern
```
Server Component / Server Action
  → src/lib/supabase/server.ts  (createServerClient)
  → Supabase Postgres (with RLS enforced)

Client Component (rare)
  → src/lib/supabase/client.ts  (createBrowserClient)
  → Supabase Postgres (with RLS enforced)
```

Never call Supabase with the service role key from client-side code. Service role is only used in trusted API routes (e.g., certificate generation, webhook handlers).

## Course Content Architecture

Courses have a 3-level hierarchy:
```
Course
  └── Module (section/chapter)
        └── Lesson
              └── ContentBlock[] (ordered blocks of content)
```

Each `ContentBlock` has a `type`:
- `video` — YouTube video ID + optional transcript
- `text` — rich text (stored as JSON/HTML)
- `quiz` — reference to a quiz entity
- `file` — PDF/resource link (stored in Supabase Storage)

This block-based design lets the creator compose lessons freely.

## AI Architecture

### AI Tutor
- Triggered per-course from the lesson player
- System prompt includes: course title, module list, current lesson content blocks (text only)
- Conversation history kept client-side per session (not persisted)
- API route: `POST /api/ai/tutor` — calls Claude with streaming response

### Quiz Generation
- API route: `POST /api/ai/generate-quiz`
- Input: lesson content text
- Output: structured JSON `{ questions: [{ question, options, correct_index, explanation }] }`
- Creator reviews and saves to DB

### Learning Path Recommendations
- API route: `POST /api/ai/recommendations`
- Input: user's completed courses + stated learning goal
- Output: ordered list of course IDs with reasoning
- Shown on learner dashboard

### Prompt Caching
- Use `cache_control: { type: "ephemeral" }` on system prompts > 1024 tokens
- Especially important for AI tutor (course context can be large)

## Payment Architecture

Abstract payment logic in `src/lib/payments/`:
```
src/lib/payments/
  index.ts          # exports unified interface
  types.ts          # PaymentIntent, CheckoutSession types
  paychungu.ts      # PayChangu implementation
  flutterwave.ts    # Flutterwave implementation (fallback)
```

Payment webhooks: `POST /api/webhooks/payment` — verifies signature, updates `orders` and `enrollments` tables.

## B2B Company Model

```
Company
  └── CompanyMember[] (FK to profiles)
  └── CompanySubscription (seat count, plan, billing cycle)
  └── SeatAllocation (which members have active seats)
```

Company admin can:
- Invite members by email
- Assign/revoke seats
- See completion rates and time-spent analytics per member
- Bulk purchase additional seats

## File Storage (Supabase Storage)

| Bucket | Contents | Access |
|---|---|---|
| `course-thumbnails` | Course cover images | Public |
| `course-resources` | PDFs, downloadable files | Private (RLS) |
| `certificates` | Generated PDF certificates | Private (owner only) |
| `avatars` | User profile photos | Public |

## Deployment Target
- Vercel (Next.js native)
- Environment variables set in Vercel dashboard
- Supabase project handles DB + Auth hosting
