import React, { useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { FileText, Loader2 } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { loadCompanyInfo } from '@/lib/quotes/company-info';

import SalaryPdfDocument from './SalaryPdfDocument';

interface SalaryRow {
  instructor_id: string;
  full_name: string;
  report_count: number;
  lesson_count: number;
  total_pay: number;
}

interface SalaryPdfButtonProps {
  salaryData: SalaryRow[];
  selectedMonth: string;
  disabled?: boolean;
}

const SalaryPdfButton: React.FC<SalaryPdfButtonProps> = ({ salaryData, selectedMonth, disabled }) => {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);

  const handleClick = async () => {
    setGenerating(true);
    try {
      const companyInfo = await loadCompanyInfo();
      const blob = await pdf(
        <SalaryPdfDocument
          salaryData={salaryData}
          selectedMonth={selectedMonth}
          logoUrl={companyInfo.logoUrl}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = selectedMonth.replace(/\s+/g, '-');
      a.download = `salary-report-${safeName}.pdf`;
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
      ייצוא PDF
    </Button>
  );
};

export default SalaryPdfButton;
