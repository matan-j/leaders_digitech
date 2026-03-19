# CLAUDE.md — Leader App
> קובץ זה נטען אוטומטית על ידי Claude Code בכל פתיחה של הפרויקט.
> מכיל את כל הקונטקסט הנדרש לפני כל משימה.

---

## Stack & Infrastructure

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind CSS |
| UI Components | shadcn/ui |
| Backend | Supabase (PostgreSQL + Auth + REST + RLS) |
| Edge Functions | Supabase Edge Functions (Deno runtime) |
| Hosting | Vercel (SPA fallback configured) |
| Email | Brevo API (`https://api.brevo.com/v3/smtp/email`) |

**Environment Variables:**
- Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
- Edge Functions: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (auto-injected by Supabase)
- Edge Functions: `BREVO_API_KEY` (set manually in Supabase dashboard)

---

## Project Structure

```
src/
  pages/
    Index.tsx              → renders <Dashboard /> component
    Auth.tsx               → login / signup
    Calendar.tsx           → lesson calendar
    CourseAssignments.tsx  → course instance management (admin + instructor view)
    Courses.tsx            → course templates management
    LessonReport.tsx       → submit / view lesson reports
    Reports.tsx            → management reports (admin + PM only)
    Rewards.tsx            → instructor rewards
    Profile.tsx            → user profile
    AdminSettings.tsx      → system settings (admin + PM only)
    VerifyPage.tsx         → email verification
    NotFound.tsx           → 404
  components/
    auth/
      AuthProvider.tsx     → AuthContext, useAuth hook, signIn/signOut/signUp/resetPassword
      ProtectedRoute.tsx   → role-based route guard
    layout/
      Navigation.tsx       → desktop + mobile nav, role-based menu items
      MobileNavigation.tsx → mobile bottom nav
    dashboard/
      Dashboard.tsx        → main dashboard (role-aware)
    ui/
      DeleteConfirmationPopup.tsx
      Pagination.tsx
      [shadcn components]
  integrations/
    supabase/
      client.ts            → supabase client instance
  utils/
    scheduleUtils.ts       → fetchCombinedSchedules()
    schoolTypeUtils.ts     → getSchoolTypeDisplayName(), getSchoolTypeColors()
  services/
    apiService.ts          → hideCourseInstance() and other API calls
supabase/
  functions/
    _shared/
      cors.ts              → shared CORS headers
    notify-admins-low-attendance/index.ts
    notify-admins-incomplete-tasks/index.ts
    notify-admins-on-feedback/index.ts
    delete-user/index.ts
    postpone-schedule/index.ts
    test-cors/index.ts
  migrations/              → SQL migration files (chronological)
```

---

## What This System Does

Leader App is an **operational, pedagogical, and business management platform**
for training companies and educational institutions managing instructors in the field.

Replaces manual spreadsheets, WhatsApp groups, and scattered tracking with a
centralized control layer for: lesson execution, instructor performance, attendance,
media, salary, client billing, rewards, and sales pipeline.

---

## Core Data Hierarchy

**Every feature, query, migration, and screen must align with this:**

```
Institution (educational_institutions)
  └── course_instances  ← the central entity (Course × Institution × Instructor)
        ├── course_id       → courses
        ├── instructor_id   → profiles
        ├── institution_id  → educational_institutions
        ├── start_date / end_date
        ├── price_for_customer
        ├── price_for_instructor
        ├── max_participants
        ├── days_of_week[]
        ├── schedule_pattern (JSONB)
        ├── lesson_mode: 'template' | 'custom_only' | 'combined'
        └── is_visible (bool)
              └── lessons (via course_id or course_instance_id)
                    ├── order_index
                    └── lesson_tasks
                          └── lesson_reports
                                ├── instructor_id
                                ├── reported_by
                                ├── is_completed
                                ├── completed_task_ids[]
                                └── reported_lesson_instances
                                      ├── lesson_schedule_id
                                      ├── course_instance_id
                                      └── lesson_id
```

---

## Database Tables (Real Schema)

### `profiles`
```sql
id                  UUID (FK → auth.users)
role                user_role ENUM ('admin', 'pedagogical_manager', 'instructor')
full_name           TEXT
email               TEXT
birthdate           DATE
current_work_hours  INTEGER DEFAULT 0
benefits            TEXT
```
RLS: users SELECT/UPDATE own row. Admins see all.

---

### `courses`
Course templates — not tied to institution or instructor.
```sql
id                  UUID PK
name                TEXT
school_type         TEXT
presentation_link   TEXT
program_link        TEXT
is_visible          BOOLEAN
```
RLS: SELECT all authenticated. INSERT/UPDATE/DELETE: admin or pedagogical_manager only.

---

### `course_instances`
Course assignment = Course × Institution × Instructor. **Central entity.**
```sql
id                   UUID PK
course_id            UUID FK → courses
instructor_id        UUID FK → profiles
institution_id       UUID FK → educational_institutions
price_for_customer   NUMERIC
price_for_instructor NUMERIC
max_participants     INTEGER
start_date           DATE
end_date             DATE
days_of_week         INTEGER[]
schedule_pattern     JSONB
lesson_mode          TEXT ('template' | 'custom_only' | 'combined')
is_visible           BOOLEAN
created_at           TIMESTAMPTZ
```

---

### `course_instance_schedules`
```sql
id                      UUID PK
course_instance_id      UUID FK → course_instances (CASCADE DELETE)
days_of_week            INTEGER[]
time_slots              JSONB  -- [{"day": 0, "start_time": "09:00", "end_time": "10:30"}]
total_lessons           INTEGER
lesson_duration_minutes INTEGER
created_at / updated_at TIMESTAMPTZ
```

---

### `lessons`
```sql
id                  UUID PK
course_id           UUID FK → courses
course_instance_id  UUID FK → course_instances (nullable — null = template lesson)
title               TEXT
order_index         INTEGER DEFAULT 0
created_at          TIMESTAMPTZ
```
Lesson modes:
- `template`: use lessons where `course_instance_id IS NULL`
- `custom_only`: use lessons where `course_instance_id = instance.id`
- `combined`: use both, sorted by order_index

---

### `lesson_tasks`
```sql
id                  UUID PK
lesson_id           UUID FK → lessons
title               TEXT
description         TEXT
estimated_duration  INTEGER
is_mandatory        BOOLEAN
order_index         INTEGER
```

---

### `lesson_reports`
```sql
id                  UUID PK
instructor_id       UUID FK → profiles       -- lesson belongs to this instructor
reported_by         UUID FK → auth.users     -- who submitted (may differ if admin)
is_completed        BOOLEAN DEFAULT true     -- did lesson actually happen?
completed_task_ids  UUID[] DEFAULT '{}'      -- which tasks were completed
is_lesson_ok        BOOLEAN
created_at          TIMESTAMPTZ
```
RLS:
- admin/PM: full CRUD
- instructor: own rows only (instructor_id = auth.uid() OR reported_by = auth.uid())

---

### `reported_lesson_instances`
Join table between lesson_reports and schedules.
```sql
lesson_schedule_id   UUID
course_instance_id   UUID
lesson_id            UUID
```

---

### `educational_institutions`
```sql
id    UUID PK
name  TEXT
```

---

### `blocked_dates`
```sql
id          UUID PK
date        DATE
start_date  DATE
end_date    DATE
```
RLS: SELECT all authenticated. ALL ops: admin only.

---

### Storage Bucket: `lesson-files`
Public bucket. Upload: any authenticated user. Delete: uploader only.

---

## Auth System

### `AuthProvider` (`src/components/auth/AuthProvider.tsx`)
- Wraps entire app
- Exposes via `useAuth()`:
  - `user: User | null`
  - `session: Session | null`
  - `loading: boolean`
  - `signIn(email, password)`
  - `signUp(email, password, fullName, role?, phone?)`
  - `signOut()`
  - `resetPassword(email)` → sends reset email, redirects to `/reset-password`
  - `updatePassword(newPassword)`
- Role stored in: `user.user_metadata.role`
- Uses `supabase.auth.onAuthStateChange` for session management
- Creates profile on first sign-in via `createProfileIfNeeded()`

### `ProtectedRoute` (`src/components/auth/ProtectedRoute.tsx`)
```typescript
<ProtectedRoute allowedRoles={['admin', 'pedagogical_manager']}>
```
- No `allowedRoles` = any authenticated user
- Wrong role = redirect to `/`
- Not authenticated = redirect to `/auth`

---

## User Roles

```typescript
type user_role = 'admin' | 'pedagogical_manager' | 'instructor'
// accessed via: user?.user_metadata?.role
```

### `admin` (Super Admin)
- Full access to everything
- Sees: financial data, salary, billing, pricing, all users
- Can manage: blocked_dates, system settings, integrations
- `isAdmin = ['admin'].includes(role)`

### `pedagogical_manager`
- Sees: courses, assignments, reports, QA, media, workload
- NEVER sees: `price_for_instructor`, `price_for_customer`, salary, financial rewards
- `isAdminOrManager = ['admin', 'pedagogical_manager'].includes(role)`

### `instructor`
- Sees ONLY: own lessons, own reports, own rewards, own pipeline, own profile
- Filtered via: `course_instances.instructor_id = user.id`
- `isInstructor = role === 'instructor'`

---

## Routes

| Path | Page | Access |
|---|---|---|
| `/auth` | Auth | Public |
| `/verify` | VerifyPage | Public |
| `/reset-password` | ResetPassword | Public |
| `/` | Index → Dashboard | All authenticated |
| `/calendar` | Calendar | All authenticated |
| `/lesson-report` | LessonReport | All authenticated |
| `/lesson-report/:id` | LessonReport (edit) | All authenticated |
| `/courses` | Courses | All authenticated |
| `/course-assignments` | CourseAssignments | All authenticated |
| `/rewards` | Rewards | All authenticated |
| `/reports` | Reports | admin, pedagogical_manager |
| `/profile` | Profile | All authenticated |
| `/AdminSettings` | AdminSettings | admin, pedagogical_manager |

---

## Navigation (`src/components/layout/Navigation.tsx`)

- Desktop + mobile versions
- Menu items vary by role:
  - All: Dashboard, Calendar, CourseAssignments, Profile
  - admin + PM only: AdminSettings
- Uses `user?.user_metadata?.role` for role checks
- Fetches profile from `profiles` table on mount
- `isAdminOrManager = ['admin', 'pedagogical_manager'].includes(role)`
- `isAdmin = ['admin'].includes(role)`

---

## Key Pages

### `CourseAssignments.tsx`
Most complex page. Manages course instances.
- Pagination: 8 items per page
- Filters: instructor, institution, course, school_type
- Cache: 30s TTL for report statuses
- `lesson_mode` determines which lessons to show: template / custom_only / combined
- Status keys: `lesson_schedule_id` OR `${course_instance_id}_${lesson_id}`
- Uses: `fetchCombinedSchedules()`, `hideCourseInstance()`, `CourseAssignDialog`
- Only shows instances where `is_visible = true` AND `course.is_visible = true`

### `LessonReport.tsx`
- Submit and view lesson reports
- Supports `is_completed` flag (lesson didn't happen)
- Tracks `completed_task_ids[]`
- Has `FeedbackDialog` component
- Route: `/lesson-report` (new) and `/lesson-report/:id` (edit)

### `Index.tsx`
- Renders `<Dashboard />` from `src/components/dashboard/Dashboard.tsx`
- Dashboard is role-aware

---

## Edge Functions

All functions in `supabase/functions/`. Deno runtime.

| Function | Purpose | Status |
|---|---|---|
| `notify-admins-low-attendance` | Email when attendance < 70% | Exists, needs deploy |
| `notify-admins-incomplete-tasks` | Email when tasks incomplete | Exists |
| `notify-admins-on-feedback` | Email when instructor submits feedback | Exists, has deno.json |
| `delete-user` | Delete user + notify admins | Exists |
| `postpone-schedule` | Postpone lesson schedule | Exists, working pattern |
| `test-cors` | CORS testing | Exists |

**Correct pattern for ALL Edge Functions:**
```typescript
import { createClient } from 'jsr:@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')!
// NEVER use process.env — does not exist in Deno
// NEVER use PUBLISHABLE_KEY for server-side calls — use SERVICE_ROLE_KEY
```

**Email sender:** `fransesguy1@gmail.com` / name: `Leaders Admin System`
**Admin emails:** fetched via `supabase.rpc('get_admin_emails')`

---

## DB Helper Function

```sql
-- Used in ALL RLS policies
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;
```

---

## Business Rules (Always Enforce)

1. `pedagogical_manager` NEVER sees `price_for_instructor`, `price_for_customer`, salary
2. `instructor` sees ONLY data where `instructor_id = auth.uid()`
3. `is_completed = false` → lesson did NOT happen → does not count for billing
4. Salary = approved hours only
5. Billing = lessons where `is_completed = true`
6. Critical changes → Audit Log
7. `course_instances` = source of truth for instructor ↔ course ↔ institution
8. `reported_by` may differ from `instructor_id` (admin can report on behalf)
9. Only show instances/courses where `is_visible = true`

---

## Development Rules (Non-Negotiable)

1. **No breaking changes** to existing production code
2. **No unrelated refactoring**
3. **Migrations are additive only** — never DROP without explicit instruction
4. **Always check RLS** — frontend filtering alone is not enough
5. **Use `get_current_user_role()`** in new RLS policies
6. **Edge Functions:** always use `Deno.env.get()`, never `process.env`
7. **Edge Functions:** always use `SERVICE_ROLE_KEY` for server-side Supabase calls
8. **Prefer explicit column selects** — avoid `select('*')` in production
9. **Show exact diffs** — wait for approval before applying

---

## How to Handle Every Task

1. Identify which role(s) are affected
2. Identify which tables, RLS policies, and pages are touched
3. Check the hierarchy: `educational_institutions` → `course_instances` → `lessons` → `lesson_reports`
4. Confirm no financial data exposed to `pedagogical_manager` or `instructor`
5. Propose minimal safe implementation
6. Flag risks (RLS gaps, breaking changes, missing indexes)
7. Show exact diffs — wait for approval
