# Database Schema — Zed AI Academy

Backed by Supabase (Postgres). All tables use Row Level Security (RLS). UUIDs for all primary keys.

---

## Core Tables

### `profiles`
Extends `auth.users` (one-to-one).
```sql
id            uuid PRIMARY KEY REFERENCES auth.users(id)
full_name     text
avatar_url    text
role          text DEFAULT 'learner'   -- learner | instructor | company_admin | super_admin
company_id    uuid REFERENCES companies(id) NULLABLE
bio           text
created_at    timestamptz DEFAULT now()
updated_at    timestamptz DEFAULT now()
```

### `companies`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
name          text NOT NULL
slug          text UNIQUE NOT NULL
logo_url      text
admin_id      uuid REFERENCES profiles(id)
created_at    timestamptz DEFAULT now()
```

### `company_members`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
company_id    uuid REFERENCES companies(id) ON DELETE CASCADE
profile_id    uuid REFERENCES profiles(id) ON DELETE CASCADE
status        text DEFAULT 'invited'  -- invited | active | deactivated
invited_at    timestamptz DEFAULT now()
joined_at     timestamptz
UNIQUE(company_id, profile_id)
```

---

## Course Tables

### `courses`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
slug            text UNIQUE NOT NULL
title           text NOT NULL
description     text
thumbnail_url   text
category        text
level           text        -- beginner | intermediate | advanced
instructor_id   uuid REFERENCES profiles(id)
status          text DEFAULT 'draft'  -- draft | published | archived
price_type      text DEFAULT 'free'   -- free | one_time | subscription_only | both
price_amount    numeric(10,2)         -- NULL if free or subscription_only
is_featured     boolean DEFAULT false
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

### `modules`
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
course_id   uuid REFERENCES courses(id) ON DELETE CASCADE
title       text NOT NULL
position    int NOT NULL
created_at  timestamptz DEFAULT now()
```

### `lessons`
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
module_id   uuid REFERENCES modules(id) ON DELETE CASCADE
title       text NOT NULL
position    int NOT NULL
is_preview  boolean DEFAULT false   -- free preview without enrollment
created_at  timestamptz DEFAULT now()
```

### `content_blocks`
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
lesson_id   uuid REFERENCES lessons(id) ON DELETE CASCADE
type        text NOT NULL   -- video | text | quiz | resource
position    int NOT NULL
content     jsonb NOT NULL  -- structure varies by type (see below)
created_at  timestamptz DEFAULT now()
```

**content JSONB by type:**
```json
// video
{ "youtube_id": "dQw4w9WgXcQ", "title": "Intro to Prompting" }

// text
{ "html": "<p>Rich text content...</p>" }

// quiz
{ "quiz_id": "uuid-of-quiz" }

// resource
{ "file_url": "...", "file_name": "prompt-cheatsheet.pdf", "file_size": 204800 }
```

---

## Quiz Tables

### `quizzes`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
lesson_id       uuid REFERENCES lessons(id) ON DELETE CASCADE
title           text
pass_threshold  int DEFAULT 70      -- percentage
max_attempts    int DEFAULT 0       -- 0 = unlimited
created_at      timestamptz DEFAULT now()
```

### `quiz_questions`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
quiz_id         uuid REFERENCES quizzes(id) ON DELETE CASCADE
question        text NOT NULL
options         jsonb NOT NULL      -- ["option A", "option B", ...]
correct_indices int[] NOT NULL      -- [0] for single, [0,2] for multi
explanation     text
position        int NOT NULL
```

### `quiz_attempts`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
quiz_id         uuid REFERENCES quizzes(id)
user_id         uuid REFERENCES profiles(id)
answers         jsonb NOT NULL      -- { "question_id": [selected_indices] }
score           int NOT NULL        -- percentage 0-100
passed          boolean NOT NULL
created_at      timestamptz DEFAULT now()
```

---

## Learning Progress Tables

### `enrollments`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id         uuid REFERENCES profiles(id)
course_id       uuid REFERENCES courses(id)
enrolled_at     timestamptz DEFAULT now()
completed_at    timestamptz
source          text   -- individual_purchase | subscription | company_seat | gift
order_id        uuid REFERENCES orders(id) NULLABLE
UNIQUE(user_id, course_id)
```

### `lesson_progress`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id         uuid REFERENCES profiles(id)
lesson_id       uuid REFERENCES lessons(id)
completed       boolean DEFAULT false
completed_at    timestamptz
UNIQUE(user_id, lesson_id)
```

### `bookmarks`
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id     uuid REFERENCES profiles(id)
lesson_id   uuid REFERENCES lessons(id)
created_at  timestamptz DEFAULT now()
UNIQUE(user_id, lesson_id)
```

### `notes`
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id     uuid REFERENCES profiles(id)
lesson_id   uuid REFERENCES lessons(id)
content     text NOT NULL
updated_at  timestamptz DEFAULT now()
UNIQUE(user_id, lesson_id)
```

### `certificates`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id         uuid REFERENCES profiles(id)
course_id       uuid REFERENCES courses(id)
issued_at       timestamptz DEFAULT now()
file_url        text        -- Supabase Storage path
public_id       text UNIQUE -- for shareable verification URL
UNIQUE(user_id, course_id)
```

---

## Payments & Subscriptions

### `orders`
```sql
id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id             uuid REFERENCES profiles(id)
course_id           uuid REFERENCES courses(id) NULLABLE   -- NULL for subscription orders
company_id          uuid REFERENCES companies(id) NULLABLE
amount              numeric(10,2) NOT NULL
currency            text DEFAULT 'ZMW'
status              text DEFAULT 'pending'   -- pending | paid | failed | refunded
payment_reference   text    -- processor's transaction ID
payment_method      text    -- mtn_momo | airtel_money | card
created_at          timestamptz DEFAULT now()
paid_at             timestamptz
```

### `subscriptions`
```sql
id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id             uuid REFERENCES profiles(id) NULLABLE
company_id          uuid REFERENCES companies(id) NULLABLE
plan                text NOT NULL   -- pro_monthly | pro_annual | company_starter | company_growth
status              text DEFAULT 'active'   -- active | cancelled | expired | past_due
seat_count          int DEFAULT 1
current_period_start timestamptz
current_period_end  timestamptz
processor_sub_id    text    -- processor's subscription ID
created_at          timestamptz DEFAULT now()
```

### `company_seat_allocations`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
subscription_id uuid REFERENCES subscriptions(id)
company_id      uuid REFERENCES companies(id)
profile_id      uuid REFERENCES profiles(id)
allocated_at    timestamptz DEFAULT now()
revoked_at      timestamptz
UNIQUE(subscription_id, profile_id)
```

---

## RLS Policy Summary

| Table | Learner reads | Learner writes | Instructor reads | Instructor writes | Admin |
|---|---|---|---|---|---|
| profiles | own row | own row | any | — | any |
| courses | published only | — | own courses | own courses | any |
| enrollments | own rows | — | their course enrollments | — | any |
| lesson_progress | own rows | own rows | — | — | any |
| quiz_attempts | own rows | own rows | their course attempts | — | any |
| orders | own rows | — | — | — | any |

All writes that need elevated privilege (e.g., creating an enrollment after payment) go through a Supabase Edge Function or Next.js API route using the service role key server-side.

---

## Indexes (Performance)

```sql
CREATE INDEX ON courses(status, category);
CREATE INDEX ON courses(instructor_id);
CREATE INDEX ON modules(course_id, position);
CREATE INDEX ON lessons(module_id, position);
CREATE INDEX ON content_blocks(lesson_id, position);
CREATE INDEX ON enrollments(user_id);
CREATE INDEX ON enrollments(course_id);
CREATE INDEX ON lesson_progress(user_id, lesson_id);
CREATE INDEX ON quiz_attempts(user_id, quiz_id);
CREATE INDEX ON orders(user_id);
CREATE INDEX ON company_members(company_id);
```
