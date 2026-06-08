import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';

Font.register({
  family: 'Heebo',
  fonts: [
    { src: '/fonts/heebo/Heebo-Variable.ttf', fontWeight: 'normal' },
    { src: '/fonts/heebo/Heebo-Variable.ttf', fontWeight: 'bold' },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const fmtMoney = (n: number): string => {
  const v = Number(n) || 0;
  return `₪${v.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const fmtDate = (raw: string | undefined): string => {
  if (!raw) return '—';
  return new Date(raw).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const statusLabel = (lesson: LessonDetail): string => {
  if (lesson.lesson_status === 'not_reported') return 'טרם דווח';
  if (!lesson.is_completed) return 'לא התקיים';
  return lesson.is_lesson_ok ? 'הושלם' : 'הושלם*';
};

const palette = {
  ink: '#0f172a',
  sub: '#475569',
  dim: '#94a3b8',
  line: '#e2e8f0',
  accent: '#3B5BDB',
  accentBg: '#EEF2FF',
  bg: '#f8fafc',
  sectionBg: '#1e3a8a',
  courseBg: '#dbeafe',
};

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Heebo',
    fontSize: 9,
    color: palette.ink,
    paddingTop: 36,
    paddingBottom: 60,
    paddingHorizontal: 36,
  },

  // ── PAGE HEADER ──────────────────────────────────────────
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingBottom: 14,
    borderBottom: `1.5pt solid ${palette.accent}`,
  },
  logoBox: { width: 110, height: 60, alignItems: 'flex-start' },
  logo: { width: 110, objectFit: 'contain' },
  titleBlock: { flexDirection: 'column', alignItems: 'flex-end' },
  titleText: { fontSize: 18, fontWeight: 'bold', color: palette.accent, marginBottom: 6, textAlign: 'right' },
  titleMeta: { fontSize: 9, color: palette.sub, textAlign: 'right', lineHeight: 1.5 },

  // ── INSTITUTION SECTION HEADER ───────────────────────────
  sectionHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: palette.sectionBg,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 14,
    borderRadius: 3,
  },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', color: '#ffffff', textAlign: 'right' },
  sectionMeta: { fontSize: 8, color: '#bfdbfe', textAlign: 'left' },

  // ── COURSE SUB-HEADER ────────────────────────────────────
  courseHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: palette.courseBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 8,
    borderRadius: 2,
  },
  courseTitle: { fontSize: 9, fontWeight: 'bold', color: palette.accent, textAlign: 'right' },
  courseMeta: { fontSize: 8, color: palette.sub, textAlign: 'left' },

  // ── DETAIL TABLE ─────────────────────────────────────────
  detailTable: { border: `0.5pt solid ${palette.line}`, marginTop: 4, marginBottom: 4 },
  detailHead: { flexDirection: 'row-reverse', backgroundColor: palette.ink, paddingVertical: 5 },
  detailHeadCell: { fontSize: 8, fontWeight: 'bold', color: '#ffffff', paddingHorizontal: 6, textAlign: 'center' },
  detailRow: { flexDirection: 'row-reverse', paddingVertical: 6, borderBottom: `0.5pt solid ${palette.line}` },
  detailRowAlt: { backgroundColor: palette.bg },
  detailRowPending: { backgroundColor: '#fefce8' },
  detailCell: { fontSize: 8, color: palette.ink, paddingHorizontal: 6 },

  // ── INSTITUTION SUBTOTAL ─────────────────────────────────
  subtotalRow: {
    flexDirection: 'row-reverse',
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: palette.accentBg,
    borderTop: `1pt solid ${palette.accent}`,
    marginBottom: 4,
  },
  subtotalCell: { fontSize: 8, fontWeight: 'bold', color: palette.accent },

  // ── GRAND TOTAL ──────────────────────────────────────────
  grandTotalRow: {
    flexDirection: 'row-reverse',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: palette.accent,
    marginTop: 12,
    borderRadius: 3,
  },
  grandTotalCell: { fontSize: 9, fontWeight: 'bold', color: '#ffffff' },

  // ── COLUMN WIDTHS (sum = 100%) ────────────────────────────
  cNum:    { width: '6%',  textAlign: 'center' },
  cTitle:  { width: '28%', textAlign: 'right' },
  cAtt:    { width: '14%', textAlign: 'center' },
  cPay:    { width: '14%', textAlign: 'center' },
  cStatus: { width: '21%', textAlign: 'right' },
  cDate:   { width: '17%', textAlign: 'center' },

  // ── FOOTER ───────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 22,
    left: 36,
    right: 36,
    paddingTop: 8,
    borderTop: `0.5pt solid ${palette.line}`,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    fontSize: 8,
    color: palette.dim,
  },
});

// ── TYPES ────────────────────────────────────────────────────

interface LessonDetail {
  id: string;
  lesson_title: string;
  lesson_number: number;
  participants_count: number;
  total_students: number;
  is_lesson_ok: boolean;
  is_completed: boolean;
  hourly_rate: number;
  created_at: string;
  lesson_status: 'completed' | 'reported_issues' | 'not_reported';
  scheduled_date?: string;
}

interface CourseDetail {
  id: string;
  course_name: string;
  instructor_name: string;
  student_count: number;
  lesson_details: LessonDetail[];
}

interface InstitutionRow {
  id: string;
  name: string;
  total_lessons: number;
  total_revenue: number;
  courses: CourseDetail[];
}

interface InstitutionsPdfDocumentProps {
  institutionData: InstitutionRow[];
  selectedMonth: string;
  logoUrl?: string;
}

// ── COMPONENT ────────────────────────────────────────────────

const InstitutionsPdfDocument: React.FC<InstitutionsPdfDocumentProps> = ({
  institutionData,
  selectedMonth,
  logoUrl,
}) => {
  const grandTotalLessons = institutionData.reduce((s, i) => s + i.total_lessons, 0);
  const grandTotalRevenue = institutionData.reduce((s, i) => s + i.total_revenue, 0);

  const generatedDate = new Date().toLocaleDateString('he-IL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const institutionCompletionPct = (inst: InstitutionRow): number => {
    const total = inst.courses.reduce((s, c) => s + c.lesson_details.length, 0);
    const done  = inst.courses.reduce(
      (s, c) => s + c.lesson_details.filter(l => l.lesson_status === 'completed').length, 0,
    );
    return total > 0 ? Math.round((done / total) * 100) : 0;
  };

  return (
    <Document title="דוח מוסדות חינוך">
      <Page size="A4" style={styles.page}>

        {/* ── PAGE HEADER ── */}
        <View style={styles.pageHeader}>
          <View style={styles.logoBox}>
            {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.titleText}>דוח מוסדות חינוך</Text>
            <Text style={styles.titleMeta}>{selectedMonth}</Text>
            <Text style={styles.titleMeta}>הופק: {generatedDate}</Text>
          </View>
        </View>

        {/* ── ONE SECTION PER INSTITUTION ── */}
        {institutionData.map((institution) => (
          <View key={institution.id}>
            {/* Institution header */}
            <View style={styles.sectionHeader} wrap={false}>
              <Text style={styles.sectionTitle}>{institution.name}</Text>
              <Text style={styles.sectionMeta}>
                {`${institution.total_lessons} שיעורים | ${institutionCompletionPct(institution)}% השלמה | ${fmtMoney(institution.total_revenue)}`}
              </Text>
            </View>

            {/* Courses */}
            {institution.courses.map((course) => {
              const reportedLessons = course.lesson_details.filter(l => l.lesson_status !== 'not_reported').length;
              const courseRevenue = course.lesson_details.reduce(
                (s, l) => s + (l.lesson_status !== 'not_reported' ? l.hourly_rate : 0), 0,
              );

              return (
                <View key={course.id}>
                  {/* Course sub-header */}
                  <View style={styles.courseHeader} wrap={false}>
                    <Text style={styles.courseTitle}>{course.course_name}</Text>
                    <Text style={styles.courseMeta}>
                      {`מדריך: ${course.instructor_name} | ${reportedLessons}/${course.lesson_details.length} שיעורים דווחו | ${course.student_count} תלמידים`}
                    </Text>
                  </View>

                  {/* Course lesson table */}
                  <View style={styles.detailTable}>
                    <View style={styles.detailHead}>
                      <Text style={[styles.detailHeadCell, styles.cNum]}>#</Text>
                      <Text style={[styles.detailHeadCell, styles.cTitle]}>נושא השיעור</Text>
                      <Text style={[styles.detailHeadCell, styles.cAtt]}>נוכחות</Text>
                      <Text style={[styles.detailHeadCell, styles.cPay]}>שכר</Text>
                      <Text style={[styles.detailHeadCell, styles.cStatus]}>סטטוס</Text>
                      <Text style={[styles.detailHeadCell, styles.cDate]}>תאריך</Text>
                    </View>

                    {course.lesson_details.map((lesson, idx) => {
                      const isPending = lesson.lesson_status === 'not_reported';
                      const rowStyle = isPending
                        ? styles.detailRowPending
                        : idx % 2 === 1 ? styles.detailRowAlt : {};
                      const dateRaw = isPending ? lesson.scheduled_date : lesson.created_at;

                      return (
                        <View key={lesson.id} style={[styles.detailRow, rowStyle]}>
                          <Text style={[styles.detailCell, styles.cNum]}>{lesson.lesson_number}</Text>
                          <Text style={[styles.detailCell, styles.cTitle]}>{lesson.lesson_title}</Text>
                          <Text style={[styles.detailCell, styles.cAtt]}>
                            {isPending
                              ? `0/${lesson.total_students}`
                              : `${lesson.participants_count}/${lesson.total_students}`}
                          </Text>
                          <Text style={[styles.detailCell, styles.cPay]}>
                            {isPending ? '—' : fmtMoney(lesson.hourly_rate)}
                          </Text>
                          <Text style={[styles.detailCell, styles.cStatus]}>{statusLabel(lesson)}</Text>
                          <Text style={[styles.detailCell, styles.cDate]}>{fmtDate(dateRaw)}</Text>
                        </View>
                      );
                    })}
                  </View>

                  {/* Course total line */}
                  <View style={{ flexDirection: 'row-reverse', paddingVertical: 4, paddingHorizontal: 10 }}>
                    <Text style={{ fontSize: 8, color: palette.sub, textAlign: 'right', width: '70%' }}>
                      {`סה"כ קורס — ${course.course_name}:`}
                    </Text>
                    <Text style={{ fontSize: 8, fontWeight: 'bold', color: palette.ink, width: '30%', textAlign: 'center' }}>
                      {fmtMoney(courseRevenue)}
                    </Text>
                  </View>
                </View>
              );
            })}

            {/* Institution subtotal */}
            <View style={styles.subtotalRow}>
              <Text style={[styles.subtotalCell, { width: '55%', textAlign: 'right' }]}>
                {`סה"כ — ${institution.name}`}
              </Text>
              <Text style={[styles.subtotalCell, { width: '20%', textAlign: 'center' }]}>
                {`${institution.total_lessons} שיעורים`}
              </Text>
              <Text style={[styles.subtotalCell, { width: '25%', textAlign: 'center' }]}>
                {fmtMoney(institution.total_revenue)}
              </Text>
            </View>
          </View>
        ))}

        {/* ── GRAND TOTAL ── */}
        <View style={styles.grandTotalRow}>
          <Text style={[styles.grandTotalCell, { width: '55%', textAlign: 'right' }]}>סה"כ כל המוסדות</Text>
          <Text style={[styles.grandTotalCell, { width: '20%', textAlign: 'center' }]}>
            {`${grandTotalLessons} שיעורים`}
          </Text>
          <Text style={[styles.grandTotalCell, { width: '25%', textAlign: 'center' }]}>
            {fmtMoney(grandTotalRevenue)}
          </Text>
        </View>

        {/* ── FOOTER ── */}
        <View style={styles.footer} fixed>
          <Text>הופק על ידי מערכת Leaders</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};

export default InstitutionsPdfDocument;
