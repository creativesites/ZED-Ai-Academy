-- ============================================================
-- Zed AI Academy — Initial Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     text,
  avatar_url    text,
  role          text NOT NULL DEFAULT 'learner'
                CHECK (role IN ('learner', 'instructor', 'company_admin', 'super_admin')),
  company_id    uuid,
  bio           text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- COMPANIES
-- ============================================================
CREATE TABLE public.companies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  logo_url    text,
  admin_id    uuid REFERENCES public.profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.companies(id);

CREATE TABLE public.company_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'invited'
              CHECK (status IN ('invited', 'active', 'deactivated')),
  invited_at  timestamptz NOT NULL DEFAULT now(),
  joined_at   timestamptz,
  UNIQUE(company_id, profile_id)
);

-- ============================================================
-- COURSES
-- ============================================================
CREATE TABLE public.courses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,
  title           text NOT NULL,
  description     text,
  thumbnail_url   text,
  category        text,
  level           text CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  instructor_id   uuid REFERENCES public.profiles(id),
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'published', 'archived')),
  price_type      text NOT NULL DEFAULT 'free'
                  CHECK (price_type IN ('free', 'one_time', 'subscription_only', 'both')),
  price_amount    numeric(10, 2),
  is_featured     boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.modules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title       text NOT NULL,
  position    int NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lessons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id   uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  title       text NOT NULL,
  position    int NOT NULL,
  is_preview  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.content_blocks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id   uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('video', 'text', 'quiz', 'resource')),
  position    int NOT NULL,
  content     jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- QUIZZES
-- ============================================================
CREATE TABLE public.quizzes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id       uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  title           text,
  pass_threshold  int NOT NULL DEFAULT 70,
  max_attempts    int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.quiz_questions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id         uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question        text NOT NULL,
  options         jsonb NOT NULL,
  correct_indices int[] NOT NULL,
  explanation     text,
  position        int NOT NULL
);

CREATE TABLE public.quiz_attempts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id     uuid NOT NULL REFERENCES public.quizzes(id),
  user_id     uuid NOT NULL REFERENCES public.profiles(id),
  answers     jsonb NOT NULL,
  score       int NOT NULL,
  passed      boolean NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- LEARNING PROGRESS
-- ============================================================
CREATE TABLE public.enrollments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id),
  course_id     uuid NOT NULL REFERENCES public.courses(id),
  enrolled_at   timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  source        text NOT NULL
                CHECK (source IN ('individual_purchase', 'subscription', 'company_seat', 'gift')),
  order_id      uuid,
  UNIQUE(user_id, course_id)
);

CREATE TABLE public.lesson_progress (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id),
  lesson_id     uuid NOT NULL REFERENCES public.lessons(id),
  completed     boolean NOT NULL DEFAULT false,
  completed_at  timestamptz,
  UNIQUE(user_id, lesson_id)
);

CREATE TABLE public.bookmarks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id),
  lesson_id   uuid NOT NULL REFERENCES public.lessons(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

CREATE TABLE public.notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id),
  lesson_id   uuid NOT NULL REFERENCES public.lessons(id),
  content     text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

CREATE TABLE public.certificates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id),
  course_id   uuid NOT NULL REFERENCES public.courses(id),
  issued_at   timestamptz NOT NULL DEFAULT now(),
  file_url    text,
  public_id   text UNIQUE NOT NULL,
  UNIQUE(user_id, course_id)
);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE public.orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.profiles(id),
  course_id           uuid REFERENCES public.courses(id),
  company_id          uuid REFERENCES public.companies(id),
  amount              numeric(10, 2) NOT NULL,
  currency            text NOT NULL DEFAULT 'ZMW',
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  payment_reference   text,
  payment_method      text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  paid_at             timestamptz
);

CREATE TABLE public.subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid REFERENCES public.profiles(id),
  company_id            uuid REFERENCES public.companies(id),
  plan                  text NOT NULL,
  status                text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
  seat_count            int NOT NULL DEFAULT 1,
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  processor_sub_id      text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX ON public.courses(status, category);
CREATE INDEX ON public.courses(instructor_id);
CREATE INDEX ON public.modules(course_id, position);
CREATE INDEX ON public.lessons(module_id, position);
CREATE INDEX ON public.content_blocks(lesson_id, position);
CREATE INDEX ON public.enrollments(user_id);
CREATE INDEX ON public.enrollments(course_id);
CREATE INDEX ON public.lesson_progress(user_id, lesson_id);
CREATE INDEX ON public.quiz_attempts(user_id, quiz_id);
CREATE INDEX ON public.orders(user_id);
CREATE INDEX ON public.company_members(company_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Profiles are publicly readable for instructors" ON public.profiles FOR SELECT USING (role = 'instructor');

-- Courses (public can see published)
CREATE POLICY "Anyone can view published courses" ON public.courses FOR SELECT USING (status = 'published');
CREATE POLICY "Instructors can manage own courses" ON public.courses FOR ALL USING (instructor_id = auth.uid());

-- Modules & Lessons (readable if enrolled or course is published)
CREATE POLICY "Anyone can view modules of published courses" ON public.modules FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND status = 'published'));
CREATE POLICY "Instructors can manage own modules" ON public.modules FOR ALL
  USING (EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND instructor_id = auth.uid()));

CREATE POLICY "Anyone can view lessons of published courses" ON public.lessons FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.modules m
    JOIN public.courses c ON c.id = m.course_id
    WHERE m.id = module_id AND c.status = 'published'
  ));
CREATE POLICY "Instructors can manage own lessons" ON public.lessons FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.modules m
    JOIN public.courses c ON c.id = m.course_id
    WHERE m.id = module_id AND c.instructor_id = auth.uid()
  ));

-- Content blocks
CREATE POLICY "Enrolled users and instructors can view content" ON public.content_blocks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
    JOIN public.courses c ON c.id = m.course_id
    WHERE l.id = lesson_id AND (
      c.instructor_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = c.id AND e.user_id = auth.uid())
      OR l.is_preview = true
    )
  ));
CREATE POLICY "Instructors can manage own content blocks" ON public.content_blocks FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
    JOIN public.courses c ON c.id = m.course_id
    WHERE l.id = lesson_id AND c.instructor_id = auth.uid()
  ));

-- Enrollments
CREATE POLICY "Users can view own enrollments" ON public.enrollments FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Instructors can view their course enrollments" ON public.enrollments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND instructor_id = auth.uid()));

-- Progress
CREATE POLICY "Users can manage own progress" ON public.lesson_progress FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users can manage own bookmarks" ON public.bookmarks FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users can manage own notes" ON public.notes FOR ALL USING (user_id = auth.uid());

-- Quiz attempts
CREATE POLICY "Users can manage own quiz attempts" ON public.quiz_attempts FOR ALL USING (user_id = auth.uid());

-- Certificates
CREATE POLICY "Users can view own certificates" ON public.certificates FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Certificates are publicly viewable by public_id" ON public.certificates FOR SELECT USING (true);

-- Orders
CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT USING (user_id = auth.uid());

-- Subscriptions
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions FOR SELECT USING (user_id = auth.uid());

-- ============================================================
-- UPDATED_AT trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_courses_updated_at BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
