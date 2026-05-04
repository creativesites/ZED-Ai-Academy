-- Migration: Category B & C platform features
-- reviews · notifications · discussions · coupons · referrals

-- ─── Reviews / Ratings ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text    NOT NULL,
  course_id   uuid    NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  rating      int     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id)
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reviews"
  ON public.reviews FOR SELECT USING (true);

CREATE POLICY "Enrolled users can write reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'sub') = user_id
    AND EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE user_id = (auth.jwt() ->> 'sub')
        AND course_id = reviews.course_id
    )
  );

CREATE POLICY "Users can update own review"
  ON public.reviews FOR UPDATE
  USING ((auth.jwt() ->> 'sub') = user_id);

CREATE POLICY "Users can delete own review"
  ON public.reviews FOR DELETE
  USING ((auth.jwt() ->> 'sub') = user_id);

-- ─── In-App Notifications ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text    NOT NULL,
  type        text    NOT NULL DEFAULT 'system',
  title       text    NOT NULL,
  body        text,
  read        boolean NOT NULL DEFAULT false,
  data        jsonb   NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications(user_id, read)
  WHERE read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  USING ((auth.jwt() ->> 'sub') = user_id);

CREATE POLICY "Users can mark own notifications read"
  ON public.notifications FOR UPDATE
  USING ((auth.jwt() ->> 'sub') = user_id);

CREATE POLICY "Service can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- ─── Discussions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.discussions (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid    NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id   uuid    REFERENCES public.lessons(id) ON DELETE CASCADE,
  user_id     text    NOT NULL,
  parent_id   uuid    REFERENCES public.discussions(id) ON DELETE CASCADE,
  content     text    NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discussions_lesson_idx ON public.discussions(lesson_id);
CREATE INDEX IF NOT EXISTS discussions_course_idx ON public.discussions(course_id);

ALTER TABLE public.discussions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enrolled users can read discussions"
  ON public.discussions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE user_id = (auth.jwt() ->> 'sub')
        AND course_id = discussions.course_id
    )
    OR EXISTS (
      SELECT 1 FROM public.courses
      WHERE id = discussions.course_id
        AND instructor_id = (auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "Enrolled users can post discussions"
  ON public.discussions FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'sub') = user_id
    AND (
      EXISTS (
        SELECT 1 FROM public.enrollments
        WHERE user_id = (auth.jwt() ->> 'sub')
          AND course_id = discussions.course_id
      )
      OR EXISTS (
        SELECT 1 FROM public.courses
        WHERE id = discussions.course_id
          AND instructor_id = (auth.jwt() ->> 'sub')
      )
    )
  );

CREATE POLICY "Users can update own posts"
  ON public.discussions FOR UPDATE
  USING ((auth.jwt() ->> 'sub') = user_id);

CREATE POLICY "Users can delete own posts"
  ON public.discussions FOR DELETE
  USING (
    (auth.jwt() ->> 'sub') = user_id
    OR EXISTS (
      SELECT 1 FROM public.courses
      WHERE id = discussions.course_id
        AND instructor_id = (auth.jwt() ->> 'sub')
    )
  );

-- ─── Coupons ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coupons (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text    UNIQUE NOT NULL,
  discount_type   text    NOT NULL DEFAULT 'percent'
                    CHECK (discount_type IN ('percent', 'fixed')),
  discount_value  numeric NOT NULL CHECK (discount_value > 0),
  max_uses        int,
  uses_count      int     NOT NULL DEFAULT 0,
  course_id       uuid    REFERENCES public.courses(id) ON DELETE SET NULL,
  expires_at      timestamptz,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active coupons"
  ON public.coupons FOR SELECT USING (active = true);

-- ─── Referrals ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referrals (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id     text    NOT NULL,
  referred_id     text,
  referral_code   text    UNIQUE NOT NULL,
  course_id       uuid    REFERENCES public.courses(id) ON DELETE SET NULL,
  status          text    NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'converted')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals"
  ON public.referrals FOR SELECT
  USING (
    (auth.jwt() ->> 'sub') = referrer_id
    OR (auth.jwt() ->> 'sub') = referred_id
  );

CREATE POLICY "Users can create referrals"
  ON public.referrals FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'sub') = referrer_id);
