import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';

import { exclFromIncl, formatILS } from '@/lib/quotes/money';
import type { Product } from '@/types/products';

// URL validator that accepts empty string or a valid http(s) URL.
const urlOptional = z
  .string()
  .trim()
  .refine(
    (v) => v === '' || /^https?:\/\/.+/.test(v),
    'יש להזין כתובת URL תקינה (מתחילה ב־http או https)',
  )
  .optional()
  .or(z.literal(''));

const productSchema = z.object({
  name: z.string().min(1, 'שם המוצר הוא שדה חובה'),
  short_description: z.string().optional().or(z.literal('')),
  price_incl_vat: z
    .number({ invalid_type_error: 'יש להזין מחיר תקין' })
    .min(0, 'המחיר חייב להיות 0 ומעלה'),
  vat_rate: z
    .number({ invalid_type_error: 'יש להזין אחוז מע"מ תקין' })
    .min(0, 'מע"מ חייב להיות 0 ומעלה')
    .max(100, 'מע"מ לא יכול לעבור 100%'),
  website_url: urlOptional,
  syllabus_url: urlOptional,
  internal_notes: z.string().optional().or(z.literal('')),
  status: z.enum(['active', 'inactive']),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  defaultVatRate: number;
  onSaved: () => void;
}

const emptyDefaults = (defaultVatRate: number): ProductFormData => ({
  name: '',
  short_description: '',
  price_incl_vat: 0,
  vat_rate: defaultVatRate,
  website_url: '',
  syllabus_url: '',
  internal_notes: '',
  status: 'active',
});

const ProductForm: React.FC<ProductFormProps> = ({
  open,
  onOpenChange,
  product,
  defaultVatRate,
  onSaved,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: emptyDefaults(defaultVatRate),
  });

  useEffect(() => {
    if (!open) return;
    if (product) {
      form.reset({
        name: product.name,
        short_description: product.short_description ?? '',
        price_incl_vat: Number(product.price_incl_vat),
        vat_rate: Number(product.vat_rate),
        website_url: product.website_url ?? '',
        syllabus_url: product.syllabus_url ?? '',
        internal_notes: product.internal_notes ?? '',
        status: product.status,
      });
    } else {
      form.reset(emptyDefaults(defaultVatRate));
    }
  }, [open, product, defaultVatRate, form]);

  const priceIncl = form.watch('price_incl_vat');
  const vatRate = form.watch('vat_rate');
  const priceExclPreview = exclFromIncl(Number(priceIncl) || 0, Number(vatRate) || 0);

  const onSubmit = async (data: ProductFormData) => {
    const payload = {
      name: data.name.trim(),
      short_description: data.short_description?.trim() || null,
      price_incl_vat: Number(data.price_incl_vat),
      vat_rate: Number(data.vat_rate),
      price_excl_vat: exclFromIncl(Number(data.price_incl_vat), Number(data.vat_rate)),
      website_url: data.website_url?.trim() || null,
      syllabus_url: data.syllabus_url?.trim() || null,
      internal_notes: data.internal_notes?.trim() || null,
      status: data.status,
      updated_by: user?.id ?? null,
    };

    const isEdit = !!product?.id;

    const { error } = isEdit
      ? await supabase.from('products').update(payload).eq('id', product!.id)
      : await supabase
          .from('products')
          .insert({ ...payload, created_by: user?.id ?? null });

    if (error) {
      toast({
        title: 'שגיאה בשמירת המוצר',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: isEdit ? 'המוצר עודכן' : 'המוצר נוצר',
      description: payload.name,
    });

    onSaved();
    onOpenChange(false);
  };

  const submitting = form.formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{product ? 'עריכת מוצר' : 'מוצר חדש'}</DialogTitle>
          <DialogDescription>
            המחיר העיקרי הוא <strong>כולל מע"מ</strong>. המחיר ללא מע"מ נגזר אוטומטית.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם המוצר *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="לדוגמה: Creators AI" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="short_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>תיאור קצר</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} placeholder="תיאור פנימי קצר של המוצר" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price_incl_vat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>מחיר כולל מע"מ *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        dir="ltr"
                        value={field.value}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      ללא מע"מ: {formatILS(priceExclPreview)}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vat_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>אחוז מע"מ *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        max={100}
                        dir="ltr"
                        value={field.value}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="website_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>קישור לעמוד מוצר</FormLabel>
                    <FormControl>
                      <Input {...field} dir="ltr" placeholder="https://..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="syllabus_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>קישור לסילבוס</FormLabel>
                    <FormControl>
                      <Input {...field} dir="ltr" placeholder="https://..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>סטטוס</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">פעיל</SelectItem>
                      <SelectItem value="inactive">לא פעיל</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="internal_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>הערות פנימיות</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                ביטול
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
                {product ? 'שמירה' : 'יצירה'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ProductForm;
