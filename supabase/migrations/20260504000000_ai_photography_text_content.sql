-- ============================================================
-- Migration: AI Photography Practical Course - Text & Interactive Content Update
-- Description: Replaces video-centric content blocks with rich text, 
--              interactive components, steps, callouts, and images.
-- ============================================================

DO $$
DECLARE
  v_course_id uuid;
  v_mod_id uuid;
  v_lesson_id uuid;
  v_quiz_id uuid;
BEGIN

  -- 1. Find the existing course
  SELECT id INTO v_course_id FROM courses WHERE slug = 'ai-photography-practical-course' LIMIT 1;
  
  -- If course doesn't exist, we skip (or we could create it, but it was seeded)
  IF v_course_id IS NULL THEN
    RAISE NOTICE 'Course not found. Please run the seed script first.';
    RETURN;
  END IF;

  -- 2. Delete existing modules (this cascades to lessons, content_blocks, quizzes)
  DELETE FROM modules WHERE course_id = v_course_id;

  -- ============================================================
  -- MODULE 1: Quick Win — AI Background Removal
  -- ============================================================
  INSERT INTO modules (course_id, title, position) VALUES (v_course_id, 'Quick Win — Remove Any Background in 30 Seconds', 1) RETURNING id INTO v_mod_id;

  -- Lesson 1.1
  INSERT INTO lessons (module_id, title, position, is_preview) VALUES (v_mod_id, 'How AI sees your photos', 1, true) RETURNING id INTO v_lesson_id;
  
  INSERT INTO content_blocks (lesson_id, type, position, content) VALUES
    (v_lesson_id, 'text', 1, '{"html": "<h2>Welcome to the AI Era of Photography</h2><p>Traditional background removal relied on manual selection tools — lasso, magic wand, pen paths. These require skill, patience, and often 20–40 minutes per image. AI changes this completely.</p><p>Modern AI background removal tools use <strong>semantic segmentation</strong>: the model has been trained on millions of images and has learned to recognise objects, edges, hair, and fine detail at a pixel level. The result? A clean cutout in seconds that often rivals hours of manual work.</p>"}'),
    (v_lesson_id, 'image', 2, '{"url": "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=2000&auto=format&fit=crop", "caption": "Semantic segmentation allows AI to separate complex subjects from busy backgrounds instantly.", "alt": "Abstract AI visualization"}'),
    (v_lesson_id, 'callout', 3, '{"variant": "tip", "title": "The Golden Rule of AI Editing", "body": "AI is a tool to enhance your workflow, not replace your creative vision. The goal is to spend less time on tedious tasks and more time on the creative decisions that make your work unique."}'),
    (v_lesson_id, 'tool_spotlight', 4, '{"name": "Remove.bg", "description": "The fastest AI background removal tool. Upload a photo and get a perfect cutout in seconds. Free tier includes 50 previews/month.", "url": "https://www.remove.bg", "icon_url": ""}');

  -- Lesson 1.2
  INSERT INTO lessons (module_id, title, position, is_preview) VALUES (v_mod_id, 'Your first perfect cutout', 2, false) RETURNING id INTO v_lesson_id;

  INSERT INTO content_blocks (lesson_id, type, position, content) VALUES
    (v_lesson_id, 'text', 1, '{"html": "<h3>Step-by-Step Execution</h3><p>Let''s dive straight in. We will use Remove.bg for this exercise because it requires zero installation and provides incredible results out of the box.</p>"}'),
    (v_lesson_id, 'steps', 2, '{"title": "The Removal Process", "steps": [{"title": "Open Remove.bg", "body": "Go to remove.bg in your browser. No account needed for your first few tries."}, {"title": "Upload your photo", "body": "Drag and drop or click Upload Image. Use a photo with a clear subject — portrait, product, or pet."}, {"title": "Review the result", "body": "The AI processes in 2–3 seconds. Zoom in to check edges, especially around hair and fine detail."}, {"title": "Use the Erase/Restore brush", "body": "If edges are not clean, use the built-in brush tool to erase stray background or restore missed subject areas."}, {"title": "Download the PNG", "body": "Click Download. The free tier gives a low-res preview; a small credit gives you full resolution."}]}'),
    (v_lesson_id, 'ai_prompt', 3, '{"label": "ChatGPT Background Ideas", "tool": "ChatGPT", "prompt": "I am a portrait photographer. I have cut out a subject from their photo using Remove.bg. Suggest 10 creative background ideas I can use for this portrait — including natural settings, studio gradients, and conceptual backgrounds. Describe the mood it creates."}');

  -- Quiz 1
  INSERT INTO lessons (module_id, title, position, is_preview) VALUES (v_mod_id, 'Module 1 Checkpoint Quiz', 3, false) RETURNING id INTO v_lesson_id;
  INSERT INTO content_blocks (lesson_id, type, position, content) VALUES (v_lesson_id, 'quiz', 1, '{"quiz_id": ""}');
  INSERT INTO quizzes (lesson_id, title, pass_threshold, max_attempts) VALUES (v_lesson_id, 'Module 1: AI Background Removal', 70, 3) RETURNING id INTO v_quiz_id;
  UPDATE content_blocks SET content = jsonb_build_object('quiz_id', v_quiz_id::text) WHERE lesson_id = v_lesson_id AND type = 'quiz';
  
  INSERT INTO quiz_questions (quiz_id, question, options, correct_indices, explanation, position) VALUES
    (v_quiz_id, 'What technique does AI use to remove backgrounds?', '["Colour threshold selection", "Semantic segmentation", "Gaussian blur masking", "Histogram matching"]', '{1}', 'Semantic segmentation means the AI has learned to identify what objects are.', 1),
    (v_quiz_id, 'Which Remove.bg plan gives you full-resolution PNG downloads?', '["The free tier", "The free preview tier", "A paid credit plan", "No plan needed"]', '{2}', 'The free tier gives low-resolution previews.', 2);


  -- ============================================================
  -- MODULE 2: Smart Culling
  -- ============================================================
  INSERT INTO modules (course_id, title, position) VALUES (v_course_id, 'Smart Culling — Cull a 200-Shot Shoot in Minutes', 2) RETURNING id INTO v_mod_id;

  -- Lesson 2.1
  INSERT INTO lessons (module_id, title, position, is_preview) VALUES (v_mod_id, 'Why manual culling is killing your profit', 1, false) RETURNING id INTO v_lesson_id;

  INSERT INTO content_blocks (lesson_id, type, position, content) VALUES
    (v_lesson_id, 'text', 1, '{"html": "<h3>The Hidden Cost of Photography</h3><p>Culling — deciding which shots to keep and which to discard — is the invisible time thief of photography. Most photographers spend <strong>1–3 hours culling a single shoot</strong>.</p><p>AI culling tools analyse every image for technical quality (sharpness, exposure, blink detection, composition) and group similar shots — letting you make keep/reject decisions 5–10x faster.</p>"}'),
    (v_lesson_id, 'callout', 2, '{"variant": "warning", "title": "Opportunity Cost", "body": "At a $50/hr opportunity cost, 2 hours of culling per shoot equals $100 of lost income or rest."}'),
    (v_lesson_id, 'tool_spotlight', 3, '{"name": "AfterShoot", "description": "The fastest AI culling tool. It runs locally on your machine and uses AI to group duplicates, detect closed eyes, and rate image sharpness.", "url": "https://aftershoot.com", "icon_url": ""}');


  -- ============================================================
  -- MODULE 3: AI Enhancement & Retouching
  -- ============================================================
  INSERT INTO modules (course_id, title, position) VALUES (v_course_id, 'AI Enhancement — Sharper, Cleaner, Better', 3) RETURNING id INTO v_mod_id;

  -- Lesson 3.1
  INSERT INTO lessons (module_id, title, position, is_preview) VALUES (v_mod_id, 'Topaz Photo AI: denoise, sharpen, and upscale', 1, false) RETURNING id INTO v_lesson_id;

  INSERT INTO content_blocks (lesson_id, type, position, content) VALUES
    (v_lesson_id, 'text', 1, '{"html": "<h3>Pushing Your Camera to the Limits</h3><p>In the past, shooting at ISO 6400 or missing focus slightly meant a ruined shot. Topaz Photo AI uses machine learning trained on millions of images to reconstruct missing details, remove grain without destroying texture, and fix motion blur.</p>"}'),
    (v_lesson_id, 'image', 2, '{"url": "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=2000&auto=format&fit=crop", "caption": "High ISO shots can be completely recovered using AI denoising.", "alt": "Dark moody photography"}'),
    (v_lesson_id, 'callout', 3, '{"variant": "tip", "title": "ISO 6400 is No Longer Scary", "body": "Topaz Photo AI can reduce noise from high-ISO shots so effectively that images previously unusable for client delivery become portfolio quality. Do not be afraid to push ISO at events."}');


  -- ============================================================
  -- MODULE 4: Generative AI & Creative Tools
  -- ============================================================
  INSERT INTO modules (course_id, title, position) VALUES (v_course_id, 'Generative AI — Fill, Concept, and Create', 4) RETURNING id INTO v_mod_id;

  -- Lesson 4.1
  INSERT INTO lessons (module_id, title, position, is_preview) VALUES (v_mod_id, 'Midjourney for Mood Boards', 1, false) RETURNING id INTO v_lesson_id;

  INSERT INTO content_blocks (lesson_id, type, position, content) VALUES
    (v_lesson_id, 'text', 1, '{"html": "<h3>Pitching with Confidence</h3><p>Sometimes you need to pitch a concept to a client, but you don''t have the exact image in your portfolio. Midjourney allows you to generate photorealistic mood boards to convey lighting, styling, and location ideas instantly.</p>"}'),
    (v_lesson_id, 'ai_prompt', 2, '{"label": "Midjourney Mood Board Prompt", "tool": "Midjourney", "prompt": "/imagine prompt: editorial portrait photography, urban environment, golden hour, teal and orange colour grade, shallow depth of field, Canon 85mm f/1.4 look, professional photography, high fashion --ar 4:5 --style raw --v 6"}'),
    (v_lesson_id, 'steps', 3, '{"title": "The Midjourney Workflow", "steps": [{"title": "Open Discord", "body": "Midjourney operates entirely inside Discord. Go to the Midjourney bot channel."}, {"title": "Start your prompt", "body": "Type /imagine to bring up the prompt box."}, {"title": "Describe the scene", "body": "Use photography terms: lighting (golden hour, studio lighting), camera/lens (85mm, f/1.4), and film stock (Kodak Portra, cinematic)."}, {"title": "Upscale and save", "body": "Use the U buttons to upscale your favorite variation, then right-click and save to build your mood board."}]}');

  -- Final output
  RAISE NOTICE '✓ Photography course successfully updated with rich text/interactive components.';

END $$;
