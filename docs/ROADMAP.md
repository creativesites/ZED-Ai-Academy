# Roadmap — Zed AI Academy

Solo build. Ship something learners can actually use at each phase before moving to the next.

---

## Phase 1 — Foundation (Weeks 1–3)
**Goal: Auth, DB, and a learner can browse and enroll in a free course.**

- [ ] Supabase project setup: create all tables + RLS policies (from DATABASE.md)
- [ ] Supabase client setup: `src/lib/supabase/client.ts` + `src/lib/supabase/server.ts`
- [ ] Middleware: protect `(learner)`, `(creator)`, `(company)` routes
- [ ] Auth pages: register, login, forgot password (Supabase Auth)
- [ ] Profiles: auto-create profile row on signup (Supabase trigger)
- [ ] Marketing homepage (static, hero + features + pricing teaser)
- [ ] Public course catalog page + course detail page
- [ ] Learner dashboard shell (enrolled courses list)
- [ ] Lesson player — render content blocks (video embed, rich text, resource download)
- [ ] Progress tracking — mark lesson complete, store in `lesson_progress`
- [ ] Deploy to Vercel

**Milestone: A user can register, browse free courses, and track their progress.**

---

## Phase 2 — Course Builder (Weeks 4–6)
**Goal: Instructor can create and publish a full course without leaving the app.**

- [ ] Creator dashboard (list my courses, stats)
- [ ] Course settings form (title, description, thumbnail, pricing, publish toggle)
- [ ] Curriculum builder (drag-and-drop modules + lessons with dnd-kit)
- [ ] Lesson editor: Video block (YouTube URL → embed)
- [ ] Lesson editor: Text block (TipTap rich text editor)
- [ ] Lesson editor: Resource block (file upload to Supabase Storage)
- [ ] Lesson preview as student
- [ ] Supabase Storage setup (buckets: course-thumbnails, course-resources, avatars)
- [ ] Image upload for course thumbnails

**Milestone: Instructor can create, edit, and publish a complete AI course.**

---

## Phase 3 — Quizzes & Certificates (Weeks 7–8)
**Goal: Full assessment loop with certificates.**

- [ ] Quiz builder UI (add/edit/delete questions + options)
- [ ] Quiz block in lesson editor
- [ ] Quiz player in lesson player (submit, score, show explanations)
- [ ] Store quiz attempts in DB
- [ ] Retake logic + attempt limits
- [ ] Certificate generation (PDF using `@react-pdf/renderer` or `puppeteer`)
- [ ] Store certificate in Supabase Storage
- [ ] Shareable certificate URL + LinkedIn share button
- [ ] Creator quiz analytics (pass rate, per-question difficulty)

**Milestone: Learner can take a quiz, pass, and receive a certificate.**

---

## Phase 4 — Payments (Weeks 9–10)
**Goal: Paid courses work end-to-end.**

- [ ] Decide on payment processor (PayChangu vs Flutterwave — research both APIs)
- [ ] Implement payment abstraction layer (`src/lib/payments/`)
- [ ] Individual course purchase checkout flow
- [ ] Payment webhook handler → create enrollment on success
- [ ] Subscription plan checkout (Pro monthly + annual)
- [ ] Billing management page (view plan, cancel)
- [ ] Subscription status enforcement (gating subscription-only courses)
- [ ] Receipt email via Resend
- [ ] Pricing page with working CTAs

**Milestone: Individual learners can purchase courses and subscribe.**

---

## Phase 5 — AI Features (Weeks 11–13)
**Goal: AI tutor, quiz generation, and personalized learning paths live.**

- [ ] Gemini API integration (`src/lib/ai/`)
- [ ] AI Tutor: streaming chat API route + UI panel in lesson player
- [ ] Prompt caching on AI tutor system prompt
- [ ] Rate limiting on AI tutor (per user, per day)
- [ ] AI Quiz Generation: API route + creator UI button + review flow
- [ ] Personalized learning path: API route + dashboard UI
- [ ] Learning goal capture on first login
- [ ] Update recommendations after each course completion

**Milestone: Learners get an AI tutor; instructors generate quizzes with one click.**

---

## Phase 6 — B2B Company Accounts (Weeks 14–16)
**Goal: A company can buy seats and manage their team's learning.**

- [ ] Company registration + company_admin role
- [ ] Company subscription checkout (seat-based)
- [ ] Company admin dashboard: member list, invite by email
- [ ] Seat allocation + revocation
- [ ] Invitation email flow (Resend)
- [ ] Company member enrollment (seat holder gets access)
- [ ] Company analytics: per-member progress, per-course completion rates
- [ ] CSV export
- [ ] Company billing management

**Milestone: A company admin can buy 10 seats and enroll their team.**

---

## Phase 7 — Polish & Launch (Weeks 17–18)
**Goal: Production-ready.**

- [ ] SEO: metadata, Open Graph, sitemap, robots.txt
- [ ] Performance audit (Lighthouse, image optimization)
- [ ] Full mobile responsiveness pass
- [ ] Error pages (404, 500)
- [ ] Accessibility pass (keyboard nav, ARIA)
- [ ] Admin panel: user management, course approval, revenue report
- [ ] Email notifications (welcome, completion, company invite)
- [ ] Security review (RLS audit, API rate limiting, input validation)
- [ ] Load test Supabase with realistic data
- [ ] Custom domain + Vercel production deploy
- [ ] Analytics (Plausible or Vercel Analytics — privacy-friendly)

**Milestone: Public launch.**

---

## Phase 8 — Growth (Post-launch)
- Learner referral program
- Course reviews and ratings
- Discussion forum per course (Supabase Realtime)
- Live cohort sessions (Zoom/Google Meet links)
- Instructor marketplace (third-party course submissions)
- Mobile PWA
- Multi-language (English + Nyanja/Bemba for Zambian market)

---

## Tech Decisions Log

| Decision | Choice | Reason |
|---|---|---|
| Video hosting | YouTube embeds | Zero cost, no encoding pipeline needed |
| Rich text | TipTap | Headless, extensible, great DX |
| PDF generation | @react-pdf/renderer | React-native PDF without headless browser |
| Drag and drop | dnd-kit | Modern, accessible, works with Next.js |
| Email | Resend | Simple API, great free tier |
| Payment | PayChangu or Flutterwave | Zambian market support, local mobile money |
| AI model | gemini-2.5-flash | Fast, production-ready default for tutoring and generation |
