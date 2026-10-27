-- Assertions for the demo seed. Each query prints one row: check name and actual count.
-- Expected values are noted per row; the caller compares them.
select 'course_by_slug' as check, count(*) as n from courses where slug = 'zai-tutor-showcase'
union all select 'course_free_published', count(*) from courses where slug = 'zai-tutor-showcase' and price_type = 'free' and status = 'published'
union all select 'modules', count(*) from modules where course_id = '7a1e0000-0000-4000-8000-000000000201'
union all select 'lessons', count(*) from lessons l join modules m on m.id = l.module_id where m.course_id = '7a1e0000-0000-4000-8000-000000000201'
union all select 'content_blocks_total', count(*) from content_blocks cb join lessons l on l.id = cb.lesson_id join modules m on m.id = l.module_id where m.course_id = '7a1e0000-0000-4000-8000-000000000201'
union all select 'tutor_session_blocks', count(*) from content_blocks cb join lessons l on l.id = cb.lesson_id join modules m on m.id = l.module_id where m.course_id = '7a1e0000-0000-4000-8000-000000000201' and cb.type = 'tutor_session'
union all select 'platform_scenarios_published', count(*) from practice_scenarios where visibility = 'platform' and status = 'published' and company_id = 'org_zedai'
union all select 'personas', count(*) from ai_personas where company_id = 'org_zedai'
union all select 'tutor_blocks_point_at_existing_scenario', count(*) from content_blocks cb join practice_scenarios ps on ps.id = (cb.content->>'scenarioId')::uuid where cb.type = 'tutor_session' and ps.status = 'published'
union all select 'tutor_blocks_persona_linked', count(*) from content_blocks cb join practice_scenarios ps on ps.id = (cb.content->>'scenarioId')::uuid join ai_personas p on p.id = ps.persona_id where cb.type = 'tutor_session'
union all select 'tutor_blocks_not_required', count(*) from content_blocks cb where cb.type = 'tutor_session' and (cb.content->>'required')::boolean = false and cb.content->>'style' = 'scene'
union all select 'bogus_type_rejected', case when exists (select 1 from pg_constraint c where c.conname = 'content_blocks_type_check' and pg_get_constraintdef(c.oid) like '%tutor_session%') then 1 else 0 end;
