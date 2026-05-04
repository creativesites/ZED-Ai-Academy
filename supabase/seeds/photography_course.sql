-- ============================================================
-- AI Photography: Shoot to Gallery in Half the Time
-- ============================================================
-- BEFORE RUNNING:
--   1. Run all migrations up to 016_new_content_block_types.sql
--   2. Confirm the instructor_id below matches the Clerk user ID
--      for Mr. Chabz (check profiles table).
--   3. Run in the Supabase SQL Editor.
--   4. Open Creator Studio to add videos to each lesson.
-- ============================================================

DO $$
DECLARE
  v_instructor_id text := 'user_3D8zG2D3z98MlEtAJ3Of9zhLn3s';

  v_course_id uuid;

  -- module ids
  v_mod1 uuid; v_mod2 uuid; v_mod3 uuid; v_mod4 uuid;
  v_mod5 uuid; v_mod6 uuid; v_mod7 uuid; v_mod8 uuid; v_mod9 uuid;

  -- module 1 lessons
  v_l1_1 uuid; v_l1_2 uuid; v_l1_3 uuid; v_l1_q uuid;

  -- module 2 lessons
  v_l2_1 uuid; v_l2_2 uuid; v_l2_3 uuid; v_l2_q uuid;

  -- module 3 lessons
  v_l3_1 uuid; v_l3_2 uuid; v_l3_3 uuid; v_l3_4 uuid; v_l3_q uuid;

  -- module 4 lessons
  v_l4_1 uuid; v_l4_2 uuid; v_l4_3 uuid; v_l4_q uuid;

  -- module 5 lessons
  v_l5_1 uuid; v_l5_2 uuid; v_l5_3 uuid; v_l5_q uuid;

  -- module 6 (project)
  v_l6_proj uuid;

  -- module 7 lessons
  v_l7_1 uuid; v_l7_2 uuid; v_l7_3 uuid; v_l7_q uuid;

  -- module 8 lessons
  v_l8_1 uuid; v_l8_2 uuid; v_l8_3 uuid; v_l8_4 uuid; v_l8_q uuid;

  -- module 9 (final exam)
  v_l9_exam uuid;

  -- quiz ids
  v_quiz1 uuid; v_quiz2 uuid; v_quiz3 uuid; v_quiz4 uuid;
  v_quiz5 uuid; v_quiz7 uuid; v_quiz8 uuid; v_quiz9 uuid;

BEGIN

-- ─── Course ──────────────────────────────────────────────────────────────────
INSERT INTO courses (
  instructor_id, title, slug, description,
  category, level, price_type, price_amount,
  status, is_featured
) VALUES (
  v_instructor_id,
  'AI Photography: Shoot to Gallery in Half the Time',
  'ai-photography-practical-course',
  'A hands-on course for photographers who want to use AI tools to cut editing time, remove backgrounds instantly, cull faster, enhance quality, and deliver polished galleries to clients — without losing their creative signature. Includes a practical mid-course project, 8 checkpoint quizzes, and a final certification exam.',
  'Photography',
  'beginner',
  'one_time',
  400,
  'draft',
  true
) RETURNING id INTO v_course_id;

-- ════════════════════════════════════════════════════════════════════════════
-- MODULE 1: Quick Win — AI Background Removal
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO modules (course_id, title, position)
  VALUES (v_course_id, 'Quick Win — Remove Any Background in 30 Seconds', 1)
  RETURNING id INTO v_mod1;

INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod1, 'How AI sees your photos (and why it beats manual selection)', 1, true)
  RETURNING id INTO v_l1_1;

INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod1, 'Remove.bg walkthrough: your first perfect cutout', 2, false)
  RETURNING id INTO v_l1_2;

INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod1, 'Batch remove 20 backgrounds in under 5 minutes', 3, false)
  RETURNING id INTO v_l1_3;

INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod1, 'Module 1 Checkpoint Quiz', 4, false)
  RETURNING id INTO v_l1_q;

-- ── Lesson 1.1 Content Blocks ─────────────────────────────────────────────
INSERT INTO content_blocks (lesson_id, type, position, content) VALUES
  (v_l1_1, 'video', 1,
    '{"youtube_id": "", "title": "How AI Sees Your Photos"}'),

  (v_l1_1, 'text', 2,
    '{"html": "<p>Traditional background removal relied on manual selection tools — lasso, magic wand, pen paths. These require skill, patience, and often 20–40 minutes per image. AI changes this completely.</p><p>Modern AI background removal tools use <strong>semantic segmentation</strong>: the model has been trained on millions of images and has learned to recognise objects, edges, hair, and fine detail at a pixel level. The result? A clean cutout in seconds that often rivals hours of manual work.</p>"}'),

  (v_l1_1, 'tool_spotlight', 3,
    '{"name": "Remove.bg", "description": "The fastest AI background removal tool. Upload a photo and get a perfect cutout in seconds. Free tier includes 50 previews/month.", "url": "https://www.remove.bg", "icon_url": ""}'),

  (v_l1_1, 'tool_spotlight', 4,
    '{"name": "Adobe Photoshop Remove Background", "description": "Built into Photoshop (Select > Subject then Remove Background). Best for users already in the Adobe ecosystem.", "url": "https://www.adobe.com/products/photoshop.html", "icon_url": ""}'),

  (v_l1_1, 'key_takeaway', 5,
    '{"title": "Key Takeaways from this Lesson", "points": ["AI background removal uses semantic segmentation — it understands what objects are, not just colour differences.", "Results that used to take 30 minutes now take under 10 seconds.", "Remove.bg, Adobe, and Canva all offer free tiers good enough to start with today.", "AI performs best on images with clear subject separation — you can improve results with good composition."]}');

-- ── Lesson 1.2 Content Blocks ─────────────────────────────────────────────
INSERT INTO content_blocks (lesson_id, type, position, content) VALUES
  (v_l1_2, 'video', 1,
    '{"youtube_id": "", "title": "Remove.bg Full Walkthrough"}'),

  (v_l1_2, 'steps', 2,
    '{"title": "Your First Perfect Cutout — Step by Step", "steps": [
      {"title": "Open Remove.bg", "body": "Go to remove.bg in your browser. No account needed for your first few tries."},
      {"title": "Upload your photo", "body": "Drag and drop or click Upload Image. Use a photo with a clear subject — portrait, product, or pet."},
      {"title": "Review the result", "body": "The AI processes in 2–3 seconds. Zoom in to check edges, especially around hair and fine detail."},
      {"title": "Use the Erase/Restore brush", "body": "If edges are not clean, use the built-in brush tool to erase stray background or restore missed subject areas."},
      {"title": "Download the PNG", "body": "Click Download. The free tier gives a low-res preview; a small credit gives you full resolution."},
      {"title": "Open in Photoshop or Lightroom", "body": "Place your cutout over a new background or use it in a composite. The transparent PNG works in any editor."}
    ]}'),

  (v_l1_2, 'callout', 3,
    '{"variant": "tip", "title": "Pro Tip: Shoot for AI", "body": "The cleaner your original background contrast, the better AI performs. On shoots where you plan to cut out subjects, use a plain wall or neutral backdrop. You will save time even before editing starts."}'),

  (v_l1_2, 'ai_prompt', 4,
    '{"label": "ChatGPT Background Ideas", "tool": "ChatGPT", "prompt": "I am a portrait photographer in Zambia. I have cut out a subject from their photo using Remove.bg. Suggest 10 creative background ideas I can use for this portrait — including natural settings, studio gradients, and conceptual backgrounds. For each idea, describe the mood it creates and the type of client it suits best."}'),

  (v_l1_2, 'checklist', 5,
    '{"title": "Before You Move On", "items": ["I have uploaded at least one photo to Remove.bg and downloaded the cutout.", "I have tested the erase/restore brush to clean up an edge.", "I understand the difference between a preview download and a full-resolution download.", "I have tried placing my cutout on a new background in any editing app."]}');

-- ── Lesson 1.3 Content Blocks ─────────────────────────────────────────────
INSERT INTO content_blocks (lesson_id, type, position, content) VALUES
  (v_l1_3, 'video', 1,
    '{"youtube_id": "", "title": "Batch Remove Backgrounds in 5 Minutes"}'),

  (v_l1_3, 'steps', 2,
    '{"title": "Batch Workflow with Remove.bg API", "steps": [
      {"title": "Create a Remove.bg account", "body": "Sign up at remove.bg. Free accounts include a small credit balance. For batch work, purchase a credit pack (roughly $0.20 per image at volume)."},
      {"title": "Use the Remove.bg Desktop App", "body": "Download the free desktop app (Mac/Windows). Drag an entire folder of images onto it — it processes them all automatically."},
      {"title": "Or use Photoshop Batch Action", "body": "In Photoshop, record an Action: File > Open, then Select > Subject > Remove Background > Save As PNG > Close. Then run it via File > Automate > Batch on your folder."},
      {"title": "Review results folder", "body": "Check the output folder. Flag any images that need manual touch-up (typically 5–10% of shots)."},
      {"title": "Touch up flagged images", "body": "Open flagged images in Remove.bg or Photoshop for a quick manual fix. This is still 90% faster than doing everything manually."}
    ]}'),

  (v_l1_3, 'callout', 3,
    '{"variant": "warning", "title": "Watch Your Credit Balance", "body": "Remove.bg charges per image at full resolution. For a 200-shot shoot, budget around $8–15 in credits. Always check your credit balance before running a large batch to avoid interruption mid-job."}'),

  (v_l1_3, 'key_takeaway', 4,
    '{"title": "Module 1 Summary", "points": ["AI background removal is a professional-grade tool, not a shortcut — results are client-ready.", "Batch processing lets you clear an entire shoot in minutes, not hours.", "The 3 main approaches: Remove.bg web/desktop, Adobe Photoshop Select Subject, Canva background remover.", "Always do a final QC pass — AI gets it right 90%+ of the time but never 100%."]}');

-- ── Module 1 Quiz ─────────────────────────────────────────────────────────
INSERT INTO content_blocks (lesson_id, type, position, content) VALUES
  (v_l1_q, 'quiz', 1, '{"quiz_id": ""}');

INSERT INTO quizzes (lesson_id, title, pass_threshold, max_attempts)
  VALUES (v_l1_q, 'Module 1: AI Background Removal', 70, 3)
  RETURNING id INTO v_quiz1;

UPDATE content_blocks
  SET content = jsonb_build_object('quiz_id', v_quiz1::text)
  WHERE lesson_id = v_l1_q AND type = 'quiz';

INSERT INTO quiz_questions (quiz_id, question, options, correct_indices, explanation, position) VALUES
  (v_quiz1,
   'What technique does AI use to remove backgrounds — understanding objects and their edges at pixel level?',
   '["Colour threshold selection", "Semantic segmentation", "Gaussian blur masking", "Histogram matching"]',
   '{1}',
   'Semantic segmentation means the AI has learned to identify what objects are (person, car, hair) and separates them from the background at a pixel level — far more accurately than colour-based selection.',
   1),

  (v_quiz1,
   'Which Remove.bg plan gives you full-resolution PNG downloads without watermarks?',
   '["The free tier with no account", "The free preview tier", "A paid credit or subscription plan", "No plan — all downloads are full resolution"]',
   '{2}',
   'The free tier gives low-resolution previews. Full-resolution clean PNGs require spending credits (purchased or included in a subscription).',
   2),

  (v_quiz1,
   'You have 150 product photos that all need their backgrounds removed. What is the most efficient approach?',
   '["Remove backgrounds one by one on the website", "Use the Remove.bg desktop app to batch-process the whole folder", "Manually use Photoshop pen tool for each image", "Hire an outsourcer — AI cannot handle batches"]',
   '{1}',
   'The Remove.bg desktop app lets you drag an entire folder in and processes every image automatically. This is the most efficient approach for batch work.',
   3),

  (v_quiz1,
   'When should you expect to do a manual touch-up after AI background removal?',
   '["Never — AI is always perfect", "Only when the photo is blurry", "For roughly 5–10% of images, especially those with complex edges like fly-away hair", "For every single image to ensure quality"]',
   '{2}',
   'AI gets it right the vast majority of the time, but complex edges (fine hair, transparent fabric, overlapping colours) sometimes need a quick manual brush touch-up.',
   4),

  (v_quiz1,
   'What is the main advantage of shooting subjects against a plain, neutral background?',
   '["The photo looks better straight out of camera", "It makes the AI removal faster on your computer", "It improves AI accuracy and reduces the number of images needing manual touch-up", "It is required by Remove.bg terms of service"]',
   '{2}',
   'Strong contrast between subject and background is the biggest predictor of AI removal quality. Shooting with this in mind saves editing time before you even open the tools.',
   5);

-- ════════════════════════════════════════════════════════════════════════════
-- MODULE 2: Smart Culling
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO modules (course_id, title, position)
  VALUES (v_course_id, 'Smart Culling — Cull a 200-Shot Shoot in Minutes', 2)
  RETURNING id INTO v_mod2;

INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod2, 'Why manual culling is silently killing your profit margin', 1, false)
  RETURNING id INTO v_l2_1;

INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod2, 'AfterShoot AI: smart selection and auto-rating explained', 2, false)
  RETURNING id INTO v_l2_2;

INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod2, 'Build a culling criteria preset you reuse on every shoot', 3, false)
  RETURNING id INTO v_l2_3;

INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod2, 'Module 2 Checkpoint Quiz', 4, false)
  RETURNING id INTO v_l2_q;

-- ── Lesson 2.1 Content Blocks ─────────────────────────────────────────────
INSERT INTO content_blocks (lesson_id, type, position, content) VALUES
  (v_l2_1, 'video', 1,
    '{"youtube_id": "", "title": "The Real Cost of Manual Culling"}'),

  (v_l2_1, 'text', 2,
    '{"html": "<p>Culling — deciding which shots to keep and which to discard — is the invisible time thief of photography. Most photographers spend <strong>1–3 hours culling a single shoot</strong>. At even a modest hourly rate, that is $50–150 of unbillable time, per job.</p><p>AI culling tools analyse every image for technical quality (sharpness, exposure, blink detection, composition) and group similar shots — letting you make keep/reject decisions 5–10x faster.</p>"}'),

  (v_l2_1, 'ai_prompt', 3,
    '{"label": "Calculate Your Culling Cost", "tool": "ChatGPT", "prompt": "I am a photographer. I shoot an average of [X] sessions per month. Each session produces around [Y] photos and I spend about [Z] hours culling manually. My desired hourly rate is $[rate]/hour. Calculate: (1) my monthly hours lost to culling, (2) the monthly cost of that time at my rate, (3) the annual cost, and (4) how much I would save if AI reduced my culling time by 80%."}'),

  (v_l2_1, 'key_takeaway', 4,
    '{"title": "Why This Matters", "points": ["Manual culling is one of the top 3 time costs in post-production — yet it adds no creative value.", "At a $50/hr opportunity cost, 2 hours of culling per shoot = $100 of lost income or rest.", "AI culling does not replace your judgement — it handles the mechanical sorting so you focus on the creative decisions.", "The goal is not to automate taste. It is to automate the tedious part so taste gets more of your time."]}');

-- ── Module 2 Quiz ─────────────────────────────────────────────────────────
INSERT INTO content_blocks (lesson_id, type, position, content) VALUES
  (v_l2_q, 'quiz', 1, '{"quiz_id": ""}');

INSERT INTO quizzes (lesson_id, title, pass_threshold, max_attempts)
  VALUES (v_l2_q, 'Module 2: Smart Culling', 70, 3)
  RETURNING id INTO v_quiz2;

UPDATE content_blocks
  SET content = jsonb_build_object('quiz_id', v_quiz2::text)
  WHERE lesson_id = v_l2_q AND type = 'quiz';

INSERT INTO quiz_questions (quiz_id, question, options, correct_indices, explanation, position) VALUES
  (v_quiz2,
   'What does an AI culling tool primarily analyse to rate your photos?',
   '["Colour palette and mood", "Sharpness, exposure, blink detection, and composition quality", "File size and camera model", "Number of faces in the frame"]',
   '{1}',
   'AI culling tools score images on technical quality metrics: focus sharpness, correct exposure, closed eyes, and composition. This is the mechanical work that used to require a human eye to review every single frame.',
   1),

  (v_quiz2,
   'What is AfterShoot primarily used for?',
   '["Adding filters and presets to photos", "AI-powered culling and auto-rating of photo shoots", "Uploading galleries to clients", "Removing objects from backgrounds"]',
   '{1}',
   'AfterShoot is an AI culling application. It imports your shoot, analyses every image, groups similar shots, and gives you a rated shortlist — dramatically reducing the time spent reviewing frames one by one.',
   2),

  (v_quiz2,
   'A photographer shoots 400 frames at a wedding. AI culling selects 180 as the best. The photographer then reviews the 180. This workflow is best described as:',
   '["Fully automated — the photographer does not need to review anything", "AI-first, human-final — AI handles the first pass, human makes the final creative call", "Dangerous — AI will miss important moments", "Only suitable for studio photographers, not wedding photographers"]',
   '{1}',
   'The AI-first, human-final workflow is the best practice. AI eliminates obvious rejects (blurry, blinked, duplicates) quickly, then the photographer reviews a much shorter list to make the creative final selections.',
   3),

  (v_quiz2,
   'What is a "culling criteria preset" and why is it valuable?',
   '["A Lightroom colour preset applied during culling", "A saved set of rules (minimum sharpness score, grouping sensitivity) that the AI uses to rate your specific shoot type", "A gallery template for client delivery", "A keyboard shortcut configuration in Capture One"]',
   '{1}',
   'A culling criteria preset saves your preferred AI settings — like how strict the sharpness threshold is, how to group similar shots, and which ratings to auto-reject. Once built, you apply it to every shoot of the same type without reconfiguring.',
   4),

  (v_quiz2,
   'Approximately how much faster is AI culling compared to manual culling for most photographers?',
   '["10–20% faster", "About the same speed", "5–10 times faster", "Only faster for shoots over 1000 images"]',
   '{2}',
   'Most photographers report AI culling is 5–10x faster. A shoot that took 2 hours to cull manually can be reduced to 15–25 minutes using AI tools, with the same or better selection quality.',
   5);

-- ════════════════════════════════════════════════════════════════════════════
-- MODULE 3: AI Enhancement & Retouching
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO modules (course_id, title, position)
  VALUES (v_course_id, 'AI Enhancement — Sharper, Cleaner, Better in One Pass', 3)
  RETURNING id INTO v_mod3;

INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod3, 'Topaz Photo AI: denoise, sharpen, and upscale explained', 1, false)
  RETURNING id INTO v_l3_1;

INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod3, 'AI skin retouching that looks natural, not plastic', 2, false)
  RETURNING id INTO v_l3_2;

INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod3, 'Luminar Neo: AI sky replacement and portrait relighting', 3, false)
  RETURNING id INTO v_l3_3;

INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod3, 'Batch enhancement: RAW to polished in one automated pass', 4, false)
  RETURNING id INTO v_l3_4;

INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod3, 'Module 3 Checkpoint Quiz', 5, false)
  RETURNING id INTO v_l3_q;

INSERT INTO content_blocks (lesson_id, type, position, content) VALUES
  (v_l3_1, 'video', 1, '{"youtube_id": "", "title": "Topaz Photo AI Deep Dive"}'),
  (v_l3_1, 'tool_spotlight', 2,
    '{"name": "Topaz Photo AI", "description": "Industry-leading AI for noise reduction, sharpening, and upscaling. Turns unusable low-light or blurry shots into sharp, printable images.", "url": "https://www.topazlabs.com/topaz-photo-ai", "icon_url": ""}'),
  (v_l3_1, 'callout', 3,
    '{"variant": "tip", "title": "ISO 6400 is No Longer Scary", "body": "Topaz Photo AI can reduce noise from high-ISO shots so effectively that images previously unusable for client delivery become portfolio quality. Do not be afraid to push ISO at events."}');

INSERT INTO content_blocks (lesson_id, type, position, content) VALUES
  (v_l3_q, 'quiz', 1, '{"quiz_id": ""}');

INSERT INTO quizzes (lesson_id, title, pass_threshold, max_attempts)
  VALUES (v_l3_q, 'Module 3: AI Enhancement & Retouching', 70, 3)
  RETURNING id INTO v_quiz3;

UPDATE content_blocks
  SET content = jsonb_build_object('quiz_id', v_quiz3::text)
  WHERE lesson_id = v_l3_q AND type = 'quiz';

INSERT INTO quiz_questions (quiz_id, question, options, correct_indices, explanation, position) VALUES
  (v_quiz3, 'Topaz Photo AI performs three core functions. Which of the following is NOT one of them?',
   '["Noise reduction", "Sharpening", "Background removal", "Upscaling"]', '{2}',
   'Topaz Photo AI focuses on noise reduction, sharpening, and upscaling. Background removal is handled by dedicated tools like Remove.bg or Adobe Photoshop.',
   1),
  (v_quiz3, 'What does "upscaling" mean in the context of Topaz Photo AI?',
   '["Increasing the brightness of an image", "Enlarging an image while maintaining or improving sharpness using AI", "Converting RAW files to JPEG", "Adding a vignette to an image"]', '{1}',
   'AI upscaling uses machine learning to add realistic detail when enlarging an image, unlike traditional resampling which just creates blurry pixels.',
   2),
  (v_quiz3, 'AI skin retouching tools aim to achieve what result?',
   '["Perfect, flawless, plastic skin on every portrait", "Natural-looking smoothing that retains skin texture and pores", "Changing the skin tone to match a preset", "Removing all wrinkles regardless of client preference"]', '{1}',
   'Good AI retouching retains texture and natural detail. Over-retouching creates a plastic, unnatural look that clients increasingly dislike.',
   3),
  (v_quiz3, 'Which Luminar Neo feature is specifically designed to replace skies in outdoor photos?',
   '["Skin AI", "Accent AI", "Sky AI", "Portrait Bokeh AI"]', '{2}',
   'Sky AI in Luminar Neo detects the sky in any outdoor photo and replaces it with one from a library — automatically relighting the foreground to match the new sky.',
   4),
  (v_quiz3, 'What is the main benefit of batch enhancement over image-by-image processing?',
   '["Better AI quality per image", "Processes many images automatically while you work on other tasks", "Free credits for every image", "Required for RAW file support"]', '{1}',
   'Batch processing means you set the parameters once and let the software run on a whole folder overnight or while you work. You do not need to be present for each image.',
   5);

-- ════════════════════════════════════════════════════════════════════════════
-- MODULE 4: Colour Grading with AI
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO modules (course_id, title, position)
  VALUES (v_course_id, 'Colour Grading with AI — Consistent Style at Scale', 4)
  RETURNING id INTO v_mod4;

INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod4, 'Lightroom AI masking and auto colour grade', 1, false) RETURNING id INTO v_l4_1;
INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod4, 'Style consistency: make 100 photos feel like one shoot', 2, false) RETURNING id INTO v_l4_2;
INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod4, 'Building and exporting your AI-assisted signature preset', 3, false) RETURNING id INTO v_l4_3;
INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod4, 'Module 4 Checkpoint Quiz', 4, false) RETURNING id INTO v_l4_q;

INSERT INTO content_blocks (lesson_id, type, position, content) VALUES
  (v_l4_1, 'video', 1, '{"youtube_id": "", "title": "Lightroom AI Masking and Auto Grade"}'),
  (v_l4_1, 'tool_spotlight', 2,
    '{"name": "Lightroom AI Masking", "description": "Select Subject, Sky, Background, and individual body parts (face, body, clothing) with one click. AI-powered and built into Lightroom.", "url": "https://www.adobe.com/products/photoshop-lightroom.html", "icon_url": ""}');

INSERT INTO content_blocks (lesson_id, type, position, content) VALUES
  (v_l4_q, 'quiz', 1, '{"quiz_id": ""}');

INSERT INTO quizzes (lesson_id, title, pass_threshold, max_attempts)
  VALUES (v_l4_q, 'Module 4: Colour Grading with AI', 70, 3)
  RETURNING id INTO v_quiz4;

UPDATE content_blocks
  SET content = jsonb_build_object('quiz_id', v_quiz4::text)
  WHERE lesson_id = v_l4_q AND type = 'quiz';

INSERT INTO quiz_questions (quiz_id, question, options, correct_indices, explanation, position) VALUES
  (v_quiz4, 'What does Lightroom''s "Select Subject" AI masking do?',
   '["Removes the background from the image", "Automatically creates a precise selection mask around the main subject", "Applies a colour grade to the subject only", "Exports the subject as a separate layer"]', '{1}',
   'Select Subject uses AI to detect the primary subject and create a selection mask. This mask can then be used to apply adjustments to the subject only, or to the background only.',
   1),
  (v_quiz4, 'What is a Lightroom preset?',
   '["A camera setting saved on the memory card", "A saved set of edit adjustments that can be applied to any photo in one click", "A colour profile built into the camera sensor", "A Photoshop plugin for Lightroom"]', '{1}',
   'A preset saves all your slider adjustments (exposure, contrast, colour grade, sharpness, etc.) as a named profile. Apply it to any photo to instantly get the same look.',
   2),
  (v_quiz4, 'What does it mean for a shoot to have "style consistency"?',
   '["Every photo has identical exposure values", "All photos share a coherent colour tone, contrast, and mood so they look like they belong together", "All photos were taken with the same lens", "Photos are sorted by colour in the gallery"]', '{1}',
   'Style consistency means every photo in the gallery shares the same visual language — same warm tones, same contrast style, same processing approach. It makes galleries look professional and intentional.',
   3),
  (v_quiz4, 'What is "Auto Colour" in Lightroom and when should you use it?',
   '["A filter that randomly applies colours to a photo", "An AI adjustment that analyses the image and sets a starting point for exposure, colour, and tone — best used as a starting point, then refined", "A feature that converts RAW to JPEG", "A tool for creating duotone effects"]', '{1}',
   'Auto Colour (or Auto in Lightroom) uses AI to analyse the image and set sensible starting points. It is not final — but it saves time as a first pass before applying your own creative adjustments.',
   4),
  (v_quiz4, 'What is the benefit of applying a preset to an entire shoot in Lightroom before making individual adjustments?',
   '["It locks the photos so they cannot be edited further", "It establishes a consistent baseline style across all images before you make per-image tweaks", "It converts all files to black and white", "It uploads the photos to the client gallery automatically"]', '{1}',
   'Applying a preset first gives every photo the same starting look. You then only need to make small per-image adjustments (exposure, colour balance) rather than grading every photo from scratch.',
   5);

-- ════════════════════════════════════════════════════════════════════════════
-- MODULE 5: Generative AI & Creative Tools
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO modules (course_id, title, position)
  VALUES (v_course_id, 'Generative AI — Fill, Remove, Concept, and Create', 5)
  RETURNING id INTO v_mod5;

INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod5, 'Adobe Firefly: generative fill, remove objects, and extend canvas', 1, false) RETURNING id INTO v_l5_1;
INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod5, 'Midjourney for mood boards and client concept presentations', 2, false) RETURNING id INTO v_l5_2;
INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod5, 'Text-to-image prompting for photographers: practical examples', 3, false) RETURNING id INTO v_l5_3;
INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod5, 'Module 5 Checkpoint Quiz', 4, false) RETURNING id INTO v_l5_q;

INSERT INTO content_blocks (lesson_id, type, position, content) VALUES
  (v_l5_1, 'video', 1, '{"youtube_id": "", "title": "Adobe Firefly Generative Fill Walkthrough"}'),
  (v_l5_1, 'tool_spotlight', 2,
    '{"name": "Adobe Firefly", "description": "Generative AI built into Adobe products. Use Generative Fill to remove objects, extend canvas edges, or replace backgrounds with photorealistic AI content.", "url": "https://www.adobe.com/products/firefly.html", "icon_url": ""}'),
  (v_l5_1, 'ai_prompt', 3,
    '{"label": "Firefly Text Prompt", "tool": "Adobe Firefly / Photoshop", "prompt": "lush green botanical garden in Zambia, golden hour light, shallow depth of field, professional photography backdrop"}'),

  (v_l5_2, 'video', 1, '{"youtube_id": "", "title": "Midjourney for Photography Concept Boards"}'),
  (v_l5_2, 'ai_prompt', 2,
    '{"label": "Midjourney Mood Board Prompt", "tool": "Midjourney", "prompt": "/imagine prompt: editorial portrait photography, Lusaka urban environment, golden hour, teal and orange colour grade, shallow depth of field, Canon 85mm f/1.4 look, professional photography, high fashion --ar 4:5 --style raw --v 6"}');

INSERT INTO content_blocks (lesson_id, type, position, content) VALUES
  (v_l5_q, 'quiz', 1, '{"quiz_id": ""}');

INSERT INTO quizzes (lesson_id, title, pass_threshold, max_attempts)
  VALUES (v_l5_q, 'Module 5: Generative AI & Creative Tools', 70, 3)
  RETURNING id INTO v_quiz5;

UPDATE content_blocks
  SET content = jsonb_build_object('quiz_id', v_quiz5::text)
  WHERE lesson_id = v_l5_q AND type = 'quiz';

INSERT INTO quiz_questions (quiz_id, question, options, correct_indices, explanation, position) VALUES
  (v_quiz5, 'What does Adobe Firefly''s "Generative Fill" do in Photoshop?',
   '["Automatically fills the histogram to correct exposure", "Fills a selected area with AI-generated content that matches the surrounding image realistically", "Fills a layer with a solid colour", "Syncs presets from Lightroom to Photoshop"]', '{1}',
   'Generative Fill lets you paint a selection over an area (like an unwanted object or empty canvas edge) and type a text prompt. Firefly generates photorealistic content that blends with the original image.',
   1),
  (v_quiz5, 'What is Midjourney primarily used for in a photography business context?',
   '["Editing photos taken with a camera", "Creating AI-generated concept images, mood boards, and visual briefs to present ideas to clients", "Managing photo files and albums", "Replacing Lightroom for colour grading"]', '{1}',
   'Midjourney generates images from text prompts. For photographers, it is a powerful tool for concept development — creating visual references for client briefs, mood boards, and creative pitches.',
   2),
  (v_quiz5, 'The "--ar 4:5" parameter in a Midjourney prompt controls what?',
   '["The colour profile of the image", "The aspect ratio of the generated image", "The artistic style or era", "The number of image variations generated"]', '{1}',
   '--ar sets the aspect ratio. 4:5 is a common portrait format used in Instagram posts.',
   3),
  (v_quiz5, 'A photographer uses Firefly to extend the background of a portrait so the client fits better in the frame. This technique is called:',
   '["Generative Remove", "Canvas Extension / Outpainting", "Content-Aware Scale", "Warp Transform"]', '{1}',
   'Extending the canvas and filling the new area with AI-generated content that matches the original is called outpainting or canvas extension. Firefly handles this with the Generative Fill tool.',
   4),
  (v_quiz5, 'Why is prompting skill important when using text-to-image AI tools?',
   '["The AI only works if prompts are written in a specific programming language", "Better prompts produce images closer to your vision — understanding prompt structure gives you creative control over the output", "Longer prompts always produce better results than short prompts", "Prompts are only needed for the first image; the AI learns your style automatically"]', '{1}',
   'Prompting is the primary creative input for text-to-image AI. Knowing how to describe style, lighting, composition, and mood in prompt language is the skill that separates useful AI output from generic results.',
   5);

-- ════════════════════════════════════════════════════════════════════════════
-- MODULE 6: Mid-Course Project
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO modules (course_id, title, position)
  VALUES (v_course_id, 'Mid-Course Project — Process a Complete Real-World Shoot', 6)
  RETURNING id INTO v_mod6;

INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod6, '[PROJECT] Process a Full Mini-Shoot Using All Five AI Tools', 1, false)
  RETURNING id INTO v_l6_proj;

INSERT INTO content_blocks (lesson_id, type, position, content) VALUES
  (v_l6_proj, 'text', 1,
    '{"html": "<h2>Your Mid-Course Project</h2><p>You have completed the first five modules. Now it is time to prove your skills with a real project. Complete all five tasks below using your own photos or the sample images provided. Submit your before/after gallery to unlock the advanced modules.</p>"}'),

  (v_l6_proj, 'steps', 2,
    '{"title": "Project Tasks — Complete All Five", "steps": [
      {"title": "Task 1: Background Removal", "body": "Take 10 portrait or product photos and remove all backgrounds using Remove.bg or Photoshop. Download full-resolution PNG cutouts."},
      {"title": "Task 2: AI Culling", "body": "Import a set of at least 50 photos into AfterShoot or Lightroom AI. Let the AI rate them. Review the shortlist and make your final selections. Record how long this took you vs. your old manual method."},
      {"title": "Task 3: Enhancement", "body": "Take 3 of your selected photos and run them through Topaz Photo AI for noise reduction and sharpening. Export before and after versions."},
      {"title": "Task 4: Colour Grade", "body": "Apply a consistent colour grade to your full selection using Lightroom presets. All photos must feel cohesive — same tone, mood, and style."},
      {"title": "Task 5: One Generative Edit", "body": "Choose one photo and use Adobe Firefly to either remove an unwanted object, extend the canvas, or replace the background. Show the before and after."}
    ]}'),

  (v_l6_proj, 'checklist', 3,
    '{"title": "Project Submission Checklist", "items": [
      "10 cutout PNGs from background removal (Task 1)",
      "Screenshot of AI culling results showing before/after shortlist sizes (Task 2)",
      "3 before/after pairs from Topaz Photo AI (Task 3)",
      "Full colour-graded gallery showing consistent style (Task 4)",
      "One Firefly generative edit before/after (Task 5)",
      "A short paragraph (50–100 words) describing how long the full workflow took you and what surprised you"
    ]}'),

  (v_l6_proj, 'callout', 4,
    '{"variant": "tip", "title": "Use Your Own Client Work", "body": "If you have a real shoot you are currently editing, use it for this project. Real-world results are more valuable than exercises. You will finish a client deliverable AND complete your coursework at the same time."}');

-- ════════════════════════════════════════════════════════════════════════════
-- MODULE 7: Advanced Tools & Techniques
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO modules (course_id, title, position)
  VALUES (v_course_id, 'Advanced Tools — Video from Stills, Relighting, and Print-Ready Upscaling', 7)
  RETURNING id INTO v_mod7;

INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod7, 'AI video from stills: Kling AI and Runway ML for photographers', 1, false) RETURNING id INTO v_l7_1;
INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod7, 'Portrait relighting after the shoot with AI', 2, false) RETURNING id INTO v_l7_2;
INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod7, 'Upscaling for large print: billboard-ready from a phone shot', 3, false) RETURNING id INTO v_l7_3;
INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod7, 'Module 7 Checkpoint Quiz', 4, false) RETURNING id INTO v_l7_q;

INSERT INTO content_blocks (lesson_id, type, position, content) VALUES
  (v_l7_1, 'video', 1, '{"youtube_id": "", "title": "AI Video from Stills — Kling AI and Runway"}'),
  (v_l7_1, 'tool_spotlight', 2,
    '{"name": "Kling AI", "description": "Generate short, realistic video clips from a single still photo. Used to create dynamic social media content and portfolio reels from your existing photography.", "url": "https://klingai.com", "icon_url": ""}'),
  (v_l7_1, 'tool_spotlight', 3,
    '{"name": "Runway ML", "description": "Professional AI video generation platform. Gen-3 Alpha can animate stills, add motion to portraits, and generate cinematic footage from text prompts.", "url": "https://runwayml.com", "icon_url": ""}'),

  (v_l7_3, 'video', 1, '{"youtube_id": "", "title": "Upscaling for Large Print with Topaz Gigapixel"}'),
  (v_l7_3, 'callout', 2,
    '{"variant": "tip", "title": "Sell Large Prints You Could Not Before", "body": "AI upscaling means a sharp 12MP photo can be printed at billboard size without visible pixelation. Offer large print packages with confidence — AI upscaling covers the technical gap."}');

INSERT INTO content_blocks (lesson_id, type, position, content) VALUES
  (v_l7_q, 'quiz', 1, '{"quiz_id": ""}');

INSERT INTO quizzes (lesson_id, title, pass_threshold, max_attempts)
  VALUES (v_l7_q, 'Module 7: Advanced Tools', 70, 3)
  RETURNING id INTO v_quiz7;

UPDATE content_blocks
  SET content = jsonb_build_object('quiz_id', v_quiz7::text)
  WHERE lesson_id = v_l7_q AND type = 'quiz';

INSERT INTO quiz_questions (quiz_id, question, options, correct_indices, explanation, position) VALUES
  (v_quiz7, 'What does "AI video from stills" mean?',
   '["Converting video files to still photos", "Using AI to generate a short, animated video clip from a single photograph", "Upscaling video resolution using AI", "Removing background from video frames"]', '{1}',
   'Tools like Kling AI and Runway ML can take a single photograph and generate a realistic video clip with motion — camera movement, subject movement, or environmental effects like wind.',
   1),
  (v_quiz7, 'Why would a photographer want to offer AI-animated photos to clients?',
   '["To replace traditional photography entirely", "To create engaging social media content and portfolio videos without additional shooting time", "Because it is required for digital delivery", "To save on storage by converting stills to video"]', '{1}',
   'AI video from stills creates premium content (reels, social videos, animated portraits) from existing photography. It adds a high-value offering without additional shooting time.',
   2),
  (v_quiz7, 'Topaz Gigapixel AI is primarily used for:',
   '["Noise reduction in video", "Upscaling images to much larger resolutions while maintaining sharpness using AI", "Creating HDR images", "Removing people from photos"]', '{1}',
   'Gigapixel AI is a dedicated upscaling tool that can enlarge images 2x, 4x, or 6x while adding realistic detail — making it possible to print even phone photos at large format sizes.',
   3),
  (v_quiz7, 'Portrait relighting after the shoot refers to:',
   '["Taking new photos with better lighting", "Changing the direction, colour, or quality of light in an existing photo using AI", "Adjusting the exposure slider in Lightroom", "Using a reflector during the shoot"]', '{1}',
   'AI relighting tools (like Luminar Neo Portrait Relighting or Adobe Firefly) can simulate different lighting setups on an existing portrait — adding virtual fill light, changing light direction, or fixing mixed lighting.',
   4),
  (v_quiz7, 'Which of these is a practical business use case for selling AI-generated video to photography clients?',
   '["Replacing portrait sessions with AI-only images", "Offering social media reel packages where still photos are animated into short videos for Instagram or LinkedIn", "Using video to replace printed albums", "Generating fake event coverage"]', '{1}',
   'Offering animated portrait packages or event highlight reels made from stills is a tangible upsell that clients value for social media content.',
   5);

-- ════════════════════════════════════════════════════════════════════════════
-- MODULE 8: Photography Business with AI
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO modules (course_id, title, position)
  VALUES (v_course_id, 'Photography Business with AI — Grow Your Income, Not Your Hours', 8)
  RETURNING id INTO v_mod8;

INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod8, 'AI for client communication: proposals, quotes, and follow-ups', 1, false) RETURNING id INTO v_l8_1;
INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod8, 'Build and update your portfolio website with AI tools', 2, false) RETURNING id INTO v_l8_2;
INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod8, 'Social media content at scale: 30 posts from one shoot', 3, false) RETURNING id INTO v_l8_3;
INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod8, 'Pricing your AI-assisted services in the Zambian market', 4, false) RETURNING id INTO v_l8_4;
INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod8, 'Module 8 Checkpoint Quiz', 5, false) RETURNING id INTO v_l8_q;

INSERT INTO content_blocks (lesson_id, type, position, content) VALUES
  (v_l8_1, 'video', 1, '{"youtube_id": "", "title": "AI for Client Communication"}'),
  (v_l8_1, 'ai_prompt', 2,
    '{"label": "Client Proposal Prompt", "tool": "ChatGPT", "prompt": "Write a professional photography proposal for a corporate client in Lusaka, Zambia. The client is [Company Name], they need [describe shoot: headshots for 12 staff members]. My studio is called [Your Name Photography]. Include: a brief introduction of my services, what is included in the package (number of edited photos, turnaround time, delivery format), pricing at ZMW [X], and a call to action. Tone: professional but warm. Length: one page."}'),
  (v_l8_1, 'ai_prompt', 3,
    '{"label": "Follow-Up Email Prompt", "tool": "ChatGPT", "prompt": "Write a friendly but professional follow-up email to a potential client who I met at an event in Lusaka last week. They expressed interest in hiring me for their daughter''s graduation photos. I sent a quote 5 days ago and have not heard back. The email should be warm, not pushy, remind them of the quote, and include a gentle deadline (spots for that month are filling). Sign off as [Your Name]."}'),
  (v_l8_1, 'key_takeaway', 4,
    '{"title": "AI for Business Communication", "points": ["ChatGPT can draft professional proposals, quotes, and follow-up emails in minutes — not hours.", "Always edit AI-generated text to add your personal voice and local context.", "Faster responses to client enquiries = higher booking rate.", "AI handles the admin writing so you focus on creative and client relationship work."]}'),

  (v_l8_3, 'video', 1, '{"youtube_id": "", "title": "30 Social Posts from One Shoot"}'),
  (v_l8_3, 'ai_prompt', 2,
    '{"label": "Caption Generator Prompt", "tool": "ChatGPT", "prompt": "I am a photographer based in Lusaka, Zambia. I just completed a maternity shoot for a client. Write 5 Instagram captions for the photos I will post. Mix the tones: one emotional and heartfelt, one professional that sells my services, one fun and light, one with photography education value, and one that asks a question to drive comments. Include 3–5 relevant hashtags for each. Keep captions under 150 words each."}'),
  (v_l8_3, 'steps', 3,
    '{"title": "30 Posts from One Shoot — Content Repurposing System", "steps": [
      {"title": "Select your hero shots (5–8 images)", "body": "Choose the strongest images from the shoot for primary posts."},
      {"title": "Write captions with AI", "body": "Use ChatGPT to generate 5+ caption variations per image — emotional, educational, promotional."},
      {"title": "Create Reels clips", "body": "Use Kling AI or CapCut to animate 2–3 of your best stills into short video reels."},
      {"title": "Create behind-the-scenes content", "body": "If you captured any BTS photos or video, post these separately as a ''how it was made'' story."},
      {"title": "Create educational carousel posts", "body": "Use Canva AI to turn your photo editing before/after into a carousel: before → after → tools used → takeaway tip."},
      {"title": "Schedule everything", "body": "Use Buffer or Meta Business Suite to schedule your 30 posts across 2–3 weeks from a single shoot."}
    ]}'),

  (v_l8_4, 'video', 1, '{"youtube_id": "", "title": "Pricing AI-Assisted Photography Services in Zambia"}'),
  (v_l8_4, 'callout', 2,
    '{"variant": "tip", "title": "Charge for Results, Not Hours", "body": "AI cuts your post-production time by 60–80%. Do NOT reduce your prices — increase your capacity instead. Serve more clients at the same price point. The time you save is profit and rest, not a discount to give away."}'),
  (v_l8_4, 'ai_prompt', 3,
    '{"label": "Pricing Calculator Prompt", "tool": "ChatGPT", "prompt": "Help me set my photography pricing in Zambia. My costs: [list your costs — equipment depreciation, transport, editing software subscriptions, etc.]. My target monthly income: ZMW [X]. I aim to do [Y] shoots per month. I use AI tools that save me approximately [Z] hours per shoot in editing time. Calculate: my minimum viable price per shoot, a competitive market rate for Lusaka, and a premium tier price for clients who want same-day turnaround. Show your working."}');

INSERT INTO content_blocks (lesson_id, type, position, content) VALUES
  (v_l8_q, 'quiz', 1, '{"quiz_id": ""}');

INSERT INTO quizzes (lesson_id, title, pass_threshold, max_attempts)
  VALUES (v_l8_q, 'Module 8: Photography Business with AI', 70, 3)
  RETURNING id INTO v_quiz8;

UPDATE content_blocks
  SET content = jsonb_build_object('quiz_id', v_quiz8::text)
  WHERE lesson_id = v_l8_q AND type = 'quiz';

INSERT INTO quiz_questions (quiz_id, question, options, correct_indices, explanation, position) VALUES
  (v_quiz8, 'How should AI savings in editing time affect your photography pricing?',
   '["Reduce prices to pass savings to clients", "Keep prices the same but take on more clients, increasing total income", "Stop charging for editing since it is now automated", "Only reduce prices for clients who specifically ask for AI editing"]', '{1}',
   'AI reduces your time cost, not your value. Maintain your prices and use the extra capacity to serve more clients — that is where the income growth comes from.',
   1),
  (v_quiz8, 'Which AI tool is best suited for drafting a client proposal or quote?',
   '["Midjourney", "Remove.bg", "ChatGPT", "Topaz Photo AI"]', '{2}',
   'ChatGPT excels at writing tasks — proposals, emails, captions, bios. It can produce professional client-facing text that you then personalise.',
   2),
  (v_quiz8, 'What does "content repurposing" mean for a photographer on social media?',
   '["Posting the same photo multiple times with no changes", "Creating multiple different types of content (posts, reels, stories, carousels, captions) from a single shoot", "Reposting other photographers'' work", "Deleting old posts and replacing them with new ones"]', '{1}',
   'Content repurposing means extracting maximum social media value from a single photoshoot by creating different content formats — behind-the-scenes, carousels, animated reels, captions with different angles — all from the same session.',
   3),
  (v_quiz8, 'What is the primary benefit of using AI to write Instagram captions?',
   '["AI captions perform better in the algorithm than human-written ones", "Drafts are produced in seconds so you can post consistently without spending hours writing", "AI automatically adds the correct hashtags for your location", "It bypasses the need for a social media manager"]', '{1}',
   'Speed and consistency are the main benefits. AI drafts captions in seconds; you edit and post. This makes consistent posting sustainable even for solo photographers.',
   4),
  (v_quiz8, 'A Lusaka photographer currently charges ZMW 2,500 for a corporate headshot session. AI cuts their editing from 4 hours to 45 minutes. What should they do?',
   '["Reduce the price to ZMW 1,500 since editing takes less time", "Keep the price at ZMW 2,500 but take on more sessions per week", "Charge ZMW 5,000 to immediately double income", "Stop offering headshots and switch to a different product"]', '{1}',
   'Keep the same price, use the saved time to book more sessions. If you previously did 4 sessions per week, you can now do 6–8. That is income growth without a price increase.',
   5);

-- ════════════════════════════════════════════════════════════════════════════
-- MODULE 9: Final Exam
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO modules (course_id, title, position)
  VALUES (v_course_id, 'Final Exam — Certify Your AI Photography Mastery', 9)
  RETURNING id INTO v_mod9;

INSERT INTO lessons (module_id, title, position, is_preview) VALUES
  (v_mod9, '[FINAL EXAM] AI Photography Mastery Certification Exam', 1, false)
  RETURNING id INTO v_l9_exam;

INSERT INTO content_blocks (lesson_id, type, position, content) VALUES
  (v_l9_exam, 'text', 1,
    '{"html": "<h2>Certification Exam</h2><p>This is your final exam. You must score <strong>75% or higher</strong> to earn your Zed AI Academy certificate. You have <strong>2 attempts</strong>. The exam covers all 8 modules. Take your time — you have completed the full course and are ready for this.</p>"}'),

  (v_l9_exam, 'quiz', 2, '{"quiz_id": ""}');

INSERT INTO quizzes (lesson_id, title, pass_threshold, max_attempts)
  VALUES (v_l9_exam, 'AI Photography Mastery — Final Certification Exam', 75, 2)
  RETURNING id INTO v_quiz9;

UPDATE content_blocks
  SET content = jsonb_build_object('quiz_id', v_quiz9::text)
  WHERE lesson_id = v_l9_exam AND type = 'quiz';

INSERT INTO quiz_questions (quiz_id, question, options, correct_indices, explanation, position) VALUES
  (v_quiz9, 'Which process allows AI tools to accurately identify and separate the main subject from a complex background?',
   '["Histogram equalisation", "Semantic segmentation", "Colour threshold masking", "Gaussian blur detection"]', '{1}',
   'Semantic segmentation is the core AI technique for background removal — the model identifies objects and their precise boundaries.',
   1),
  (v_quiz9, 'A photographer finishes a 300-image wedding shoot. What is the recommended first step in an AI-assisted post-production workflow?',
   '["Apply Lightroom presets to all images", "Run all images through Topaz Photo AI", "Import to an AI culling tool to reduce to a manageable shortlist", "Upload all images to the client gallery"]', '{2}',
   'Culling first reduces the set to only the best images before any editing begins — saving time on every subsequent step.',
   2),
  (v_quiz9, 'What happens to your pricing when AI reduces your editing time from 6 hours to 1 hour per shoot?',
   '["You must reduce prices proportionally", "Prices stay the same; you use the saved time to take on more clients", "You charge extra for using AI tools", "You can only charge for actual editing hours"]', '{1}',
   'Your price is based on value delivered to the client, not hours worked. Use the time savings to scale your capacity.',
   3),
  (v_quiz9, 'An Instagram Reel showing a portrait magically coming to life with subtle movement was most likely created using:',
   '["A slow shutter speed on a DSLR", "An AI video-from-stills tool like Kling AI or Runway ML", "A GIF export from Lightroom", "Stop motion photography"]', '{1}',
   'Tools like Kling AI and Runway ML animate still photos into short, realistic video clips — a popular technique for social media content.',
   4),
  (v_quiz9, 'Which Lightroom feature uses AI to automatically create precise selection masks around subjects, skies, and backgrounds?',
   '["Auto Tone", "AI Masking (Select Subject / Sky / Background)", "Lens Correction", "Dehaze"]', '{1}',
   'Lightroom AI Masking creates intelligent selection masks with one click, enabling targeted adjustments to specific parts of an image.',
   5),
  (v_quiz9, 'What is the main purpose of Adobe Firefly''s Generative Fill feature?',
   '["Filling histogram gaps in under-exposed images", "Generating photorealistic content inside a selection to add, remove, or extend image elements", "Applying a preset colour grade to the entire image", "Synchronising edits across a shoot in Lightroom"]', '{1}',
   'Generative Fill uses AI to fill a selected region with contextually appropriate, photorealistic content — used for object removal, background extension, and creative composites.',
   6),
  (v_quiz9, 'A photographer charges ZMW 3,000 for a product shoot. AI cuts editing from 5 hours to 1 hour. The best business decision is:',
   '["Charge ZMW 600 (reflecting 1 hour of editing)", "Charge ZMW 3,000 and book 4–5 more shoots per week with the saved time", "Offer a ZMW 500 discount to every client to stay competitive", "Stop doing product photography since AI makes it less valuable"]', '{1}',
   'Maintain your price and reinvest the time savings into capacity. More shoots at the same rate equals more revenue.',
   7),
  (v_quiz9, 'You need to create 20 different social media captions for photos from a recent event. The most efficient approach is:',
   '["Write all 20 captions manually to ensure quality", "Use ChatGPT with a well-crafted prompt to generate drafts, then edit them for your voice", "Post photos without captions to save time", "Hire a copywriter for every caption"]', '{1}',
   'ChatGPT generates quality draft captions in seconds. A photographer''s role is to personalise and approve, not write from scratch.',
   8),
  (v_quiz9, 'Which AI tool is best suited for sharpening a blurry, high-ISO photo taken in low light at an indoor event?',
   '["Adobe Firefly", "Remove.bg", "Topaz Photo AI", "AfterShoot"]', '{2}',
   'Topaz Photo AI specialises in noise reduction and sharpening — exactly what is needed for technically compromised indoor event shots.',
   9),
  (v_quiz9, 'The mid-course project required you to process a full shoot using 5 AI tools. What was the primary purpose of this project?',
   '["To test your theoretical knowledge of AI concepts", "To apply all learned tools in a real-world workflow, building hands-on competence and confidence", "To create a portfolio piece for Zed AI Academy to use in marketing", "To compare AI tools and submit a review"]', '{1}',
   'The project is designed to move you from knowledge to competence by completing a real workflow end-to-end — the only way to truly internalise the skills.',
   10);

RAISE NOTICE '✓ Photography course created. Course ID: %', v_course_id;
RAISE NOTICE '  Open Creator Studio: /creator/courses/%', v_course_id;
RAISE NOTICE '  Next step: Add YouTube video IDs to each lesson using Creator Studio.';
RAISE NOTICE '  Modules: 9 | Lessons: 33 | Quizzes: 8 checkpoints + 1 final exam';

END $$;
