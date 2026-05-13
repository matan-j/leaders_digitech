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

import type { Quote, QuoteLine } from '@/types/quotes';
import { buildDescription } from '@/lib/quotes/description-builder';
import { DEFAULT_COMPANY_INFO, type CompanyInfo } from '@/lib/quotes/company-info';

// Register Heebo from a single variable TTF that contains *all* glyphs
// (Hebrew + Latin + digits + punctuation). Single-file registration avoids
// @react-pdf's font-variant collision when multiple WOFF subsets shared the
// same weight — that's what caused punctuation like "," to render as garbage.
Font.register({
  family: 'Heebo',
  fonts: [
    { src: '/fonts/heebo/Heebo-Variable.ttf', fontWeight: 'normal' },
    { src: '/fonts/heebo/Heebo-Variable.ttf', fontWeight: 'bold' },
  ],
});

// Disable hyphenation — @react-pdf otherwise breaks Hebrew words at random points.
Font.registerHyphenationCallback((word) => [word]);

// Local money formatter for the PDF: currency symbol on the LEFT of the
// number (Hebrew RTL reading: number first, then ₪).
const fmtMoney = (n: number): string => {
  const v = Number(n) || 0;
  return `₪ ${v.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

// String preparation helper for Hebrew text in the PDF.
//
// Originally this function did word-reversal / RLM-prepending hacks to work
// around bidi bugs. After switching to the single Heebo-Variable.ttf (which
// contains the full Hebrew+Latin glyph set), pdfkit handles bidi correctly on
// its own — both for pure Hebrew and for mixed Hebrew+digit strings. The
// hacks were actually corrupting otherwise-correct rendering.
//
// Kept as a no-op identity function so the call sites don't need editing,
// and so we have a single hook if a future case needs special handling.
const rtl = (s: string | null | undefined): string => s ?? '';

// Brand palette — matches the app's primary blue
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

  // ── HEADER ──────────────────────────────────────────────
  // Layout: logo on the LEFT, company details on the RIGHT.
  // We use flexDirection: 'row' (LTR) so the natural document order places
  // the logo first (visually left) and details second (visually right).
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
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
  brandBlock: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    maxWidth: '60%',
  },
  brandName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: palette.ink,
    marginBottom: 4,
    textAlign: 'right',
  },
  brandLine: {
    fontSize: 9,
    color: palette.sub,
    lineHeight: 1.4,
    textAlign: 'right',
  },

  // ── TITLE STRIP ─────────────────────────────────────────
  titleStrip: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: palette.accentBg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 4,
    marginBottom: 16,
  },
  titleText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: palette.accent,
  },
  titleMeta: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  // Each meta line uses its own row so label and value render as separate Text nodes
  // — avoids bidi misorder of "label: value" when the label is Hebrew and value is LTR.
  // row-reverse so the Hebrew label sits visually on the right of the value (Hebrew reading order).
  titleMetaLine: {
    flexDirection: 'row-reverse',
    alignItems: 'baseline',
    marginBottom: 2,
    gap: 4,
  },
  titleMetaLabel: {
    fontSize: 9,
    color: palette.sub,
  },
  titleMetaValue: {
    fontSize: 9,
    color: palette.ink,
    fontWeight: 'bold',
  },

  // ── CUSTOMER ────────────────────────────────────────────
  customerCard: {
    backgroundColor: palette.bg,
    borderRadius: 4,
    padding: 12,
    marginBottom: 18,
  },
  // Width 100% + textAlign:'right' is more reliable in @react-pdf than alignItems:'flex-end'
  // — Text elements were shrinking-to-content and ignoring the parent's cross-axis alignment.
  customerLabel: {
    fontSize: 9,
    color: palette.sub,
    marginBottom: 4,
    width: '100%',
    textAlign: 'right',
  },
  customerName: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
    width: '100%',
    textAlign: 'right',
  },
  // row-reverse → Hebrew label visually on the right, LTR value on the left.
  customerContactLine: {
    flexDirection: 'row-reverse',
    alignItems: 'baseline',
    marginTop: 2,
    gap: 4,
  },
  customerContactLabel: {
    fontSize: 9,
    color: palette.sub,
  },
  customerContactValue: {
    fontSize: 9,
    color: palette.ink,
  },

  // ── TABLE ───────────────────────────────────────────────
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
  },
  // column widths (visually RTL)
  colProduct: { width: '30%', paddingHorizontal: 10, textAlign: 'right' },
  colDesc:    { width: '38%', paddingHorizontal: 10, textAlign: 'right' },
  colQty:     { width: '12%', paddingHorizontal: 10, textAlign: 'center' },
  colPrice:   { width: '20%', paddingHorizontal: 10, textAlign: 'left' },

  // ── TOTALS ──────────────────────────────────────────────
  totalsBox: {
    alignSelf: 'flex-start',
    width: '46%',
    marginBottom: 14,
  },
  totalsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingVertical: 4,
    fontSize: 10,
    color: palette.ink,
  },
  totalsRowMuted: {
    color: palette.sub,
  },
  // Hebrew label + colon as two text nodes so the colon sits visually on the
  // LEFT of the Hebrew label (Hebrew RTL reading: label first, colon after).
  totalsLabelGroup: {
    flexDirection: 'row-reverse',
    alignItems: 'baseline',
    gap: 2,
  },
  totalsFinal: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 4,
    borderTop: `1.5pt solid ${palette.ink}`,
    fontSize: 13,
    fontWeight: 'bold',
    color: palette.accent,
  },
  vatNote: {
    fontSize: 8,
    color: palette.dim,
    textAlign: 'right',
    marginBottom: 12,
    marginTop: -4,
  },

  // ── NOTES / TERMS ───────────────────────────────────────
  block: {
    marginTop: 10,
  },
  blockLabel: {
    fontSize: 9,
    color: palette.sub,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'right',
  },
  blockText: {
    fontSize: 9,
    color: palette.ink,
    textAlign: 'right',
    lineHeight: 1.5,
  },

  // ── FOOTER ──────────────────────────────────────────────
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
  footerSide: {
    fontSize: 8,
    color: palette.dim,
  },
});

interface QuotePdfDocumentProps {
  quote: Quote;
  lines: QuoteLine[];
  companyInfo?: CompanyInfo;
}

const formatDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const QuotePdfDocument: React.FC<QuotePdfDocumentProps> = ({ quote, lines, companyInfo }) => {
  const company = companyInfo ?? DEFAULT_COMPANY_INFO;
  // Always rebuild the customer-facing description from raw fields. Older quote
  // lines may have stored an out-of-date format in description_text — rebuilding
  // on every render guarantees the latest "כיתה X- N מפגשים" format always shows.
  const customerDesc = (l: QuoteLine) =>
    buildDescription({
      grade_label: l.grade_label,
      class_label: l.class_label,
      meetings_count: l.meetings_count,
      groups_count: l.groups_count,
    });

  return (
    <Document
      title={`הצעת מחיר ${quote.quote_number}`}
      author={company.legalName}
      creator={company.legalName}
    >
      <Page size="A4" style={styles.page}>
        {/* HEADER — logo (right) + company details (left) */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Image src={company.logoUrl} style={styles.logo} />
          </View>
          <View style={styles.brandBlock}>
            <Text style={styles.brandName}>{rtl(company.legalName)}</Text>
            <Text style={styles.brandLine}>{rtl(company.address)}</Text>
            <Text style={styles.brandLine}>{company.phone}</Text>
            <Text style={styles.brandLine}>{company.email}</Text>
            <Text style={styles.brandLine}>{rtl(`ח.פ. ${company.taxId}`)}</Text>
            {company.website ? (
              <Text style={styles.brandLine}>{company.website}</Text>
            ) : null}
          </View>
        </View>

        {/* TITLE STRIP — minimal: title on the right, number+date on the left */}
        <View style={styles.titleStrip}>
          <Text style={styles.titleText}>הצעת מחיר</Text>
          <View style={styles.titleMeta}>
            <View style={styles.titleMetaLine}>
              <Text style={styles.titleMetaLabel}>מס׳ </Text>
              <Text style={styles.titleMetaValue}>{quote.quote_number}</Text>
            </View>
            <View style={styles.titleMetaLine}>
              <Text style={styles.titleMetaLabel}>תאריך </Text>
              <Text style={styles.titleMetaValue}>{formatDate(quote.issue_date)}</Text>
            </View>
            {quote.valid_until && (
              <View style={styles.titleMetaLine}>
                <Text style={styles.titleMetaLabel}>בתוקף עד </Text>
                <Text style={styles.titleMetaValue}>{formatDate(quote.valid_until)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* CUSTOMER */}
        <View style={styles.customerCard}>
          <Text style={styles.customerLabel}>לכבוד</Text>
          <Text style={styles.customerName}>{rtl(quote.customer_snapshot_name)}</Text>
          {quote.contact_snapshot_name && (
            <View style={styles.customerContactLine}>
              <Text style={styles.customerContactLabel}>איש קשר</Text>
              <Text style={styles.customerContactValue}>{quote.contact_snapshot_name}</Text>
            </View>
          )}
          {quote.contact_snapshot_phone && (
            <View style={styles.customerContactLine}>
              <Text style={styles.customerContactLabel}>טלפון</Text>
              <Text style={styles.customerContactValue}>{quote.contact_snapshot_phone}</Text>
            </View>
          )}
          {quote.contact_snapshot_email && (
            <View style={styles.customerContactLine}>
              <Text style={styles.customerContactLabel}>דוא״ל</Text>
              <Text style={styles.customerContactValue}>{quote.contact_snapshot_email}</Text>
            </View>
          )}
        </View>

        {/* LINES TABLE */}
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.tableHeadCell, styles.colProduct]}>מוצר / שירות</Text>
            <Text style={[styles.tableHeadCell, styles.colDesc]}>תיאור</Text>
            <Text style={[styles.tableHeadCell, styles.colQty]}>שעות</Text>
            <Text style={[styles.tableHeadCell, styles.colPrice]}>מחיר</Text>
          </View>
          {lines.map((l, idx) => (
            <View key={l.id} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
              <Text style={[styles.tableCell, styles.colProduct]}>{rtl(l.product_name_snapshot)}</Text>
              <Text style={[styles.tableCell, styles.colDesc]}>{rtl(customerDesc(l))}</Text>
              <Text style={[styles.tableCell, styles.colQty]}>{l.total_hours}</Text>
              <Text style={[styles.tableCell, styles.colPrice]}>{fmtMoney(l.line_total_incl_vat)}</Text>
            </View>
          ))}
        </View>

        {/* TOTALS — colon is its own Text so it sits cleanly to the LEFT of the Hebrew label */}
        <View style={styles.totalsBox}>
          <View style={styles.totalsRow}>
            <View style={styles.totalsLabelGroup}>
              <Text style={styles.totalsRowMuted}>סה״כ ביניים</Text>
              <Text style={styles.totalsRowMuted}>:</Text>
            </View>
            <Text>{fmtMoney(quote.subtotal_incl_vat)}</Text>
          </View>
          {Number(quote.discount_amount) > 0 && (
            <View style={styles.totalsRow}>
              <View style={styles.totalsLabelGroup}>
                <Text style={styles.totalsRowMuted}>הנחה</Text>
                <Text style={styles.totalsRowMuted}>:</Text>
              </View>
              <Text>-{fmtMoney(quote.discount_amount)}</Text>
            </View>
          )}
          {Number(quote.rounding_amount) !== 0 && (
            <View style={styles.totalsRow}>
              <View style={styles.totalsLabelGroup}>
                <Text style={styles.totalsRowMuted}>עיגול</Text>
                <Text style={styles.totalsRowMuted}>:</Text>
              </View>
              <Text>{fmtMoney(quote.rounding_amount)}</Text>
            </View>
          )}
          <View style={styles.totalsFinal}>
            <View style={styles.totalsLabelGroup}>
              <Text>סה״כ לתשלום</Text>
              <Text>:</Text>
            </View>
            <Text>{fmtMoney(quote.total_incl_vat)}</Text>
          </View>
        </View>
        <Text style={styles.vatNote}>* כל המחירים כוללים מע״מ</Text>

        {/* NOTES + TERMS */}
        {quote.notes && (
          <View style={styles.block}>
            <Text style={styles.blockLabel}>הערות</Text>
            <Text style={styles.blockText}>{rtl(quote.notes)}</Text>
          </View>
        )}
        {quote.terms_text && (
          <View style={styles.block}>
            <Text style={styles.blockLabel}>תנאים מסחריים</Text>
            <Text style={styles.blockText}>{rtl(quote.terms_text)}</Text>
          </View>
        )}

        {/* FOOTER — fixed on every page. Two separate Text nodes per side so Hebrew/LTR don't collide. */}
        <View style={styles.footer} fixed>
          <View style={styles.footerSide}>
            <Text>{rtl(company.legalName)}</Text>
          </View>
          <View style={styles.footerSide}>
            <Text
              render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
            />
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default QuotePdfDocument;
