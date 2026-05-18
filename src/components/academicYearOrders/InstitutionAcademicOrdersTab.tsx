import React, { useEffect, useState } from 'react';
import { CalendarRange, Loader2, Plus, Trash2, Users } from 'lucide-react';

import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
} from '@/types/academicYearOrders';
import { regionDef } from '@/lib/academicYearOrders/regions';
import { deleteOrder, listOrdersByInstitution } from '@/lib/academicYearOrders/api';

interface InstitutionAcademicOrdersTabProps {
  institutionId: string;
  institutionName: string;
}

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
    case 'archived':
    case 'draft':
    default:
      return 'outline';
  }
};

const formatDate = (iso: string | null): string => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('he-IL');
};

const InstitutionAcademicOrdersTab: React.FC<InstitutionAcademicOrdersTabProps> = ({
  institutionId,
  institutionName,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const role = user?.user_metadata?.role as string | undefined;
  const canEdit = role === 'admin' || role === 'pedagogical_manager';

  const [orders, setOrders] = useState<AcademicYearOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const rows = await listOrdersByInstitution(institutionId);
      setOrders(rows);
    } catch (e) {
      const err = e as { message?: string };
      toast({
        title: 'שגיאה בטעינת הזמנות',
        description: err.message ?? 'נסה שוב',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institutionId]);

  const handleCreate = () => {
    // Editor dialog comes in Phase 4. For now, surface a clear notice.
    toast({
      title: 'יצירת הזמנה תתאפשר בקרוב',
      description: 'הטופס יושק בשלב הבא של המודול.',
    });
  };

  const handleDelete = async (order: AcademicYearOrder) => {
    if (!canEdit) return;
    const label = `${order.academic_year} (${ORDER_STATUS_LABELS[order.status as AcademicYearOrderStatus]})`;
    if (!window.confirm(`למחוק את ההזמנה ${label}?`)) return;
    try {
      await deleteOrder(order.id);
      toast({ title: 'ההזמנה נמחקה' });
      fetchOrders();
    } catch (e) {
      const err = e as { message?: string };
      toast({ title: 'שגיאה במחיקה', description: err.message ?? 'נסה שוב', variant: 'destructive' });
    }
  };

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">הזמנות לשנה"ל</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            תכנון שנתי של פעילויות עבור {institutionName}.
            {orders.length > 0 && ` סה"כ: ${orders.length}`}
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleCreate}>
            <Plus className="ms-2 h-4 w-4" />
            הזמנה חדשה
          </Button>
        )}
      </div>

      {loading ? (
        <div className="p-10 flex items-center justify-center text-gray-500">
          <Loader2 className="ms-2 h-4 w-4 animate-spin" />
          טוען...
        </div>
      ) : orders.length === 0 ? (
        <EmptyState canEdit={canEdit} onCreate={handleCreate} />
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">שנה"ל</TableHead>
                <TableHead className="text-right">סטטוס</TableHead>
                <TableHead className="text-right">קבוצות מתוכננות</TableHead>
                <TableHead className="text-right">תאריכי בקשה</TableHead>
                <TableHead className="text-right">אזור</TableHead>
                <TableHead className="text-right">מצב שיבוץ</TableHead>
                <TableHead className="text-right">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const status = order.status as AcademicYearOrderStatus;
                const schedStatus =
                  order.scheduling_status as keyof typeof ORDER_SCHEDULING_STATUS_LABELS;
                const region = regionDef(order.region);
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.academic_year}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(status)}>
                        {ORDER_STATUS_LABELS[status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{order.groups_count_planned ?? '—'}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {formatDate(order.requested_start_date)} – {formatDate(order.requested_end_date)}
                    </TableCell>
                    <TableCell>
                      {order.region ? (
                        <Badge variant="outline" className={region?.badgeClass}>
                          {order.region}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ORDER_SCHEDULING_STATUS_LABELS[schedStatus] ?? schedStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(order)}
                          title="מחיקה"
                        >
                          <Trash2 className="h-4 w-4" />
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
    </div>
  );
};

const EmptyState: React.FC<{ canEdit: boolean; onCreate: () => void }> = ({ canEdit, onCreate }) => (
  <div className="p-12 text-center bg-white rounded-lg border">
    <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 mb-4">
      <CalendarRange className="h-7 w-7 text-blue-600" />
    </div>
    <h4 className="text-base font-semibold text-gray-900 mb-1">
      אין עדיין הזמנות לשנה"ל
    </h4>
    <p className="text-sm text-gray-500 max-w-md mx-auto mb-5">
      כאן תוכלו לתכנן את הפעילות השנתית של הלקוח: מספר קבוצות, שכבות גיל, ימים ושעות מבוקשים,
      מדריך מועדף ועוד.
    </p>
    {canEdit ? (
      <Button onClick={onCreate}>
        <Plus className="ms-2 h-4 w-4" />
        צור הזמנה לשנה"ל
      </Button>
    ) : (
      <p className="text-xs text-gray-400 inline-flex items-center gap-1">
        <Users className="h-3.5 w-3.5" />
        יצירת הזמנות מתאפשרת רק לאדמין ולמנהל פדגוגי
      </p>
    )}
  </div>
);

export default InstitutionAcademicOrdersTab;
