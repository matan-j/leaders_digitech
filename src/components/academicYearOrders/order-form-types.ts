// Form-only shapes used by AcademicYearOrderEditorSheet.
// Strings here are what live in <Input> elements; we convert to the
// strict AcademicYearOrderPayload shape at save time.

import type {
  AcademicYearOrderGroupSchedulingStatus,
  AcademicYearOrderSchedulingStatus,
  AcademicYearOrderStatus,
} from '@/types/academicYearOrders';

export interface GroupFormValue {
  id: string | null;
  course_id: string | null;
  age_group: string;
  grade_label: string;
  groups_count: number;
  meetings_count: string; // empty string allowed → null on save
  hours_per_meeting: string;
  requested_days_of_week: number[];
  time_from: string; // "HH:MM" or ""
  time_to: string;
  scheduling_status: AcademicYearOrderGroupSchedulingStatus;
  notes: string;
}

export interface OrderFormValues {
  academic_year: string;
  status: AcademicYearOrderStatus;
  scheduling_status: AcademicYearOrderSchedulingStatus;
  region: string;
  city: string;
  preferred_instructor_id: string;
  requested_start_date: string;
  requested_end_date: string;
  groups_count_planned: string;
  total_meetings_planned: string;
  hours_per_meeting: string;
  notes: string;
  groups: GroupFormValue[];
}

export const emptyGroup = (): GroupFormValue => ({
  id: null,
  course_id: null,
  age_group: '',
  grade_label: '',
  groups_count: 1,
  meetings_count: '',
  hours_per_meeting: '',
  requested_days_of_week: [],
  time_from: '',
  time_to: '',
  scheduling_status: 'pending',
  notes: '',
});
