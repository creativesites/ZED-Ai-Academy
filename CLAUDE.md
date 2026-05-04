@AGENTS.md

# Zed AI Academy — Claude Context

## What this project is
A full-stack Next.js platform for creating and selling AI courses — targeting both individual learners (B2C) and companies (B2B). Built solo by the founder.

## Tech Stack
- **Framework**: Next.js 14+ (App Router, TypeScript, src/ directory)
- **Styling**: Tailwind CSS v4 + Shadcn/UI
- **Database & Auth**: Supabase (Postgres + Row Level Security)
- **Video**: YouTube embeds (no video hosting costs)
- **AI Features**: Anthropic Claude API (`claude-sonnet-4-6`)
- **Payments**: Zambian local processor (PayChangu or Flutterwave — TBD)
- **Email**: Resend (recommended, not yet installed)

## Project structure
```
src/
  app/
    (auth)/             # Login, register, forgot password
    (marketing)/        # Homepage, pricing, about
    (learner)/          # Student dashboard, course player
    (creator)/          # Course builder (admin/instructor)
    (company)/          # B2B company admin panel
    api/                # API routes
  components/
    ui/                 # Shadcn primitives
    shared/             # Cross-app components
    learner/            # Course player components
    creator/            # Course builder components
    company/            # B2B team management components
  lib/
    supabase/           # client.ts (browser) + server.ts (server)
    ai/                 # Claude API helpers (tutor, quiz gen, recommendations)
    payments/           # Payment gateway abstraction layer
  types/                # Shared TypeScript types (generate from Supabase schema)
docs/
  ARCHITECTURE.md
  FEATURES.md
  DATABASE.md
  ROADMAP.md
supabase/
  migrations/           # SQL migration files
```

## Key conventions
- Server Components by default; `"use client"` only when needed (interactivity, hooks)
- All DB access goes through Supabase with RLS — never use service role on the client
- Use `@/` import alias throughout (configured in tsconfig.json)
- Supabase browser client: `src/lib/supabase/client.ts`
- Supabase server client: `src/lib/supabase/server.ts`
- Keep payment logic behind `src/lib/payments/` abstraction so processor can be swapped

## Business model
- **B2C**: Individual course purchases (one-time) + monthly/annual subscription plans
- **B2B**: Company accounts with seat-based licensing, team management, usage analytics

## Core features (see docs/FEATURES.md for detail)
1. Course Builder — in-app creation: YouTube video + rich text blocks + quizzes
2. Course Player — progress tracking, bookmarks, notes per lesson
3. Quizzes & Assessments — scored, multiple choice, results stored
4. Certificates — auto-generated PDF on course completion
5. AI Tutor — per-course Claude-powered chatbot with lesson content as context
6. Personalized Learning Paths — AI-recommended course sequences
7. Quiz Generation — Claude generates questions from lesson content
8. Company Accounts — seat allocation, team management, org-level analytics
9. Payments — individual + company checkout, Zambian mobile money + card

## Supabase
- Project URL: https://einxearwcaefblftlxqm.supabase.co
- Use RLS on all tables — see docs/DATABASE.md for policies
- Migrations go in `supabase/migrations/` (use Supabase CLI)

## Payment notes
- Primary market: Zambia — support MTN MoMo, Airtel Money, Visa/Mastercard
- Processor candidates: PayChangu (local Zambian), Flutterwave (ZMW + MoMo), DPO Group
- Abstract all payment calls behind `src/lib/payments/` so switching processor = swap one file

## AI (Claude API)
- Model: `claude-sonnet-4-6` as default
- Enable prompt caching on long system prompts (AI tutor, learning path context)
- AI Tutor: RAG-style, inject relevant lesson content into system prompt
- Quiz generation: pass lesson text → Claude returns structured JSON questions
- See docs/FEATURES.md for full AI feature specs
