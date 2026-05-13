import React, { useEffect, useState } from 'react';
import { Plus, Edit, Copy, FileText, Trash2, Loader2 } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import QuoteEditorDialog from './QuoteEditorDialog';
import { formatILS } from '@/lib/quotes/money';
import { QUOTE_STATUS_LABELS } from '@/types/quotes';
import type { Quote } from '@/types/quotes';

interface InstitutionContact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  is_primary: boolean | null;
}

interface InstitutionQuotesTabProps {
  institutionId: string;
  institutionName: string;
  contacts: InstitutionContact[];
  // External "create new quote" trigger — when the number increases, the tab fires handleCreate.
  // Used by the top action bar in CRMInstitution so the same flow works from both places.
  createTrigger?: number;
}

const statusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (status) {
    case 'approved': return 'default';
    case 'sent': case 'ready': return 'secondary';
    case 'cancelled': return 'destructive';
    default: return 'outline';
  }
};

const InstitutionQuotesTab: React.FC<InstitutionQuotesTabProps> = ({
  institutionId,
  institutionName,
  contacts,
  createTrigger,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const role = user?.user_metadata?.role;
  const canEdit = ['admin', 'pedagogical_manager', 'sales_rep'].includes(role);

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  // Tracks whether the editor is currently working on a brand-new draft.
  // When it is, closing the editor without saving will auto-delete the empty quote.
  const [editorIsNew, setEditorIsNew] = useState(false);

  const fetchQuotes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('institution_id', institutionId)
      .order('issue_date', { ascending: false });

    if (error) {
      toast({ title: 'שגיאה בטעינת ההצעות', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }
    setQuotes((data as Quote[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchQuotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institutionId]);

  // External create trigger (from CRMInstitution top bar).
  // Only fires when createTrigger is truthy and changes — not on initial mount with 0/undefined.
  const lastTriggerRef = React.useRef<number | undefined>(undefined);
  useEffect(() => {
    if (typeof createTrigger !== 'number' || createTrigger === 0) return;
    if (lastTriggerRef.current === createTrigger) return;
    lastTriggerRef.current = createTrigger;
    handleCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createTrigger]);

  const primaryContact = contacts.find((c) => c.is_primary) ?? contacts[0] ?? null;

  const handleCreate = async () => {
    if (!canEdit) return;
    setCreating(true);
    try {
      const { data: numData, error: numErr } = await supabase.rpc('allocate_quote_number');
      if (numErr || !numData) {
        toast({ title: 'שגיאה ביצירת מספר הצעה', description: numErr?.message, variant: 'destructive' });
        return;
      }

      const payload = {
        institution_id: institutionId,
        quote_number: numData as string,
        customer_snapshot_name: institutionName,
        contact_snapshot_name: primaryContact?.name ?? null,
        contact_snapshot_phone: primaryContact?.phone ?? null,
        contact_snapshot_email: primaryContact?.email ?? null,
        status: 'draft',
        created_by: user?.id ?? null,
        updated_by: user?.id ?? null,
      };

      const { data: inserted, error: insErr } = await supabase
        .from('quotes')
        .insert(payload)
        .select('id')
        .single();

      if (insErr || !inserted) {
        toast({ title: 'שגיאה ביצירת הצעה', description: insErr?.message, variant: 'destructive' });
        return;
      }

      setEditingId((inserted as { id: string }).id);
      setEditorIsNew(true);
      setEditorOpen(true);
      fetchQuotes();
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = (q: Quote) => {
    setEditingId(q.id);
    setEditorIsNew(false);
    setEditorOpen(true);
  };

  const handleDuplicate = async (q: Quote) => {
    if (!canEdit) return;

    const { data: numData, error: numErr } = await supabase.rpc('allocate_quote_number');
    if (numErr || !numData) {
      toast({ title: 'שגיאה במספור', description: numErr?.message, variant: 'destructive' });
      return;
    }

    const { data: lines, error: linesErr } = await supabase
      .from('quote_lines')
      .select('*')
      .eq('quote_id', q.id)
      .order('sort_order', { ascending: true });

    if (linesErr) {
      toast({ title: 'שגיאה בטעינת שורות לשכפול', description: linesErr.message, variant: 'destructive' });
      return;
    }

    const { data: newQuote, error: insErr } = await supabase
      .from('quotes')
      .insert({
        institution_id: q.institution_id,
        quote_number: numData as string,
        customer_snapshot_name: q.customer_snapshot_name,
        contact_snapshot_name: q.contact_snapshot_name,
        contact_snapshot_phone: q.contact_snapshot_phone,
        contact_snapshot_email: q.contact_snapshot_email,
        subtotal_incl_vat: q.subtotal_incl_vat,
        discount_amount: q.discount_amount,
        rounding_amount: q.rounding_amount,
        total_incl_vat: q.total_incl_vat,
        notes: q.notes,
        terms_text: q.terms_text,
        status: 'draft',
        created_by: user?.id ?? null,
        updated_by: user?.id ?? null,
      })
      .select('id')
      .single();

    if (insErr || !newQuote) {
      toast({ title: 'שגיאה בשכפול', description: insErr?.message, variant: 'destructive' });
      return;
    }

    const newQuoteId = (newQuote as { id: string }).id;

    if (lines && lines.length > 0) {
      const linePayload = lines.map((l: any) => ({
        quote_id: newQuoteId,
        product_id: l.product_id,
        product_name_snapshot: l.product_name_snapshot,
        grade_label: l.grade_label,
        class_label: l.class_label,
        description_text: l.description_text,
        meetings_count: l.meetings_count,
        hours_per_meeting: l.hours_per_meeting,
        groups_count: l.groups_count,
        total_hours: l.total_hours,
        hourly_rate_incl_vat: l.hourly_rate_incl_vat,
        line_total_incl_vat: l.line_total_incl_vat,
        internal_notes: l.internal_notes,
        external_product_name: l.external_product_name,
        external_description: l.external_description,
        external_quantity: l.external_quantity,
        external_price: l.external_price,
        sort_order: l.sort_order,
      }));
      const { error: linesInsErr } = await supabase.from('quote_lines').insert(linePayload);
      if (linesInsErr) {
        toast({ title: 'שגיאה בהעתקת שורות', description: linesInsErr.message, variant: 'destructive' });
      }
    }

    toast({ title: 'ההצעה שוכפלה', description: numData as string });
    fetchQuotes();
  };

  const handleDelete = async (q: Quote) => {
    if (!canEdit) return;
    if (!window.confirm(`למחוק את הצעה ${q.quote_number}?`)) return;

    const { error } = await supabase.from('quotes').delete().eq('id', q.id);
    if (error) {
      toast({ title: 'שגיאה במחיקה', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'ההצעה נמחקה' });
    fetchQuotes();
  };

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">הצעות מחיר</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            כל ההצעות שיצרת ללקוח זה. {quotes.length > 0 && `סה"כ: ${quotes.length}`}
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <Plus className="ms-2 h-4 w-4" />}
            הצעה חדשה
          </Button>
        )}
      </div>

      {loading ? (
        <div className="p-10 flex items-center justify-center text-gray-500">
          <Loader2 className="ms-2 h-4 w-4 animate-spin" /> טוען...
        </div>
      ) : quotes.length === 0 ? (
        <div className="p-10 text-center text-gray-500 bg-white rounded-lg border">
          אין הצעות מחיר ללקוח זה.{canEdit && ' לחץ "הצעה חדשה" כדי להתחיל.'}
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">מספר</TableHead>
                <TableHead className="text-right">תאריך</TableHead>
                <TableHead className="text-right">תוקף</TableHead>
                <TableHead className="text-right">סטטוס</TableHead>
                <TableHead className="text-right">סה"כ כולל מע"מ</TableHead>
                <TableHead className="text-right">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-mono font-medium">{q.quote_number}</TableCell>
                  <TableCell>{new Date(q.issue_date).toLocaleDateString('he-IL')}</TableCell>
                  <TableCell>
                    {q.valid_until ? new Date(q.valid_until).toLocaleDateString('he-IL') : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(q.status)}>
                      {QUOTE_STATUS_LABELS[q.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatILS(q.total_incl_vat)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(q)} title="עריכה">
                        <Edit className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => handleDuplicate(q)} title="שכפול">
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(q)} title="מחיקה">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {editingId && (
        <QuoteEditorDialog
          quoteId={editingId}
          open={editorOpen}
          isNew={editorIsNew}
          onOpenChange={(o) => {
            setEditorOpen(o);
            if (!o) {
              setEditingId(null);
              setEditorIsNew(false);
            }
          }}
          onSaved={fetchQuotes}
        />
      )}
    </div>
  );
};

export default InstitutionQuotesTab;
