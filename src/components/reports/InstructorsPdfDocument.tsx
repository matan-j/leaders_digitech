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
};

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Heebo',
    fontSize: 8,
    color: palette.ink,
    paddingTop: 36,
    paddingBottom: 60,
    paddingHorizontal: 36,
  },

  // ── PAGE HEADER ─────────────────────────────────────────
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

  // ── SECTION HEADER (per instructor) ─────────────────────
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

  // ── DETAIL TABLE ─────────────────────────────────────────
  detailTable: { border: `0.5pt solid ${palette.line}`, marginTop: 4, marginBottom: 4 },
  detailHead: { flexDirection: 'row-reverse', backgroundColor: palette.ink, paddingVertical: 5 },
  detailHeadCell: { fontSize: 7, fontWeight: 'bold', color: '#ffffff', paddingHorizontal: 3, textAlign: 'center' },
  detailRow: { flexDirection: 'row-reverse', paddingVertical: 5, borderBottom: `0.5pt solid ${palette.line}` },
  detailRowAlt: { backgroundColor: palette.bg },
  detailRowPending: { backgroundColor: '#fefce8' },
  detailCell: { fontSize: 7, color: palette.ink, paddingHorizontal: 3 },

  // ── SUBTOTAL ROW (per instructor) ────────────────────────
  subtotalRow: {
    flexDirection: 'row-reverse',
    paddingVertical: 6,
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

  // ── COLUMN WIDTHS (must sum to 100%) ─────────────────────
  cNum:    { width: '4%',  textAlign: 'center' },
  cTitle:  { width: '16%', textAlign: 'right' },
  cCourse: { width: '11%', textAlign: 'right' },
  cInst:   { width: '11%', textAlign: 'right' },
  cAtt:    { width: '8%',  textAlign: 'center' },
  cLess:   { width: '7%',  textAlign: 'center' },
  cHours:  { width: '7%',  textAlign: 'center' },
  cPay:    { width: '9%',  textAlign: 'center' },
  cStatus: { width: '14%', textAlign: 'right' },
  cDate:   { width: '13%', textAlign: 'center' },

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
  course_name: string;
  institution_name: string;
  lesson_number: number;
  participants_count: number;
  total_students: number;
  is_lesson_ok: boolean;
  is_completed: boolean;
  hourly_rate: number;
  lessons_count: number;
  created_at: string;
  lesson_status: 'completed' | 'reported_issues' | 'not_reported';
  scheduled_date?: string;
  actual_hours?: number;
}

interface InstructorRow {
  id: string;
  full_name: string;
  total_lessons: number;
  total_hours: number;
  total_salary: number;
  reports: LessonDetail[];
}

interface InstructorsPdfDocumentProps {
  instructorData: InstructorRow[];
  selectedMonth: string;
  logoUrl?: string;
}

// ── COMPONENT ────────────────────────────────────────────────

const InstructorsPdfDocument: React.FC<InstructorsPdfDocumentProps> = ({
  instructorData,
  selectedMonth,
  logoUrl,
}) => {
  const grandTotalLessons = instructorData.reduce((s, i) => s + i.total_lessons, 0);
  const grandTotalHours   = instructorData.reduce((s, i) => s + i.total_hours, 0);
  const grandTotalPay     = instructorData.reduce((s, i) => s + i.total_salary, 0);

  const generatedDate = new Date().toLocaleDateString('he-IL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  return (
    <Document title="דוח מדריכים">
      <Page size="A4" style={styles.page}>

        {/* ── PAGE HEADER ── */}
        <View style={styles.pageHeader}>
          <View style={styles.logoBox}>
            {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.titleText}>דוח מדריכים</Text>
            <Text style={styles.titleMeta}>{selectedMonth}</Text>
            <Text style={styles.titleMeta}>הופק: {generatedDate}</Text>
          </View>
        </View>

        {/* ── ONE SECTION PER INSTRUCTOR ── */}
        {instructorData.map((instructor) => {
          const sortedReports = [...instructor.reports].sort((a, b) => {
            if (a.lesson_status === 'not_reported' && b.lesson_status !== 'not_reported') return 1;
            if (a.lesson_status !== 'not_reported' && b.lesson_status === 'not_reported') return -1;
            return a.lesson_number - b.lesson_number;
          });

          return (
            <View key={instructor.id}>
              {/* Section header */}
              <View style={styles.sectionHeader} wrap={false}>
                <Text style={styles.sectionTitle}>{instructor.full_name}</Text>
                <Text style={styles.sectionMeta}>
                  {`${instructor.total_lessons} שיעורים | ${instructor.total_hours.toFixed(1)} שעות | ${fmtMoney(instructor.total_salary)}`}
                </Text>
              </View>

              {/* Detail table */}
              <View style={styles.detailTable}>
                <View style={styles.detailHead}>
                  <Text style={[styles.detailHeadCell, styles.cNum]}>#</Text>
                  <Text style={[styles.detailHeadCell, styles.cTitle]}>נושא השיעור</Text>
                  <Text style={[styles.detailHeadCell, styles.cCourse]}>קורס</Text>
                  <Text style={[styles.detailHeadCell, styles.cInst]}>מוסד</Text>
                  <Text style={[styles.detailHeadCell, styles.cAtt]}>נוכחות</Text>
                  <Text style={[styles.detailHeadCell, styles.cLess]}>שיעורים</Text>
                  <Text style={[styles.detailHeadCell, styles.cHours]}>שעות</Text>
                  <Text style={[styles.detailHeadCell, styles.cPay]}>שכר</Text>
                  <Text style={[styles.detailHeadCell, styles.cStatus]}>סטטוס</Text>
                  <Text style={[styles.detailHeadCell, styles.cDate]}>תאריך</Text>
                </View>

                {sortedReports.map((lesson, idx) => {
                  const isPending = lesson.lesson_status === 'not_reported';
                  const rowStyle = isPending
                    ? styles.detailRowPending
                    : idx % 2 === 1 ? styles.detailRowAlt : {};
                  const dateRaw = isPending ? lesson.scheduled_date : lesson.created_at;

                  return (
                    <View key={lesson.id} style={[styles.detailRow, rowStyle]}>
                      <Text style={[styles.detailCell, styles.cNum]}>{lesson.lesson_number}</Text>
                      <Text style={[styles.detailCell, styles.cTitle]}>{lesson.lesson_title}</Text>
                      <Text style={[styles.detailCell, styles.cCourse]}>{lesson.course_name}</Text>
                      <Text style={[styles.detailCell, styles.cInst]}>{lesson.institution_name}</Text>
                      <Text style={[styles.detailCell, styles.cAtt]}>
                        {isPending ? `0/${lesson.total_students}` : `${lesson.participants_count}/${lesson.total_students}`}
                      </Text>
                      <Text style={[styles.detailCell, styles.cLess]}>
                        {isPending ? '—' : String(lesson.lessons_count)}
                      </Text>
                      <Text style={[styles.detailCell, styles.cHours]}>
                        {isPending ? '—' : `${(lesson.actual_hours ?? 1).toFixed(1)}`}
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

              {/* Instructor subtotal */}
              <View style={styles.subtotalRow}>
                <Text style={[styles.subtotalCell, { width: '55%', textAlign: 'right' }]}>
                  {`סה"כ — ${instructor.full_name}`}
                </Text>
                <Text style={[styles.subtotalCell, { width: '15%', textAlign: 'center' }]}>
                  {`${instructor.total_lessons} שיעורים`}
                </Text>
                <Text style={[styles.subtotalCell, { width: '15%', textAlign: 'center' }]}>
                  {`${instructor.total_hours.toFixed(1)} שעות`}
                </Text>
                <Text style={[styles.subtotalCell, { width: '15%', textAlign: 'center' }]}>
                  {fmtMoney(instructor.total_salary)}
                </Text>
              </View>
            </View>
          );
        })}

        {/* ── GRAND TOTAL ── */}
        <View style={styles.grandTotalRow}>
          <Text style={[styles.grandTotalCell, { width: '55%', textAlign: 'right' }]}>סה"כ כל המדריכים</Text>
          <Text style={[styles.grandTotalCell, { width: '15%', textAlign: 'center' }]}>
            {`${grandTotalLessons} שיעורים`}
          </Text>
          <Text style={[styles.grandTotalCell, { width: '15%', textAlign: 'center' }]}>
            {`${grandTotalHours.toFixed(1)} שעות`}
          </Text>
          <Text style={[styles.grandTotalCell, { width: '15%', textAlign: 'center' }]}>
            {fmtMoney(grandTotalPay)}
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

export default InstructorsPdfDocument;
