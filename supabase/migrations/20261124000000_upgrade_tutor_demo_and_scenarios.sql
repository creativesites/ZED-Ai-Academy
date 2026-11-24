-- ============================================================
-- Upgrade all existing ZAI Tutor scenarios & the seeded demo course
-- to support dynamic non-speaking interactions (Tap/Type + Teaching Board),
-- 3D WebGL avatar readiness, and a 5th Guided Concept Walkthrough lesson.
--
-- Idempotent: safe to re-run.
-- ============================================================

BEGIN;

-- 1. Ensure EVERY existing practice_scenario allows 'text' mode alongside any other mode
--    so learners are never forced to use a microphone.
UPDATE public.practice_scenarios
SET allowed_modes = array_append(allowed_modes, 'text')
WHERE NOT ('text' = ANY(allowed_modes));

-- 2. Upgrade the platform tenant's seeded demo personas, scenarios, and demo course.
DO $$
DECLARE
  v_platform text;
BEGIN
  SELECT id INTO v_platform
  FROM public.companies
  WHERE slug = 'zedai'
  LIMIT 1;

  IF v_platform IS NULL THEN
    RAISE NOTICE 'No company with slug zedai found; skipping demo course upgrade.';
    RETURN;
  END IF;

  -- Add Tinashe (5th starter persona, 3D WebGL enabled by default for general course walkthroughs)
  INSERT INTO public.ai_personas
    (id, company_id, name, display_name, languages, rive_variant, voice, personality_prompt, default_scene, is_active)
  VALUES
    ('7a1e0000-0000-4000-8000-000000000005', v_platform, 'Tinashe', 'Tinashe', ARRAY['en'],
     '{"skinColor":"#7A4A30","skinShadeColor":"#5A3320","hairColor":"#14100E","outfitPrimary":"#2F4A6B","outfitSecondary":"#F4F7FA","accentColor":"#F4F7FA","hairStyle":"short","outfitStyle":"blazer","prop":"book","faceStyle":"tinashe","engine":"three"}'::jsonb,
     '{"provider":"gemini","voiceName":"Puck"}'::jsonb,
     'You are Tinashe, an encouraging 3D AI study coach in a modern classroom. Teach step by step using the Teaching Board (show_board), check understanding with multiple-choice questions (ask_choice) and confidence checks (ask_confidence), and celebrate milestones with awards. Never require the student to use a microphone.',
     'Scene_Classroom', true)
  ON CONFLICT (id) DO UPDATE SET
    rive_variant = EXCLUDED.rive_variant,
    personality_prompt = EXCLUDED.personality_prompt,
    default_scene = EXCLUDED.default_scene,
    is_active = true;

  -- Add 5th platform starter scenario: Guided Concept Walkthrough (no mic required)
  INSERT INTO public.practice_scenarios
    (id, company_id, course_id, lesson_id, skill_pack, persona_id, title, goal, beats, target_items,
     level, exam_task, max_minutes, allowed_modes, scene, visibility, style, status)
  VALUES
    ('7a1e0000-0000-4000-8000-000000000105', v_platform,
     NULL, NULL,
     'general-tutor', '7a1e0000-0000-4000-8000-000000000005',
     'Guided Walkthrough: How AI Learns (No Mic Needed)',
     'Explore how AI models learn from examples using interactive Teaching Board steps and quick-tap checkpoints — no microphone required.',
     '[{"id":"intro","goal":"Show 3 concise bullet points on the Teaching Board explaining inputs, patterns, and feedback"},
       {"id":"check","goal":"Ask a multiple-choice checkpoint (ask_choice) testing pattern recognition vs memorization"},
       {"id":"example","goal":"Give a practical real-world example and check confidence (ask_confidence) before awarding completion"}]'::jsonb,
     '[{"text":"Training Data","meaning":"Examples an AI learns patterns from"},
       {"text":"Generalization","meaning":"Applying learned patterns to brand-new inputs"},
       {"text":"Feedback Loop","meaning":"Adjusting predictions based on errors"}]'::jsonb,
     'All levels', NULL, 6, ARRAY['text','voice']::text[], 'Scene_Classroom',
     'platform', 'guided_lesson', 'published')
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    goal = EXCLUDED.goal,
    beats = EXCLUDED.beats,
    target_items = EXCLUDED.target_items,
    allowed_modes = EXCLUDED.allowed_modes,
    scene = EXCLUDED.scene,
    style = EXCLUDED.style,
    status = 'published';

  -- Update the demo course description to reflect both language role-plays and dynamic non-speaking walkthroughs
  UPDATE public.courses
  SET description = 'Five interactive lessons powered by ZAI AI Teachers (2D Rive & 3D WebGL). Practise Mandarin, Spanish, French, and clinical English out loud — or experience a no-mic Guided Concept Walkthrough with live Teaching Board checkpoints and flashcards.'
  WHERE id = '7a1e0000-0000-4000-8000-000000000201';

  -- Add Lesson 5 to the demo course if the module exists
  IF EXISTS (SELECT 1 FROM public.modules WHERE id = '7a1e0000-0000-4000-8000-000000000301') THEN
    INSERT INTO public.lessons (id, module_id, title, position, is_preview)
    VALUES
      ('7a1e0000-0000-4000-8000-000000000405', '7a1e0000-0000-4000-8000-000000000301', 'Interactive Walkthrough: How AI Learns (No Mic Needed)', 5, true)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.content_blocks (id, lesson_id, type, position, content)
    VALUES
      ('7a1e0000-0000-4000-8000-000000000513', '7a1e0000-0000-4000-8000-000000000405', 'text', 1,
       '{"html":"<p>Not every lesson needs a microphone. In this guided walkthrough, <strong>Tinashe</strong> teaches on the interactive Teaching Board using step-by-step bullets, multiple-choice checkpoints, and one-tap actions like <em>Next step</em>, <em>Explain simpler</em>, and <em>Quiz me</em>.</p>"}'::jsonb),
      ('7a1e0000-0000-4000-8000-000000000514', '7a1e0000-0000-4000-8000-000000000405', 'tutor_session', 2,
       '{"scenarioId":"7a1e0000-0000-4000-8000-000000000105","style":"guided_lesson","required":false,"title":"Guided Walkthrough with Tinashe (3D AI Teacher)","intro":"Use the quick-tap chips or Teaching Board choices — no microphone required."}'::jsonb)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

COMMIT;
