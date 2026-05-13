import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, ExternalLink, Edit, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pagination } from '@/components/ui/Pagination';

import ProductForm from '@/components/products/ProductForm';
import type { Product, ProductStatus } from '@/types/products';
import { formatILS } from '@/lib/quotes/money';

const PAGE_SIZE = 8;

type StatusFilter = ProductStatus | 'all';

const Products: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const role = user?.user_metadata?.role;
  const canEdit = ['admin', 'pedagogical_manager'].includes(role);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [defaultVatRate, setDefaultVatRate] = useState<number>(18);

  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const fetchDefaultVat = async () => {
    const { data } = await supabase
      .from('crm_settings')
      .select('value')
      .eq('key', 'default_vat_rate')
      .maybeSingle();
    const parsed = Number(data?.value);
    if (!isNaN(parsed) && parsed >= 0) setDefaultVatRate(parsed);
  };

  const fetchProducts = async () => {
    setLoading(true);

    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('products')
      .select(
        'id, name, short_description, price_excl_vat, vat_rate, price_incl_vat, website_url, syllabus_url, sort_order, internal_notes, status, created_at, updated_at, created_by, updated_by',
        { count: 'exact' },
      )
      .order('updated_at', { ascending: false });

    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (search.trim()) query = query.ilike('name', `%${search.trim()}%`);

    const { data, count, error } = await query.range(from, to);

    if (error) {
      toast({ title: 'שגיאה בטעינת מוצרים', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    setProducts((data as Product[]) ?? []);
    setTotalCount(count ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    fetchDefaultVat();
  }, []);

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, statusFilter]);

  // debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      setCurrentPage(0);
      fetchProducts();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const totalPages = useMemo(() => Math.ceil(totalCount / PAGE_SIZE), [totalCount]);

  const handleToggleStatus = async (product: Product) => {
    if (!canEdit) return;
    const next: ProductStatus = product.status === 'active' ? 'inactive' : 'active';
    const { error } = await supabase
      .from('products')
      .update({ status: next, updated_by: user?.id ?? null })
      .eq('id', product.id);

    if (error) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
      return;
    }
    toast({
      title: next === 'active' ? 'המוצר הופעל' : 'המוצר הושבת',
      description: product.name,
    });
    fetchProducts();
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setFormOpen(true);
  };

  return (
    <div dir="rtl" className="max-w-7xl mx-auto p-4 md:p-6">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">קטלוג מוצרים</h1>
          <p className="text-sm text-gray-500 mt-1">
            מקור אמת למוצרים ומחירים שמופיעים בהצעות מחיר.
          </p>
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="ms-2 h-4 w-4" /> מוצר חדש
          </Button>
        )}
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">סינון</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש לפי שם..."
              className="pr-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as StatusFilter); setCurrentPage(0); }}>
            <SelectTrigger className="md:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הסטטוסים</SelectItem>
              <SelectItem value="active">פעיל</SelectItem>
              <SelectItem value="inactive">לא פעיל</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-10 flex items-center justify-center text-gray-500">
              <Loader2 className="ms-2 h-4 w-4 animate-spin" /> טוען...
            </div>
          ) : products.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              אין מוצרים להצגה. {canEdit && 'התחל ביצירת מוצר חדש.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">שם</TableHead>
                  <TableHead className="text-right">מחיר כולל מע"מ</TableHead>
                  <TableHead className="text-right">מע"מ</TableHead>
                  <TableHead className="text-right">סטטוס</TableHead>
                  <TableHead className="text-right">קישורים</TableHead>
                  <TableHead className="text-right">עדכון אחרון</TableHead>
                  <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.name}
                      {p.short_description && (
                        <div className="text-xs text-gray-500 mt-0.5">{p.short_description}</div>
                      )}
                    </TableCell>
                    <TableCell>{formatILS(p.price_incl_vat)}</TableCell>
                    <TableCell>{Number(p.vat_rate).toFixed(0)}%</TableCell>
                    <TableCell>
                      <Badge variant={p.status === 'active' ? 'default' : 'secondary'}>
                        {p.status === 'active' ? 'פעיל' : 'לא פעיל'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {p.website_url && (
                          <a
                            href={p.website_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline inline-flex items-center"
                            title="עמוד מוצר"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                        {p.syllabus_url && (
                          <a
                            href={p.syllabus_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-600 hover:underline inline-flex items-center"
                            title="סילבוס"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(p.updated_at).toLocaleDateString('he-IL')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {canEdit && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => openEdit(p)} title="עריכה">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleStatus(p)}
                              title={p.status === 'active' ? 'השבתה' : 'הפעלה'}
                            >
                              {p.status === 'active' ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="mt-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalCount}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      <ProductForm
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editing}
        defaultVatRate={defaultVatRate}
        onSaved={fetchProducts}
      />
    </div>
  );
};

export default Products;
