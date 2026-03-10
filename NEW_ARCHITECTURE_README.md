# New Course Scheduling Architecture

## Overview

The course scheduling system has been refactored from saving individual lesson schedules to saving course-wide scheduling patterns. This change provides better efficiency and flexibility.

## Architecture Changes

### Before (Old Architecture)
- Multiple rows in `lesson_schedules` table for each lesson instance
- Each lesson had its own schedule entry with specific date/time
- Difficult to manage course-wide schedule changes
- Many database rows for courses with multiple lessons

### After (New Architecture)
- Single course schedule pattern in `course_instances` table
- New `course_instance_schedules` table for complex patterns
- Schedule patterns generate lesson instances dynamically
- One schedule definition per course instance

## Database Schema Changes

### Updated `course_instances` table
```sql
ALTER TABLE course_instances ADD COLUMN:
- days_of_week INTEGER[]
- schedule_pattern JSONB
```
*Note: Uses existing start_date and end_date fields for schedule period*

### New `course_instance_schedules` table
```sql
CREATE TABLE course_instance_schedules (
  id UUID PRIMARY KEY,
  course_instance_id UUID REFERENCES course_instances(id),
  days_of_week INTEGER[] NOT NULL,
  time_slots JSONB NOT NULL,
  total_lessons INTEGER,
  lesson_duration_minutes INTEGER
);
```
*Note: Uses course_instances.start_date/end_date for schedule period*

## Key Features

### 1. Course Instance Schedule Pattern
- Define which days of the week lessons occur (e.g., [0, 2, 4] for Sunday, Tuesday, Thursday)
- Set different time slots for different days
- Specify total number of lessons
- Set course duration and lesson length

### 2. Dynamic Schedule Generation
- Lesson schedules are generated on-demand from the pattern
- Combines course pattern with actual lesson data
- Supports both legacy and new schedule formats

### 3. Backward Compatibility
- Existing `lesson_schedules` are still supported
- `fetchCombinedSchedules()` utility combines both formats
- Gradual migration from old to new system

## Code Changes

### CourseAssignDialog
- Simplified from 3 steps to 2 steps
- Removed individual lesson scheduling
- Added course-wide schedule pattern definition
- Shows all course lessons to admin for reference
- Uses course instance dates (no duplicate date fields)
- Saves schedule pattern instead of individual instances

### Schedule Utilities (`/utils/scheduleUtils.ts`)
- `generateLessonSchedulesFromPattern()` - Creates lesson schedules from patterns
- `fetchAndGenerateSchedules()` - Fetches and generates new format schedules  
- `fetchCombinedSchedules()` - Combines legacy and new schedules
- `filterSchedulesByDate()` - Date filtering utilities

### Updated Components
- `Calendar.tsx` - Uses combined schedules
- `WeeklyCalendar.tsx` - Works with both schedule types
- `ScheduleList.tsx` - Displays combined schedules

## Usage Examples

### Creating a Course Schedule
```javascript
const courseSchedule = {
  days_of_week: [0, 2, 4], // Sunday, Tuesday, Thursday
  time_slots: [
    { day: 0, start_time: "09:00", end_time: "10:30" }, // Sunday
    { day: 2, start_time: "14:00", end_time: "15:30" }, // Tuesday  
    { day: 4, start_time: "16:00", end_time: "17:30" }  // Thursday
  ],
  total_lessons: 24,
  lesson_duration_minutes: 90
};

// Course instance already has start_date and end_date
const courseInstance = {
  start_date: "2025-01-20",
  end_date: "2025-03-20",
  // ... other fields
};
```

### Fetching Combined Schedules
```javascript
import { fetchCombinedSchedules } from '@/utils/scheduleUtils';

// Get all schedules (legacy + new)
const allSchedules = await fetchCombinedSchedules();

// Get schedules for specific course instance
const courseSchedules = await fetchCombinedSchedules(courseInstanceId);
```

## Benefits

1. **Efficiency**: One schedule pattern instead of dozens of individual records
2. **Flexibility**: Easy to modify course-wide schedules
3. **Consistency**: Ensures all lessons follow the same pattern
4. **Maintainability**: Simpler to manage and update schedules
5. **Performance**: Fewer database queries and records

## Migration Strategy

1. **Phase 1**: New architecture implemented alongside existing system
2. **Phase 2**: New course instances use new scheduling format
3. **Phase 3**: Existing schedules continue to work via compatibility layer
4. **Phase 4**: Gradual migration of existing data (future)

## Files Modified

- `/src/components/CourseAssignDialog.tsx` - Refactored dialog
- `/src/integrations/supabase/types.ts` - Updated database types
- `/src/utils/scheduleUtils.ts` - New utility functions
- `/src/pages/Calendar.tsx` - Updated to use combined schedules
- `/supabase/migrations/20250115000000_course_instance_schedule_refactor.sql` - Database migration

## Next Steps

1. Apply the database migration to update schema
2. Test the new course creation and scheduling workflow
3. Verify that existing schedules continue to display correctly
4. Consider migrating existing course instances to new format
5. Update remaining components to use new schedule utilities

The new architecture provides a solid foundation for more efficient course scheduling while maintaining backward compatibility with existing data.