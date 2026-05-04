# Features — Zed AI Academy

## 1. Marketing & Discovery

### Public Course Catalog
- Browse all published courses (grid with filters: category, level, price)
- Course detail page: description, instructor info, curriculum preview, reviews, pricing
- Search (title + description full-text via Supabase)
- Categories: Prompt Engineering, AI Tools, Machine Learning, AI for Business, etc.

### Pricing Page
- Individual plans: Free tier, Pro monthly, Pro annual
- Company plans: Starter (up to 10 seats), Growth (up to 50), Enterprise (custom)
- Clear feature comparison table

---

## 2. Authentication

- Email/password registration and login
- Email verification (Supabase Auth)
- Password reset via email
- Google OAuth (optional, Phase 2)
- Roles: `learner`, `instructor`, `company_admin`, `super_admin`

---

## 3. Course Builder (Instructor / Creator)

### Dashboard
- List of my courses (draft/published/archived)
- Revenue summary, total enrollments, average completion rate
- Quick-create new course button

### Course Settings
- Title, slug, description, category, difficulty level
- Thumbnail upload (Supabase Storage)
- Pricing: free / one-time price / subscription-only
- Publishing: draft → published

### Curriculum Builder
- Drag-and-drop module reordering
- Add/remove/reorder lessons within modules
- Lesson types: standard, quiz-only

### Lesson Editor (block-based)
Add content blocks in any order:

| Block Type | Input | Notes |
|---|---|---|
| Video | YouTube URL | Auto-extract video ID, embed player |
| Text | Rich text editor (TipTap) | Bold, headings, lists, code, links |
| Quiz | Quiz builder UI | See Quizzes section |
| Resource | File upload | PDF, ZIP — stored in Supabase Storage |

- Preview lesson as a student
- AI button: "Generate quiz from this lesson" (calls Claude)
- AI button: "Suggest improvements to this text"

---

## 4. Course Player (Learner)

- Sidebar with full course curriculum (modules + lessons, progress indicators)
- Content area renders blocks in order (video embed, rich text, quiz, download links)
- Mark lesson complete button (records progress)
- Progress bar per module and overall course
- Bookmarks: star any lesson to revisit
- Notes: per-lesson text notes (stored in DB)
- Next/previous lesson navigation
- AI Tutor chat panel (slide-in, course-scoped)
- Certificate unlock when 100% complete

---

## 5. Quizzes & Assessments

- Multiple choice questions (single or multiple correct answers)
- Each question has: prompt, 2–6 options, correct answer(s), explanation
- Learner submits quiz → see score + explanations immediately
- Results stored: `quiz_attempts` (score, answers, timestamp)
- Pass threshold configurable per quiz (default 70%)
- Retake allowed (configurable: unlimited or N attempts)
- Creator can view aggregate stats (% of learners passing, per-question difficulty)

### AI Quiz Generation
- Creator clicks "Generate Quiz" on a lesson
- Claude reads the lesson text blocks and returns 5–10 question suggestions
- Creator reviews, edits, removes questions, then saves
- Reduces quiz creation time significantly

---

## 6. Certificates

- Auto-generated PDF when learner reaches 100% course completion
- Certificate includes: learner name, course name, completion date, unique ID
- Stored in Supabase Storage, accessible from learner dashboard
- Shareable public URL (verified via unique certificate ID)
- LinkedIn share button

---

## 7. AI Tutor

- Floating chat panel on the course player page
- Claude-powered, context includes current lesson content
- Can answer questions about the course material
- Suggests relevant lessons when asked
- Streaming responses (no waiting for full reply)
- Conversation resets per session (not persisted — privacy by default)
- Rate limited per user to manage API costs

---

## 8. Personalized Learning Paths

- Learner states their goal on first login ("I want to learn prompt engineering for marketing")
- AI analyzes their completed courses and stated goal
- Recommends an ordered sequence of courses to take next
- Updated after each course completion
- Displayed as a visual path on the dashboard

---

## 9. Learner Dashboard

- Enrolled courses with progress bars
- Recommended learning path (AI-powered)
- Recently accessed lessons (quick resume)
- Certificates earned
- Bookmarked lessons
- Account settings (name, avatar, password, billing)

---

## 10. Payments — Individual (B2C)

### One-time Purchase
- Buy a single course
- Checkout via local Zambian processor (MTN MoMo, Airtel Money, Visa/Mastercard)
- On success: enrollment created automatically (via webhook)
- Receipt emailed to learner

### Subscription Plans
- Pro plan unlocks all courses
- Monthly and annual billing
- Cancel anytime (access until end of billing period)
- Subscription status synced via webhooks

---

## 11. Company Accounts (B2B)

### Company Admin Panel
- Invite members by email
- View all members + their enrollment status and progress
- Allocate and revoke seats
- Bulk-enroll members into specific courses
- Purchase additional seats

### Company Subscription
- Seat-based: pay per active seat per month/year
- Seat is "active" when assigned to a member
- Company admin can reassign seats (e.g., employee leaves)

### Analytics Dashboard (Company)
- Per-member: courses enrolled, % completion, time spent, quiz scores
- Per-course: how many members enrolled, average completion rate
- Export to CSV

---

## 12. Admin Panel (Super Admin)

- User management (view, ban, change role)
- Course management (approve/unpublish courses)
- Revenue reports
- Company account management
- Platform analytics (total users, MRR, churn, popular courses)

---

## 13. Notifications & Email

- Welcome email on registration
- Purchase confirmation
- Course completion + certificate
- New course announcement (subscribers opt-in)
- Company: invitation email for new members
- All email via Resend

---

## Future / Phase 3+

- Live cohort classes (scheduled sessions with video call links)
- Discussion forums per course
- Instructor marketplace (third-party instructors submit courses)
- Mobile app (React Native or PWA)
- Offline download for mobile
- Multi-language support (English + local languages)
