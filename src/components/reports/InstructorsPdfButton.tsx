import React, { useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { FileText, Loader2 } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { loadCompanyInfo } from '@/lib/quotes/company-info';

import InstructorsPdfDocument from './InstructorsPdfDocument';

interface InstructorRow {
  id: string;
  full_name: string;
  total_lessons: number;
  total_hours: number;
  total_salary: number;
}

interface InstructorsPdfButtonProps {
  instructorData: InstructorRow[];
  selectedMonth: string;
  disabled?: boolean;
}

const InstructorsPdfButton: React.FC<InstructorsPdfButtonProps> = ({
  instructorData,
  selectedMonth,
  disabled,
}) => {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);

  const handleClick = async () => {
    setGenerating(true);
    try {
      const companyInfo = await loadCompanyInfo();
      const blob = await pdf(
        <InstructorsPdfDocument
          instructorData={instructorData}
          selectedMonth={selectedMonth}
          logoUrl={companyInfo.logoUrl}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = selectedMonth.replace(/\s+/g, '-');
      a.download = `instructors-report-${safeName}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 100);
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
      ייצוא PDF ⬇
    </Button>
  );
};

export default InstructorsPdfButton;
