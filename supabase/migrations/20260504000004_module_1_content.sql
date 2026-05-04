-- ============================================================
-- Module 1 Content: What AI Photography Actually Is — The Foundation
-- ============================================================
-- Prerequisites: 20260504000003_course_skeleton.sql must be run first.
-- Idempotent: clears and rewrites content blocks for Module 1.
-- ============================================================

DO $$
DECLARE
  v_course_id uuid;
  v_mod_id    uuid;
  v_l1 uuid; v_l2 uuid; v_l3 uuid; v_l4 uuid; v_l5 uuid; v_lq uuid;
  v_quiz_id   uuid;
BEGIN

  SELECT id INTO v_course_id FROM courses WHERE slug = 'ai-photography-practical-course';
  IF v_course_id IS NULL THEN RAISE EXCEPTION 'Course not found. Run skeleton migration first.'; END IF;

  SELECT id INTO v_mod_id FROM modules WHERE course_id = v_course_id AND position = 1;
  SELECT id INTO v_l1 FROM lessons WHERE module_id = v_mod_id AND position = 1;
  SELECT id INTO v_l2 FROM lessons WHERE module_id = v_mod_id AND position = 2;
  SELECT id INTO v_l3 FROM lessons WHERE module_id = v_mod_id AND position = 3;
  SELECT id INTO v_l4 FROM lessons WHERE module_id = v_mod_id AND position = 4;
  SELECT id INTO v_l5 FROM lessons WHERE module_id = v_mod_id AND position = 5;
  SELECT id INTO v_lq FROM lessons WHERE module_id = v_mod_id AND position = 6;

  DELETE FROM content_blocks WHERE lesson_id IN (v_l1, v_l2, v_l3, v_l4, v_l5, v_lq);

  -- ── Lesson 1.1: What AI photography tools are ──────────────────────────
  INSERT INTO content_blocks (lesson_id, type, position, content) VALUES

  (v_l1, 'text', 1, '{"html": "<h2>Welcome to AI Photography</h2><p>Artificial intelligence has entered every stage of the photography workflow. But most photographers encounter it as a feature buried in a menu — a single button that does something impressive but unexplained. This module builds the mental model you need to use every AI tool confidently, not just instinctively.</p><p>AI photography tools are software applications that use machine learning models trained on large datasets of images to perform tasks that previously required manual human effort. They do not think. They do not see creatively. They are very sophisticated pattern-matchers that have seen millions of images and learned what good results look like.</p><p>This distinction matters because it sets the right expectations. AI will not make artistic decisions for you. It will execute technical tasks — noise reduction, subject selection, colour grading, background removal — with speed and consistency that would be impossible manually. Your creative direction, your knowledge of your clients, and your eye for light remain entirely yours."}'),

  (v_l1, 'comparison_table', 2, '{"title": "AI Tools vs Traditional Manual Workflow", "headers": ["Task", "Manual Method", "AI Method", "Time Saved"], "rows": [["Background removal", "Pen tool or lasso — 20-40 min/image", "Remove.bg or Photoshop AI — under 10 sec", "99%"], ["Photo culling", "Review every frame by eye — 2-3 hrs/shoot", "AfterShoot AI rating — 15-25 min/shoot", "80-90%"], ["Noise reduction", "Lightroom sliders — 3-5 min/image", "Topaz Photo AI — under 30 sec", "90%"], ["Colour grading", "Manual adjustments from scratch — 5-10 min/image", "AI preset + sync — under 2 min/image", "75%"], ["Object removal", "Clone stamp + careful masking — 10-30 min", "Firefly Generative Fill — under 1 min", "95%"]]}'),

  (v_l1, 'callout', 3, '{"variant": "important", "title": "The Golden Rule of AI Photography", "body": "AI is a time tool, not a taste tool. It handles the technical labour so you can spend more time on the creative decisions that clients actually pay you for. Never let AI make the final call on what looks good — that is your job."}'),

  (v_l1, 'key_takeaway', 4, '{"title": "Module 1 Lesson 1 — Key Points", "points": ["AI photography tools are pattern-matching engines, not creative intelligences. They execute technical tasks with speed and consistency.", "The five main categories of AI photography tools are: selection and masking, culling and sorting, enhancement and repair, colour grading, and generative editing.", "AI does not replace your creative eye or client relationships — it frees up the time those things deserve.", "Understanding what AI is doing (not just what button to press) makes you a better operator and troubleshooter."]}');

  -- ── Lesson 1.2: The 5-stage AI workflow ────────────────────────────────
  INSERT INTO content_blocks (lesson_id, type, position, content) VALUES

  (v_l2, 'text', 1, '{"html": "<h2>The AI-Assisted Photography Workflow</h2><p>A structured workflow is what separates photographers who use AI tools occasionally from those who have genuinely transformed their business. The five stages below map every step from leaving a shoot to delivering a finished gallery — and identify exactly where AI accelerates each stage.</p><p>The key insight is that AI tools in each stage build on the previous one. If you rush through culling, you waste time enhancing images you will not deliver. If you enhance before grading, you may undo noise reduction with heavy colour processing. Sequence matters.</p>"}'),

  (v_l2, 'steps', 2, '{"title": "The 5-Stage AI-Assisted Workflow", "steps": [{"title": "Stage 1: Cull — Remove the Bad, Rank the Good", "body": "Import your RAW files into AfterShoot or use Lightroom AI ratings. Let the AI do the first pass: eliminating blurry shots, closed eyes, and obvious duplicates. Your job is to review the shortlist and make final creative selections. Target: a curated set of 15-25% of original frames."}, {"title": "Stage 2: Enhance — Fix Technical Problems", "body": "Run your selected RAWs through Topaz Photo AI for noise reduction, sharpening, and upscaling if needed. This is the repair stage — turn technically imperfect captures into clean, sharp files. Do this before colour grading so your grain-free files grade more accurately."}, {"title": "Stage 3: Retouch — Portrait-Specific Refinements", "body": "For portrait, wedding, or headshot work, apply Luminar Neo Portrait AI or Lightroom AI masking to retouch skin, eyes, and lighting. Use presets and profiles so retouching is consistent across a full gallery, not just one hero image."}, {"title": "Stage 4: Grade — Apply Your Creative Look", "body": "Apply your signature Lightroom preset as a starting point. Use AI colour grading or auto-grade to handle per-image exposure variations. Sync your main adjustments across the gallery. Spend individual time only on the images that still need it — typically 10-20% of the set."}, {"title": "Stage 5: Deliver — Export, Package, and Send", "body": "Export at the correct resolution and colour profile for the delivery medium (screen vs print). Use AI-assisted tools like Narrative Select or Pic-Time for gallery delivery, smart album creation, and automated client notifications."}]}'),

  (v_l2, 'comparison_table', 3, '{"title": "Workflow Time: Traditional vs AI-Assisted", "headers": ["Stage", "Traditional Time (200 images)", "AI-Assisted Time", "Saving"], "rows": [["Culling", "2.5 hours", "25 minutes", "83%"], ["Enhancement", "3+ hours (when done at all)", "30 minutes (batch)", "85%"], ["Retouching (portraits)", "1 hour (select images only)", "20 minutes", "67%"], ["Colour grading", "3 hours", "45 minutes", "75%"], ["Export and delivery", "45 minutes", "20 minutes", "56%"], ["TOTAL", "10+ hours", "2.5 hours", "75%"]]}'),

  (v_l2, 'key_takeaway', 4, '{"title": "The Workflow Principle", "points": ["Sequence is everything: Cull first, then enhance, then retouch, then grade. Doing these out of order multiplies your work.", "The goal of the AI workflow is a 4x reduction in post-production time while improving consistency.", "Beginners often skip enhancement entirely. AI makes it fast enough to do on every shoot.", "Your first AI workflow will take longer than usual. The second will be faster. By the fifth, it is muscle memory."]}');

  -- ── Lesson 1.3: Free vs paid toolkit ───────────────────────────────────
  INSERT INTO content_blocks (lesson_id, type, position, content) VALUES

  (v_l3, 'text', 1, '{"html": "<h2>Building Your AI Photography Toolkit</h2><p>You do not need to spend money on day one. The free tiers of most major AI photography tools are genuinely useful for learning and for handling moderate workloads. A professional earning from photography should budget for the paid tools that save the most time relative to their cost — typically culling, enhancement, and colour grading software.</p><p>This lesson maps every tool you will use in this course against its pricing, what the free tier covers, and when it makes financial sense to upgrade.</p>"}'),

  (v_l3, 'comparison_table', 2, '{"title": "Complete AI Photography Toolkit", "headers": ["Tool", "Purpose", "Free Tier", "Paid Price", "Priority"], "rows": [["Remove.bg", "Background removal", "50 low-res previews/month", "From $9/mo or credits", "High"], ["AfterShoot", "AI culling and album creation", "Limited — paid from day 1", "From $12/mo", "High"], ["Topaz Photo AI", "Denoise, sharpen, upscale", "Trial only", "From $199 one-time or $99/yr", "High"], ["Luminar Neo", "Portrait retouching and sky AI", "Trial only", "From $79/yr", "Medium"], ["Adobe Lightroom", "Full editing + AI features", "7-day trial", "From $10/mo (Photography plan)", "High if not subscribed"], ["Adobe Firefly (Photoshop)", "Generative fill and removal", "25 credits/month free", "Included in Photoshop plan", "Medium"], ["Midjourney", "AI image generation for concepts", "No free tier currently", "From $10/mo", "Medium"], ["Kling AI", "AI video from stills", "Daily free credits", "From $8/mo", "Low (advanced)"], ["Runway ML", "AI video generation", "Limited free tier", "From $12/mo", "Low (advanced)"], ["ChatGPT", "Business writing and prompts", "Free tier (GPT-3.5/4o mini)", "From $20/mo for GPT-4o", "High"]]}'),

  (v_l3, 'tool_spotlight', 3, '{"name": "Remove.bg", "description": "The fastest AI background removal tool. Upload any photo and receive a clean PNG cutout in under 5 seconds. Free tier gives unlimited low-resolution previews — good enough for social media. Full-resolution output requires credits (approximately $0.20 per image at volume rates).", "url": "https://www.remove.bg", "icon_url": ""}'),

  (v_l3, 'tool_spotlight', 4, '{"name": "Topaz Photo AI", "description": "The gold standard for AI noise reduction, sharpening, and upscaling. A one-time purchase (no subscription) makes it cost-effective for professionals. Processes RAW and JPEG. Integrates as a Lightroom plugin for one-click access from your existing workflow.", "url": "https://www.topazlabs.com/topaz-photo-ai", "icon_url": ""}'),

  (v_l3, 'tool_spotlight', 5, '{"name": "AfterShoot", "description": "AI-powered culling software that runs locally on your Mac or PC. Import a shoot, set your criteria (minimum sharpness, group similar shots, detect closed eyes), and AfterShoot rates every image and presents a curated shortlist. Reduces culling time by 80-90% for most photographers.", "url": "https://aftershoot.com", "icon_url": ""}'),

  (v_l3, 'callout', 6, '{"variant": "tip", "title": "Start Free — Upgrade When It Pays", "body": "Calculate your hourly rate. If a tool saves you 2 hours per shoot and you do 8 shoots per month, it saves 16 hours of time. If your hourly rate is $30, that tool is worth $480/month in time value. A $20/month subscription is an obvious investment at that point."}');

  -- ── Lesson 1.4: Your first AI experiment ───────────────────────────────
  INSERT INTO content_blocks (lesson_id, type, position, content) VALUES

  (v_l4, 'text', 1, '{"html": "<h2>Your First AI Experiment</h2><p>Reading about AI tools is useful. Doing it once is worth more than reading about it ten times. In this exercise you will take a single photograph and run it through three different AI tools — background removal, noise reduction, and AI colour grading. You will time each step and compare the results against what you would have done manually.</p><p>Choose a portrait or product photo from a recent shoot. Ideally one that has some technical imperfection — a little noise, a busy background, or flat colour. These imperfections make the AI results more dramatic and instructive.</p>"}'),

  (v_l4, 'checklist', 2, '{"title": "What You Need Before Starting", "items": ["A photo to work with — portrait, product, or headshot with a somewhat busy background", "A free Remove.bg account (no payment required for low-res preview)", "Topaz Photo AI trial installed (free download from topazlabs.com)", "Adobe Lightroom or Lightroom Classic installed", "A stopwatch or timer on your phone", "A note-taking app — you will record your times"]}'),

  (v_l4, 'steps', 3, '{"title": "The Three-Tool Experiment", "steps": [{"title": "Tool 1: Remove.bg — Background Removal", "body": "Upload your chosen photo to remove.bg. Start your timer when you click Upload and stop it when you download the PNG. Record the time. Compare the result to how long you estimate the same cut would take with a pen tool or manual selection. Note: check the edges around hair or fine detail and assess quality."}, {"title": "Tool 2: Topaz Photo AI — Noise Reduction and Sharpening", "body": "Open your original photo in Topaz Photo AI. Enable Autopilot mode — the tool analyses the image and applies recommended settings automatically. Start your timer when you click Process and stop it when the export completes. Open the before/after in your photo viewer and zoom to 100%. Record your assessment of the quality difference."}, {"title": "Tool 3: Lightroom AI Colour Grade — Auto and Preset", "body": "Import the photo into Lightroom. In the Develop module, click the magic wand icon (Auto) in the Basic panel. Record how long this takes. Then try applying a preset from the preset panel. Compare the auto-grade to your manual starting point. Record which approach you would typically have taken and how long it usually takes you."}, {"title": "Document Your Results", "body": "Record three numbers: time with AI (total for all three tools), your estimated manual time for the same three tasks, and your percentage time saving. Calculate: (manual time - AI time) / manual time x 100. Most photographers find this is between 70% and 90% on their first experiment."}]}'),

  (v_l4, 'ai_prompt', 4, '{"label": "Analyse Your Results with ChatGPT", "tool": "ChatGPT", "prompt": "I am a photographer who just ran my first AI editing experiment. Here are my results:\n\n- Background removal: AI took [X seconds]. Estimated manual time: [Y minutes]. AI quality: [describe]\n- Noise reduction: AI took [X minutes]. Estimated manual time: [Y minutes]. Quality improvement: [describe]\n- Colour grading: AI auto-grade took [X seconds]. My usual approach takes [Y minutes].\n\nBased on these numbers, calculate:\n1. How many hours per week I save if I do 5 shoots per month averaging 150 images each\n2. The monthly value of that time at my rate of [your hourly rate]\n3. Which tool gave me the biggest return on time invested\n4. What I should learn next to keep increasing efficiency"}');

  -- ── Lesson 1.5: Expert deep dive — neural networks ─────────────────────
  INSERT INTO content_blocks (lesson_id, type, position, content) VALUES

  (v_l5, 'text', 1, '{"html": "<h2>How AI Photography Tools Actually Work</h2><p>You do not need to understand neural networks to use AI photography tools effectively. But photographers who understand the principles behind the tools tend to use them more confidently, push them further, and troubleshoot failures more effectively.</p><p>Every AI photography tool you will use in this course — from Remove.bg to Topaz to Midjourney — is built on a class of machine learning model called a neural network. Specifically, most image AI uses <strong>convolutional neural networks (CNNs)</strong> or more recent architectures called <strong>transformers</strong>.</p>"}'),

  (v_l5, 'expert_note', 2, '{"title": "How Convolutional Neural Networks Process Images", "body": "A CNN processes an image by passing it through multiple layers. Each layer extracts progressively more abstract features:\n\nLayer 1 (Edge Detection): The network learns to identify basic edges — horizontal lines, vertical lines, diagonal lines at various angles. This layer has no understanding of what objects are; it simply detects contrast boundaries.\n\nLayer 2-3 (Shape Features): The network combines edges into simple shapes: corners, curves, circles. It is starting to recognise structural patterns but still has no concept of meaning.\n\nLayers 4-N (Semantic Features): These layers combine shapes into recognisable patterns: a round shape with two points above it becomes an ear. A connected series of curves becomes hair. The network is now recognising parts of objects.\n\nFinal Layer (Classification): The final layer makes a decision — this pixel belongs to the subject (foreground) or the background — based on everything learned in the previous layers.\n\nThis is why Remove.bg can separate fine hair from a complex background: it has been trained on millions of portrait images and its deep layers have learned what human hair looks like in enormous detail. It is not using a colour-matching algorithm; it understands the semantic meaning of what hair is.\n\nThis is also why AI fails on unusual inputs: a photographer in a white studio wearing a white jacket will confuse a model that has mostly seen subjects against distinctly different backgrounds. The model is doing pattern-matching, not reasoning — it cannot handle cases it has not seen in training."}'),

  (v_l5, 'key_takeaway', 3, '{"title": "What This Means for Your Practice", "points": ["AI tools fail predictably: they struggle most with cases that look different from their training data — unusual lighting, rare subject types, extreme angles.", "Better input images produce better AI results. AI amplifies quality; it rarely rescues fundamentally broken images.", "AI models improve over time as developers release updated versions trained on more data. The tool you use today will perform better in 12 months.", "Understanding training data helps you anticipate failures: if a tool was trained on North American and European portrait data, it may perform differently on skin tones it has seen less of. Check results carefully for your specific client base.", "You do not need to know the mathematics. You need to know: AI is a pattern-matcher. Give it patterns it has seen before and it performs excellently. Give it edge cases and check its work."]}');

  -- ── Module 1 Checkpoint Quiz ────────────────────────────────────────────
  DELETE FROM quizzes WHERE lesson_id = v_lq;
  INSERT INTO content_blocks (lesson_id, type, position, content) VALUES (v_lq, 'quiz', 1, '{"quiz_id": ""}');
  INSERT INTO quizzes (lesson_id, title, pass_threshold, max_attempts)
    VALUES (v_lq, 'Module 1: AI Photography Foundations', 70, 3) RETURNING id INTO v_quiz_id;
  UPDATE content_blocks SET content = jsonb_build_object('quiz_id', v_quiz_id::text)
    WHERE lesson_id = v_lq AND type = 'quiz';

  INSERT INTO quiz_questions (quiz_id, question, options, correct_indices, explanation, position) VALUES
    (v_quiz_id, 'Which best describes what an AI photography tool actually is?',
     '["A creative intelligence that makes artistic decisions", "A pattern-matching system trained on large image datasets to perform specific technical tasks", "A replacement for a human editor", "A cloud storage system for photos"]',
     '{1}', 'AI tools are sophisticated pattern-matching systems. They perform technical tasks (removal, enhancement, grading) based on patterns learned from training data — they do not make creative decisions.', 1),

    (v_quiz_id, 'In the correct AI-assisted workflow sequence, which stage comes first?',
     '["Colour grading", "Retouching", "Culling", "Enhancement"]',
     '{2}', 'Culling first reduces your image set to only the best frames. Enhancing or retouching images you will not deliver wastes time.', 2),

    (v_quiz_id, 'Why do AI background removal tools perform better when the subject has clear contrast against the background?',
     '["Higher contrast reduces the file size, making processing faster", "The tool uses colour threshold matching, which requires strong colour differences", "The model learned to identify subjects partly by their contrast with surroundings, so clear contrast matches patterns it has seen reliably in training", "Contrast improves the resolution of the exported PNG"]',
     '{2}', 'AI models use learned patterns, not simple algorithms. Clear contrast matches the high-confidence patterns from training data, producing more reliable results.', 3),

    (v_quiz_id, 'A photographer who earns ZMW 1,500 per shoot and spends 4 hours on post-production wants to use AI to reduce that to 1 hour. How should they change their pricing?',
     '["Lower the price to reflect less work", "Keep the same price and use the 3 hours saved to take on more shoots", "Charge extra for using AI tools", "Offer a discount to clients who do not want AI editing"]',
     '{1}', 'Your price reflects the value you deliver, not the hours you work. Using the saved time to increase capacity grows revenue without requiring a price change.', 4),

    (v_quiz_id, 'An AI noise reduction tool performs poorly on a type of camera or lighting setup it has not seen before. This is because:',
     '["The tool is broken and needs to be reinstalled", "AI models are pattern-matchers — inputs that differ significantly from training data produce weaker results", "The JPEG compression has destroyed too much information", "Free tier tools do not support all camera models"]',
     '{1}', 'AI failure is predictable and connected to training data. Unusual inputs (rare camera types, extreme lighting) fall outside well-trained patterns and produce weaker results.', 5);

  RAISE NOTICE '✓ Module 1 content loaded (5 lessons + quiz).';
END $$;
