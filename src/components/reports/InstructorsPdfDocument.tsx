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
  return `₪ ${v.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const palette = {
  ink: '#0f172a',
  sub: '#475569',
  dim: '#94a3b8',
  line: '#e2e8f0',
  accent: '#3B5BDB',
  accentBg: '#EEF2FF',
  bg: '#f8fafc',
};

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Heebo',
    fontSize: 10,
    color: palette.ink,
    paddingTop: 36,
    paddingBottom: 60,
    paddingHorizontal: 36,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingBottom: 14,
    borderBottom: `1.5pt solid ${palette.accent}`,
  },
  logoBox: {
    width: 110,
    height: 60,
    alignItems: 'flex-start',
  },
  logo: {
    width: 110,
    objectFit: 'contain',
  },
  titleBlock: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  titleText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: palette.accent,
    marginBottom: 6,
    textAlign: 'right',
  },
  titleMeta: {
    fontSize: 9,
    color: palette.sub,
    textAlign: 'right',
    lineHeight: 1.5,
  },
  table: {
    borderRadius: 4,
    overflow: 'hidden',
    border: `1pt solid ${palette.line}`,
    marginBottom: 14,
  },
  tableHead: {
    flexDirection: 'row-reverse',
    backgroundColor: palette.ink,
    paddingVertical: 8,
  },
  tableHeadCell: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#ffffff',
    paddingHorizontal: 10,
  },
  tableRow: {
    flexDirection: 'row-reverse',
    paddingVertical: 9,
    borderBottom: `0.5pt solid ${palette.line}`,
  },
  tableRowAlt: {
    backgroundColor: palette.bg,
  },
  tableCell: {
    fontSize: 10,
    color: palette.ink,
    paddingHorizontal: 10,
  },
  tableTotalRow: {
    flexDirection: 'row-reverse',
    paddingVertical: 10,
    backgroundColor: palette.accentBg,
    borderTop: `1.5pt solid ${palette.accent}`,
  },
  tableTotalCell: {
    fontSize: 10,
    fontWeight: 'bold',
    color: palette.accent,
    paddingHorizontal: 10,
  },
  colName:    { width: '40%', textAlign: 'right' },
  colLessons: { width: '20%', textAlign: 'center' },
  colHours:   { width: '20%', textAlign: 'center' },
  colPay:     { width: '20%', textAlign: 'left' },
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

interface InstructorRow {
  id: string;
  full_name: string;
  total_lessons: number;
  total_hours: number;
  total_salary: number;
}

interface InstructorsPdfDocumentProps {
  instructorData: InstructorRow[];
  selectedMonth: string;
  logoUrl?: string;
}

const InstructorsPdfDocument: React.FC<InstructorsPdfDocumentProps> = ({
  instructorData,
  selectedMonth,
  logoUrl,
}) => {
  const totalLessons = instructorData.reduce((s, r) => s + r.total_lessons, 0);
  const totalHours = instructorData.reduce((s, r) => s + r.total_hours, 0);
  const totalPay = instructorData.reduce((s, r) => s + r.total_salary, 0);
  const generatedDate = new Date().toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <Document title="דוח מדריכים">
      <Page size="A4" style={styles.page}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.titleText}>דוח מדריכים</Text>
            <Text style={styles.titleMeta}>{selectedMonth}</Text>
            <Text style={styles.titleMeta}>הופק: {generatedDate}</Text>
          </View>
        </View>

        {/* TABLE */}
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.tableHeadCell, styles.colName]}>מדריך</Text>
            <Text style={[styles.tableHeadCell, styles.colLessons]}>שיעורים</Text>
            <Text style={[styles.tableHeadCell, styles.colHours]}>שעות</Text>
            <Text style={[styles.tableHeadCell, styles.colPay]}>סה"כ לתשלום</Text>
          </View>
          {instructorData.map((row, idx) => (
            <View
              key={row.id}
              style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <Text style={[styles.tableCell, styles.colName]}>{row.full_name}</Text>
              <Text style={[styles.tableCell, styles.colLessons]}>{row.total_lessons}</Text>
              <Text style={[styles.tableCell, styles.colHours]}>{row.total_hours.toFixed(1)}</Text>
              <Text style={[styles.tableCell, styles.colPay]}>{fmtMoney(row.total_salary)}</Text>
            </View>
          ))}
          <View style={styles.tableTotalRow}>
            <Text style={[styles.tableTotalCell, styles.colName]}>סה"כ</Text>
            <Text style={[styles.tableTotalCell, styles.colLessons]}>{totalLessons}</Text>
            <Text style={[styles.tableTotalCell, styles.colHours]}>{totalHours.toFixed(1)}</Text>
            <Text style={[styles.tableTotalCell, styles.colPay]}>{fmtMoney(totalPay)}</Text>
          </View>
        </View>

        {/* FOOTER */}
        <View style={styles.footer} fixed>
          <Text>הופק על ידי מערכת Leaders</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};

export default InstructorsPdfDocument;
