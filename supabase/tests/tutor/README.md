# ZAI Tutor RLS tests (local only)

**Never run these against the production or any shared Supabase database.** They create stub
`auth`/`storage` schemas and grant broad privileges inside a transaction that is rolled back.

Run on a throwaway local Postgres 16:

```bash
createdb zai_tutor_test
psql -v ON_ERROR_STOP=1 -d zai_tutor_test -f supabase/tests/tutor/00_stubs.sql
psql -v ON_ERROR_STOP=1 -d zai_tutor_test -f supabase/tests/tutor/01_baseline.sql
psql -v ON_ERROR_STOP=1 -d zai_tutor_test -f supabase/migrations/20261101000000_zai_tutor.sql
psql -v ON_ERROR_STOP=1 -d zai_tutor_test -f supabase/migrations/20261101000000_zai_tutor.sql   # idempotency
psql -v ON_ERROR_STOP=1 -d zai_tutor_test -f supabase/tests/tutor/rls_test.sql                 # expect only PASS notices
dropdb zai_tutor_test
```

`01_baseline.sql` is a minimal stand-in for the production tables the migration references (the
historical migration chain can't be replayed from scratch). It is not the real production schema.
