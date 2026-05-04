DO $$
DECLARE
  v_course_id uuid;
  v_mod_id    uuid;
  v_l1 uuid; v_lq uuid;
  v_quiz_id   uuid;
BEGIN
  SELECT id INTO v_course_id FROM courses WHERE slug = 'ai-photography-practical-course';
  SELECT id INTO v_mod_id FROM modules WHERE course_id = v_course_id AND position = 11;
  SELECT id INTO v_l1 FROM lessons WHERE module_id = v_mod_id AND position = 1;
  SELECT id INTO v_lq FROM lessons WHERE module_id = v_mod_id AND position = 2;

  DELETE FROM content_blocks WHERE lesson_id IN (v_l1, v_lq);

  -- ─── L11.1: Course Review ─────────────────────────────────────────────────
  INSERT INTO content_blocks (lesson_id, type, position, content) VALUES
  (v_l1,'text',1,'{"html":"<h2>Course Review: Everything You Now Know</h2><p>You have covered the complete AI photography workflow — from first principles to business strategy. Before you sit the Final Exam, this lesson consolidates the key insights from all ten modules into a single reference you can return to after the course.</p><p>This is not a quiz — it is a map. Read through it, note what feels solid, and revisit any module lesson where you feel uncertain before attempting the exam.</p>"}'),
  (v_l1,'key_takeaway',2,'{"points":["Module 1 — Foundation: AI photography is about using intelligent tools at every stage of the workflow, from capture settings to final delivery. The AI photograph is 20% capture and 80% informed post-production decisions.","Module 2 — Background Removal: Professional-quality isolation requires the right tool for the edge complexity. Photoshop AI for complex edges; remove.bg and Canva AI for speed; Luminar Neo for natural-edge subjects.","Module 3 — Smart Culling: AI culling eliminates 60–80% of the manual culling workload. Tools like Imagen AI score on technical quality + face expression — combine AI scores with your own creative judgment.","Module 4 — AI Enhancement: Noise reduction (Lightroom Denoise, Topaz DeNoise AI) and AI-powered masking (Lightroom Subject/Sky masks) are the two highest-ROI tools in the modern editing workflow.","Module 5 — Portrait Retouching: Frequency separation separates texture from tone. AI skin tools (Luminar Neo, Photoshop Neural Filters) work on the tone layer. Always preserve real skin texture for print work.","Module 6 — Colour Grading: Colour grade communicates emotion. Build a grade in two stages: technical correction (white balance, exposure) then creative grade (curve shape, split tone, HSL). Export as Lightroom preset.","Module 7 — Generative AI: Adobe Firefly for commercially-safe fill and removal. Luminar Neo Sky AI for sky replacement. Midjourney for concept boards. Always disclose AI-generated content per your client contract policy.","Module 8 — Mid-Course Project: Your project is your portfolio piece. The combination of technical execution and written process notes demonstrates professional-level thinking.","Module 9 — Advanced Tools: AI video from stills (Kling AI, Runway) unlocks a new revenue stream. HDR merging, portrait relighting, drone enhancement, and print optimisation complete the advanced technical toolkit.","Module 10 — Business: AI editing enables faster delivery AND higher quality — the combination that justifies premium pricing. Build retainer agreements, a social media content machine, and diversified revenue streams.","Module 11 — You are here. Attempt the Final Exam when you feel ready. 75% is the passing threshold. You have 2 attempts."]}'),
  (v_l1,'comparison_table',3,'{"headers":["Tool","Primary Use","Module"],"rows":[["Lightroom Denoise","AI noise reduction in RAW","4"],["Lightroom Subject/Sky Mask","AI-powered masking for targeted adjustments","4"],["Imagen AI","AI culling and star rating","3"],["Photoshop Remove Background","Subject isolation for complex edges","2"],["Photoshop Generative Fill","Object removal and canvas extension","7"],["Luminar Neo Sky AI","Sky replacement with foreground relighting","7"],["Luminar Neo Portrait AI","Skin retouching, teeth, eyes","5"],["Topaz DeNoise AI","Extreme noise reduction, fine hair detail","4"],["Topaz Gigapixel AI","AI upscaling for print","9"],["Adobe Firefly","Commercially-licensed generative AI","7"],["Midjourney","Client concept boards, pre-visualisation","7"],["Kling AI","Image-to-video animation","9"],["Runway ML","Image-to-video with camera motion control","9"],["Lightroom Batch Export","Automated client delivery at scale","10"]]}'),
  (v_l1,'callout',4,'{"type":"info","title":"Final Exam Rules","body":"The Final Exam has 15 questions drawn from all 10 content modules. Passing score: 75% (11/15). You have 2 attempts. If you do not pass on your second attempt, contact your instructor — additional review support is available. Your score and a digital certificate of completion are issued immediately upon passing."}'),
  (v_l1,'checklist',5,'{"items":["Reviewed all 10 module summaries above","Revisited any module lesson where you felt uncertain","Submitted your mid-course project (Module 8) — the exam does not require this but the project prepares you for the applied questions","Ready to attempt the Final Exam"]}'  );

  -- ─── L11.Q: Final Exam ────────────────────────────────────────────────────
  DELETE FROM quizzes WHERE lesson_id = v_lq;
  INSERT INTO content_blocks (lesson_id, type, position, content)
  VALUES (v_lq, 'quiz', 1, '{"quiz_id": ""}');

  INSERT INTO quizzes (
    lesson_id, title, description, passing_score, max_attempts
  ) VALUES (
    v_lq,
    'Final Exam — AI Photography Practical Course',
    'The Final Exam covers all 10 modules. 15 questions. Passing score: 75% (11/15 correct). You have 2 attempts. A digital certificate is issued immediately upon passing.',
    75,
    2
  ) RETURNING id INTO v_quiz_id;

  UPDATE content_blocks
  SET content = jsonb_build_object('quiz_id', v_quiz_id::text)
  WHERE lesson_id = v_lq AND type = 'quiz';

  -- 15 questions across all modules
  INSERT INTO quiz_questions (quiz_id, question, type, options, correct_answer, explanation, position) VALUES
  -- Q1 (Module 1 — Foundation)
  (v_quiz_id,
   'Which file format retains all original sensor data without in-camera processing, giving AI tools the most information to work with during editing?',
   'multiple_choice',
   '["JPEG","TIFF","RAW","PNG"]',
   'RAW',
   'RAW files store unprocessed sensor data with 12–14 bit depth. JPEG is processed and compressed in-camera, discarding data. RAW gives AI editing tools (Lightroom Denoise, AI masks, HDR merge) far more tonal and colour information to work with.',
   1),
  -- Q2 (Module 2 — Background Removal)
  (v_quiz_id,
   'For a product shot requiring background removal where the product has fine metallic mesh edges, which tool gives the most accurate result?',
   'multiple_choice',
   '["Canva Magic Erase","remove.bg auto-remove","Photoshop AI Select Subject + Refine Edge in high-contrast mode","Luminar Neo Background Removal"]',
   'Photoshop AI Select Subject + Refine Edge in high-contrast mode',
   'Fine metallic mesh is one of the most complex edge cases for background removal. Photoshop''s Refine Edge with the Decontaminate Colours option and manual Edge Detection radius gives the most precise control over semi-transparent or fine-detail edges.',
   2),
  -- Q3 (Module 3 — Culling)
  (v_quiz_id,
   'An AI culling tool gives a sharp, well-exposed portrait a score of 40/100 because the subject''s eyes are slightly closed. You think the expression is the most authentic of the shoot. What should you do?',
   'multiple_choice',
   '["Reject the image — the AI knows best","Select the image anyway — AI scores technical quality; you judge creative intent","Re-shoot the session to get a better AI score","Lower the AI sharpness sensitivity setting to accept more images"]',
   'Select the image anyway — AI scores technical quality; you judge creative intent',
   'AI culling tools score objective technical quality. Creative judgment — expression, moment, emotion — is yours. Override AI scores when your creative eye identifies something the algorithm cannot evaluate. The AI is your assistant, not your editor-in-chief.',
   3),
  -- Q4 (Module 4 — Enhancement)
  (v_quiz_id,
   'Lightroom''s Denoise slider processes your RAW file using AI. At what point in the editing workflow should you apply Denoise?',
   'multiple_choice',
   '["After all other adjustments, as the final step before export","Before other adjustments — Denoise first, then grade and retouch on the clean file","Only after exporting to JPEG","At the same time as sharpening, using the same slider"]',
   'Before other adjustments — Denoise first, then grade and retouch on the clean file',
   'Denoising first gives subsequent adjustments — exposure, contrast, colour, sharpening, masking — a clean base to work on. Denoising after colour grading can flatten the grade or create inconsistencies in the noise pattern relative to the adjustments applied.',
   4),
  -- Q5 (Module 5 — Portrait Retouching)
  (v_quiz_id,
   'In frequency separation retouching, what does the High Frequency layer contain, and why is it important to preserve it?',
   'multiple_choice',
   '["Colour and tone — the overall skin colour is stored here","Texture detail — pores, fine lines, hair; preserving it keeps the skin looking real","Shadows and highlights — the 3D shape of the face","A backup copy of the original pixel data"]',
   'Texture detail — pores, fine lines, hair; preserving it keeps the skin looking real',
   'In frequency separation, the High Frequency layer holds texture (pores, fine lines, hair strands) while the Low Frequency layer holds colour and tone. Retouching is done on the Low layer. Preserving the High layer unmodified ensures skin retains authentic texture instead of looking plastic or airbrushed.',
   5),
  -- Q6 (Module 5 — Portrait Retouching)
  (v_quiz_id,
   'Luminar Neo''s Skin AI tool detects and smooths only skin areas. After applying it at 60%, a client says the result looks "too perfect" and wants a more natural look. What is the correct adjustment?',
   'multiple_choice',
   '["Increase the Skin AI slider further to make it more consistent","Reduce the Skin AI slider to a lower amount (20–30%) or use the Amount mask to reduce effect in texture-rich areas","Undo and retouch manually without AI","Apply Texture slider in the opposite direction to counteract the smoothing"]',
   'Reduce the Skin AI slider to a lower amount (20–30%) or use the Amount mask to reduce effect in texture-rich areas',
   '"Too perfect" is almost always too much skin smoothing. The correct response is less, not more. Reduce the overall slider or paint the Amount mask lower in high-texture areas (cheeks, nose, forehead) while retaining smoothing in lower-texture zones (under eyes, forehead centre).',
   6),
  -- Q7 (Module 6 — Colour Grading)
  (v_quiz_id,
   'What is the purpose of split toning in a colour grade, and what is a common professional technique?',
   'multiple_choice',
   '["It corrects white balance errors caused by mixed lighting","It adds a different hue to shadows and highlights to create mood — commonly warm shadows with cool highlights or vice versa","It converts the image to black and white while preserving colour information","It synchronises colour grades across multiple images in a batch"]',
   'It adds a different hue to shadows and highlights to create mood — commonly warm shadows with cool highlights or vice versa',
   'Split toning (now Colour Grading in Lightroom) adds hue/saturation to the shadow, midtone, and highlight ranges independently. Warm shadows (amber/orange) with cool highlights (teal/blue) is the classic cinematic look used in commercial and wedding photography.',
   7),
  -- Q8 (Module 7 — Generative AI)
  (v_quiz_id,
   'You use Photoshop Generative Fill to remove a logo from a building wall in an architectural shoot for a real estate client. The fill is seamless. Is disclosure required?',
   'multiple_choice',
   '["No — object removal is standard editing, like removing a blemish from skin","Yes — any use of generative AI must be disclosed regardless of context","It depends on the client contract and the nature of the use. For a commercial real estate listing, removing permanent architectural features may require disclosure or client approval.","Only if the building is a listed or heritage structure"]',
   'It depends on the client contract and the nature of the use. For a commercial real estate listing, removing permanent architectural features may require disclosure or client approval.',
   'Removing a permanent feature of a property (not a temporary obstruction) in a commercial listing could misrepresent the property. This falls in the Tier 2 disclosure category — recommend checking with the client and your contract. Removing a temporary skip or rubbish bin is different from removing a permanent structural element.',
   8),
  -- Q9 (Module 7 — Generative AI)
  (v_quiz_id,
   'Which of the following best describes the professional use case for Midjourney in a photography business?',
   'multiple_choice',
   '["Generating images to sell as stock photography under your name","Creating client concept boards and mood boards before a shoot for pre-visualisation","Replacing location scouting by generating the location you want","Building a portfolio without shooting"]',
   'Creating client concept boards and mood boards before a shoot for pre-visualisation',
   'Midjourney''s legitimate photography business use is pre-shoot client communication: showing clients what lighting, colour, and composition direction you are proposing before the shoot. Using AI-generated images as photographs, stock, or portfolio work misrepresents the images and potentially violates platform terms.',
   9),
  -- Q10 (Module 8 — Project)
  (v_quiz_id,
   'The Mid-Course Project submission requires a before/after comparison at 100% crop for the portrait retouch task. Why is 100% crop specified rather than a full-image comparison?',
   'multiple_choice',
   '["Because 100% crop files are smaller and easier to upload","To demonstrate that the AI retouching preserved authentic skin texture at full resolution — where print-quality concerns are evaluated","Because the full image comparison is already covered in other tasks","To check that the correct image was submitted"]',
   'To demonstrate that the AI retouching preserved authentic skin texture at full resolution — where print-quality concerns are evaluated',
   'At viewing size, many skin retouching issues are invisible. At 100% crop (1:1 pixel view), over-smoothing, plastic skin texture, and frequency separation artefacts become visible. This is the standard quality check for print-quality portrait retouching.',
   10),
  -- Q11 (Module 9 — Advanced Tools)
  (v_quiz_id,
   'You are using Kling AI to animate a landscape photograph for an Instagram Reel for a hospitality client. The landscape has a waterfall and trees. Which motion intensity and duration settings give the most professional result?',
   'multiple_choice',
   '["High intensity, 10 seconds — maximum drama for social media","Low intensity (2–3), 5 seconds — subtle natural motion reads as cinematic life","Medium intensity, 10 seconds — balances drama and realism","High intensity, 3 seconds — short and punchy"]',
   'Low intensity (2–3), 5 seconds — subtle natural motion reads as cinematic life',
   'Natural elements (waterfall flow, tree sway) at low intensity remain photorealistic. High intensity distorts the landscape into an obviously AI-animated look. 5 seconds is ideal for Instagram Reels loops. Longer clips expose artefacts in AI video at this quality level.',
   11),
  -- Q12 (Module 9 — Advanced Tools)
  (v_quiz_id,
   'For a professional print lab submission, what is the correct export combination for maximum quality?',
   'multiple_choice',
   '["JPEG Quality 80, sRGB, 72 DPI","TIFF 16-bit, lab ICC profile (or sRGB), 300 DPI, output sharpening for media type","PNG maximum quality, AdobeRGB, 300 DPI","JPEG Quality 100, AdobeRGB, 150 DPI"]',
   'TIFF 16-bit, lab ICC profile (or sRGB), 300 DPI, output sharpening for media type',
   'TIFF 16-bit preserves maximum tonal range without compression. The lab ICC profile (or sRGB if not provided) ensures colour accuracy. 300 DPI is the standard print resolution. Output sharpening compensates for the softening that occurs when printing.',
   12),
  -- Q13 (Module 10 — Business)
  (v_quiz_id,
   'A client asks for a rush delivery of 100 edited event images within 6 hours of the shoot ending. Your AI workflow can achieve this. How should you price it?',
   'multiple_choice',
   '["Same as standard price — you want to build goodwill with this client","Decline — 6 hours is not a credible professional promise","Apply a Rush surcharge (50–100%) on top of your standard event rate — speed is a premium service","Offer a discount because it keeps the shoot day and delivery on the same invoice"]',
   'Apply a Rush surcharge (50–100%) on top of your standard event rate — speed is a premium service',
   'Rush delivery has real value to the client (same-day social media posting, same-day internal sharing). Your AI workflow makes it operationally feasible — the surcharge reflects the client''s urgency, not your effort. Underpricing rush work trains clients to expect it for free.',
   13),
  -- Q14 (Module 10 — Business)
  (v_quiz_id,
   'When writing a social media caption for LinkedIn about a corporate headshot session, which tone is most appropriate?',
   'multiple_choice',
   '["Casual and emoji-heavy — LinkedIn is social media","Professional narrative highlighting the business value of quality headshots for team credibility","The same caption used for Instagram, adapted with different hashtags","A technical description of the lighting setup used in the shoot"]',
   'Professional narrative highlighting the business value of quality headshots for team credibility',
   'LinkedIn''s audience responds to professional, value-focused content. A caption that connects headshot photography to business outcomes (first impressions, team credibility, client trust) performs better than a technical or casual post on this platform.',
   14),
  -- Q15 (Cross-module — Synthesis)
  (v_quiz_id,
   'A photographer completes this course and wants to position themselves as an "AI photography specialist" in Lusaka. Which combination of capabilities best defines this positioning to a corporate client?',
   'multiple_choice',
   '["Ability to generate images using Midjourney and other AI art tools","Fast delivery (AI culling + editing workflow), high quality (AI noise reduction, retouching, grading), and transparent AI disclosure policies that protect the client commercially","Ownership of the most expensive AI software subscriptions available","Specialisation in AI-generated images for advertising campaigns"]',
   'Fast delivery (AI culling + editing workflow), high quality (AI noise reduction, retouching, grading), and transparent AI disclosure policies that protect the client commercially',
   'The AI photography specialist value proposition to a corporate client is a combination of speed, quality, and professional integrity. Generative AI tools (Midjourney) are a small part of the offering — the operational advantage (fast turnaround) and professional standards (disclosure, commercial safety) are what corporate clients actually pay a premium for.',
   15);

  RAISE NOTICE '✓ Module 11 (Final Exam) content loaded — course complete.';
END $$;
