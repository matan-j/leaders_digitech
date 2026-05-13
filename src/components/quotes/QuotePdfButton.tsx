import React, { useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { FileText, Loader2 } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';

import QuotePdfDocument from './QuotePdfDocument';
import type { Quote, QuoteLine } from '@/types/quotes';
import { loadCompanyInfo } from '@/lib/quotes/company-info';

interface QuotePdfButtonProps {
  quoteId: string;
  quoteNumber: string;
  disabled?: boolean;
  // If provided, runs before fetching DB state — caller uses this to flush
  // unsaved form changes (the PDF reads from DB, not from React state).
  // Return false to abort PDF generation (e.g. validation failed).
  beforeGenerate?: () => Promise<boolean>;
}

// Generate the PDF on-demand from the latest persisted DB state.
// We render via `pdf()` (not <PDFDownloadLink>) so the click always reflects
// what's saved in the database, not the in-flight form state.
const QuotePdfButton: React.FC<QuotePdfButtonProps> = ({
  quoteId,
  quoteNumber,
  disabled,
  beforeGenerate,
}) => {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);

  const handleClick = async () => {
    setGenerating(true);
    try {
      // Auto-save unsaved form state before reading from DB.
      if (beforeGenerate) {
        const ok = await beforeGenerate();
        if (!ok) return;
      }

      const [quoteRes, linesRes, companyInfo] = await Promise.all([
        supabase.from('quotes').select('*').eq('id', quoteId).single(),
        supabase
          .from('quote_lines')
          .select('*')
          .eq('quote_id', quoteId)
          .order('sort_order', { ascending: true }),
        loadCompanyInfo(),
      ]);

      if (quoteRes.error || !quoteRes.data) {
        toast({ title: 'שגיאה בטעינת ההצעה', description: quoteRes.error?.message, variant: 'destructive' });
        return;
      }

      const quote = quoteRes.data as Quote;
      const lines = (linesRes.data as QuoteLine[]) ?? [];

      if (lines.length === 0) {
        toast({ title: 'הצעה ריקה', description: 'הוסף לפחות שורה אחת לפני יצירת PDF.', variant: 'destructive' });
        return;
      }

      const blob = await pdf(<QuotePdfDocument quote={quote} lines={lines} companyInfo={companyInfo} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${quoteNumber || 'quote'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({
        title: 'שגיאה ביצירת PDF',
        description: e?.message || 'נסה שוב מאוחר יותר',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button type="button" variant="secondary" onClick={handleClick} disabled={disabled || generating}>
      {generating ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <FileText className="ms-2 h-4 w-4" />}
      הורד PDF
    </Button>
  );
};

export default QuotePdfButton;
