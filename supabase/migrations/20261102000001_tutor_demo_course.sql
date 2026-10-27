-- ============================================================
-- ZAI Tutor Showcase: a free, published demo course with one tutor_session per lesson.
--
-- Inserts only, in the platform tenant (companies.slug = 'zedai'):
--   4 ai_personas        Lín Lǎoshī (zh), Sofía (es), Camille (fr), Nurse Tendai (en)
--   4 practice_scenarios visibility = 'platform', status = 'published'
--   1 course (free, published), 1 module, 4 lessons
--   12 content_blocks    per lesson: text intro, glossary of target phrases, tutor_session
--
-- Every row has a fixed UUID and is inserted with ON CONFLICT DO NOTHING, so re-running this file
-- does not duplicate anything. Rive looks are copied from design/rive/presets.json (faceStyle included).
--
-- Requires: 20261101000000_zai_tutor.sql and 20261102000000_tutor_session_block.sql.
-- If no company has slug 'zedai' yet, the file does nothing except a NOTICE.
-- NOT APPLIED. This file is written for review only. See supabase/seed/README_TUTOR_DEMO.md.
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_platform  text;
  v_admin     text;
BEGIN
  SELECT id, admin_id INTO v_platform, v_admin
  FROM public.companies
  WHERE slug = 'zedai'
  LIMIT 1;

  IF v_platform IS NULL THEN
    RAISE NOTICE 'No company with slug zedai: the ZAI Tutor demo course was not seeded.';
    RETURN;
  END IF;

  -- ----------------------------------------------------------
  -- Personas (rive_variant = presets in design/rive/presets.json, without the display name)
  -- ----------------------------------------------------------
  INSERT INTO public.ai_personas
    (id, company_id, name, display_name, languages, rive_variant, voice, personality_prompt, default_scene, is_active)
  VALUES
    ('7a1e0000-0000-4000-8000-000000000001', v_platform, 'Lín Lǎoshī', 'Lín Lǎoshī', ARRAY['zh'],
     '{"skinColor":"#E8B48F","skinShadeColor":"#C98D6A","hairColor":"#2A2230","outfitPrimary":"#2FA37F","outfitSecondary":"#FFF4E2","accentColor":"#FFB547","hairStyle":"bob","outfitStyle":"cardigan","prop":"none","faceStyle":"lin"}'::jsonb,
     '{"provider":"gemini","voiceName":"Kore"}'::jsonb,
     'You are Lín Lǎoshī, a warm, patient Mandarin teacher who runs a small tea house. Speak mostly Mandarin at HSK1 level with short sentences, pinyin when the learner is stuck, and gentle English hints. Praise effort, correct one thing at a time.',
     'Scene_TeaHouse', true),
    ('7a1e0000-0000-4000-8000-000000000002', v_platform, 'Sofía', 'Sofía', ARRAY['es'],
     '{"skinColor":"#8B5A3C","skinShadeColor":"#6A4029","hairColor":"#1C1410","outfitPrimary":"#C4572E","outfitSecondary":"#FFF1E0","accentColor":"#E8A93A","hairStyle":"curly","outfitStyle":"blouse_stripe","prop":"menu","faceStyle":"sofia"}'::jsonb,
     '{"provider":"gemini","voiceName":"Aoede"}'::jsonb,
     'You are Sofía, a friendly barista in a neighbourhood café in Madrid. Speak simple A1 Spanish: short questions, slow pace, repeat key words. Offer the menu, check understanding, and celebrate small wins.',
     'Scene_Cafe', true),
    ('7a1e0000-0000-4000-8000-000000000003', v_platform, 'Camille', 'Camille', ARRAY['fr'],
     '{"skinColor":"#9A6641","skinShadeColor":"#774C2F","hairColor":"#2A1A12","outfitPrimary":"#F0705A","outfitSecondary":"#F7F4FF","accentColor":"#1F2F6B","hairStyle":"bun","outfitStyle":"blazer","prop":"croissant","faceStyle":"camille"}'::jsonb,
     '{"provider":"gemini","voiceName":"Puck"}'::jsonb,
     'You are Camille, a cheerful baker in a Parisian bakery. Speak simple A1 French with short phrases. Use gestures in words ("voilà"), model the phrase first, then let the learner try. Keep it light and encouraging.',
     'Scene_Rooftop', true),
    ('7a1e0000-0000-4000-8000-000000000004', v_platform, 'Nurse Tendai', 'Nurse Tendai', ARRAY['en'],
     '{"skinColor":"#5F3B27","skinShadeColor":"#43271A","hairColor":"#14100E","outfitPrimary":"#1FA3A0","outfitSecondary":"#F4F7F7","accentColor":"#FF8A3D","hairStyle":"short","outfitStyle":"scrubs","prop":"stethoscope","faceStyle":"tendai"}'::jsonb,
     '{"provider":"gemini","voiceName":"Charon"}'::jsonb,
     'You are Nurse Tendai, a calm nurse doing a patient intake at a clinic. Use plain, clear English, one question at a time. Check the learner understands, never give medical advice, and keep a reassuring tone.',
     'Scene_Clinic', true)
  ON CONFLICT DO NOTHING;

  -- ----------------------------------------------------------
  -- Scenarios (platform starter packs, published)
  -- ----------------------------------------------------------
  INSERT INTO public.practice_scenarios
    (id, company_id, course_id, lesson_id, skill_pack, persona_id, title, goal, beats, target_items,
     level, exam_task, max_minutes, allowed_modes, scene, visibility, style, status)
  VALUES
    ('7a1e0000-0000-4000-8000-000000000101', v_platform,
     NULL, NULL,
     'language-zh', '7a1e0000-0000-4000-8000-000000000001',
     'Mandarin tea house', 'Greet the tea house owner, ask for a cup of tea and find out how much it costs.',
     '[{"id":"greet","goal":"Greet the owner and say thank you","targetItems":["你好","谢谢"]},
       {"id":"order","goal":"Order one cup of tea","targetItems":["一杯茶"]},
       {"id":"price","goal":"Ask how much it costs and pay","targetItems":["多少钱"]}]'::jsonb,
     '[{"text":"你好","pron":"nǐ hǎo","meaning":"hello"},{"text":"谢谢","pron":"xièxie","meaning":"thank you"},
       {"text":"一杯茶","pron":"yì bēi chá","meaning":"a cup of tea"},{"text":"多少钱","pron":"duōshao qián","meaning":"how much"}]'::jsonb,
     'HSK1', 'HSKK-beginner-repeat', 6, ARRAY['voice','text','live']::text[], 'Scene_TeaHouse',
     'platform', 'scene', 'published'),
    ('7a1e0000-0000-4000-8000-000000000102', v_platform,
     NULL, NULL,
     'language-es', '7a1e0000-0000-4000-8000-000000000002',
     'Spanish café', 'Order a coffee with milk, ask the price and say thank you.',
     '[{"id":"greet","goal":"Greet the barista","targetItems":["Hola"]},
       {"id":"order","goal":"Order a coffee with milk","targetItems":["Un café con leche, por favor"]},
       {"id":"pay","goal":"Ask the price and pay","targetItems":["¿Cuánto cuesta?","Gracias"]}]'::jsonb,
     '[{"text":"Hola","meaning":"hello"},{"text":"Un café con leche, por favor","meaning":"A coffee with milk, please"},
       {"text":"¿Cuánto cuesta?","meaning":"How much does it cost?"},{"text":"Gracias","meaning":"thank you"}]'::jsonb,
     'A1', NULL, 6, ARRAY['voice','text','live']::text[], 'Scene_Cafe',
     'platform', 'scene', 'published'),
    ('7a1e0000-0000-4000-8000-000000000103', v_platform,
     NULL, NULL,
     'language-fr', '7a1e0000-0000-4000-8000-000000000003',
     'French bakery', 'Greet the baker, buy a croissant and ask how much it costs.',
     '[{"id":"greet","goal":"Greet the baker","targetItems":["Bonjour"]},
       {"id":"order","goal":"Ask for a croissant","targetItems":["Un croissant, s''il vous plaît"]},
       {"id":"pay","goal":"Ask the price and say goodbye","targetItems":["Combien ça coûte ?","Merci, au revoir"]}]'::jsonb,
     '[{"text":"Bonjour","meaning":"hello"},{"text":"Un croissant, s''il vous plaît","meaning":"A croissant, please"},
       {"text":"Combien ça coûte ?","meaning":"How much does it cost?"},{"text":"Merci, au revoir","meaning":"Thank you, goodbye"}]'::jsonb,
     'A1', 'DELF-A1-oral-dialogue', 6, ARRAY['voice','text','live']::text[], 'Scene_Rooftop',
     'platform', 'scene', 'published'),
    ('7a1e0000-0000-4000-8000-000000000104', v_platform,
     NULL, NULL,
     'health-sim', '7a1e0000-0000-4000-8000-000000000004',
     'English for healthcare patient intake', 'Answer a nurse''s intake questions: greeting, the reason for the visit and how long you have had the symptom.',
     '[{"id":"greet","goal":"Respond to the greeting and confirm your name","targetItems":["Good morning"]},
       {"id":"reason","goal":"Say why you are here","targetItems":["I have a headache"]},
       {"id":"duration","goal":"Say how long the symptom has lasted","targetItems":["since yesterday"]}]'::jsonb,
     '[{"text":"Good morning","meaning":"greeting"},{"text":"I have a headache","meaning":"describing a symptom"},
       {"text":"since yesterday","meaning":"for a period of time"},{"text":"What brings you in today?","meaning":"reason for the visit"}]'::jsonb,
     'B1', NULL, 6, ARRAY['voice','text','live']::text[], 'Scene_Clinic',
     'platform', 'scene', 'published')
  ON CONFLICT DO NOTHING;

  -- ----------------------------------------------------------
  -- Course, module, lessons
  -- ----------------------------------------------------------
  INSERT INTO public.courses
    (id, slug, title, description, category, level, instructor_id, company_id, status, price_type, price_amount, is_featured)
  VALUES
    ('7a1e0000-0000-4000-8000-000000000201', 'zai-tutor-showcase', 'ZAI Tutor Showcase: Speak from Day One',
     'Four short lessons, one per language. Learn the key phrases, then practise each one out loud with a ZAI Tutor role-play: Mandarin at a tea house, Spanish at a café, French at a bakery, and English for a clinic intake.',
     'Languages', 'beginner', v_admin, v_platform, 'published', 'free', 0, false)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.modules (id, course_id, title, position)
  VALUES ('7a1e0000-0000-4000-8000-000000000301', '7a1e0000-0000-4000-8000-000000000201', 'Speak from Day One', 1)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.lessons (id, module_id, title, position, is_preview)
  VALUES
    ('7a1e0000-0000-4000-8000-000000000401', '7a1e0000-0000-4000-8000-000000000301', 'Ordering tea in Mandarin', 1, false),
    ('7a1e0000-0000-4000-8000-000000000402', '7a1e0000-0000-4000-8000-000000000301', 'Ordering a coffee in Spanish', 2, false),
    ('7a1e0000-0000-4000-8000-000000000403', '7a1e0000-0000-4000-8000-000000000301', 'Buying bread in French', 3, false),
    ('7a1e0000-0000-4000-8000-000000000404', '7a1e0000-0000-4000-8000-000000000301', 'Patient intake in English', 4, false)
  ON CONFLICT DO NOTHING;

  -- ----------------------------------------------------------
  -- Content blocks: text intro, glossary of target phrases, tutor_session (scene, not required)
  -- ----------------------------------------------------------
  INSERT INTO public.content_blocks (id, lesson_id, type, position, content)
  VALUES
    -- Lesson 1: Mandarin
    ('7a1e0000-0000-4000-8000-000000000511', '7a1e0000-0000-4000-8000-000000000401', 'text', 1,
     '{"html":"<p>At Lín Lǎoshī''s tea house you will greet the owner, order a cup of tea and ask the price. Listen to the phrases first, then say them out loud.</p>"}'::jsonb),
    ('7a1e0000-0000-4000-8000-000000000512', '7a1e0000-0000-4000-8000-000000000401', 'glossary', 2,
     '{"title":"Phrases to know","terms":[{"term":"你好 (nǐ hǎo)","definition":"Hello"},{"term":"谢谢 (xièxie)","definition":"Thank you"},{"term":"一杯茶 (yì bēi chá)","definition":"A cup of tea"},{"term":"多少钱 (duōshao qián)","definition":"How much?"}]}'::jsonb),
    ('7a1e0000-0000-4000-8000-000000000513', '7a1e0000-0000-4000-8000-000000000401', 'tutor_session', 3,
     '{"scenarioId":"7a1e0000-0000-4000-8000-000000000101","style":"scene","required":false,"title":"Order tea at the tea house","intro":"Use the phrases above. The tutor will speak Mandarin, with English hints when you need them."}'::jsonb),

    -- Lesson 2: Spanish
    ('7a1e0000-0000-4000-8000-000000000521', '7a1e0000-0000-4000-8000-000000000402', 'text', 1,
     '{"html":"<p>Sofía runs a café in Madrid. Learn the phrases for ordering, then go and order your coffee.</p>"}'::jsonb),
    ('7a1e0000-0000-4000-8000-000000000522', '7a1e0000-0000-4000-8000-000000000402', 'glossary', 2,
     '{"title":"Phrases to know","terms":[{"term":"Hola","definition":"Hello"},{"term":"Un café con leche, por favor","definition":"A coffee with milk, please"},{"term":"¿Cuánto cuesta?","definition":"How much does it cost?"},{"term":"Gracias","definition":"Thank you"}]}'::jsonb),
    ('7a1e0000-0000-4000-8000-000000000523', '7a1e0000-0000-4000-8000-000000000402', 'tutor_session', 3,
     '{"scenarioId":"7a1e0000-0000-4000-8000-000000000102","style":"scene","required":false,"title":"Order a coffee at the café","intro":"Speak Spanish with Sofía. Short answers are fine."}'::jsonb),

    -- Lesson 3: French
    ('7a1e0000-0000-4000-8000-000000000531', '7a1e0000-0000-4000-8000-000000000403', 'text', 1,
     '{"html":"<p>Camille works in a Parisian bakery. Learn the phrases for greeting, asking for bread and paying, then visit her counter.</p>"}'::jsonb),
    ('7a1e0000-0000-4000-8000-000000000532', '7a1e0000-0000-4000-8000-000000000403', 'glossary', 2,
     '{"title":"Phrases to know","terms":[{"term":"Bonjour","definition":"Hello"},{"term":"Un croissant, s''il vous plaît","definition":"A croissant, please"},{"term":"Combien ça coûte ?","definition":"How much does it cost?"},{"term":"Merci, au revoir","definition":"Thank you, goodbye"}]}'::jsonb),
    ('7a1e0000-0000-4000-8000-000000000533', '7a1e0000-0000-4000-8000-000000000403', 'tutor_session', 3,
     '{"scenarioId":"7a1e0000-0000-4000-8000-000000000103","style":"scene","required":false,"title":"Buy a croissant at the bakery","intro":"Speak French with Camille. Try the phrase first, then adapt it."}'::jsonb),

    -- Lesson 4: English for healthcare
    ('7a1e0000-0000-4000-8000-000000000541', '7a1e0000-0000-4000-8000-000000000404', 'text', 1,
     '{"html":"<p>Nurse Tendai is taking a patient history at a clinic. Learn the phrases for greeting, describing a symptom and saying how long it has lasted.</p>"}'::jsonb),
    ('7a1e0000-0000-4000-8000-000000000542', '7a1e0000-0000-4000-8000-000000000404', 'glossary', 2,
     '{"title":"Phrases to know","terms":[{"term":"Good morning","definition":"A greeting"},{"term":"I have a headache","definition":"Describing a symptom"},{"term":"since yesterday","definition":"For a period of time"},{"term":"What brings you in today?","definition":"Why the patient came in"}]}'::jsonb),
    ('7a1e0000-0000-4000-8000-000000000543', '7a1e0000-0000-4000-8000-000000000404', 'tutor_session', 3,
     '{"scenarioId":"7a1e0000-0000-4000-8000-000000000104","style":"scene","required":false,"title":"Patient intake with Nurse Tendai","intro":"You are the patient. Answer one question at a time."}'::jsonb)
  ON CONFLICT DO NOTHING;
END
$$;

COMMIT;
