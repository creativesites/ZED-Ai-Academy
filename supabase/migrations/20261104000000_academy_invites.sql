-- =============================================================================
-- Academy invite links (/i/{code}).
--
-- An academy shares a short secret link. A student opens it, signs up (or signs
-- in) and is added to the academy, enrolled in the invite's courses for free and
-- placed in its classroom group. No payment: academies bring their own students.
--
--  * academy_invites: one row per link (label, role, courses, group, limits).
--    Every academy gets a default "General" learner link, created lazily by the
--    server the first time it is needed (is_default = true, one per academy).
--  * academy_invite_redemptions: who used which link. Makes accepting a link
--    idempotent: a person counts once against max_uses, however often they tap.
--  * redeem_academy_invite(): counts one use atomically (conditional UPDATE that
--    respects revoked_at, expires_at and max_uses) and records the redemption.
--  * enrollments.source gains 'academy_invite'.
--
-- Server-only: RLS is enabled with no policies and anon / authenticated have no
-- privileges, so only the service role (server actions) reads or writes.
--
-- Idempotent: IF NOT EXISTS / DROP ... IF EXISTS / CREATE OR REPLACE throughout.
-- NOT APPLIED to any database. Review, then apply with the Supabase CLI.
-- =============================================================================

BEGIN;

-- 1. Invite links. courses.id and classroom_groups.id are uuid; companies.id and
--    profile ids are text (Clerk ids).
CREATE TABLE IF NOT EXISTS public.academy_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code        text NOT NULL UNIQUE,
  label       text NOT NULL DEFAULT 'General',
  role        text NOT NULL DEFAULT 'learner',
  course_ids  uuid[] NOT NULL DEFAULT '{}',
  group_id    uuid NULL REFERENCES public.classroom_groups(id) ON DELETE SET NULL,
  max_uses    int NULL,
  uses        int NOT NULL DEFAULT 0,
  expires_at  timestamptz NULL,
  revoked_at  timestamptz NULL,
  is_default  boolean NOT NULL DEFAULT false,
  created_by  text NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.academy_invites DROP CONSTRAINT IF EXISTS academy_invites_role_check;
ALTER TABLE public.academy_invites ADD CONSTRAINT academy_invites_role_check
  CHECK (role IN ('learner', 'teacher'));

-- 8 characters from 23456789ABCDEFGHJKMNPQRSTUVWXYZ (no 0/O, 1/I/L).
ALTER TABLE public.academy_invites DROP CONSTRAINT IF EXISTS academy_invites_code_check;
ALTER TABLE public.academy_invites ADD CONSTRAINT academy_invites_code_check
  CHECK (code ~ '^[2-9A-HJKMNP-Z]{8}$');

ALTER TABLE public.academy_invites DROP CONSTRAINT IF EXISTS academy_invites_uses_check;
ALTER TABLE public.academy_invites ADD CONSTRAINT academy_invites_uses_check
  CHECK (uses >= 0 AND (max_uses IS NULL OR max_uses > 0));

CREATE INDEX IF NOT EXISTS academy_invites_company_id_idx ON public.academy_invites (company_id);
CREATE INDEX IF NOT EXISTS academy_invites_code_idx ON public.academy_invites (code);
-- One default "General" link per academy (lazy creation races resolve on this).
CREATE UNIQUE INDEX IF NOT EXISTS academy_invites_one_default_per_company
  ON public.academy_invites (company_id)
  WHERE is_default;

-- 2. Redemptions: one row per (invite, person).
CREATE TABLE IF NOT EXISTS public.academy_invite_redemptions (
  invite_id   uuid NOT NULL REFERENCES public.academy_invites(id) ON DELETE CASCADE,
  -- Clerk user id. No FK to profiles: a brand-new learner can redeem before the
  -- profile row exists (acceptInvite counts the use first, then creates the membership).
  user_id     text NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (invite_id, user_id)
);
CREATE INDEX IF NOT EXISTS academy_invite_redemptions_user_idx
  ON public.academy_invite_redemptions (user_id);

-- 3. Server-only access.
ALTER TABLE public.academy_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_invite_redemptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.academy_invites FROM anon, authenticated;
REVOKE ALL ON public.academy_invite_redemptions FROM anon, authenticated;

-- 4. Count one use atomically. Returns:
--      'redeemed'         this call counted a new use
--      'already_redeemed' this person already used this link (no new use)
--      'unavailable'      revoked, expired or used up (nothing changed)
--    The UPDATE takes the row lock, so concurrent redemptions never exceed
--    max_uses. If the same person races themselves, the loser's increment is
--    undone when its redemption insert finds the existing row.
CREATE OR REPLACE FUNCTION public.redeem_academy_invite(p_invite_id uuid, p_user_id text)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_inserted int;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.academy_invite_redemptions
    WHERE invite_id = p_invite_id AND user_id = p_user_id
  ) THEN
    RETURN 'already_redeemed';
  END IF;

  UPDATE public.academy_invites
     SET uses = uses + 1
   WHERE id = p_invite_id
     AND revoked_at IS NULL
     AND (expires_at IS NULL OR expires_at > now())
     AND (max_uses IS NULL OR uses < max_uses);
  IF NOT FOUND THEN
    RETURN 'unavailable';
  END IF;

  INSERT INTO public.academy_invite_redemptions (invite_id, user_id)
  VALUES (p_invite_id, p_user_id)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    UPDATE public.academy_invites SET uses = uses - 1 WHERE id = p_invite_id;
    RETURN 'already_redeemed';
  END IF;

  RETURN 'redeemed';
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_academy_invite(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_academy_invite(uuid, text) TO service_role;

-- 5. Enrollment source for invite enrollments (free, active, no order).
ALTER TABLE public.enrollments DROP CONSTRAINT IF EXISTS enrollments_source_check;
ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_source_check
  CHECK (source IN ('individual_purchase', 'subscription', 'company_seat', 'gift', 'manual_admin', 'academy_invite'));

COMMIT;
