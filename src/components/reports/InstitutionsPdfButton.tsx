import React, { useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { FileText, Loader2 } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { loadCompanyInfo } from '@/lib/quotes/company-info';

import InstitutionsPdfDocument from './InstitutionsPdfDocument';

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

interface InstitutionsPdfButtonProps {
  institutionData: InstitutionRow[];
  selectedMonth: string;
  disabled?: boolean;
}

const InstitutionsPdfButton: React.FC<InstitutionsPdfButtonProps> = ({
  institutionData,
  selectedMonth,
  disabled,
}) => {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);

  const handleClick = async () => {
    setGenerating(true);
    let logoUrl: string | null = null;
    try {
      const companyInfo = await loadCompanyInfo();
      logoUrl = companyInfo.logoUrl ?? null;
    } catch {
      logoUrl = null;
    }
    try {
      const blob = await pdf(
        <InstitutionsPdfDocument
          institutionData={institutionData}
          selectedMonth={selectedMonth}
          logoUrl={logoUrl ?? undefined}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = selectedMonth.replace(/\s+/g, '-');
      a.download = `institutions-report-${safeName}.pdf`;
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

export default InstitutionsPdfButton;
