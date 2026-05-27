import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarRange, Filter, Loader2, Pencil, Search, X } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import {
  ORDER_SCHEDULING_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  type AcademicYearOrder,
  type AcademicYearOrderStatus,
  type AcademicYearOrderSchedulingStatus,
} from '@/types/academicYearOrders';
import { ACADEMIC_YEARS } from '@/lib/academicYearOrders/academic-years';
import { REGIONS, regionDef } from '@/lib/academicYearOrders/regions';
import AcademicYearOrderEditorSheet from '@/components/academicYearOrders/AcademicYearOrderEditorSheet';

const ALL = '__all__';

type OrderRow = AcademicYearOrder & {
  institution_name: string | null;
};

const statusBadgeVariant = (
  status: AcademicYearOrderStatus
): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (status) {
    case 'scheduled':
    case 'approved':
      return 'default';
    case 'scheduling':
    case 'pending_approval':
      return 'secondary';
    case 'cancelled':
      return 'destructive';
    default:
      return 'outline';
  }
};

const formatDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('he-IL') : '—';

const CRMAcademicOrders: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const role = user?.user_metadata?.role as string | undefined;
  const canEdit = role === 'admin' || role === 'pedagogical_manager';

  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [year, setYear] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [region, setRegion] = useState<string>(ALL);
  const [schedStatus, setSchedStatus] = useState<string>(ALL);
  const [search, setSearch] = useState<string>('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingInstitution, setEditingInstitution] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('academic_year_orders')
      .select('*, institution:educational_institutions(name)')
      .order('academic_year', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'שגיאה בטעינת הזמנות',
        description: error.message,
        variant: 'destructive',
      });
      setRows([]);
      setLoading(false);
      return;
    }

    const mapped: OrderRow[] = (data ?? []).map((r: any) => ({
      ...r,
      institution_name: r.institution?.name ?? null,
    }));
    setRows(mapped);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (year !== ALL && r.academic_year !== year) return false;
      if (status !== ALL && r.status !== status) return false;
      if (region !== ALL && (r.region ?? '') !== region) return false;
      if (schedStatus !== ALL && r.scheduling_status !== schedStatus) return false;
      if (q && !(r.institution_name ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, year, status, region, schedStatus, search]);

  const anyFilterActive =
    year !== ALL || status !== ALL || region !== ALL || schedStatus !== ALL || !!search;

  const resetFilters = () => {
    setYear(ALL);
    setStatus(ALL);
    setRegion(ALL);
    setSchedStatus(ALL);
    setSearch('');
  };

  const goToInstitution = (institutionId: string) => {
    navigate(`/crm/institution/${institutionId}?tab=academic-orders`);
  };

  const openEditor = (row: OrderRow, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) return;
    setEditingOrderId(row.id);
    setEditingInstitution({ id: row.institution_id, name: row.institution_name ?? '—' });
    setEditorOpen(true);
  };

  const handleEditorOpenChange = (open: boolean) => {
    setEditorOpen(open);
    if (!open) {
      setEditingOrderId(null);
      setEditingInstitution(null);
    }
  };

  return (
    <div dir="rtl" className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">הזמנות לשנה"ל</h1>
          <p className="text-sm text-gray-500 mt-1">
            תכנון שנתי של כל הלקוחות במקום אחד. ליצירה / עריכה — היכנס לכרטיס הלקוח.
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white border rounded-lg p-3 mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 me-2 text-gray-500 text-sm">
          <Filter className="h-4 w-4" />
          סינון
        </div>

        <div className="relative">
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש מוסד..."
            className="pe-8 w-56 text-sm"
          />
        </div>

        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-32 text-sm"><SelectValue placeholder="שנה" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>כל השנים</SelectItem>
            {ACADEMIC_YEARS.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36 text-sm"><SelectValue placeholder="סטטוס" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>כל הסטטוסים</SelectItem>
            {Object.entries(ORDER_STATUS_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger className="w-36 text-sm"><SelectValue placeholder="אזור" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>כל האזורים</SelectItem>
            {REGIONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.value}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={schedStatus} onValueChange={setSchedStatus}>
          <SelectTrigger className="w-36 text-sm"><SelectValue placeholder="מצב שיבוץ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>כל מצבי השיבוץ</SelectItem>
            {Object.entries(ORDER_SCHEDULING_STATUS_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {anyFilterActive && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="text-gray-500">
            <X className="ms-1 h-3.5 w-3.5" />
            נקה
          </Button>
        )}

        <div className="ms-auto text-xs text-gray-500">
          {loading ? '...' : `${filtered.length} מתוך ${rows.length}`}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-12 flex items-center justify-center text-gray-500 bg-white rounded-lg border">
          <Loader2 className="ms-2 h-4 w-4 animate-spin" />
          טוען...
        </div>
      ) : rows.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <NoResultsState onReset={resetFilters} />
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">מוסד</TableHead>
                <TableHead className="text-right">שנה"ל</TableHead>
                <TableHead className="text-right">סטטוס</TableHead>
                <TableHead className="text-right">קבוצות</TableHead>
                <TableHead className="text-right">תאריכים</TableHead>
                <TableHead className="text-right">עיר</TableHead>
                <TableHead className="text-right">אזור</TableHead>
                <TableHead className="text-right">מצב שיבוץ</TableHead>
                <TableHead className="text-right w-12">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const st = r.status as AcademicYearOrderStatus;
                const sch = r.scheduling_status as AcademicYearOrderSchedulingStatus;
                const reg = regionDef(r.region);
                return (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => goToInstitution(r.institution_id)}
                  >
                    <TableCell className="font-medium text-blue-600">
                      {r.institution_name ?? '—'}
                    </TableCell>
                    <TableCell>{r.academic_year}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(st)}>{ORDER_STATUS_LABELS[st]}</Badge>
                    </TableCell>
                    <TableCell>{r.groups_count_planned ?? '—'}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {formatDate(r.requested_start_date)} – {formatDate(r.requested_end_date)}
                    </TableCell>
                    <TableCell>{r.city ?? '—'}</TableCell>
                    <TableCell>
                      {r.region ? (
                        <Badge variant="outline" className={reg?.badgeClass}>{r.region}</Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ORDER_SCHEDULING_STATUS_LABELS[sch] ?? sch}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => openEditor(r, e)}
                          title="עריכה"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {editingInstitution && (
        <AcademicYearOrderEditorSheet
          institutionId={editingInstitution.id}
          institutionName={editingInstitution.name}
          orderId={editingOrderId}
          open={editorOpen}
          onOpenChange={handleEditorOpenChange}
          onSaved={() => fetchOrders()}
        />
      )}
    </div>
  );
};

const EmptyState: React.FC = () => (
  <div className="p-12 text-center bg-white rounded-lg border">
    <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 mb-4">
      <CalendarRange className="h-7 w-7 text-blue-600" />
    </div>
    <h4 className="text-base font-semibold text-gray-900 mb-1">אין עדיין הזמנות לשנה"ל</h4>
    <p className="text-sm text-gray-500 max-w-md mx-auto">
      כל הזמנה נוצרת מתוך כרטיס הלקוח. לחץ על לקוח בלשונית "לקוחות" או "לידים", פתח את הטאב
      "הזמנות לשנה"ל" בכרטיס שלו, וצור הזמנה ראשונה.
    </p>
  </div>
);

const NoResultsState: React.FC<{ onReset: () => void }> = ({ onReset }) => (
  <div className="p-12 text-center bg-white rounded-lg border">
    <h4 className="text-base font-semibold text-gray-900 mb-1">לא נמצאו הזמנות מתאימות</h4>
    <p className="text-sm text-gray-500 mb-4">נסה להסיר חלק מהפילטרים.</p>
    <Button variant="outline" size="sm" onClick={onReset}>
      נקה פילטרים
    </Button>
  </div>
);

export default CRMAcademicOrders;
