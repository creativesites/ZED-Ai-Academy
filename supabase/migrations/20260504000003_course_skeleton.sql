-- ============================================================
-- Full Course Skeleton — AI Photography: Shoot to Gallery in Half the Time
-- ============================================================
-- Clears all existing modules for this course and rebuilds
-- the complete 11-module, 67-lesson skeleton.
-- Run content migrations (20260504000004 onwards) after this.
-- ============================================================
-- STRUCTURE OVERVIEW:
--   Module 1  — Foundation (5 lessons + quiz)
--   Module 2  — Background Removal (6 lessons + meeting + quiz)
--   Module 3  — Smart Culling (5 lessons + quiz)
--   Module 4  — Enhancement (6 lessons + quiz)
--   Module 5  — Portrait Retouching (6 lessons + quiz)
--   Module 6  — Colour Grading (6 lessons + meeting + quiz)
--   Module 7  — Generative AI (6 lessons + quiz)
--   Module 8  — Mid-Course Project (2 lessons: brief + meeting review)
--   Module 9  — Advanced Tools (5 lessons + quiz)
--   Module 10 — Business with AI (6 lessons + meeting + quiz)
--   Module 11 — Final Exam (2 lessons: review + exam)
--
--   ZOOM MEETINGS (4 total):
--   Session 1 — Module 2 Lesson 7: AI Tool Setup Workshop
--   Session 2 — Module 6 Lesson 7: Colour Grading Workshop
--   Session 3 — Module 8 Lesson 2: Project Review & Q&A
--   Session 4 — Module 10 Lesson 7: Business Strategy Clinic
-- ============================================================

DO $$
DECLARE
  v_course_id uuid;
  v_mod uuid;
BEGIN

  -- Find or create the course
  SELECT id INTO v_course_id FROM courses WHERE slug = 'ai-photography-practical-course' LIMIT 1;

  IF v_course_id IS NULL THEN
    INSERT INTO courses (
      instructor_id, title, slug, description, category, level,
      price_type, price_amount, status, is_featured
    ) VALUES (
      'user_3D8zG2D3z98MlEtAJ3Of9zhLn3s',
      'AI Photography: Shoot to Gallery in Half the Time',
      'ai-photography-practical-course',
      'A hands-on course for photographers who want to use AI tools to cut editing time, remove backgrounds instantly, cull faster, enhance quality, and deliver polished galleries to clients — without losing their creative signature. Includes a practical mid-course project, 8 module checkpoint quizzes, 4 live Zoom sessions, and a final certification exam.',
      'Photography', 'beginner', 'one_time', 400, 'draft', true
    ) RETURNING id INTO v_course_id;
  ELSE
    -- Wipe existing modules (cascades to lessons, content_blocks, quizzes)
    DELETE FROM modules WHERE course_id = v_course_id;
  END IF;

  -- ─────────────────────────────────────────────────────────
  -- MODULE 1: Foundation
  -- ─────────────────────────────────────────────────────────
  INSERT INTO modules (course_id, title, position)
    VALUES (v_course_id, 'What AI Photography Actually Is — The Foundation', 1)
    RETURNING id INTO v_mod;

  INSERT INTO lessons (module_id, title, position, is_preview) VALUES
    (v_mod, 'What AI photography tools are (and what they are not)', 1, true),
    (v_mod, 'The 5-stage AI-assisted photography workflow', 2, false),
    (v_mod, 'Free vs paid: building your AI photography toolkit', 3, false),
    (v_mod, 'Your first AI experiment: one photo through three tools', 4, false),
    (v_mod, 'Expert deep dive: how neural networks learn to see images', 5, false),
    (v_mod, 'Module 1 Checkpoint Quiz', 6, false);

  -- ─────────────────────────────────────────────────────────
  -- MODULE 2: Background Removal
  -- ─────────────────────────────────────────────────────────
  INSERT INTO modules (course_id, title, position)
    VALUES (v_course_id, 'AI Background Removal — From One-Click to Batch Mastery', 2)
    RETURNING id INTO v_mod;

  INSERT INTO lessons (module_id, title, position, is_preview) VALUES
    (v_mod, 'How semantic segmentation works', 1, true),
    (v_mod, 'Remove.bg: web tool, desktop app, and API walkthrough', 2, false),
    (v_mod, 'Photoshop AI selection: Subject, Sky, and the Masking Panel', 3, false),
    (v_mod, 'Canva background remover for quick social media edits', 4, false),
    (v_mod, 'Batch removal: 50 images in under 10 minutes', 5, false),
    (v_mod, 'Difficult cuts: hair, glass, and transparent fabrics', 6, false),
    (v_mod, 'Live Session 1: AI Tool Setup and Background Removal Workshop', 7, false),
    (v_mod, 'Module 2 Checkpoint Quiz', 8, false);

  -- ─────────────────────────────────────────────────────────
  -- MODULE 3: Smart Culling
  -- ─────────────────────────────────────────────────────────
  INSERT INTO modules (course_id, title, position)
    VALUES (v_course_id, 'Smart Culling — Select the Best Shots Fast', 3)
    RETURNING id INTO v_mod;

  INSERT INTO lessons (module_id, title, position, is_preview) VALUES
    (v_mod, 'The economics of culling: what your time is actually worth', 1, false),
    (v_mod, 'AfterShoot: setup, settings, and your first automated cull', 2, false),
    (v_mod, 'Lightroom AI ratings and smart preview generation', 3, false),
    (v_mod, 'Building culling criteria presets by shoot type', 4, false),
    (v_mod, 'Advanced: integrating AI culling into same-day delivery', 5, false),
    (v_mod, 'Module 3 Checkpoint Quiz', 6, false);

  -- ─────────────────────────────────────────────────────────
  -- MODULE 4: Enhancement
  -- ─────────────────────────────────────────────────────────
  INSERT INTO modules (course_id, title, position)
    VALUES (v_course_id, 'AI Enhancement — Noise, Sharpness, and Quality Recovery', 4)
    RETURNING id INTO v_mod;

  INSERT INTO lessons (module_id, title, position, is_preview) VALUES
    (v_mod, 'Digital noise explained: why high ISO looks the way it does', 1, false),
    (v_mod, 'Topaz Photo AI: the complete walkthrough', 2, false),
    (v_mod, 'Lightroom AI Denoise vs Topaz Photo AI: when to use each', 3, false),
    (v_mod, 'Recovering motion blur and missed focus with AI', 4, false),
    (v_mod, 'AI upscaling for print: Topaz Gigapixel deep dive', 5, false),
    (v_mod, 'Batch enhancement: building an automated overnight pipeline', 6, false),
    (v_mod, 'Module 4 Checkpoint Quiz', 7, false);

  -- ─────────────────────────────────────────────────────────
  -- MODULE 5: Portrait Retouching
  -- ─────────────────────────────────────────────────────────
  INSERT INTO modules (course_id, title, position)
    VALUES (v_course_id, 'AI Portrait Retouching — Natural Results at Speed', 5)
    RETURNING id INTO v_mod;

  INSERT INTO lessons (module_id, title, position, is_preview) VALUES
    (v_mod, 'Natural vs over-retouched: reading the client expectation spectrum', 1, false),
    (v_mod, 'Luminar Neo Portrait AI: skin, eyes, body, and relighting', 2, false),
    (v_mod, 'Lightroom AI masking for portrait-specific adjustments', 3, false),
    (v_mod, 'Frequency separation: what AI retouching does at the pixel level', 4, false),
    (v_mod, 'The ethics of face and body reshaping tools', 5, false),
    (v_mod, 'Creating reusable portrait retouching profiles', 6, false),
    (v_mod, 'Module 5 Checkpoint Quiz', 7, false);

  -- ─────────────────────────────────────────────────────────
  -- MODULE 6: Colour Grading
  -- ─────────────────────────────────────────────────────────
  INSERT INTO modules (course_id, title, position)
    VALUES (v_course_id, 'AI Colour Grading at Scale — Your Signature Look, Consistently', 6)
    RETURNING id INTO v_mod;

  INSERT INTO lessons (module_id, title, position, is_preview) VALUES
    (v_mod, 'Colour theory essentials every photographer must understand', 1, false),
    (v_mod, 'Lightroom AI colour grading: auto-grade, adaptive presets, and sync', 2, false),
    (v_mod, 'Building your signature look: preset creation walkthrough', 3, false),
    (v_mod, 'Mixed lighting: making tungsten and daylight look intentional', 4, false),
    (v_mod, 'Advanced: how AI colour models work — a colour science deep dive', 5, false),
    (v_mod, 'Colour accuracy for screen vs print delivery', 6, false),
    (v_mod, 'Live Session 2: Colour Grading Workshop', 7, false),
    (v_mod, 'Module 6 Checkpoint Quiz', 8, false);

  -- ─────────────────────────────────────────────────────────
  -- MODULE 7: Generative AI
  -- ─────────────────────────────────────────────────────────
  INSERT INTO modules (course_id, title, position)
    VALUES (v_course_id, 'Generative AI and Creative Editing', 7)
    RETURNING id INTO v_mod;

  INSERT INTO lessons (module_id, title, position, is_preview) VALUES
    (v_mod, 'What generative AI can and cannot do in 2025', 1, false),
    (v_mod, 'Adobe Firefly: generative fill, object removal, and canvas extension', 2, false),
    (v_mod, 'Luminar Neo Sky AI: realistic replacements and known limitations', 3, false),
    (v_mod, 'Midjourney for photographers: concept boards and client briefs', 4, false),
    (v_mod, 'Text-to-image prompting masterclass for photographers', 5, false),
    (v_mod, 'Disclosure and ethics: when and how to tell clients you used AI', 6, false),
    (v_mod, 'Module 7 Checkpoint Quiz', 7, false);

  -- ─────────────────────────────────────────────────────────
  -- MODULE 8: Mid-Course Project
  -- ─────────────────────────────────────────────────────────
  INSERT INTO modules (course_id, title, position)
    VALUES (v_course_id, 'Mid-Course Project — Process a Complete Real-World Shoot', 8)
    RETURNING id INTO v_mod;

  INSERT INTO lessons (module_id, title, position, is_preview) VALUES
    (v_mod, '[PROJECT] Your Brief: Five Tasks, One Real Shoot', 1, false),
    (v_mod, 'Live Session 3: Project Review and Q&A', 2, false);

  -- ─────────────────────────────────────────────────────────
  -- MODULE 9: Advanced Tools
  -- ─────────────────────────────────────────────────────────
  INSERT INTO modules (course_id, title, position)
    VALUES (v_course_id, 'Advanced Tools — Animation, Relighting, and Print', 9)
    RETURNING id INTO v_mod;

  INSERT INTO lessons (module_id, title, position, is_preview) VALUES
    (v_mod, 'AI video from stills: Kling AI and Runway ML', 1, false),
    (v_mod, 'Portrait relighting after the shoot', 2, false),
    (v_mod, 'HDR merging and exposure blending with AI', 3, false),
    (v_mod, 'AI for aerial and drone photography enhancement', 4, false),
    (v_mod, 'Print optimisation: colour profiles, paper types, and AI sharpening', 5, false),
    (v_mod, 'Module 9 Checkpoint Quiz', 6, false);

  -- ─────────────────────────────────────────────────────────
  -- MODULE 10: Business with AI
  -- ─────────────────────────────────────────────────────────
  INSERT INTO modules (course_id, title, position)
    VALUES (v_course_id, 'Photography Business with AI — Grow Income, Not Hours', 10)
    RETURNING id INTO v_mod;

  INSERT INTO lessons (module_id, title, position, is_preview) VALUES
    (v_mod, 'Pricing AI-assisted services: the value equation', 1, false),
    (v_mod, 'AI for client communication: proposals, quotes, and follow-ups', 2, false),
    (v_mod, 'Social media content machine: 30 posts from one shoot', 3, false),
    (v_mod, 'Building and maintaining your portfolio with AI tools', 4, false),
    (v_mod, 'Studio operations: AI for scheduling, contracts, and CRM', 5, false),
    (v_mod, 'The AI photography income model: a Zambia case study', 6, false),
    (v_mod, 'Live Session 4: Business Strategy Clinic', 7, false),
    (v_mod, 'Module 10 Checkpoint Quiz', 8, false);

  -- ─────────────────────────────────────────────────────────
  -- MODULE 11: Final Exam
  -- ─────────────────────────────────────────────────────────
  INSERT INTO modules (course_id, title, position)
    VALUES (v_course_id, 'Final Exam and Certification', 11)
    RETURNING id INTO v_mod;

  INSERT INTO lessons (module_id, title, position, is_preview) VALUES
    (v_mod, 'Course review: your complete AI photography workflow', 1, false),
    (v_mod, '[FINAL EXAM] AI Photography Mastery Certification Exam', 2, false);

  RAISE NOTICE '✓ Skeleton built: 11 modules, 67 lessons. Course ID: %', v_course_id;
  RAISE NOTICE '  Next: run content migrations 20260504000004 through 20260504000014.';

END $$;
