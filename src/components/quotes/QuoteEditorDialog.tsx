import React, { useEffect, useMemo, useState } from 'react';
import { useForm, FormProvider, useWatch } from 'react-hook-form';
import { Loader2, Save, X } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import QuoteLinesEditor from './QuoteLinesEditor';
import QuotePdfButton from './QuotePdfButton';
import type { Product } from '@/types/products';
import type { Quote, QuoteLine, QuoteStatus } from '@/types/quotes';
import { QUOTE_STATUS_LABELS } from '@/types/quotes';
import { calcLine, calcQuoteTotals } from '@/lib/quotes/quote-calc';
import { buildDescription } from '@/lib/quotes/description-builder';
import { formatILS } from '@/lib/quotes/money';
import type { QuoteFormValues, QuoteLineFormValue } from './quote-form-types';

interface QuoteEditorDialogProps {
  quoteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  // True when the parent just allocated a fresh quote row for this session.
  // If the user closes the dialog without explicitly saving, we delete the
  // empty draft so the list isn't polluted with blank rows.
  isNew?: boolean;
}

const isoDate = (d: string | null) => (d ? d.slice(0, 10) : '');

const lineFromDB = (l: QuoteLine): QuoteLineFormValue => ({
  id: l.id,
  product_id: l.product_id,
  product_name_snapshot: l.product_name_snapshot ?? '',
  grade_label: l.grade_label ?? '',
  class_label: l.class_label ?? '',
  description_text: l.description_text ?? '',
  description_dirty: Boolean(l.description_text?.trim()),
  meetings_count: Number(l.meetings_count) || 1,
  hours_per_meeting: Number(l.hours_per_meeting) || 1,
  groups_count: Number(l.groups_count) || 1,
  total_hours: Number(l.total_hours) || 0,
  hourly_rate_incl_vat: Number(l.hourly_rate_incl_vat) || 0,
  line_total_incl_vat: Number(l.line_total_incl_vat) || 0,
  internal_notes: l.internal_notes ?? '',
});

const QuoteEditorDialog: React.FC<QuoteEditorDialogProps> = ({
  quoteId,
  open,
  onOpenChange,
  onSaved,
  isNew,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  // Whether the user explicitly saved at least once during this open session.
  // Used to decide whether to garbage-collect an unsaved new draft on close.
  const [wasSaved, setWasSaved] = useState(false);

  const form = useForm<QuoteFormValues>({
    defaultValues: {
      quote_number: '',
      issue_date: '',
      valid_until: '',
      status: 'draft',
      customer_snapshot_name: '',
      contact_snapshot_name: '',
      contact_snapshot_phone: '',
      contact_snapshot_email: '',
      lines: [],
      discount_amount: 0,
      rounding_amount: 0,
      notes: '',
      terms_text: '',
    },
  });

  const loadData = async () => {
    setLoading(true);

    const [quoteRes, linesRes, productsRes] = await Promise.all([
      supabase.from('quotes').select('*').eq('id', quoteId).single(),
      supabase
        .from('quote_lines')
        .select('*')
        .eq('quote_id', quoteId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('products')
        .select('id, name, short_description, price_excl_vat, vat_rate, price_incl_vat, website_url, syllabus_url, sort_order, internal_notes, status, created_at, updated_at, created_by, updated_by')
        .eq('status', 'active')
        .order('name', { ascending: true }),
    ]);

    if (quoteRes.error || !quoteRes.data) {
      toast({ title: 'שגיאה בטעינת ההצעה', description: quoteRes.error?.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const q = quoteRes.data as Quote;
    const lines = ((linesRes.data ?? []) as QuoteLine[]).map(lineFromDB);

    setQuote(q);
    setProducts((productsRes.data as Product[]) ?? []);

    form.reset({
      quote_number: q.quote_number,
      issue_date: isoDate(q.issue_date),
      valid_until: isoDate(q.valid_until),
      status: q.status,
      customer_snapshot_name: q.customer_snapshot_name ?? '',
      contact_snapshot_name: q.contact_snapshot_name ?? '',
      contact_snapshot_phone: q.contact_snapshot_phone ?? '',
      contact_snapshot_email: q.contact_snapshot_email ?? '',
      lines,
      discount_amount: Number(q.discount_amount) || 0,
      rounding_amount: Number(q.rounding_amount) || 0,
      notes: q.notes ?? '',
      terms_text: q.terms_text ?? '',
    });

    setLoading(false);
  };

  useEffect(() => {
    if (open && quoteId) {
      loadData();
      setWasSaved(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, quoteId]);

  // Live totals (re-rendered via useWatch — independent of typed state)
  const watchedLines = useWatch({ control: form.control, name: 'lines' });
  const watchedDiscount = useWatch({ control: form.control, name: 'discount_amount' });
  const watchedRounding = useWatch({ control: form.control, name: 'rounding_amount' });

  const totals = useMemo(
    () =>
      calcQuoteTotals({
        lines: (watchedLines ?? []).map((l: any) => ({
          line_total_incl_vat: Number(l?.line_total_incl_vat) || 0,
        })),
        discount_amount: Number(watchedDiscount) || 0,
        rounding_amount: Number(watchedRounding) || 0,
      }),
    [watchedLines, watchedDiscount, watchedRounding],
  );

  // Persist the form to DB. Returns true on success so callers (PDF button) can
  // know whether to continue.
  const persist = async (data: QuoteFormValues): Promise<boolean> => {
    if (!quote) return false;
    setSaving(true);

    // Authoritative server-side math: recompute every line + totals using shared helpers
    const linesForDb = data.lines.map((line, idx) => {
      const math = calcLine({
        meetings_count: line.meetings_count,
        hours_per_meeting: line.hours_per_meeting,
        groups_count: line.groups_count,
        hourly_rate_incl_vat: line.hourly_rate_incl_vat,
      });
      const description = line.description_dirty && line.description_text.trim()
        ? line.description_text
        : buildDescription({
            grade_label: line.grade_label,
            class_label: line.class_label,
            meetings_count: line.meetings_count,
            groups_count: line.groups_count,
          });

      return {
        quote_id: quote.id,
        product_id: line.product_id,
        product_name_snapshot: line.product_name_snapshot || 'מוצר',
        grade_label: line.grade_label || null,
        class_label: line.class_label || null,
        description_text: description || null,
        meetings_count: line.meetings_count,
        hours_per_meeting: line.hours_per_meeting,
        groups_count: line.groups_count,
        total_hours: math.total_hours,
        hourly_rate_incl_vat: line.hourly_rate_incl_vat,
        line_total_incl_vat: math.line_total_incl_vat,
        internal_notes: line.internal_notes || null,
        external_product_name: line.product_name_snapshot || null,
        external_description: description || null,
        external_quantity: math.total_hours,
        external_price: math.line_total_incl_vat,
        sort_order: idx,
      };
    });

    const computedTotals = calcQuoteTotals({
      lines: linesForDb.map((l) => ({ line_total_incl_vat: l.line_total_incl_vat })),
      discount_amount: data.discount_amount,
      rounding_amount: data.rounding_amount,
    });

    // 1) update header
    const { error: updErr } = await supabase
      .from('quotes')
      .update({
        issue_date: data.issue_date || new Date().toISOString().slice(0, 10),
        valid_until: data.valid_until || null,
        status: data.status,
        subtotal_incl_vat: computedTotals.subtotal_incl_vat,
        discount_amount: data.discount_amount,
        rounding_amount: data.rounding_amount,
        total_incl_vat: computedTotals.total_incl_vat,
        notes: data.notes || null,
        terms_text: data.terms_text || null,
        updated_by: user?.id ?? null,
      })
      .eq('id', quote.id);

    if (updErr) {
      toast({ title: 'שגיאה בשמירת ההצעה', description: updErr.message, variant: 'destructive' });
      setSaving(false);
      return false;
    }

    // 2) replace lines (delete + insert)
    const { error: delErr } = await supabase.from('quote_lines').delete().eq('quote_id', quote.id);
    if (delErr) {
      toast({
        title: 'שגיאה במחיקת שורות ישנות',
        description: delErr.message + ' — נסה לשמור שוב.',
        variant: 'destructive',
      });
      setSaving(false);
      return false;
    }

    if (linesForDb.length > 0) {
      const { error: insErr } = await supabase.from('quote_lines').insert(linesForDb);
      if (insErr) {
        toast({
          title: 'שגיאה בשמירת שורות',
          description: insErr.message + ' — נסה לשמור שוב.',
          variant: 'destructive',
        });
        setSaving(false);
        return false;
      }
    }

    toast({ title: 'ההצעה נשמרה', description: data.quote_number });
    onSaved();
    setWasSaved(true);
    setSaving(false);

    // Reload to sync IDs / canonical values
    loadData();
    return true;
  };

  // Close handler: if the user opened a freshly-created quote and never saved
  // (no lines added, no PDF generated), delete the empty draft so it doesn't
  // pile up in the list as "Q-2026-XXXX  ₪0.00  טיוטה".
  const handleClose = async () => {
    if (isNew && !wasSaved && quote) {
      await supabase.from('quotes').delete().eq('id', quote.id);
      onSaved(); // refresh parent list so the empty row disappears
    }
    onOpenChange(false);
  };

  // form-submit handler wraps persist() so the existing "שמירה" button keeps working.
  const onSubmit = (data: QuoteFormValues) => persist(data);

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}>
      <DialogContent dir="rtl" className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>הצעת מחיר {form.watch('quote_number')}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="p-10 flex items-center justify-center text-gray-500">
            <Loader2 className="ms-2 h-5 w-5 animate-spin" /> טוען...
          </div>
        ) : (
          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Header — customer snapshot + meta */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 rounded-lg p-4 border">
                <div>
                  <Label className="text-xs">לקוח</Label>
                  <div className="font-semibold text-gray-900 mt-1">
                    {form.watch('customer_snapshot_name') || '—'}
                  </div>
                  <div className="text-sm text-gray-600 mt-2">
                    {form.watch('contact_snapshot_name') || '—'}
                    {form.watch('contact_snapshot_phone') && (
                      <div className="text-xs text-gray-500 mt-0.5" dir="ltr">
                        {form.watch('contact_snapshot_phone')}
                      </div>
                    )}
                    {form.watch('contact_snapshot_email') && (
                      <div className="text-xs text-gray-500" dir="ltr">
                        {form.watch('contact_snapshot_email')}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">תאריך הצעה</Label>
                    <Input
                      type="date"
                      dir="ltr"
                      value={form.watch('issue_date')}
                      onChange={(e) => form.setValue('issue_date', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">בתוקף עד</Label>
                    <Input
                      type="date"
                      dir="ltr"
                      value={form.watch('valid_until')}
                      onChange={(e) => form.setValue('valid_until', e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">סטטוס</Label>
                  <Select
                    value={form.watch('status')}
                    onValueChange={(v) => form.setValue('status', v as QuoteStatus)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(QUOTE_STATUS_LABELS) as QuoteStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>{QUOTE_STATUS_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Lines */}
              <QuoteLinesEditor products={products} />

              {/* Footer — totals + notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">הערות</Label>
                    <Textarea
                      rows={3}
                      value={form.watch('notes')}
                      onChange={(e) => form.setValue('notes', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">תנאים מסחריים</Label>
                    <Textarea
                      rows={3}
                      value={form.watch('terms_text')}
                      onChange={(e) => form.setValue('terms_text', e.target.value)}
                    />
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">סה"כ ביניים (כולל מע"מ):</span>
                    <span className="font-medium" dir="ltr">{formatILS(totals.subtotal_incl_vat)}</span>
                  </div>

                  <div className="flex justify-between items-center text-sm gap-2">
                    <Label className="text-xs whitespace-nowrap">הנחה:</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      dir="ltr"
                      className="h-8 text-xs w-32"
                      value={form.watch('discount_amount')}
                      onChange={(e) => form.setValue('discount_amount', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div className="flex justify-between items-center text-sm gap-2">
                    <Label className="text-xs whitespace-nowrap">עיגול:</Label>
                    <Input
                      type="number"
                      step="0.01"
                      dir="ltr"
                      className="h-8 text-xs w-32"
                      value={form.watch('rounding_amount')}
                      onChange={(e) => form.setValue('rounding_amount', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div className="border-t pt-3 flex justify-between items-center">
                    <span className="font-bold text-gray-900">סה"כ לתשלום:</span>
                    <span className="font-extrabold text-lg text-blue-600" dir="ltr">
                      {formatILS(totals.total_incl_vat)}
                    </span>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex flex-row gap-2 sm:justify-end">
                {quote && (
                  <QuotePdfButton
                    quoteId={quote.id}
                    quoteNumber={form.watch('quote_number')}
                    disabled={(watchedLines ?? []).length === 0}
                    beforeGenerate={async () => {
                      const isValid = await form.trigger();
                      if (!isValid) return false;
                      return await persist(form.getValues());
                    }}
                  />
                )}
                <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
                  <X className="ms-2 h-4 w-4" /> סגירה
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <Save className="ms-2 h-4 w-4" />}
                  שמירה
                </Button>
              </DialogFooter>
            </form>
          </FormProvider>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default QuoteEditorDialog;
